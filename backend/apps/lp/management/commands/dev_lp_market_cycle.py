"""
DEV-ONLY: run the FULL LP-market cycle on real BSC Testnet — Phase 6 Wave 2 proof.

An investor (the seller, who already holds minted tokens) lists some tokens; an
approved LP buys them; the tokens TRANSFER on-chain seller→buyer (real tx), the LP
balance is debited and the seller credited. Prints the tx hash + explorer link and
the on-chain balances BEFORE/AFTER so you can verify the move on testnet.bscscan.com.

This routes through the SAME services the API uses (create_listing → purchase_listing),
so it proves the production settlement path, not a side door.

SAFETY:
  * Refuses to run unless DEBUG=True.
  * Real on-chain transfer signed with the SELLER's custodial key; never a fake tx.

    python manage.py dev_lp_market_cycle --seller a@x.com --buyer lp@x.com \
        --property 1 --amount 1 [--unit-price 100] [--fund-buyer 100000]
"""
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.chain import service as chain_service
from apps.core.models import Profile, User
from apps.lp import market_services
from apps.lp.models import KYBStatus, LiquidityProvider, LPStatus
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken, UserWallet
from apps.wallets.services import get_or_create_custodial_wallet


class Command(BaseCommand):
    help = "DEV-ONLY: run the real-testnet LP-market list→buy→on-chain-transfer cycle."

    def add_arguments(self, parser):
        parser.add_argument("--seller", required=True, help="Seller (investor) email.")
        parser.add_argument("--buyer", required=True, help="Buyer (LP) email.")
        parser.add_argument("--property", required=True, help="Property slug (e.g. 1).")
        parser.add_argument("--amount", type=int, default=1, help="Tokens to list/sell.")
        parser.add_argument("--unit-price", default="100", help="USD per token.")
        parser.add_argument(
            "--fund-buyer", default="100000",
            help="Set the buyer LP's internal balance to this before buying.",
        )

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("Refusing to run with DEBUG=False (DEV-ONLY).")

        seller = self._user(opts["seller"])
        buyer = self._user(opts["buyer"])
        slug = opts["property"]
        amount = int(opts["amount"])

        prop = Property.objects.filter(slug=slug).select_related("token_metadata").first()
        if not prop:
            raise CommandError(f"No property with slug '{slug}'.")
        meta = getattr(prop, "token_metadata", None)
        if not meta or not meta.deployed_contract_address:
            raise CommandError(f"Property '{slug}' has no deployed token contract.")
        contract = meta.deployed_contract_address

        seller_wallet = UserWallet.objects.filter(user=seller).first()
        if not seller_wallet:
            raise CommandError(f"Seller {seller.email} has no custodial wallet.")
        buyer_wallet, _ = get_or_create_custodial_wallet(buyer)

        self.stdout.write(self.style.WARNING("[DEV-ONLY] Real BSC Testnet LP-market cycle."))
        self._show_chain(contract, seller_wallet, buyer_wallet, "BEFORE")

        # Approve the buyer LP + fund their internal balance for the demo.
        lp = self._ensure_approved_lp(buyer, Decimal(str(opts["fund_buyer"])))

        # 1) List (escrow-lock).
        listing = market_services.create_listing(
            user=seller,
            data={
                "property_id": slug, "property_name": prop.name,
                "token_symbol": chain_service.token_symbol_for_slug(slug),
                "token_amount": amount, "unit_price": opts["unit_price"],
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Listed {amount} token(s): listing {listing.id} "
            f"(total ${listing.total_value}, fee ${listing.platform_fee_amount}, "
            f"net ${listing.net_amount})."
        ))

        # 2) Purchase (REAL on-chain transfer).
        self.stdout.write("Purchasing (this submits a real on-chain transfer)…")
        result = market_services.purchase_listing(buyer_user=buyer, listing_id=listing.id)
        self.stdout.write(self.style.SUCCESS(
            f"Settled. tx={result['tx_hash']} block={result.get('block_number')}"
        ))
        self.stdout.write(f"Explorer: {result.get('explorer_tx')}")

        self._show_chain(contract, seller_wallet, buyer_wallet, "AFTER")
        lp.refresh_from_db()
        self.stdout.write(self.style.SUCCESS(
            f"LP balance now ${lp.current_balance}; seller credited ${listing.net_amount}."
        ))

    # ----------------------------------------------------------------------- #
    def _user(self, email):
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

    def _ensure_approved_lp(self, user, balance):
        lp, _ = LiquidityProvider.objects.get_or_create(
            user=user, defaults={"contact_name": user.email, "email": user.email}
        )
        lp.status = LPStatus.APPROVED
        lp.kyb_status = KYBStatus.APPROVED
        lp.current_balance = balance
        lp.save()
        profile = getattr(user, "profile", None)
        if profile and profile.role == Profile.Role.LP:
            profile.role_status = Profile.RoleStatus.ACTIVE
            profile.save(update_fields=["role_status", "role_verified_at", "updated_at"])
        return lp

    def _show_chain(self, contract, seller_wallet, buyer_wallet, label):
        try:
            s = chain_service.read_balance(contract, seller_wallet.wallet_address)
            b = chain_service.read_balance(contract, buyer_wallet.wallet_address)
            self.stdout.write(
                f"  [{label}] on-chain — seller {seller_wallet.wallet_address}: {s} | "
                f"buyer {buyer_wallet.wallet_address}: {b}"
            )
        except Exception as exc:  # noqa: BLE001 - reporting aid only
            self.stdout.write(self.style.WARNING(f"  [{label}] could not read chain: {exc}"))
