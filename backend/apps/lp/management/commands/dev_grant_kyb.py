"""
DEV-ONLY LP KYB approval — Phase 6 Wave 1 testing aid (mirrors dev_grant_kyc).

Production KYB approval is STRICTLY the signed Sumsub webhook (business level).
This command lets the team exercise the LP journey (apply → approved → role
activated → dashboard renders) before any Sumsub KYB keys exist. It routes through
the SAME `approve_kyb` service the webhook uses, so a dev grant activates the LP
role exactly like the real path.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: --reject sets rejected; --revoke deletes the LP record entirely.

    python manage.py dev_grant_kyb --email lp@example.com
    python manage.py dev_grant_kyb --email lp@example.com --reject
    python manage.py dev_grant_kyb --email lp@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.lp.models import LiquidityProvider
from apps.lp.services import approve_kyb, get_or_create_lp, reject_kyb


class Command(BaseCommand):
    help = (
        "DEV-ONLY: approve/reject/revoke a user's LP KYB (gate bypass for testing). "
        "Requires DEBUG=True. Production approval is webhook-driven only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--reject", action="store_true", help="Reject instead of approve.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's LP record entirely."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY LP KYB approval "
                "bypass for testing and must never run in production. Production "
                "approval is the signed Sumsub webhook only."
            )

        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] LP-KYB-gate bypass -- never use in production.")
        )

        if options["revoke"]:
            deleted, _ = LiquidityProvider.objects.filter(user=user).delete()
            msg = f"Revoked LP for {email}." if deleted else f"No LP record for {email}."
            self.stdout.write(self.style.SUCCESS(msg))
            return

        lp, created = get_or_create_lp(
            user, defaults={"contact_name": user.email or "LP", "email": user.email or ""}
        )
        if created:
            self.stdout.write(f"(Created a bootstrap LP profile for {email}.)")

        if options["reject"]:
            reject_kyb(lp, reason="Rejected via dev_grant_kyb", source="dev")
            self.stdout.write(self.style.SUCCESS(f"LP KYB rejected for {email}."))
            return

        approve_kyb(lp, review_answer="DEV", source="dev")
        self.stdout.write(
            self.style.SUCCESS(f"LP KYB approved for {email}. LP role activated.")
        )
        self.stdout.write(
            f"Revert with: python manage.py dev_grant_kyb --email {email} --revoke"
        )
