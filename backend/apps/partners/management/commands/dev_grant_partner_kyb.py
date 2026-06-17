"""
DEV-ONLY partner KYB approval — Phase 11 Wave A testing aid (mirrors
dev_grant_developer_kyb).

Production partner-KYB approval is STRICTLY the signed Sumsub webhook (partner business
level). This command lets the team exercise the partner journey (apply → approved →
role activated) before any Sumsub partner-KYB keys exist. It routes through the SAME
`approve_kyb` service the webhook uses, so a dev grant activates the partner role
exactly like the real path.

NOTE: this is KYB/verification ONLY. It does NOT publish the partner to the public
directory — that is the SEPARATE admin "approve directory listing" action
(directory_status), intentionally independent of KYB.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: --reject sets rejected; --revoke deletes the partner record entirely.

    python manage.py dev_grant_partner_kyb --email partner@example.com
    python manage.py dev_grant_partner_kyb --email partner@example.com --reject
    python manage.py dev_grant_partner_kyb --email partner@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.partners.models import PartnerProfile
from apps.partners.services import approve_kyb, get_or_create_partner, reject_kyb


class Command(BaseCommand):
    help = (
        "DEV-ONLY: approve/reject/revoke a user's partner KYB (gate bypass for testing). "
        "Requires DEBUG=True. Production approval is webhook-driven only. Does NOT affect "
        "the public-directory listing (a separate admin action)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--reject", action="store_true", help="Reject instead of approve.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's partner record entirely."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY partner-KYB "
                "approval bypass for testing and must never run in production. "
                "Production approval is the signed Sumsub webhook only."
            )

        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] partner-KYB-gate bypass -- never use in production.")
        )

        if options["revoke"]:
            deleted, _ = PartnerProfile.objects.filter(user=user).delete()
            msg = f"Revoked partner for {email}." if deleted else f"No partner record for {email}."
            self.stdout.write(self.style.SUCCESS(msg))
            return

        partner, created = get_or_create_partner(
            user, defaults={"contact_name": user.email or "Partner", "email": user.email or ""}
        )
        if created:
            self.stdout.write(f"(Created a bootstrap partner profile for {email}.)")

        if options["reject"]:
            reject_kyb(partner, reason="Rejected via dev_grant_partner_kyb", source="dev")
            self.stdout.write(self.style.SUCCESS(f"Partner KYB rejected for {email}."))
            return

        approve_kyb(partner, review_answer="DEV", source="dev")
        self.stdout.write(
            self.style.SUCCESS(f"Partner KYB approved for {email}. Partner role activated.")
        )
        self.stdout.write(
            "NOTE: not yet in the public directory — approve the directory listing in admin "
            "(or it stays directory_status=pending)."
        )
        self.stdout.write(
            f"Revert with: python manage.py dev_grant_partner_kyb --email {email} --revoke"
        )
