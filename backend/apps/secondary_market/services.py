"""
Peer secondary-market settlement — Phase 6 Wave 3.

Mirrors apps/lp/market_services.py exactly, with two differences (locked decisions):
  * the buyer pays from their internal `UserBalance` (not the LP buying float), and
  * the buyer is any KYC-approved investor (not an approved LP) — gated at the view.

Escrow reuses `OwnershipToken.locked_amount`, which is SHARED with the LP market, so
the same tokens can never be listed on both markets at once (single-market
exclusivity falls out of the shared available-balance check). The on-chain transfer
is the SAME seller-signed `apps.chain.transfer`. Atomic + idempotent; never a fake tx.

Fee = settings.SECONDARY_MARKET_FEE_PERCENT (default 1%), paid by the BUYER on top of the
price; the seller receives the full price (off-plan decision 5). Listings made before that
rule (fee_payer="seller") settle on the terms they were listed with.

Off-plan §6 — POSITION sale: an active installment plan is listed and sold as ONE position.
The buyer pays the seller (units × price − remaining principal) + the resale fee, and takes
over the plan: its units (paid and locked), its remaining installments and their dates.
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


class PositionChangedError(APIException):
    """The position's figures moved since the buyer saw them (off-plan §6.6)."""

    status_code = 409
    default_code = "POSITION_CHANGED"

    def __init__(self, figures: dict):
        super().__init__(
            detail={
                "code": "POSITION_CHANGED",
                "detail": "The position's figures have changed. Please review them and confirm again.",
                "cash": str(figures["cash"]),
                "fee": str(figures["fee"]),
                "buyer_total": str(figures["buyer_total"]),
            }
        )


def compute_fees(total_value: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    """
    (fee_percent, platform_fee_amount, net_amount) from the peer-market config. The buyer
    pays the fee on top, so the seller's net is the full price.
    """
    pct = Decimal(str(settings.SECONDARY_MARKET_FEE_PERCENT))
    fee = (total_value * pct / Decimal("100")).quantize(Decimal("0.01"), ROUND_HALF_UP)
    net = Decimal(total_value).quantize(Decimal("0.01"), ROUND_HALF_UP)
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
        # listed there can't be relisted here (single-market exclusivity). Units of a running
        # installment plan are sold only as a whole position (off-plan §6), so its paid-for
        # units are left out too.
        from apps.installments.position import plan_bound_released

        available = (
            max(0, position.available_amount - plan_bound_released(user.pk, property_id))
            if position else 0
        )
        if available < token_amount:
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
            fee_payer=SecondaryMarketListing.FeePayer.BUYER,
            status=SecondaryMarketListing.Status.LISTED,
            notes=data.get("notes") or None,
        )
    return listing


def cancel_listing(*, user, listing_id) -> SecondaryMarketListing:
    with transaction.atomic():
        _lock_plan_of(listing_id)  # position listings: payments → plan → listing
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


def _escrow_amount(listing: SecondaryMarketListing) -> int:
    """
    Units this listing holds in the seller's escrow. A unit listing holds all its units. A
    position listing holds the plan's PAID units (its unpaid units are locked by the plan
    itself); installments settled while it is listed keep their units in escrow.
    """
    if listing.plan_id is None:
        return int(listing.token_amount)
    from apps.installments.services import _down_paid, _released_for

    plan = listing.plan
    paid = _down_paid(plan) + sum(
        (Decimal(p.amount) for p in plan.payments.all() if p.status == "paid"), Decimal("0")
    )
    return _released_for(paid, Decimal(plan.total_amount), int(listing.token_amount))


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
    escrow = _escrow_amount(listing)
    position.locked_amount = max(0, int(position.locked_amount) - escrow)
    position.save(update_fields=["locked_amount", "updated_at"])


# --------------------------------------------------------------------------- #
# Purchase (atomic on-chain settlement; buyer pays from UserBalance)
# --------------------------------------------------------------------------- #
def purchase_listing(*, buyer_user, listing_id, expected_cash=None, expected_fee=None) -> dict:
    head = SecondaryMarketListing.objects.filter(pk=listing_id).only("plan_id").first()
    if head is not None and head.plan_id is not None:
        return buy_position(
            buyer_user=buyer_user, listing_id=listing_id,
            expected_cash=expected_cash, expected_fee=expected_fee,
        )
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
        buyer_pays = listing.buyer_total  # + the resale fee when the buyer carries it

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

        buyer_wallet, _created = get_or_create_custodial_wallet(buyer_user)

        # Debit the buyer FIRST (rolls back the whole tx on a shortfall → no transfer).
        try:
            debit_user_balance(
                buyer_user, buyer_pays, source="secondary_market_purchase",
                reference=str(listing.pk),
                memo=f"Buy {listing.token_amount} {listing.token_symbol}",
            )
        except InsufficientBalance:
            raise InsufficientBalanceError()

        tx_hash, block, chain_id, explorer_tx, on_chain = _transfer(
            listing, seller_wallet, buyer_wallet, int(listing.token_amount)
        )

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


def _transfer(listing, seller_wallet, buyer_wallet, amount: int):
    """
    Move `amount` units seller → buyer: on-chain when the property's token contract is
    deployed, otherwise an OFF-CHAIN custodial settlement (client note 14) where the
    OwnershipToken positions are the ledger of record. Non-deployed / demo / pre-launch
    inventory has no contract, so we settle the positions instead of hard-blocking the trade.
    No fake tx is ever emitted: off-chain rows carry an explicit "offchain:" marker, never a
    fabricated hash. Returns (tx_hash, block, chain_id, explorer_tx, on_chain).
    """
    try:
        contract_address = _deployed_contract(listing.property_id)
    except NotDeployedError:
        return f"offchain:{listing.pk}", None, None, None, False

    # REAL on-chain transfer, signed with the SELLER's custodial key.
    signer = load_custodial_signer(seller_wallet)
    try:
        result = chain_service.transfer(
            contract_address, signer, buyer_wallet.wallet_address, int(amount)
        )
    except ChainError:
        log.exception("Peer-market on-chain transfer failed for listing %s", listing.pk)
        raise
    finally:
        del signer
    return (
        result["tx_hash"], result.get("block_number"), result.get("chain_id"),
        result.get("explorer_tx"), True,
    )


# --------------------------------------------------------------------------- #
# Off-plan §6 — POSITION sale (a whole active installment plan).
# Lock order (no deadlock with the installment settlement, which locks a payment row and
# then its plan): plan's payment rows → plan → listing → positions → balances.
# --------------------------------------------------------------------------- #
def _lock_plan_of(listing_id):
    """Lock the payment rows + plan of a position listing (no-op for a unit listing)."""
    from apps.installments.models import InstallmentPayment, InstallmentPlan

    plan_id = (
        SecondaryMarketListing.objects.filter(pk=listing_id)
        .values_list("plan_id", flat=True).first()
    )
    if plan_id is None:
        return None
    list(InstallmentPayment.objects.select_for_update().filter(plan_id=plan_id).order_by("sequence"))
    return InstallmentPlan.objects.select_for_update().get(pk=plan_id)


def _current_price(property_slug) -> Decimal:
    from apps.properties.models import Property

    prop = Property.objects.filter(slug=property_slug).only("token_price").first()
    return Decimal(prop.token_price) if prop else Decimal("0")


def create_position_listing(*, user, plan_id, price_per_unit=None) -> SecondaryMarketListing:
    """
    List the caller's whole ACTIVE installment plan as one position at `price_per_unit`
    (default: the current unit price). The cash the seller would receive must be above 0,
    i.e. the price must cover the remaining principal. Escrows the plan's paid units.
    """
    from apps.installments.models import InstallmentPayment, InstallmentPlan
    from apps.installments.position import block_reason, plan_investment, position_figures

    with transaction.atomic():
        list(InstallmentPayment.objects.select_for_update().filter(plan_id=plan_id).order_by("sequence"))
        plan = (
            InstallmentPlan.objects.select_for_update()
            .filter(pk=plan_id, investor=user).first()
        )
        if plan is None:
            raise ValidationError({"plan_id": "Installment plan not found."})
        if SecondaryMarketListing.objects.filter(
            plan=plan, status=SecondaryMarketListing.Status.LISTED
        ).exists():
            raise ValidationError({"plan_id": "This position is already listed."})

        slug = plan.property.slug
        price = Decimal(str(price_per_unit)) if price_per_unit else _current_price(slug)
        if price <= 0:
            raise ValidationError({"price_per_unit": "Enter a price above 0."})
        inv = plan_investment(plan)
        figures = position_figures(plan, price, inv=inv)
        reason = block_reason(plan, inv, figures)
        if reason == "below_remaining":
            floor = (figures["remaining_principal"] / figures["units"]).quantize(Decimal("0.01"))
            raise ValidationError({
                "price_per_unit": (
                    f"The price must cover the remaining installments: above ${floor} per unit."
                ),
                "code": "below_remaining",
            })
        if reason is not None:
            raise ValidationError({"plan_id": f"This position can't be listed ({reason}).", "code": reason})

        wallet = UserWallet.objects.filter(user=user).first()
        position = (
            OwnershipToken.objects.select_for_update()
            .filter(wallet=wallet, property_id=slug).first()
            if wallet else None
        )
        units = figures["units"]
        paid_units = units - _plan_locked_units(plan, units)
        # The plan's paid units must still be free (not escrowed in a unit listing).
        if position is None or position.available_amount < paid_units:
            raise InsufficientTokensError(
                detail="Some of this plan's units are listed elsewhere. Cancel that listing first."
            )
        position.locked_amount = int(position.locked_amount) + paid_units
        position.save(update_fields=["locked_amount", "updated_at"])

        return SecondaryMarketListing.objects.create(
            seller=user,
            seller_type=_party_type(user),
            property_id=slug,
            property_name=plan.property.name,
            token_symbol=position.token_symbol,
            token_amount=units,
            unit_price=figures["price_per_unit"],
            total_value=figures["cash"],
            platform_fee_percent=figures["fee_percent"],
            platform_fee_amount=figures["fee"],
            net_amount=figures["cash"],
            fee_payer=SecondaryMarketListing.FeePayer.BUYER,
            plan=plan,
            position_value=figures["position_value"],
            paid_principal=figures["paid_principal"],
            assumed_principal=figures["remaining_principal"],
            status=SecondaryMarketListing.Status.LISTED,
        )


def _plan_locked_units(plan, units: int) -> int:
    """The plan's UNPAID units (locked by the plan itself)."""
    from apps.installments.services import _down_paid, _released_for

    paid = _down_paid(plan) + sum(
        (Decimal(p.amount) for p in plan.payments.all() if p.status == "paid"), Decimal("0")
    )
    return units - _released_for(paid, Decimal(plan.total_amount), units)


def refresh_position_listing(listing: SecondaryMarketListing) -> None:
    """Re-derive an open position listing's figures (after an installment was paid)."""
    from apps.installments.position import position_figures

    figures = position_figures(listing.plan, listing.unit_price)
    listing.total_value = figures["cash"]
    listing.net_amount = figures["cash"]
    listing.platform_fee_percent = figures["fee_percent"]
    listing.platform_fee_amount = figures["fee"]
    listing.position_value = figures["position_value"]
    listing.paid_principal = figures["paid_principal"]
    listing.assumed_principal = figures["remaining_principal"]
    listing.save(update_fields=[
        "total_value", "net_amount", "platform_fee_percent", "platform_fee_amount",
        "position_value", "paid_principal", "assumed_principal", "updated_at",
    ])


def close_position_listing(listing: SecondaryMarketListing) -> None:
    """
    The plan was paid off while listed: close the listing (its units are now plain units the
    holder sells like any others). Called by the installment settlement under its locks, after
    the plan already counts every unit as paid, so the whole position leaves escrow.
    """
    _release_escrow(listing)
    listing.status = SecondaryMarketListing.Status.CANCELLED
    listing.cancelled_at = timezone.now()
    listing.notes = "Closed: the installment plan was fully paid."
    listing.save(update_fields=["status", "cancelled_at", "notes", "updated_at"])


def buy_position(*, buyer_user, listing_id, expected_cash=None, expected_fee=None) -> dict:
    """
    Buy a whole position, atomically: the buyer pays the seller's cash + the resale fee, all
    the plan's units move to the buyer (its unpaid units stay locked for the plan), and the
    plan itself — remaining installments, dates, fees, any overdue row — becomes the buyer's.
    The buyer must confirm the cash and fee they saw; if either moved → POSITION_CHANGED.
    """
    from apps.installments.position import position_figures
    from apps.investments.services import record_acquisition_cost

    with transaction.atomic():
        plan = _lock_plan_of(listing_id)
        listing = SecondaryMarketListing.objects.select_for_update().filter(pk=listing_id).first()
        if listing is None or plan is None:
            raise ListingUnavailableError(detail="Listing not found.")
        if listing.status == SecondaryMarketListing.Status.COMPLETED:
            if listing.buyer_id == buyer_user.pk:  # a replay of the same purchase
                return {"completed": True, "already": True, "tx_hash": listing.settlement_tx_hash}
            raise ListingUnavailableError()
        if listing.status != SecondaryMarketListing.Status.LISTED:
            raise ListingUnavailableError()
        if buyer_user == listing.seller:
            raise ValidationError({"listing": "You cannot buy your own listing."})
        if plan.investor_id != listing.seller_id or plan.status != "active":
            raise ListingUnavailableError(detail="This position is no longer available.")

        figures = position_figures(plan, listing.unit_price)
        if expected_cash is None or expected_fee is None:
            raise ValidationError({
                "expected_cash": "Confirm the amount shown (expected_cash and expected_fee).",
            })
        if (
            Decimal(str(expected_cash)).quantize(Decimal("0.01")) != figures["cash"]
            or Decimal(str(expected_fee)).quantize(Decimal("0.01")) != figures["fee"]
        ):
            raise PositionChangedError(figures)
        if figures["cash"] <= 0:
            raise ListingUnavailableError(detail="This position is no longer available.")

        units = figures["units"]
        plan_locked = _plan_locked_units(plan, units)

        seller_wallet = UserWallet.objects.filter(user=listing.seller).first()
        buyer_wallet, _created = get_or_create_custodial_wallet(buyer_user)
        positions = {}
        for w in sorted((seller_wallet, buyer_wallet), key=lambda w: str(w.user_id)):
            pos, _ = OwnershipToken.objects.select_for_update().get_or_create(
                wallet=w, property_id=listing.property_id,
                defaults={
                    "property_name": listing.property_name,
                    "token_symbol": listing.token_symbol,
                    "token_amount": 0,
                },
            )
            positions[w.pk] = pos
        seller_pos = positions[seller_wallet.pk]
        buyer_pos = positions[buyer_wallet.pk]
        if int(seller_pos.token_amount) < units:
            raise ListingUnavailableError(detail="Seller no longer holds these units.")

        # Money: buyer pays cash + fee, seller receives the cash in full. Balances are locked
        # in user-id order.
        def _debit():
            try:
                debit_user_balance(
                    buyer_user, figures["buyer_total"], source="secondary_market_purchase",
                    reference=str(listing.pk),
                    memo=f"Buy installment position: {units} {listing.token_symbol}",
                )
            except InsufficientBalance:
                raise InsufficientBalanceError()

        def _credit():
            credit_user_balance(
                listing.seller, figures["cash"], source="secondary_market_sale",
                reference=str(listing.pk),
                memo=f"Sale of installment position: {units} {listing.token_symbol}",
            )

        for step in (sorted([(str(buyer_user.pk), _debit), (str(listing.seller_id), _credit)])):
            step[1]()

        tx_hash, block, chain_id, explorer_tx, on_chain = _transfer(
            listing, seller_wallet, buyer_wallet, units
        )

        # Units: all of them leave the seller (paid ones were in escrow, unpaid ones locked by
        # the plan); the buyer receives them with the plan's unpaid share still locked.
        seller_pos.token_amount = int(seller_pos.token_amount) - units
        seller_pos.locked_amount = max(0, int(seller_pos.locked_amount) - units)
        _recompute_position(seller_pos, listing.property_id)
        if seller_pos.token_amount == 0:
            seller_pos.status = OwnershipToken.Status.SOLD
        seller_pos.save()

        buyer_pos.token_amount = int(buyer_pos.token_amount) + units
        buyer_pos.locked_amount = int(buyer_pos.locked_amount) + plan_locked
        buyer_pos.property_name = listing.property_name
        buyer_pos.token_symbol = listing.token_symbol
        buyer_pos.status = OwnershipToken.Status.ACTIVE
        _recompute_position(buyer_pos, listing.property_id)
        buyer_pos.save()

        # The plan is the buyer's now: its remaining rows are debited from their wallet and
        # the reminders go to them (fresh — the seller's reminder doesn't carry over).
        plan.investor = buyer_user
        plan.save(update_fields=["investor", "updated_at"])
        plan.payments.filter(status__in=("pending", "missed")).update(
            reminder_sent_at=None, due_reminder_sent_at=None
        )

        # The buyer's cost basis is their entry price on ALL the units (paid now + assumed).
        record_acquisition_cost(
            user=buyer_user, property_slug=listing.property_id,
            property_name=listing.property_name, token_symbol=listing.token_symbol,
            token_amount=units, amount_paid=figures["position_value"],
            wallet=buyer_wallet, source="secondary_market",
        )

        for w in (seller_wallet, buyer_wallet):
            WalletTransaction.objects.create(
                wallet=w, tx_hash=tx_hash, tx_type="transfer",
                amount=figures["cash"], token_symbol=listing.token_symbol,
                status="confirmed", block_number=block, chain_id=chain_id,
            )

        now = timezone.now()
        listing.status = SecondaryMarketListing.Status.COMPLETED
        listing.buyer = buyer_user
        listing.buyer_type = _party_type(buyer_user)
        listing.purchased_at = now
        listing.completed_at = now
        listing.settlement_tx_hash = tx_hash
        listing.total_value = figures["cash"]
        listing.net_amount = figures["cash"]
        listing.platform_fee_percent = figures["fee_percent"]
        listing.platform_fee_amount = figures["fee"]
        listing.position_value = figures["position_value"]
        listing.paid_principal = figures["paid_principal"]
        listing.assumed_principal = figures["remaining_principal"]
        listing.save()

        notify(
            listing.seller, NotificationType.SECONDARY_SALE_SELLER,
            params={"property": listing.property_name, "tokens": units,
                    "amount": str(figures["cash"])},
            action_url="/secondary-market",
        )
        notify(
            buyer_user, NotificationType.SECONDARY_SALE_BUYER,
            params={"property": listing.property_name, "tokens": units},
            action_url="/installments",
        )

    return {
        "completed": True,
        "tx_hash": tx_hash,
        "block_number": block,
        "explorer_tx": explorer_tx,
        "on_chain": on_chain,
        "plan_id": str(plan.pk),
    }


def listings_for(user):
    """(my_listings, market_listings) — market = others' listed inventory."""
    mine = SecondaryMarketListing.objects.filter(seller=user)
    market = SecondaryMarketListing.objects.filter(
        status=SecondaryMarketListing.Status.LISTED
    ).exclude(seller=user)
    return mine, market
