"""
DEV-ONLY: full PEER secondary-market cycle on real BSC Testnet — Phase 6 Wave 3 proof.

Investor A (seller, holds minted tokens) lists some → investor B (KYC-approved) buys
from their internal balance → tokens TRANSFER on-chain A→B (real tx) → B's UserBalance
debited, A's credited → A WITHDRAWS the proceeds. Prints tx hashes + explorer links +
on-chain balances BEFORE/AFTER. Routes through the SAME services the API uses.

SAFETY: refuses unless DEBUG=True; real on-chain transfer; never a fake tx.

    python manage.py dev_secondary_market_cycle --seller a@x.com --buyer b@x.com \
        --property 1 --amount 1 [--unit-price 100] [--fund-buyer 100000]
"""
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.chain import service as chain_service
from apps.core.models import User
from apps.kyc.services import approve_kyc, get_or_create_kyc
from apps.properties.models import Property
from apps.secondary_market import services as market
from apps.wallets.models import UserWallet
from apps.wallets.services import (
    credit_user_balance,
    get_or_create_custodial_wallet,
    request_withdrawal,
)


class Command(BaseCommand):
    help = "DEV-ONLY: real-testnet peer-market list→buy→on-chain-transfer→withdraw cycle."

    def add_arguments(self, parser):
        parser.add_argument("--seller", required=True)
        parser.add_argument("--buyer", required=True)
        parser.add_argument("--property", required=True)
        parser.add_argument("--amount", type=int, default=1)
        parser.add_argument("--unit-price", default="100")
        parser.add_argument("--fund-buyer", default="100000")

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("Refusing to run with DEBUG=False (DEV-ONLY).")

        seller = self._user(opts["seller"])
        buyer = self._user(opts["buyer"])
        slug = opts["property"]
        amount = int(opts["amount"])

        prop = Property.objects.filter(slug=slug).select_related("token_metadata").first()
        meta = getattr(prop, "token_metadata", None) if prop else None
        if not prop or not meta or not meta.deployed_contract_address:
            raise CommandError(f"Property '{slug}' has no deployed token contract.")
        contract = meta.deployed_contract_address

        seller_wallet = UserWallet.objects.filter(user=seller).first()
        if not seller_wallet:
            raise CommandError(f"Seller {seller.email} has no custodial wallet.")
        buyer_wallet, _ = get_or_create_custodial_wallet(buyer)

        self.stdout.write(self.style.WARNING("[DEV-ONLY] Real BSC Testnet peer-market cycle."))
        self._show(contract, seller_wallet, buyer_wallet, "BEFORE")

        # Both parties must be KYC-approved; fund the buyer's internal balance.
        for u in (seller, buyer):
            approve_kyc(get_or_create_kyc(u), review_answer="DEV", source="dev")
        with transaction.atomic():
            credit_user_balance(
                buyer, Decimal(str(opts["fund_buyer"])), source="dev_fund",
                memo="demo top-up",
            )

        listing = market.create_listing(
            user=seller,
            data={
                "property_id": slug, "property_name": prop.name,
                "token_symbol": chain_service.token_symbol_for_slug(slug),
                "token_amount": amount, "unit_price": opts["unit_price"],
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"Listed {amount} token(s): {listing.id} (total ${listing.total_value}, "
            f"fee {listing.platform_fee_percent}% = ${listing.platform_fee_amount}, "
            f"net ${listing.net_amount})."
        ))

        self.stdout.write("Purchasing (real on-chain transfer)…")
        result = market.purchase_listing(buyer_user=buyer, listing_id=listing.id)
        self.stdout.write(self.style.SUCCESS(
            f"Settled. tx={result['tx_hash']} block={result.get('block_number')}"
        ))
        self.stdout.write(f"Explorer: {result.get('explorer_tx')}")
        self._show(contract, seller_wallet, buyer_wallet, "AFTER")

        # Seller withdraws their proceeds.
        wd = request_withdrawal(seller, listing.net_amount, method="bank", notes="demo")
        self.stdout.write(self.style.SUCCESS(
            f"Seller withdrew ${wd.amount} -> withdrawal {wd.reference} [{wd.status}]."
        ))

    def _user(self, email):
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

    def _show(self, contract, sw, bw, label):
        try:
            s = chain_service.read_balance(contract, sw.wallet_address)
            b = chain_service.read_balance(contract, bw.wallet_address)
            self.stdout.write(
                f"  [{label}] on-chain — seller {sw.wallet_address}: {s} | "
                f"buyer {bw.wallet_address}: {b}"
            )
        except Exception as exc:  # noqa: BLE001
            self.stdout.write(self.style.WARNING(f"  [{label}] chain read failed: {exc}"))
