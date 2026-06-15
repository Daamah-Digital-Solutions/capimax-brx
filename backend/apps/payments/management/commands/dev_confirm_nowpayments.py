"""
DEV-ONLY NOW Payments confirmation — Phase 5 Wave 2 testing aid (mirrors
dev_confirm_payment). Production completion is STRICTLY the signature-verified IPN.

Drives the SAME `process_successful_nowpayments` service the real IPN calls, so a dev
confirm completes the crypto payment and mints exactly like production — proving the
crypto invest→pay→IPN→mint cycle BEFORE NOW Payments keys exist.

SAFETY:
  * Refuses to run unless DEBUG=True.
  * Clearly labelled DEV-ONLY; no real money moves (simulates the provider signal).

    python manage.py dev_confirm_nowpayments --investment <investment_id>
    python manage.py dev_confirm_nowpayments --investment <investment_id> --fail
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.investments.models import Investment
from apps.payments.models import Payment
from apps.payments.services import (
    get_or_create_payment,
    mark_nowpayments_failed,
    process_successful_nowpayments,
)


class Command(BaseCommand):
    help = (
        "DEV-ONLY: simulate a NOW Payments finished/failed IPN for an investment to "
        "drive the IPN-gated completion+mint. Requires DEBUG=True."
    )

    def add_arguments(self, parser):
        parser.add_argument("--investment", help="Investment id to confirm a crypto payment for.")
        parser.add_argument("--payment-id", help="Existing NOW Payments payment_id.")
        parser.add_argument("--fail", action="store_true", help="Simulate a failed payment.")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY IPN-simulate aid; "
                "production completion is the signed NOW Payments IPN only."
            )

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] NOW Payments IPN simulate -- never in production.")
        )

        pid = options.get("payment_id")
        if not pid:
            inv_id = options.get("investment")
            if not inv_id:
                raise CommandError("Provide --investment <id> or --payment-id <id>.")
            try:
                investment = Investment.objects.get(pk=inv_id)
            except Investment.DoesNotExist:
                raise CommandError(f"No investment '{inv_id}'.")
            payment = get_or_create_payment(
                investment, amount=investment.amount_invested, currency="usd",
                provider="nowpayments",
            )
            if not payment.nowpayments_payment_id:
                payment.nowpayments_payment_id = f"np_dev_{payment.id.hex[:18]}"
                payment.save(update_fields=["nowpayments_payment_id", "updated_at"])
            pid = payment.nowpayments_payment_id
        else:
            if not Payment.objects.filter(nowpayments_payment_id=pid).exists():
                raise CommandError(f"No payment with NOW id '{pid}'.")

        if options["fail"]:
            mark_nowpayments_failed(pid, reason="Simulated failure (dev)")
            self.stdout.write(self.style.SUCCESS(f"Marked NOW payment {pid} FAILED."))
            return

        result = process_successful_nowpayments(pid)
        self.stdout.write(
            self.style.SUCCESS(
                f"Confirmed {pid}: processed={result['processed']} minted={result['minted']}"
                + (f" reason={result['reason']}" if result.get("reason") else "")
            )
        )
