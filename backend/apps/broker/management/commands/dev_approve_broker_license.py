"""
DEV-ONLY broker LICENCE approval — Phase 12 Wave A testing aid (mirrors
dev_grant_partner_kyb, but for the licence hinge).

The broker's IDENTITY is verified via the existing investor KYC path — grant it with
`dev_grant_kyc --email <broker>`. THEN this command exercises the licence-approval HINGE
(the sanctioned admin step): it routes through the SAME `approve_license` service the
admin action uses, so a dev approve activates the broker role exactly like the real path —
INCLUDING the guard that identity KYC must already be approved.

SAFETY:
  * Refuses to run unless DEBUG=True (can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: --reject sets rejected; --revoke deletes the broker record entirely.

    python manage.py dev_grant_kyc --email broker@example.com          # identity first
    python manage.py dev_approve_broker_license --email broker@example.com
    python manage.py dev_approve_broker_license --email broker@example.com --reject
    python manage.py dev_approve_broker_license --email broker@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.broker.models import BrokerProfile
from apps.broker.services import (
    LicenseNotApprovable,
    approve_license,
    get_or_create_broker,
    reject_license,
)
from apps.core.models import User


class Command(BaseCommand):
    help = (
        "DEV-ONLY: approve/reject/revoke a broker's LICENCE (the activation hinge, for "
        "testing). Requires DEBUG=True. Approval requires identity KYC already approved "
        "(grant it with dev_grant_kyc first). Production approval is the admin action."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--reject", action="store_true", help="Reject instead of approve.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's broker record entirely."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY broker-licence "
                "approval bypass for testing and must never run in production. Production "
                "approval is the sanctioned admin action."
            )

        email = options["email"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        self.stdout.write(
            self.style.WARNING("[DEV-ONLY] broker-licence-hinge bypass -- never use in production.")
        )

        if options["revoke"]:
            deleted, _ = BrokerProfile.objects.filter(user=user).delete()
            msg = f"Revoked broker for {email}." if deleted else f"No broker record for {email}."
            self.stdout.write(self.style.SUCCESS(msg))
            return

        broker, created = get_or_create_broker(
            user, defaults={"contact_name": user.email or "Broker", "email": user.email or ""}
        )
        if created:
            self.stdout.write(f"(Created a bootstrap broker profile for {email}.)")

        if options["reject"]:
            reject_license(broker, notes="Rejected via dev_approve_broker_license", source="dev")
            self.stdout.write(self.style.SUCCESS(f"Broker licence rejected for {email}."))
            return

        try:
            approve_license(broker, source="dev")
        except LicenseNotApprovable as exc:
            raise CommandError(
                f"{exc} Run `python manage.py dev_grant_kyc --email {email}` first to "
                "approve identity KYC, then retry."
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Broker licence approved for {email}. Broker role activated "
                f"(referral code {broker.referral_code})."
            )
        )
        self.stdout.write(
            f"Revert with: python manage.py dev_approve_broker_license --email {email} --revoke"
        )
