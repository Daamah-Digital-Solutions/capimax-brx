"""
Issue the ownership certificate for every confirmed holding that has none — units received
by a secondary / LP market purchase, a transfer or a gift never got one before — and bring
every certificate's status up to date. Idempotent; sends no notifications (past events).

    python manage.py issue_missing_certificates [--dry-run]
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.certificates.models import Certificate
from apps.certificates.services import sync_certificate
from apps.investments.models import Investment, PaymentStatus


class Command(BaseCommand):
    help = "Issue missing ownership certificates for confirmed holdings (no notifications)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only count what would be issued.")

    def handle(self, *args, dry_run=False, **options):
        paid = Investment.objects.filter(payment_status=PaymentStatus.COMPLETED, tokens_minted=True)
        missing = paid.exclude(pk__in=Certificate.objects.exclude(investment=None).values("investment_id"))
        self.stdout.write(f"confirmed holdings without a certificate: {missing.count()}")
        if dry_run:
            return
        issued = 0
        for inv in missing.select_related("property", "user"):
            with transaction.atomic():
                if sync_certificate(inv, notify_holder=False) is not None:
                    issued += 1
        self.stdout.write(self.style.SUCCESS(f"issued: {issued}"))
