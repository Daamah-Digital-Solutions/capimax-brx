"""
Selling or transferring PART of an installment plan (client request, 2026-11).

The holder of an ACTIVE plan can sell (peer secondary market, liquidity provider) or transfer
(gift, family) any whole number of its units, at least one. The other party gets a plan of
their own for those units, the holder keeps a plan for the rest. Selling or transferring every
unit hands the plan itself over (the whole-position sale is unchanged, services in
apps.secondary_market).

The split, for `units` of a plan's N units (ratio r = units / N):
  * every amount of the plan — the down payment, each installment, each installment fee — is
    shared r : 1 − r; the new plan's share is floored to the cent, except its LAST installment,
    which takes whatever makes its total exactly round(original × r) (the fees likewise);
  * the original plan keeps the original minus the new plan's share, row by row,
so the two plans add up to the original to the cent: units, down payment, every installment and
its fee, paid and remaining. Both keep the same dates, statuses and terms.

What the new holder pays the old one is the share of what was already paid, adjusted by the
price: units × price per unit − the new plan's remaining principal (the same rule as the whole
position, apps/installments/position.py).

Rules: no part sale or transfer while an installment of the plan is overdue (pay it first), and
never more units than are free — units already offered on a market or in a pending transfer are
not free.

The plan's investment (the down-payment purchase that holds its units) is split the same way:
the new plan gets its own investment (PLAN_SPLIT_METHOD) for its share of the units, amount,
down payment and fee, and the original is reduced by it — the property's sold units and every
total built on primary purchases stay the same. Each holder's certificate follows their units.

Pure reads are `split_terms` / `part_figures` / `check_part`; `split_plan` writes and is called
by the three settlements under their locks (payment rows → plan → positions).
"""
from __future__ import annotations

from datetime import date
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    InstallmentPayment,
    InstallmentPaymentStatus,
    InstallmentPlan,
    InstallmentPlanStatus,
)

_CENT = Decimal("0.01")
_UNPAID = (InstallmentPaymentStatus.PENDING, InstallmentPaymentStatus.MISSED)


def _q(value) -> Decimal:
    return Decimal(value).quantize(_CENT, rounding=ROUND_HALF_UP)


def _floor(value) -> Decimal:
    return Decimal(value).quantize(_CENT, rounding=ROUND_DOWN)


def _shares(values, units: int, of_units: int) -> list[Decimal]:
    """
    The `units / of_units` share of each value: floored to the cent, the last one taking what
    makes the shares total exactly round(sum × ratio). Never negative (Σ floors ≤ floor(Σ)).
    """
    if not values:
        return []
    n, d = Decimal(units), Decimal(of_units)
    out = [_floor(Decimal(v) * n / d) for v in values]
    target = _q(sum((Decimal(v) for v in values), Decimal("0")) * n / d)
    out[-1] = target - sum(out[:-1], Decimal("0"))
    return out


def _rows(plan) -> list:
    return sorted(plan.payments.all(), key=lambda p: p.sequence)


def plan_units(plan, inv=None) -> int:
    from .position import plan_units as _units

    return _units(plan, inv)


def overdue_rows(plan, today: date | None = None) -> list:
    """Installments of the plan past their due date and not paid."""
    today = today or timezone.localdate()
    return [
        p for p in _rows(plan)
        if p.status == InstallmentPaymentStatus.MISSED
        or (p.status == InstallmentPaymentStatus.PENDING and p.due_date < today)
    ]


# --------------------------------------------------------------------------- #
# Pure reads
# --------------------------------------------------------------------------- #
def split_terms(plan, units: int, *, inv=None) -> dict:
    """The plan a holder of `units` of `plan` gets (nothing is written)."""
    total_units = plan_units(plan, inv)
    units = int(units)
    rows = _rows(plan)
    amounts = _shares([plan.down_payment_amount] + [p.amount for p in rows], units, total_units)
    fees = _shares([p.fee_amount for p in rows], units, total_units)
    down = amounts[0]
    out_rows = [
        {
            "payment": p, "sequence": p.sequence, "due_date": p.due_date, "status": p.status,
            "paid_at": p.paid_at, "amount": amount, "fee": fee,
        }
        for p, amount, fee in zip(rows, amounts[1:], fees)
    ]
    total = sum(amounts, Decimal("0"))
    paid = (down if plan.down_paid_at else Decimal("0")) + sum(
        (r["amount"] for r in out_rows if r["status"] == InstallmentPaymentStatus.PAID),
        Decimal("0"),
    )
    return {
        "units": units,
        "plan_units": total_units,
        "down_payment": down,
        "total": total,
        "paid": paid,
        "remaining": total - paid,
        "installment_amount": _q(Decimal(plan.installment_amount) * units / total_units),
        "rows": out_rows,
    }


def schedule(terms: dict, today: date | None = None) -> list[dict]:
    """The installments still to pay on the plan in `terms` (for the buyer's screen)."""
    today = today or timezone.localdate()
    return [
        {
            "sequence": r["sequence"],
            "due_date": r["due_date"].isoformat(),
            "amount": float(r["amount"]),
            "fee": float(r["fee"]),
            "charge": float(r["amount"] + r["fee"]),
            "overdue": r["status"] == InstallmentPaymentStatus.MISSED or r["due_date"] < today,
        }
        for r in terms["rows"] if r["status"] in _UNPAID
    ]


def part_figures(plan, units: int, price_per_unit, *, inv=None, fee_percent=None) -> dict:
    """
    The figures of taking `units` of `plan` at `price_per_unit`: the units' value, the
    principal the taker continues to pay, the cash for the paid share (never below 0), the fee
    on that cash (the secondary-market fee unless `fee_percent` is given), what the buyer pays
    when the fee is on top, what the seller nets when it is deducted, and the taker's schedule.
    """
    terms = split_terms(plan, units, inv=inv)
    price = _q(price_per_unit)
    value = _q(Decimal(terms["units"]) * price)
    cash = max(Decimal("0"), _q(value - terms["remaining"]))
    pct = Decimal(str(fee_percent if fee_percent is not None else settings.SECONDARY_MARKET_FEE_PERCENT))
    fee = _q(cash * pct / Decimal("100"))
    return {
        "units": terms["units"],
        "plan_units": terms["plan_units"],
        "price_per_unit": price,
        "position_value": value,
        "paid_principal": terms["paid"],
        "remaining_principal": terms["remaining"],
        "total": terms["total"],
        "cash": cash,
        "fee_percent": pct,
        "fee": fee,
        "buyer_total": _q(cash + fee),
        "seller_net": _q(cash - fee),
        "remaining_charge": sum(
            (r["amount"] + r["fee"] for r in terms["rows"] if r["status"] in _UNPAID), Decimal("0")
        ),
        "schedule": schedule(terms),
    }


def offered_units(plan, *, exclude_secondary=None, exclude_lp=None, exclude_transfer=None) -> int:
    """Units of the plan already offered: open market listings and pending transfers."""
    from apps.lp.models import LPMarketListing
    from apps.secondary_market.models import SecondaryMarketListing
    from apps.transfers.models import UnitTransfer

    sec = SecondaryMarketListing.objects.filter(plan=plan, status=SecondaryMarketListing.Status.LISTED)
    if exclude_secondary:
        sec = sec.exclude(pk=exclude_secondary)
    lp = LPMarketListing.objects.filter(plan=plan, status=LPMarketListing.Status.LISTED).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
    )
    if exclude_lp:
        lp = lp.exclude(pk=exclude_lp)
    tr = UnitTransfer.objects.filter(plan=plan, status__in=UnitTransfer.OPEN)
    if exclude_transfer:
        tr = tr.exclude(pk=exclude_transfer)
    return (
        sum(sec.values_list("token_amount", flat=True))
        + sum(lp.values_list("token_amount", flat=True))
        + sum(tr.values_list("units", flat=True))
    )


def free_units(plan, inv=None, **exclude) -> int:
    return max(0, plan_units(plan, inv) - offered_units(plan, **exclude))


def _refuse(code: str, detail: str, **extra):
    raise ValidationError({"code": code, "detail": detail, **extra})


def check_part(plan, units, *, inv=None, today: date | None = None, **exclude) -> None:
    """Refuse (400 with a `code`) a part sale or transfer of `units` of `plan` that can't happen."""
    from apps.payments.nova_pledge import active_pledge

    from .position import plan_investment

    try:
        units = int(units)
    except (TypeError, ValueError):
        units = 0
    if units < 1:
        _refuse("min_one_unit", "Choose at least 1 unit.")
    if plan.status != InstallmentPlanStatus.ACTIVE:
        _refuse("not_active", "This installment plan is not active.")
    inv = inv if inv is not None else plan_investment(plan)
    if inv is None or not inv.tokens_minted:
        _refuse("not_minted", "This plan's units are not issued yet.")
    if active_pledge(inv) is not None:
        _refuse("pledged", "This plan's units are pledged to Nova Finance.")
    late = overdue_rows(plan, today)
    if late:
        _refuse(
            "overdue_installments",
            "Pay the overdue installments of this plan first.",
            overdue=len(late),
        )
    free = free_units(plan, inv, **exclude)
    if units > free:
        _refuse(
            "exceeds_free_units",
            f"Only {free} unit(s) of this plan are free to sell or transfer.",
            free_units=free,
        )


# --------------------------------------------------------------------------- #
# The split (writes)
# --------------------------------------------------------------------------- #
def _paid(plan) -> Decimal:
    from .services import _down_paid

    return _down_paid(plan) + sum(
        (Decimal(p.amount) for p in plan.payments.all() if p.status == InstallmentPaymentStatus.PAID),
        Decimal("0"),
    )


def _plan_locked(plan, units: int) -> int:
    """The plan's unpaid units (the share of `units` its payments haven't released)."""
    from .services import _released_for

    return int(units) - _released_for(_paid(plan), Decimal(plan.total_amount), int(units))


def _ownership(units: int, supply: int) -> Decimal:
    if not supply:
        return Decimal("0")
    return (Decimal(units) / Decimal(supply) * Decimal("100")).quantize(
        Decimal("0.000001"), rounding=ROUND_HALF_UP
    )


def _refresh_certificate(inv) -> None:
    """The holder's certificate now covers fewer units: update it, its PDF is redrawn."""
    from apps.certificates.models import Certificate, CertificateStatus

    cert = (
        Certificate.objects.filter(investment=inv).exclude(status=CertificateStatus.REVOKED).first()
    )
    if cert is None:
        return
    old_units = int(cert.units_purchased or 0)
    if old_units:
        cert.platform_fee = _q(Decimal(cert.platform_fee) * int(inv.token_amount) / old_units)
    cert.units_purchased = int(inv.token_amount)
    cert.investment_amount = inv.amount_invested
    cert.ownership_percentage = inv.ownership_percentage
    cert.pdf_file = None
    cert.pdf_path = ""
    cert.pdf_url = ""
    cert.digital_signature_hash = ""
    cert.save()


def _lock_positions(wallets_and_defaults, slug):
    """Lock (creating if needed) the OwnershipToken of each wallet, in wallet-id order."""
    from apps.wallets.models import OwnershipToken

    out = {}
    for wallet_id, defaults in sorted(wallets_and_defaults, key=lambda w: str(w[0])):
        pos, _ = OwnershipToken.objects.select_for_update().get_or_create(
            wallet_id=wallet_id, property_id=slug, defaults=defaults,
        )
        out[wallet_id] = pos
    return out


def split_plan(plan, units: int, to_user, *, inv, acquired_price, cost_source: str):
    """
    Give `units` of `plan` to `to_user`; returns the plan they hold for them (a new plan, or
    `plan` itself when every unit goes). Moves the units in the ledger — both holders' positions
    and each plan's locked (unpaid) units — and splits the plan, its investment and certificate.
    Money and the on-chain transfer are the caller's.

    The caller runs inside transaction.atomic, holds the locks on the plan's payment rows and
    the plan (in that order), and has run `check_part`.
    """
    from apps.certificates.services import sync_certificate
    from apps.investments.models import PLAN_SPLIT_METHOD, Investment, PaymentStatus
    from apps.investments.services import record_acquisition_cost
    from apps.lp.market_services import _recompute_position
    from apps.wallets.models import OwnershipToken
    from apps.wallets.services import get_or_create_custodial_wallet

    from .services import holder_wallet_id

    units = int(units)
    total_units = plan_units(plan, inv)
    prop = plan.property
    slug = prop.slug
    supply = int(prop.token_supply or 0)
    now = timezone.now()
    from_wallet_id = holder_wallet_id(plan, inv)
    to_wallet, _ = get_or_create_custodial_wallet(to_user)
    locked_before = _plan_locked(plan, total_units)

    if units == total_units:
        # Every unit: the plan itself changes hands, as in the whole-position sale.
        plan.investor = to_user
        plan.acquired_price = _q(acquired_price)
        plan.acquired_at = now
        plan.save(update_fields=["investor", "acquired_price", "acquired_at", "updated_at"])
        plan.payments.filter(status__in=_UNPAID).update(reminder_sent_at=None, due_reminder_sent_at=None)
        new_plan = plan
        from_locked_after, to_locked = 0, locked_before
    else:
        terms = split_terms(plan, units, inv=inv)
        new_plan = InstallmentPlan.objects.create(
            investor=to_user,
            property=prop,
            property_name=plan.property_name,
            total_amount=terms["total"],
            down_payment_amount=terms["down_payment"],
            down_payment_percent=plan.down_payment_percent,
            number_of_installments=plan.number_of_installments,
            installment_amount=terms["installment_amount"],
            frequency=plan.frequency,
            duration_months=plan.duration_months,
            status=InstallmentPlanStatus.ACTIVE,
            down_paid_at=plan.down_paid_at,
            term_months=plan.term_months,
            unit_price=plan.unit_price,
            units_total=units,
            fee_rate=plan.fee_rate,
            split_from=plan,
            acquired_price=_q(acquired_price),
            acquired_at=now,
        )
        InstallmentPayment.objects.bulk_create([
            InstallmentPayment(
                plan=new_plan, sequence=r["sequence"], due_date=r["due_date"],
                amount=r["amount"], fee_amount=r["fee"], status=r["status"], paid_at=r["paid_at"],
            )
            for r in terms["rows"]
        ])
        # The original plan keeps the rest, row by row (so the two add up exactly).
        for r in terms["rows"]:
            p = r["payment"]
            p.amount = Decimal(p.amount) - r["amount"]
            p.fee_amount = Decimal(p.fee_amount) - r["fee"]
            p.save(update_fields=["amount", "fee_amount"])
        plan.total_amount = Decimal(plan.total_amount) - terms["total"]
        plan.down_payment_amount = Decimal(plan.down_payment_amount) - terms["down_payment"]
        plan.installment_amount = Decimal(plan.installment_amount) - terms["installment_amount"]
        if plan.units_total is not None:
            plan.units_total = int(plan.units_total) - units
        plan.save(update_fields=[
            "total_amount", "down_payment_amount", "installment_amount", "units_total", "updated_at",
        ])

        # The investment holding the units, split the same way (sold units unchanged in total).
        def part(value):
            return _q(Decimal(value or 0) * units / total_units)

        amount, fee, discount = part(inv.amount_invested), part(inv.fee_amount), part(inv.discount_amount)
        down = terms["down_payment"] if inv.down_payment_amount is not None else None
        new_inv = Investment.objects.create(
            user=to_user, property=prop, property_name=inv.property_name,
            amount_invested=amount, token_amount=units, token_symbol=inv.token_symbol,
            price_per_token=inv.price_per_token, ownership_percentage=_ownership(units, supply),
            payment_method=PLAN_SPLIT_METHOD, payment_status=PaymentStatus.COMPLETED,
            tokens_minted=True, minted_at=inv.minted_at or now, wallet=to_wallet,
            is_installment=True, down_payment_amount=down, fee_amount=fee,
            discount_amount=discount, installment_plan=new_plan,
        )
        inv.token_amount = int(inv.token_amount) - units
        inv.amount_invested = Decimal(inv.amount_invested) - amount
        inv.fee_amount = Decimal(inv.fee_amount or 0) - fee
        inv.discount_amount = Decimal(inv.discount_amount or 0) - discount
        if down is not None:
            inv.down_payment_amount = Decimal(inv.down_payment_amount) - down
        inv.ownership_percentage = _ownership(inv.token_amount, supply)
        inv.save(update_fields=[
            "token_amount", "amount_invested", "fee_amount", "discount_amount",
            "down_payment_amount", "ownership_percentage", "updated_at",
        ])
        _refresh_certificate(inv)
        sync_certificate(new_inv, notify_holder=False)

        from_locked_after = _plan_locked(plan, total_units - units)
        to_locked = _plan_locked(new_plan, units)

    # Both holders' positions: the units move, and so does each plan's unpaid (locked) share.
    defaults = {"property_name": prop.name, "token_symbol": inv.token_symbol, "token_amount": 0}
    positions = _lock_positions([(from_wallet_id, defaults), (to_wallet.pk, defaults)], slug)
    src, dst = positions[from_wallet_id], positions[to_wallet.pk]
    if int(src.token_amount) < units:
        _refuse("units_moved", "The plan's holder no longer holds these units.")
    src.token_amount = int(src.token_amount) - units
    src.locked_amount = max(0, int(src.locked_amount) - locked_before + from_locked_after)
    _recompute_position(src, slug)
    if src.token_amount == 0:
        src.status = OwnershipToken.Status.SOLD
    src.save()
    dst.token_amount = int(dst.token_amount) + units
    dst.locked_amount = int(dst.locked_amount) + to_locked
    dst.status = OwnershipToken.Status.ACTIVE
    _recompute_position(dst, slug)
    dst.save()

    if new_plan is plan:
        # The whole plan: the investment stays the original purchase; the new holder's cost
        # basis is recorded like any market purchase.
        record_acquisition_cost(
            user=to_user, property_slug=slug, property_name=prop.name,
            token_symbol=inv.token_symbol, token_amount=units,
            amount_paid=_q(Decimal(acquired_price) * units), wallet=to_wallet, source=cost_source,
        )
    return new_plan
