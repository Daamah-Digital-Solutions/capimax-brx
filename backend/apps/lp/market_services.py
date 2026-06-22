"""
LP secondary-market settlement — Phase 6 Wave 2 (SPEC §3.8; SECONDARY_MARKET_SURFACE.md).

The real, on-chain LP market: investors list ownership tokens (escrow-locked), approved
LPs buy them, and a purchase ATOMICALLY:
  * checks + debits the buyer LP's internal balance,
  * credits the seller's internal balance with the net proceeds,
  * TRANSFERS the tokens on-chain seller→buyer (signed with the SELLER's custodial key),
  * consumes the escrow lock + moves the OwnershipToken positions to match the chain,
  * writes WalletTransaction "transfer" rows with the REAL tx hash, and
  * creates the LP's holding record.

This FIXES the old Supabase bug where a "purchase" marked the listing completed and
created a holding but never moved tokens on-chain nor debited the seller
(SECONDARY_MARKET_SURFACE.md §3.4). We mirror the minting discipline exactly: the chain
call happens under a row lock inside transaction.atomic(), DB state is written only
after a confirmed receipt, and we NEVER fabricate a tx hash.

Fee is BACKEND-CONFIGURABLE via settings.LP_MARKET_FEE_PERCENT (locked decision #3).
"""
from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.chain import service as chain_service
from apps.chain.exceptions import ChainError
from apps.notifications.services import NotificationType, notify
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken, UserWallet, WalletTransaction
from apps.wallets.services import (
    credit_user_balance,
    get_or_create_custodial_wallet,
    load_custodial_signer,
)

from .models import LiquidityProvider, LPHolding, LPMarketListing, LPStatus, LPTransaction

log = logging.getLogger(__name__)


class InsufficientTokensError(APIException):
    status_code = 422
    default_detail = "You do not have enough unlocked tokens to list."
    default_code = "insufficient_tokens"


class InsufficientBalanceError(APIException):
    status_code = 402
    default_detail = "Insufficient LP balance for this purchase."
    default_code = "insufficient_balance"


class ListingUnavailableError(APIException):
    status_code = 409
    default_detail = "This listing is no longer available."
    default_code = "listing_unavailable"


class NotDeployedError(APIException):
    status_code = 409
    default_detail = "This property's token contract is not deployed; cannot settle on-chain."
    default_code = "contract_not_deployed"


# --------------------------------------------------------------------------- #
# Fee (backend-configurable, locked decision #3)
# --------------------------------------------------------------------------- #
def compute_fees(total_value: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """Return (fee_percent, platform_fee_amount, net_amount) from the backend config."""
    pct = Decimal(str(settings.LP_MARKET_FEE_PERCENT))
    fee = (total_value * pct / Decimal("100")).quantize(Decimal("0.01"), ROUND_HALF_UP)
    net = (total_value - fee).quantize(Decimal("0.01"), ROUND_HALF_UP)
    return pct, fee, net


def _deployed_contract(property_slug: str) -> str:
    """The deployed PropertyToken address for a slug on THIS chain, or raise."""
    prop = Property.objects.filter(slug=property_slug).select_related("token_metadata").first()
    meta = getattr(prop, "token_metadata", None) if prop else None
    if not prop or not meta or not meta.deployed_contract_address:
        raise NotDeployedError()
    if meta.deployment_chain_id != int(settings.CHAIN_ID):
        raise NotDeployedError(
            detail="This property's token is deployed on a different chain."
        )
    return meta.deployed_contract_address


def _recompute_position(token: OwnershipToken, prop_slug: str) -> None:
    """Refresh an OwnershipToken's USD value + ownership % from the real supply."""
    prop = Property.objects.filter(slug=prop_slug).first()
    price = prop.token_price if prop else Decimal("100")
    supply = int(prop.token_supply or 0) if prop else 0
    token.token_value_usd = (Decimal(token.token_amount) * price).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    token.ownership_percentage = (
        (Decimal(token.token_amount) / Decimal(supply) * Decimal("100")).quantize(
            Decimal("0.000001"), rounding=ROUND_HALF_UP
        )
        if supply
        else Decimal("0")
    )


# --------------------------------------------------------------------------- #
# List (escrow-lock)
# --------------------------------------------------------------------------- #
def create_listing(*, user, data: dict) -> LPMarketListing:
    """
    Create a listing of the seller's UNLOCKED tokens and ESCROW-LOCK that amount so it
    can't be double-listed or transferred while the listing is active (locked decision #2).
    Enforces the supply invariant: a user can never list more than their unlocked balance.
    """
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
        if position is None or position.available_amount < token_amount:
            available = position.available_amount if position else 0
            raise InsufficientTokensError(
                detail=f"Only {available} unlocked token(s) available to list."
            )

        total_value = (Decimal(token_amount) * unit_price).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        fee_pct, fee_amount, net_amount = compute_fees(total_value)

        # Escrow-lock the listed amount.
        position.locked_amount = int(position.locked_amount) + token_amount
        position.save(update_fields=["locked_amount", "updated_at"])

        listing = LPMarketListing.objects.create(
            seller=user,
            property_id=property_id,
            property_name=data.get("property_name") or position.property_name,
            token_symbol=data.get("token_symbol") or position.token_symbol,
            token_amount=token_amount,
            unit_price=unit_price,
            total_value=total_value,
            platform_fee_percent=fee_pct,
            platform_fee_amount=fee_amount,
            net_amount=net_amount,
            status=LPMarketListing.Status.LISTED,
            notes=data.get("notes") or None,
        )
    return listing


# --------------------------------------------------------------------------- #
# Cancel (unlock)
# --------------------------------------------------------------------------- #
def cancel_listing(*, user, listing_id) -> LPMarketListing:
    """Seller-scoped cancel → release the escrow lock. Idempotent on a non-listed row."""
    with transaction.atomic():
        listing = (
            LPMarketListing.objects.select_for_update()
            .filter(pk=listing_id, seller=user)
            .first()
        )
        if listing is None:
            raise ListingUnavailableError(detail="Listing not found.")
        if listing.status != LPMarketListing.Status.LISTED:
            return listing  # already cancelled/sold — nothing to unlock

        _release_escrow(listing)
        listing.status = LPMarketListing.Status.CANCELLED
        listing.cancelled_at = timezone.now()
        listing.save(update_fields=["status", "cancelled_at", "updated_at"])
    return listing


def _release_escrow(listing: LPMarketListing) -> None:
    """Decrement the seller's lock by this listing's amount (floored at 0)."""
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
# Purchase (atomic on-chain settlement — the core)
# --------------------------------------------------------------------------- #
def purchase_listing(*, buyer_user, listing_id) -> dict:
    """
    An approved LP buys a listing. Atomic + idempotent:
      1. lock the listing; if already completed → return {already: True} (transfer once).
      2. require an approved LP buyer with sufficient internal balance (else 402, NO transfer).
      3. resolve the deployed contract; load the SELLER's custodial signer.
      4. TRANSFER tokens on-chain seller→buyer wallet (real tx) — under the lock.
      5. debit LP balance, credit seller proceeds, move OwnershipToken positions to
         match the chain, consume escrow, write WalletTransaction 'transfer' rows,
         create the LPHolding, mark the listing completed.
    Never fabricates a tx; on any pre-transfer failure nothing moves.
    """
    with transaction.atomic():
        listing = (
            LPMarketListing.objects.select_for_update().filter(pk=listing_id).first()
        )
        if listing is None:
            raise ListingUnavailableError(detail="Listing not found.")
        if listing.status == LPMarketListing.Status.COMPLETED:
            return {"completed": True, "already": True,
                    "tx_hash": listing.settlement_tx_hash}
        if listing.status != LPMarketListing.Status.LISTED:
            raise ListingUnavailableError()

        # Buyer must be an APPROVED LP (also gated by HasActivatedLP at the view).
        lp = (
            LiquidityProvider.objects.select_for_update()
            .filter(user=buyer_user, status=LPStatus.APPROVED)
            .first()
        )
        if lp is None:
            raise PermissionDenied("Only approved LPs can purchase.")
        if buyer_user == listing.seller:
            raise ValidationError({"listing": "You cannot buy your own listing."})

        total = listing.total_value
        if lp.current_balance < total:
            raise InsufficientBalanceError()

        # Seller side: wallet + the escrow-locked position.
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

        contract_address = _deployed_contract(listing.property_id)

        # Buyer gets a custodial wallet on demand (LPs aren't auto-walleted at KYB).
        buyer_wallet, _created = get_or_create_custodial_wallet(lp.user)

        # ---- REAL on-chain transfer, signed with the SELLER's custodial key ---- #
        signer = load_custodial_signer(seller_wallet)
        try:
            result = chain_service.transfer(
                contract_address, signer, buyer_wallet.wallet_address,
                int(listing.token_amount),
            )
        except ChainError:
            # Chain failed → nothing below runs; the atomic block rolls back. No fake tx.
            log.exception("LP-market on-chain transfer failed for listing %s", listing.pk)
            raise
        finally:
            del signer  # drop the signer (and its key) promptly

        tx_hash = result["tx_hash"]
        block = result.get("block_number")
        chain_id = result.get("chain_id")

        # ---- Settle cash: debit LP, credit seller (net) ---- #
        lp.current_balance = lp.current_balance - total
        lp.save(update_fields=["current_balance", "updated_at"])
        LPTransaction.objects.create(
            lp=lp, tx_type="purchase", amount=total, currency="USD",
            status=LPTransaction.TxStatus.COMPLETED,
            notes=f"LP-market purchase of listing {listing.pk}",
            processed_at=timezone.now(),
        )
        credit_user_balance(
            listing.seller, listing.net_amount, source="lp_market_sale",
            reference=str(listing.pk),
            memo=f"Sale of {listing.token_amount} {listing.token_symbol}",
        )

        # ---- Move OwnershipToken positions to match the chain ---- #
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
        # is correct for LP-acquired tokens. NO money flow change — the LP balance was
        # already debited above; this only RECORDS the price paid. Idempotent via the
        # completed-status guard at the top of this function. Local import avoids any
        # import cycle (investments.services never imports this module).
        from apps.investments.services import record_acquisition_cost

        record_acquisition_cost(
            user=buyer_user, property_slug=listing.property_id,
            property_name=listing.property_name, token_symbol=listing.token_symbol,
            token_amount=listing.token_amount, amount_paid=total,
            wallet=buyer_wallet, source="lp_market",
        )

        # ---- WalletTransaction 'transfer' rows (REAL chain values) ---- #
        for w in (seller_wallet, buyer_wallet):
            WalletTransaction.objects.create(
                wallet=w, tx_hash=tx_hash, tx_type="transfer",
                amount=total, token_symbol=listing.token_symbol,
                status="confirmed", block_number=block, chain_id=chain_id,
            )

        # ---- LP holding + listing completion ---- #
        holding = LPHolding.objects.create(
            lp=lp, listing=listing,
            property_id=listing.property_id, property_name=listing.property_name,
            token_symbol=listing.token_symbol, token_amount=listing.token_amount,
            purchase_price=total, current_value=total,
            status=LPHolding.Status.HELD,
        )
        now = timezone.now()
        listing.status = LPMarketListing.Status.COMPLETED
        listing.lp = lp
        listing.purchased_at = now
        listing.completed_at = now
        listing.settlement_tx_hash = tx_hash
        listing.save(update_fields=[
            "status", "lp", "purchased_at", "completed_at", "settlement_tx_hash",
            "updated_at",
        ])

        # Phase 10: notify BOTH parties (replay-safe — completed-guard returns early on
        # a re-run). The buyer is the LP user.
        notify(
            listing.seller, NotificationType.SECONDARY_SALE_SELLER,
            params={"property": listing.property_name, "tokens": listing.token_amount,
                    "amount": str(listing.net_amount)},
            action_url="/secondary-market",
        )
        notify(
            lp.user, NotificationType.SECONDARY_SALE_BUYER,
            params={"property": listing.property_name, "tokens": listing.token_amount},
            action_url="/portfolio",
        )

    return {
        "completed": True,
        "tx_hash": tx_hash,
        "block_number": block,
        "holding_id": str(holding.id),
        "explorer_tx": result.get("explorer_tx"),
    }


# --------------------------------------------------------------------------- #
# Read helpers for the API
# --------------------------------------------------------------------------- #
def listings_for(user, *, is_approved_lp: bool):
    """(my_listings, market_listings) — market inventory only visible to approved LPs."""
    mine = LPMarketListing.objects.filter(seller=user)
    market = (
        LPMarketListing.objects.filter(status=LPMarketListing.Status.LISTED)
        .exclude(seller=user)
        if is_approved_lp
        else LPMarketListing.objects.none()
    )
    return mine, market
