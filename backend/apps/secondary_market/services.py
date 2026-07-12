"""
Peer secondary-market settlement — Phase 6 Wave 3.

Mirrors apps/lp/market_services.py exactly, with two differences (locked decisions):
  * the buyer pays from their internal `UserBalance` (not the LP buying float), and
  * the buyer is any KYC-approved investor (not an approved LP) — gated at the view.

Escrow reuses `OwnershipToken.locked_amount`, which is SHARED with the LP market, so
the same tokens can never be listed on both markets at once (single-market
exclusivity falls out of the shared available-balance check). The on-chain transfer
is the SAME seller-signed `apps.chain.transfer`. Atomic + idempotent; never a fake tx.

Fee = settings.SECONDARY_MARKET_FEE_PERCENT (default 0.5%, configurable).
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.chain import service as chain_service
from apps.chain.exceptions import ChainError
from apps.notifications.services import NotificationType, notify
# Reuse the generic, stateless helpers from the LP market (contract resolution +
# position revaluation) so the two markets stay consistent.
from apps.lp.market_services import (
    InsufficientTokensError,
    ListingUnavailableError,
    NotDeployedError,
    _deployed_contract,
    _recompute_position,
)
from apps.wallets.models import OwnershipToken, UserWallet, WalletTransaction
from apps.wallets.services import (
    InsufficientBalance,
    credit_user_balance,
    debit_user_balance,
    get_or_create_custodial_wallet,
    load_custodial_signer,
)

from .models import SecondaryMarketListing

log = logging.getLogger(__name__)


class InsufficientBalanceError(APIException):
    status_code = 402
    default_detail = "Insufficient balance for this purchase."
    default_code = "insufficient_balance"


def compute_fees(total_value: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """(fee_percent, platform_fee_amount, net_amount) from the peer-market config."""
    pct = Decimal(str(settings.SECONDARY_MARKET_FEE_PERCENT))
    fee = (total_value * pct / Decimal("100")).quantize(Decimal("0.01"), ROUND_HALF_UP)
    net = (total_value - fee).quantize(Decimal("0.01"), ROUND_HALF_UP)
    return pct, fee, net


def _party_type(user) -> str:
    lp = getattr(user, "liquidity_provider", None)
    return "lp" if (lp and lp.status == "approved") else "investor"


# --------------------------------------------------------------------------- #
# List (escrow-lock) — shares OwnershipToken.locked_amount with the LP market.
# --------------------------------------------------------------------------- #
def create_listing(*, user, data: dict) -> SecondaryMarketListing:
    property_id = data["property_id"]
    token_amount = int(data["token_amount"])
    if token_amount < 1:
        raise ValidationError({"token_amount": "Must list at least 1 token."})
    unit_price = Decimal(str(data.get("unit_price") or 100))

    with transaction.atomic():
        wallet = UserWallet.objects.filter(user=user).first()
        if wallet is None:
            raise InsufficientTokensError(detail="You have no wallet / tokens to list.")
        position = (
            OwnershipToken.objects.select_for_update()
            .filter(wallet=wallet, property_id=property_id)
            .first()
        )
        # available_amount already nets out tokens locked by the LP market → a block
        # listed there can't be relisted here (single-market exclusivity).
        if position is None or position.available_amount < token_amount:
            available = position.available_amount if position else 0
            raise InsufficientTokensError(
                detail=f"Only {available} unlocked token(s) available to list."
            )

        total_value = (Decimal(token_amount) * unit_price).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        fee_pct, fee_amount, net_amount = compute_fees(total_value)

        position.locked_amount = int(position.locked_amount) + token_amount
        position.save(update_fields=["locked_amount", "updated_at"])

        listing = SecondaryMarketListing.objects.create(
            seller=user,
            seller_type=_party_type(user),
            property_id=property_id,
            property_name=data.get("property_name") or position.property_name,
            token_symbol=data.get("token_symbol") or position.token_symbol,
            token_amount=token_amount,
            unit_price=unit_price,
            total_value=total_value,
            platform_fee_percent=fee_pct,
            platform_fee_amount=fee_amount,
            net_amount=net_amount,
            status=SecondaryMarketListing.Status.LISTED,
            notes=data.get("notes") or None,
        )
    return listing


def cancel_listing(*, user, listing_id) -> SecondaryMarketListing:
    with transaction.atomic():
        listing = (
            SecondaryMarketListing.objects.select_for_update()
            .filter(pk=listing_id, seller=user)
            .first()
        )
        if listing is None:
            raise ListingUnavailableError(detail="Listing not found.")
        if listing.status != SecondaryMarketListing.Status.LISTED:
            return listing
        _release_escrow(listing)
        listing.status = SecondaryMarketListing.Status.CANCELLED
        listing.cancelled_at = timezone.now()
        listing.save(update_fields=["status", "cancelled_at", "updated_at"])
    return listing


def _release_escrow(listing: SecondaryMarketListing) -> None:
    wallet = UserWallet.objects.filter(user=listing.seller).first()
    if wallet is None:
        return
    position = (
        OwnershipToken.objects.select_for_update()
        .filter(wallet=wallet, property_id=listing.property_id)
        .first()
    )
    if position is None:
        return
    position.locked_amount = max(0, int(position.locked_amount) - int(listing.token_amount))
    position.save(update_fields=["locked_amount", "updated_at"])


# --------------------------------------------------------------------------- #
# Purchase (atomic on-chain settlement; buyer pays from UserBalance)
# --------------------------------------------------------------------------- #
def purchase_listing(*, buyer_user, listing_id) -> dict:
    with transaction.atomic():
        listing = (
            SecondaryMarketListing.objects.select_for_update().filter(pk=listing_id).first()
        )
        if listing is None:
            raise ListingUnavailableError(detail="Listing not found.")
        if listing.status == SecondaryMarketListing.Status.COMPLETED:
            return {"completed": True, "already": True,
                    "tx_hash": listing.settlement_tx_hash}
        if listing.status != SecondaryMarketListing.Status.LISTED:
            raise ListingUnavailableError()
        if buyer_user == listing.seller:
            raise ValidationError({"listing": "You cannot buy your own listing."})

        total = listing.total_value

        seller_wallet = UserWallet.objects.filter(user=listing.seller).first()
        if seller_wallet is None:
            raise ListingUnavailableError(detail="Seller wallet missing.")
        seller_pos = (
            OwnershipToken.objects.select_for_update()
            .filter(wallet=seller_wallet, property_id=listing.property_id)
            .first()
        )
        if seller_pos is None or seller_pos.token_amount < listing.token_amount:
            raise ListingUnavailableError(detail="Seller no longer holds these tokens.")

        # Settle on-chain when the property's token contract is deployed; otherwise fall
        # back to an OFF-CHAIN custodial settlement (client note 14). Non-deployed / demo /
        # pre-launch inventory has no contract, so the OwnershipToken positions ARE the
        # ledger of record — we move them + settle balances instead of hard-blocking the
        # trade with "contract not deployed" (the client-reported dead end). This mirrors
        # how PRIMARY settlement records non-deployed holdings. No fake tx is ever emitted:
        # off-chain rows carry an explicit "offchain:" marker, never a fabricated hash.
        # When the property later deploys, holdings reconcile on-chain.
        try:
            contract_address = _deployed_contract(listing.property_id)
            on_chain = True
        except NotDeployedError:
            contract_address = None
            on_chain = False

        buyer_wallet, _created = get_or_create_custodial_wallet(buyer_user)

        # Debit the buyer's internal balance FIRST (rolls back the whole tx on a
        # shortfall → no transfer happens).
        try:
            debit_user_balance(
                buyer_user, total, source="secondary_market_purchase",
                reference=str(listing.pk),
                memo=f"Buy {listing.token_amount} {listing.token_symbol}",
            )
        except InsufficientBalance:
            raise InsufficientBalanceError()

        if on_chain:
            # ---- REAL on-chain transfer, signed with the SELLER's custodial key ---- #
            signer = load_custodial_signer(seller_wallet)
            try:
                result = chain_service.transfer(
                    contract_address, signer, buyer_wallet.wallet_address,
                    int(listing.token_amount),
                )
            except ChainError:
                log.exception("Peer-market on-chain transfer failed for listing %s", listing.pk)
                raise
            finally:
                del signer
            tx_hash = result["tx_hash"]
            block = result.get("block_number")
            chain_id = result.get("chain_id")
            explorer_tx = result.get("explorer_tx")
        else:
            # ---- OFF-CHAIN custodial settlement — no signer, no gas, no fabricated tx --- #
            tx_hash = f"offchain:{listing.pk}"
            block = None
            chain_id = None
            explorer_tx = None

        # Credit the seller's net proceeds.
        credit_user_balance(
            listing.seller, listing.net_amount, source="secondary_market_sale",
            reference=str(listing.pk),
            memo=f"Sale of {listing.token_amount} {listing.token_symbol}",
        )

        # Move OwnershipToken positions to match the chain.
        seller_pos.token_amount = int(seller_pos.token_amount) - int(listing.token_amount)
        seller_pos.locked_amount = max(
            0, int(seller_pos.locked_amount) - int(listing.token_amount)
        )
        _recompute_position(seller_pos, listing.property_id)
        if seller_pos.token_amount == 0:
            seller_pos.status = OwnershipToken.Status.SOLD
        seller_pos.save()

        buyer_pos, _bp_created = (
            OwnershipToken.objects.select_for_update().get_or_create(
                wallet=buyer_wallet,
                property_id=listing.property_id,
                defaults={
                    "property_name": listing.property_name,
                    "token_symbol": listing.token_symbol,
                    "token_amount": 0,
                },
            )
        )
        buyer_pos.token_amount = int(buyer_pos.token_amount) + int(listing.token_amount)
        buyer_pos.property_name = listing.property_name
        buyer_pos.token_symbol = listing.token_symbol
        buyer_pos.status = OwnershipToken.Status.ACTIVE
        _recompute_position(buyer_pos, listing.property_id)
        buyer_pos.save()

        # Record the buyer's cost basis (a completed Investment row) so portfolio return%
        # is correct for secondary-acquired tokens. NO money flow change — the debit above
        # already happened; this only RECORDS the price paid. Idempotent via the
        # completed-status guard at the top of this function. Local import avoids any
        # import cycle (investments.services never imports this module).
        from apps.investments.services import record_acquisition_cost

        record_acquisition_cost(
            user=buyer_user, property_slug=listing.property_id,
            property_name=listing.property_name, token_symbol=listing.token_symbol,
            token_amount=listing.token_amount, amount_paid=total,
            wallet=buyer_wallet, source="secondary_market",
        )

        for w in (seller_wallet, buyer_wallet):
            WalletTransaction.objects.create(
                wallet=w, tx_hash=tx_hash, tx_type="transfer",
                amount=total, token_symbol=listing.token_symbol,
                status="confirmed", block_number=block, chain_id=chain_id,
            )

        now = timezone.now()
        listing.status = SecondaryMarketListing.Status.COMPLETED
        listing.buyer = buyer_user
        listing.buyer_type = _party_type(buyer_user)
        listing.purchased_at = now
        listing.completed_at = now
        listing.settlement_tx_hash = tx_hash
        listing.save(update_fields=[
            "status", "buyer", "buyer_type", "purchased_at", "completed_at",
            "settlement_tx_hash", "updated_at",
        ])

        # Phase 10: notify BOTH parties (replay-safe — the completed-guard above returns
        # early on a re-run). Inside the atomic block so they commit with settlement.
        notify(
            listing.seller, NotificationType.SECONDARY_SALE_SELLER,
            params={"property": listing.property_name, "tokens": listing.token_amount,
                    "amount": str(listing.net_amount)},
            action_url="/secondary-market",
        )
        notify(
            buyer_user, NotificationType.SECONDARY_SALE_BUYER,
            params={"property": listing.property_name, "tokens": listing.token_amount},
            action_url="/portfolio",
        )

    return {
        "completed": True,
        "tx_hash": tx_hash,
        "block_number": block,
        "explorer_tx": explorer_tx,
        "on_chain": on_chain,
    }


def listings_for(user):
    """(my_listings, market_listings) — market = others' listed inventory."""
    mine = SecondaryMarketListing.objects.filter(seller=user)
    market = SecondaryMarketListing.objects.filter(
        status=SecondaryMarketListing.Status.LISTED
    ).exclude(seller=user)
    return mine, market
