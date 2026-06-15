"""
DEV-ONLY payment confirmation — Phase 5 Wave 1 testing aid (mirrors dev_grant_kyc).

Production completion is STRICTLY the signature-verified Stripe webhook. This command
lets the team prove the invest→pay→webhook→mint cycle BEFORE Stripe keys exist, by
driving the SAME `process_successful_payment` service the real webhook calls — so a
dev confirm completes the payment and mints exactly like production.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY.
  * No real money moves — it only simulates the provider's "succeeded" signal.

    python manage.py dev_confirm_payment --investment <investment_id>
    python manage.py dev_confirm_payment --payment-intent pi_xxx --fail
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.investments.models import Investment
from apps.payments.models import Payment, PaymentState
from apps.payments.services import (
    get_or_create_payment,
    mark_payment_failed,
    process_successful_payment,
)


class Command(BaseCommand):
    help = (
        "DEV-ONLY: simulate a successful (or failed) Stripe payment for an investment "
        "to drive the webhook-gated completion+mint. Requires DEBUG=True."
    )

    def add_arguments(self, parser):
        parser.add_argument("--investment", help="Investment id to confirm a card payment for.")
        parser.add_argument("--payment-intent", help="Existing Stripe PaymentIntent id.")
        parser.add_argument("--fail", action="store_true", help="Simulate a failed payment.")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY payment-simulate "
                "aid; production completion is the signed Stripe webhook only."
            )

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] payment simulate -- never use in production.")
        )

        intent_id = options.get("payment_intent")

        # Resolve/forge a Payment with a synthetic intent id when given an investment.
        if not intent_id:
            inv_id = options.get("investment")
            if not inv_id:
                raise CommandError("Provide --investment <id> or --payment-intent <pi_xxx>.")
            try:
                investment = Investment.objects.get(pk=inv_id)
            except Investment.DoesNotExist:
                raise CommandError(f"No investment '{inv_id}'.")
            payment = get_or_create_payment(
                investment, amount=investment.amount_invested, currency="usd"
            )
            if not payment.stripe_payment_intent_id:
                payment.stripe_payment_intent_id = f"pi_dev_{payment.id.hex[:18]}"
                payment.save(update_fields=["stripe_payment_intent_id", "updated_at"])
            intent_id = payment.stripe_payment_intent_id
        else:
            if not Payment.objects.filter(stripe_payment_intent_id=intent_id).exists():
                raise CommandError(f"No payment with intent '{intent_id}'.")

        if options["fail"]:
            mark_payment_failed(intent_id, reason="Simulated failure (dev)")
            self.stdout.write(self.style.SUCCESS(f"Marked payment {intent_id} FAILED."))
            return

        result = process_successful_payment(intent_id)
        self.stdout.write(
            self.style.SUCCESS(
                f"Confirmed {intent_id}: processed={result['processed']} "
                f"minted={result['minted']}"
                + (f" reason={result['reason']}" if result.get("reason") else "")
            )
        )
