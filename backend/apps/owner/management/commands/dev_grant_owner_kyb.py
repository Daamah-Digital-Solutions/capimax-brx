"""
DEV-ONLY owner KYB approval — Phase 7 Wave A testing aid (mirrors dev_grant_kyb).

Production owner-KYB approval is STRICTLY the signed Sumsub webhook (owner business
level). This command lets the team exercise the owner journey (apply → approved →
role activated) before any Sumsub owner-KYB keys exist. It routes through the SAME
`approve_kyb` service the webhook uses, so a dev grant activates the owner role
exactly like the real path.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: --reject sets rejected; --revoke deletes the owner record entirely.

    python manage.py dev_grant_owner_kyb --email owner@example.com
    python manage.py dev_grant_owner_kyb --email owner@example.com --reject
    python manage.py dev_grant_owner_kyb --email owner@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.owner.models import OwnerProfile
from apps.owner.services import approve_kyb, get_or_create_owner, reject_kyb


class Command(BaseCommand):
    help = (
        "DEV-ONLY: approve/reject/revoke a user's owner KYB (gate bypass for testing). "
        "Requires DEBUG=True. Production approval is webhook-driven only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--reject", action="store_true", help="Reject instead of approve.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's owner record entirely."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY owner-KYB approval "
                "bypass for testing and must never run in production. Production "
                "approval is the signed Sumsub webhook only."
            )

        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] owner-KYB-gate bypass -- never use in production.")
        )

        if options["revoke"]:
            deleted, _ = OwnerProfile.objects.filter(user=user).delete()
            msg = f"Revoked owner for {email}." if deleted else f"No owner record for {email}."
            self.stdout.write(self.style.SUCCESS(msg))
            return

        owner, created = get_or_create_owner(
            user, defaults={"contact_name": user.email or "Owner", "email": user.email or ""}
        )
        if created:
            self.stdout.write(f"(Created a bootstrap owner profile for {email}.)")

        if options["reject"]:
            reject_kyb(owner, reason="Rejected via dev_grant_owner_kyb", source="dev")
            self.stdout.write(self.style.SUCCESS(f"Owner KYB rejected for {email}."))
            return

        approve_kyb(owner, review_answer="DEV", source="dev")
        self.stdout.write(
            self.style.SUCCESS(f"Owner KYB approved for {email}. Owner role activated.")
        )
        self.stdout.write(
            f"Revert with: python manage.py dev_grant_owner_kyb --email {email} --revoke"
        )
