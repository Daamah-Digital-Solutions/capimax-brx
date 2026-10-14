"""
Off-plan model §6 — an active installment plan valued (and sold) as ONE position.

    position value  = all the plan's units × price per unit
    remaining       = principal of the installments not paid yet
    cash to seller  = position value − remaining      (never below 0: an under-water
                                                       position is worth 0, not a debt)
    resale fee      = SECONDARY_MARKET_FEE_PERCENT of the cash, paid by the BUYER on top

The installment fee the seller already paid is not refunded: "paid" means principal only.
Every holder is measured from their OWN entry price (the plan price for whoever started it,
the price they bought the position at otherwise). Pure reads — nothing here writes.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings

from .models import InstallmentPaymentStatus, InstallmentPlanStatus

_CENT = Decimal("0.01")
_UNPAID = (InstallmentPaymentStatus.PENDING, InstallmentPaymentStatus.MISSED)


def _q(value) -> Decimal:
    return Decimal(value).quantize(_CENT, rounding=ROUND_HALF_UP)


def resale_fee_percent() -> Decimal:
    return Decimal(str(settings.SECONDARY_MARKET_FEE_PERCENT))


def plan_investment(plan):
    """The minted (down-payment) investment that holds the plan's units, or None."""
    return plan.investments.order_by("created_at").first()


def plan_units(plan, inv=None) -> int:
    inv = inv if inv is not None else plan_investment(plan)
    if inv is not None:
        return int(inv.token_amount)
    return int(plan.units_total or 0)


def _rows(plan):
    # Prefetched rows when available (list views), a query otherwise.
    return list(plan.payments.all())


def remaining_principal(plan) -> Decimal:
    owed = sum((Decimal(p.amount) for p in _rows(plan) if p.status in _UNPAID), Decimal("0"))
    if plan.down_paid_at is None:
        owed += Decimal(plan.down_payment_amount)
    return _q(owed)


def paid_principal(plan) -> Decimal:
    return _q(Decimal(plan.total_amount) - remaining_principal(plan))


def position_figures(plan, price_per_unit, *, inv=None) -> dict:
    """The sale figures of `plan` at `price_per_unit` (see the module docstring)."""
    units = plan_units(plan, inv)
    price = _q(price_per_unit)
    remaining = remaining_principal(plan)
    value = _q(Decimal(units) * price)
    cash = max(Decimal("0"), _q(value - remaining))
    pct = resale_fee_percent()
    fee = _q(cash * pct / Decimal("100"))
    return {
        "units": units,
        "price_per_unit": price,
        "position_value": value,
        "remaining_principal": remaining,
        "paid_principal": paid_principal(plan),
        "cash": cash,
        "fee_percent": pct,
        "fee": fee,
        "buyer_total": _q(cash + fee),
    }


def holder_entry(plan, inv=None):
    """
    (entry price per unit, acquired_at) of the plan's CURRENT holder: the price paid for the
    position when it was bought on the market, else the plan's own price.
    """
    bought = (
        plan.position_listings.filter(status="completed", buyer_id=plan.investor_id)
        .order_by("-completed_at")
        .first()
    )
    if bought is not None:
        return Decimal(bought.unit_price), bought.completed_at
    units = plan_units(plan, inv)
    if plan.unit_price is not None:
        entry = Decimal(plan.unit_price)
    elif units:
        entry = _q(Decimal(plan.total_amount) / Decimal(units))
    else:
        entry = Decimal("0")
    return entry, plan.down_paid_at or plan.created_at


def block_reason(plan, inv, figures) -> str | None:
    """Why the plan can't be listed right now (None = it can)."""
    if plan.status != InstallmentPlanStatus.ACTIVE:
        return "not_active"
    if inv is None or not inv.tokens_minted:
        return "not_minted"
    if figures["remaining_principal"] <= 0:
        return "fully_paid"  # plain units now: sold like any other units
    if figures["cash"] <= 0:
        return "below_remaining"
    return None


def holder_view(plan, current_price, inv=None) -> dict:
    """The plan as a position for its holder: value today, their cost and gain, blockers."""
    inv = inv if inv is not None else plan_investment(plan)
    figures = position_figures(plan, current_price, inv=inv)
    entry, acquired_at = holder_entry(plan, inv)
    units = figures["units"]
    cost = max(Decimal("0"), _q(Decimal(units) * entry - figures["remaining_principal"]))
    gain = _q(Decimal(units) * (Decimal(current_price) - entry))
    listing = plan.position_listings.filter(status="listed").first()
    return {
        "currentPrice": float(figures["price_per_unit"]),
        "units": units,
        "value": float(figures["position_value"]),
        "remainingPrincipal": float(figures["remaining_principal"]),
        "paidPrincipal": float(figures["paid_principal"]),
        "equity": float(figures["cash"]),
        "entryPrice": float(entry),
        "cost": float(cost),
        "gain": float(gain),
        "acquiredAt": acquired_at.isoformat() if acquired_at else None,
        "feePercent": float(figures["fee_percent"]),
        "blocked": None if listing else block_reason(plan, inv, figures),
        "listingId": str(listing.pk) if listing else None,
        "listingPrice": float(listing.unit_price) if listing else None,
        "listingCash": float(listing.total_value) if listing else None,
    }


def plan_bound_released(user_id, property_slug) -> int:
    """
    Paid-for units of the holder's ACTIVE plans on this property that are NOT already held
    in a position listing's escrow. They can't be sold one by one (a running plan is sold
    only as a whole position), so unit listings must leave them out. Unpaid units are
    already excluded through OwnershipToken.locked_amount.
    """
    from .models import InstallmentPlan
    from .services import _down_paid, _released_for

    held = 0
    plans = (
        InstallmentPlan.objects.filter(
            investor_id=user_id, property__slug=property_slug,
            status=InstallmentPlanStatus.ACTIVE,
        )
        .exclude(position_listings__status="listed")
        .prefetch_related("payments", "investments")
    )
    for plan in plans:
        inv = next(iter(sorted(plan.investments.all(), key=lambda i: i.created_at)), None)
        if inv is None or not inv.tokens_minted:
            continue
        paid = _down_paid(plan) + sum(
            (Decimal(p.amount) for p in plan.payments.all()
             if p.status == InstallmentPaymentStatus.PAID),
            Decimal("0"),
        )
        held += _released_for(paid, Decimal(plan.total_amount), int(inv.token_amount))
    return held
