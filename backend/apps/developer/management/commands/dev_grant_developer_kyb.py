"""
DEV-ONLY developer KYB approval — Phase 8 Wave A testing aid (mirrors
dev_grant_owner_kyb).

Production developer-KYB approval is STRICTLY the signed Sumsub webhook (developer
business level). This command lets the team exercise the developer journey (apply →
approved → role activated) before any Sumsub developer-KYB keys exist. It routes
through the SAME `approve_kyb` service the webhook uses, so a dev grant activates the
developer role exactly like the real path.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: --reject sets rejected; --revoke deletes the developer record entirely.

    python manage.py dev_grant_developer_kyb --email dev@example.com
    python manage.py dev_grant_developer_kyb --email dev@example.com --reject
    python manage.py dev_grant_developer_kyb --email dev@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.developer.models import DeveloperProfile
from apps.developer.services import approve_kyb, get_or_create_developer, reject_kyb


class Command(BaseCommand):
    help = (
        "DEV-ONLY: approve/reject/revoke a user's developer KYB (gate bypass for "
        "testing). Requires DEBUG=True. Production approval is webhook-driven only."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--reject", action="store_true", help="Reject instead of approve.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's developer record entirely."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY developer-KYB "
                "approval bypass for testing and must never run in production. "
                "Production approval is the signed Sumsub webhook only."
            )

        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] developer-KYB-gate bypass -- never use in production.")
        )

        if options["revoke"]:
            deleted, _ = DeveloperProfile.objects.filter(user=user).delete()
            msg = f"Revoked developer for {email}." if deleted else f"No developer record for {email}."
            self.stdout.write(self.style.SUCCESS(msg))
            return

        developer, created = get_or_create_developer(
            user, defaults={"contact_name": user.email or "Developer", "email": user.email or ""}
        )
        if created:
            self.stdout.write(f"(Created a bootstrap developer profile for {email}.)")

        if options["reject"]:
            reject_kyb(developer, reason="Rejected via dev_grant_developer_kyb", source="dev")
            self.stdout.write(self.style.SUCCESS(f"Developer KYB rejected for {email}."))
            return

        approve_kyb(developer, review_answer="DEV", source="dev")
        self.stdout.write(
            self.style.SUCCESS(f"Developer KYB approved for {email}. Developer role activated.")
        )
        self.stdout.write(
            f"Revert with: python manage.py dev_grant_developer_kyb --email {email} --revoke"
        )
