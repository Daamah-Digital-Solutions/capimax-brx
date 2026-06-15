"""
DEV-ONLY KYC approval — Phase 4 testing aid (mirrors dev_grant_wallet).

Production approval is STRICTLY the signed Sumsub webhook. This command lets the
team exercise the gate (approved-KYC -> auto-wallet -> invest -> mint) before any
Sumsub keys exist. It routes through the SAME `approve_kyc` service the webhook
uses, so a dev grant auto-creates the custodial wallet exactly like the real path.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: --reject sets rejected; --revoke deletes the KYC record entirely.

    python manage.py dev_grant_kyc --email investor@example.com
    python manage.py dev_grant_kyc --email investor@example.com --reject
    python manage.py dev_grant_kyc --email investor@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.kyc.models import UserKYC
from apps.kyc.services import approve_kyc, get_or_create_kyc, reject_kyc


class Command(BaseCommand):
    help = (
        "DEV-ONLY: approve/reject/revoke a user's KYC (gate bypass for testing). "
        "Requires DEBUG=True. Production approval is webhook-driven only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--reject", action="store_true", help="Reject instead of approve.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's KYC record entirely."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY KYC approval "
                "bypass for testing and must never run in production. Production "
                "approval is the signed Sumsub webhook only."
            )

        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] KYC-gate bypass -- never use in production.")
        )

        if options["revoke"]:
            deleted, _ = UserKYC.objects.filter(user=user).delete()
            msg = f"Revoked KYC for {email}." if deleted else f"No KYC record for {email}."
            self.stdout.write(self.style.SUCCESS(msg))
            return

        kyc = get_or_create_kyc(user)
        if options["reject"]:
            reject_kyc(kyc, reason="Rejected via dev_grant_kyc", source="dev")
            self.stdout.write(self.style.SUCCESS(f"KYC rejected for {email}."))
            return

        approve_kyc(kyc, review_answer="DEV", source="dev")
        self.stdout.write(
            self.style.SUCCESS(f"KYC approved for {email}. Custodial wallet auto-created.")
        )
        self.stdout.write(
            f"Revert with: python manage.py dev_grant_kyc --email {email} --revoke"
        )
