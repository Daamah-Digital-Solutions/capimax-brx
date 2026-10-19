"""
Pledge the units of Nova Sukuk purchases settled before pledges existed (idempotent).

  python manage.py backfill_nova_pledges --dry-run
  python manage.py backfill_nova_pledges

Only units still free in the holder's position can be locked; anything short is reported so
it can be followed up with Nova Finance.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.investments.models import Investment, PaymentStatus
from apps.payments.models import NovaPledge
from apps.wallets.models import OwnershipToken


class Command(BaseCommand):
    help = "Create the Nova pledge for already-settled Nova Sukuk purchases."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        done = 0
        todo = Investment.objects.filter(
            payment_method="sukuk", payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
        ).exclude(pk__in=NovaPledge.objects.values("investment_id")).select_related("property", "installment_plan")
        for inv in todo:
            units = int(inv.token_amount)
            if inv.is_installment and inv.installment_plan_id:
                plan = inv.installment_plan
                units = int(units * float(inv.charge_amount) / float(plan.total_amount)) if plan.total_amount else 0
            with transaction.atomic():
                token = (
                    OwnershipToken.objects.select_for_update()
                    .filter(wallet_id=inv.wallet_id, property_id=inv.property.slug).first()
                )
                free = token.available_amount if token else 0
                lock = min(units, free)
                self.stdout.write(
                    f"{inv.pk} {inv.property.slug}: pledge {lock}/{units} unit(s)"
                    + ("" if lock == units else f" — only {free} free, follow up with Nova")
                )
                if opts["dry_run"] or lock <= 0:
                    continue
                token.locked_amount = int(token.locked_amount) + lock
                token.save(update_fields=["locked_amount", "updated_at"])
                NovaPledge.objects.create(
                    investment=inv, wallet_id=inv.wallet_id, property_slug=inv.property.slug, units=lock,
                )
                done += 1
        self.stdout.write(f"backfill_nova_pledges: {done} pledge(s) created.")
