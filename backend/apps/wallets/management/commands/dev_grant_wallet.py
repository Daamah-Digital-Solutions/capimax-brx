"""
DEV-ONLY custodial-wallet provisioning — Phase 3 Wave 2 testing aid.

The production wallet endpoint (`POST /api/wallets/`) is gated by
`KYCApprovedPermission` (always-deny until the KYC domain ships). This command
creates (or revokes) a custodial wallet for a user by calling the wallet SERVICE
directly — it does NOT touch or weaken that gate. It exists ONLY so the team can
test the invest→mint cycle before KYC is built.

SAFETY:
  * Refuses to run unless DEBUG=True (so it can never run in production).
  * Clearly labelled DEV-ONLY in its output.
  * Reversible: `--revoke` deletes the wallet (and its encrypted key material).

    python manage.py dev_grant_wallet --email owner@example.com
    python manage.py dev_grant_wallet --email owner@example.com --revoke
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.wallets.models import UserWallet
from apps.wallets.services import get_or_create_custodial_wallet


class Command(BaseCommand):
    help = "DEV-ONLY: create/revoke a custodial wallet for a user (KYC-gate bypass for testing). Requires DEBUG=True."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument(
            "--revoke", action="store_true", help="Delete the user's wallet instead of creating it."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to run with DEBUG=False. This is a DEV-ONLY KYC-gate bypass "
                "for testing and must never run in production. The real KYC gate "
                "(KYCApprovedPermission) is unchanged."
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
            deleted, _ = UserWallet.objects.filter(user=user).delete()
            if deleted:
                self.stdout.write(self.style.SUCCESS(f"Revoked wallet for {email}."))
            else:
                self.stdout.write(f"No wallet to revoke for {email}.")
            return

        wallet, created = get_or_create_custodial_wallet(user)
        self.stdout.write(
            self.style.SUCCESS(
                f"Wallet {'created' if created else 'already existed'} for {email}:"
            )
        )
        self.stdout.write(f"  address: {wallet.wallet_address}")
        self.stdout.write(f"  network: {wallet.network}")
        self.stdout.write(
            "Revert with: python manage.py dev_grant_wallet --email "
            f"{email} --revoke"
        )
