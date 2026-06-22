"""
Installments services — Wave A.

`build_installment_plan` validates eligibility and computes a CENT-EXACT schedule
(down-payment + N equal installments of the financed remainder), then persists the plan
(`draft`) and its payment rows (`pending`).

WAVE A INVARIANT: no money, no mint, no token movement. This function NEVER touches
balances, wallets, payments, or the chain — it only writes plan/schedule rows. The
down-payment charge + FULL-MINT-THEN-LOCK release + per-installment payments are later
waves (see models.py header for the locked release model).

Cent-exactness guarantee: down_payment_amount + Σ(payment.amount) == total_amount, to the
cent. The remainder cents from dividing the financed balance by N are absorbed by the
FINAL installment.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.properties.models import Property, PropertyModelType

from .models import (
    InstallmentFrequency,
    InstallmentPayment,
    InstallmentPaymentStatus,
    InstallmentPlan,
    InstallmentPlanStatus,
)

_CENTS = Decimal("0.01")
_FREQUENCY_STEP_MONTHS = {
    InstallmentFrequency.MONTHLY: 1,
    InstallmentFrequency.QUARTERLY: 3,
}


def _q(amount) -> Decimal:
    """Quantize to cents, half-up (display/charge rounding)."""
    return Decimal(amount).quantize(_CENTS, rounding=ROUND_HALF_UP)


def _add_months(d: date, months: int) -> date:
    """Add whole months to a date, clamping the day to the target month's length."""
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    last_day = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last_day))


def compute_schedule(*, total_amount, down_payment_percent, n_installments, frequency, anchor_date=None):
    """
    Pure cent-exact schedule math (no DB writes — easy to unit-test).

    Returns {total, down_payment, down_payment_percent, installment_amount,
             duration_months, frequency, rows:[{sequence, due_date, amount}]}.
    The financed remainder is split into N equal cent-floored amounts; the final row
    absorbs the leftover cents so down + Σ(rows) == total exactly.
    """
    total = _q(total_amount)
    if total <= 0:
        raise ValidationError({"total_amount": "Total must be greater than zero."})

    pct = Decimal(down_payment_percent)
    if pct <= 0 or pct >= 100:
        raise ValidationError(
            {"down_payment_percent": "Down payment percent must be between 0 and 100 (exclusive)."}
        )

    n = int(n_installments)
    if n < 1:
        raise ValidationError({"n_installments": "At least one installment is required."})

    if frequency not in _FREQUENCY_STEP_MONTHS:
        raise ValidationError(
            {"frequency": f"Frequency must be one of {list(_FREQUENCY_STEP_MONTHS)}."}
        )

    down = _q(total * pct / Decimal(100))
    remainder = total - down  # exact (both already in cents)

    # Base per-installment, floored to cents; the final row takes the leftover cents so
    # the rows sum to `remainder` exactly.
    base = (remainder / Decimal(n)).quantize(_CENTS, rounding=ROUND_DOWN)
    amounts = [base] * n
    leftover = remainder - base * n  # >= 0, a whole number of cents
    amounts[-1] = amounts[-1] + leftover

    step = _FREQUENCY_STEP_MONTHS[frequency]
    anchor = anchor_date or timezone.now().date()
    rows = [
        {
            "sequence": i + 1,
            "due_date": _add_months(anchor, (i + 1) * step),
            "amount": amounts[i],
        }
        for i in range(n)
    ]

    # Invariant: down + Σ(rows) == total, to the cent.
    assert down + sum(r["amount"] for r in rows) == total, "schedule not cent-exact"

    return {
        "total": total,
        "down_payment": down,
        "down_payment_percent": pct,
        "installment_amount": base,  # headline value; final row may differ by the leftover
        "duration_months": n * step,
        "frequency": frequency,
        "rows": rows,
    }


@transaction.atomic
def build_installment_plan(
    investor,
    prop: Property,
    *,
    total_amount,
    down_payment_percent,
    n_installments,
    frequency=InstallmentFrequency.MONTHLY,
):
    """
    Validate installment-eligibility and create a DRAFT plan + its PENDING payment rows.

    `total_amount` is the investor's financed principal (units × token_price in the real
    Checkout wave); kept an explicit input so this wave carries no pricing logic. Returns
    the created `InstallmentPlan`.

    NO money, NO mint, NO token movement — this is purely the plan/schedule foundation.
    """
    # Eligibility: only installment-model properties (Property.model field,
    # apps/properties/models.py:147 / PropertyModelType.INSTALLMENT).
    if prop.model != PropertyModelType.INSTALLMENT.value:
        raise ValidationError(
            {"property": "This property is not an installment-model property."}
        )

    sched = compute_schedule(
        total_amount=total_amount,
        down_payment_percent=down_payment_percent,
        n_installments=n_installments,
        frequency=frequency,
    )

    plan = InstallmentPlan.objects.create(
        investor=investor,
        property=prop,
        property_name=prop.name,
        total_amount=sched["total"],
        down_payment_amount=sched["down_payment"],
        down_payment_percent=Decimal(down_payment_percent),
        number_of_installments=int(n_installments),
        installment_amount=sched["installment_amount"],
        frequency=frequency,
        duration_months=sched["duration_months"],
        status=InstallmentPlanStatus.DRAFT,
    )

    InstallmentPayment.objects.bulk_create(
        [
            InstallmentPayment(
                plan=plan,
                sequence=row["sequence"],
                due_date=row["due_date"],
                amount=row["amount"],
                status=InstallmentPaymentStatus.PENDING,
            )
            for row in sched["rows"]
        ]
    )
    return plan


def mark_down_payment_settled(plan: InstallmentPlan) -> InstallmentPlan:
    """
    Wave B: activate a plan on a CONFIRMED down-payment (settlement-gated). Idempotent —
    a replayed webhook is a no-op once `down_paid_at` is set. Sets status ACTIVE +
    `down_paid_at`; the N installment rows stay `pending` (charged in Wave C). NO money
    or mint here — the caller (mint_investment) already settled the charge + minted-locked.
    """
    if plan.down_paid_at is not None:
        return plan  # already settled — idempotent
    plan.status = InstallmentPlanStatus.ACTIVE
    plan.down_paid_at = timezone.now()
    plan.save(update_fields=["status", "down_paid_at", "updated_at"])
    return plan


# --------------------------------------------------------------------------- #
# Wave C — per-installment gated payment settlement + progressive token release.
#
# Each installment is its OWN gated charge (reusing the Stripe/NOW webhook→IPN path, like
# the down-payment). On a CONFIRMED installment, settle_installment_payment moves more of
# the already-minted position from LOCKED → RELEASED (NO new mint, NO clawback), credits
# the owner/broker on THAT installment's amount, and completes the plan on the final one.
# --------------------------------------------------------------------------- #
def _down_paid(plan: InstallmentPlan) -> Decimal:
    """The confirmed down-payment contribution to paid-so-far (0 until it settles)."""
    return Decimal(plan.down_payment_amount) if plan.down_paid_at else Decimal("0")


def _released_for(total_paid: Decimal, total: Decimal, token_amount: int) -> int:
    """
    FLOOR(total_paid / total × token_amount), clamped to [0, token_amount]. FLOOR so we
    NEVER release tokens that aren't paid for (the locked remainder stays un-sellable).
    """
    if total <= 0 or token_amount <= 0:
        return 0
    raw = (Decimal(total_paid) / Decimal(total) * Decimal(token_amount)).to_integral_value(
        rounding=ROUND_DOWN
    )
    return max(0, min(int(token_amount), int(raw)))


def settle_installment_payment(installment_payment_id) -> dict:
    """
    Settle ONE confirmed (webhook/IPN-gated) installment payment. Idempotent — a replay
    no-ops once the row is PAID. In ONE atomic block:
      * mark the InstallmentPayment row `paid` (+ paid_at),
      * PROGRESSIVELY RELEASE: released = floor(total_paid/total × token_amount); reduce the
        position's OwnershipToken.locked_amount by the incremental release (NO new mint),
      * credit owner-net + broker-commission on THIS installment's amount (keyed on the
        InstallmentPayment id → its own idempotency, separate from the down-payment/others),
      * when the final installment clears → plan status `completed` (released == full).

    NO new mint, NO token clawback — only locked→released movement on the already-minted
    position. The decrement rides ON TOP of any market-listing escrow on the same token
    (that escrow is paid-for and stays locked); we only ever release THIS plan's share.
    Returns a small dict describing what moved (for the gated core + tests).
    """
    from apps.investments.models import Investment
    from apps.investments.services import credit_broker_share, credit_owner_share
    from apps.notifications.models import Notification
    from apps.notifications.services import notify
    from apps.wallets.models import OwnershipToken

    with transaction.atomic():
        ip = InstallmentPayment.objects.select_for_update().get(pk=installment_payment_id)
        if ip.status == InstallmentPaymentStatus.PAID:
            return {"settled": True, "already": True, "sequence": ip.sequence}

        # Lock the plan → serialize concurrent installment settlements of the SAME plan, so
        # the cumulative released math + the completed-transition can't race.
        plan = InstallmentPlan.objects.select_for_update().get(pk=ip.plan_id)

        # The minted position holding the tokens (the down-payment investment). Lazy-loaded
        # off the plan — NOT select_related on a locked row (the nullable-join FOR UPDATE trap).
        inv = (
            Investment.objects.select_related("property")
            .filter(installment_plan_id=plan.id)
            .order_by("created_at")
            .first()
        )

        total = Decimal(plan.total_amount)
        # Paid-so-far BEFORE this installment (down once confirmed + already-paid rows; `ip`
        # is still pending here, so it is naturally excluded from the sum).
        already_paid = sum(
            (Decimal(p.amount) for p in plan.payments.all()
             if p.status == InstallmentPaymentStatus.PAID),
            Decimal("0"),
        )
        total_paid_before = _down_paid(plan) + already_paid

        # Mark this installment paid.
        ip.status = InstallmentPaymentStatus.PAID
        ip.paid_at = timezone.now()
        ip.save(update_fields=["status", "paid_at"])
        total_paid_after = total_paid_before + Decimal(ip.amount)

        # PROGRESSIVE RELEASE on the already-minted position (no new mint).
        released_before = released_after = token_total = 0
        if inv is not None and inv.tokens_minted and inv.wallet_id:
            token_total = int(inv.token_amount)
            released_before = _released_for(total_paid_before, total, token_total)
            released_after = _released_for(total_paid_after, total, token_total)
            delta = released_after - released_before
            if delta > 0:
                token = (
                    OwnershipToken.objects.select_for_update()
                    .filter(wallet_id=inv.wallet_id, property_id=inv.property.slug)
                    .first()
                )
                if token is not None:
                    token.locked_amount = max(0, int(token.locked_amount) - delta)
                    token.save(update_fields=["locked_amount", "updated_at"])

        # Per-installment owner + broker credit on THIS installment's amount, keyed on the
        # InstallmentPayment id (independent idempotency from the down-payment + other rows).
        owner_net = broker_result = None
        if inv is not None:
            tag = f"installment {ip.sequence}/{plan.number_of_installments} of {inv.property.slug}"
            owner_net = credit_owner_share(
                inv, inv.property, gross=ip.amount, reference=str(ip.id),
                memo=f"Primary sale ({tag})",
            )
            broker_result = credit_broker_share(
                inv, gross=ip.amount, reference=str(ip.id),
                memo=f"Referral commission ({tag})",
            )

        # Final installment cleared → complete the plan. By the floor math, total_paid_after
        # == total ⇒ released_after == token_total ⇒ the position is fully unlocked for this plan.
        remaining = (
            plan.payments.exclude(pk=ip.pk)
            .exclude(status=InstallmentPaymentStatus.PAID)
            .exists()
        )
        completed = not remaining
        if completed:
            plan.status = InstallmentPlanStatus.COMPLETED
            plan.save(update_fields=["status", "updated_at"])

        # Notifications (same atomic block; only on the newly-settled path).
        if inv is not None:
            notify(
                plan.investor, Notification.Type.INSTALLMENT_PAID,
                params={
                    "property": inv.property.name, "slug": inv.property.slug,
                    "sequence": ip.sequence, "total": plan.number_of_installments,
                    "released": released_after, "tokens": token_total,
                },
                action_url="/installments",
            )
            if owner_net is not None and inv.property.submitted_by_id:
                notify(
                    inv.property.submitted_by, Notification.Type.EARNINGS_CREDITED,
                    params={"property": inv.property.name, "slug": inv.property.slug,
                            "amount": str(owner_net)},
                    action_url="/owner-wallet",
                )
            if broker_result is not None:
                broker, commission = broker_result
                notify(
                    broker.user, Notification.Type.BROKER_COMMISSION_CREDITED,
                    params={"property": inv.property.name, "slug": inv.property.slug,
                            "amount": str(commission)},
                    action_url="/broker-dashboard",
                )

    return {
        "settled": True,
        "sequence": ip.sequence,
        "released": released_after,
        "released_delta": released_after - released_before,
        "token_amount": token_total,
        "plan_completed": completed,
        "owner_credited": None if owner_net is None else str(owner_net),
        "broker_credited": None if broker_result is None else str(broker_result[1]),
    }


def installment_locked_tokens(user_id, property_slug) -> int:
    """
    Tokens currently LOCKED (unpaid) across a holder's ACTIVE installment plans for one
    property = Σ over active plans of (position token_amount − released), where
    released = floor(total_paid/total × token_amount).

    The distribution engine subtracts THIS from a holding's full token_amount so an
    installment holder earns yield only on the RELEASED (paid) share. It is computed from
    the authoritative plan/payment rows — NOT from OwnershipToken.locked_amount, which also
    carries market-listing escrow (paid-for tokens that DO still earn). Returns 0 for a
    normal holder (no active installment plan) and for a fully-paid/completed plan
    (released == full), so distributions are unchanged for everyone but mid-plan holders.
    """
    locked = 0
    plans = (
        InstallmentPlan.objects.filter(
            investor_id=user_id,
            property__slug=property_slug,
            status=InstallmentPlanStatus.ACTIVE,
        )
        .select_related("property")
        .prefetch_related("payments", "investments")
    )
    for plan in plans:
        inv = next(iter(plan.investments.all()), None)
        if inv is None or not inv.tokens_minted:
            continue  # not minted → no OwnershipToken to dock anyway
        token_total = int(inv.token_amount)
        total_paid = _down_paid(plan) + sum(
            (Decimal(p.amount) for p in plan.payments.all()
             if p.status == InstallmentPaymentStatus.PAID),
            Decimal("0"),
        )
        released = _released_for(total_paid, Decimal(plan.total_amount), token_total)
        locked += max(0, token_total - released)
    return locked


# --------------------------------------------------------------------------- #
# Wave D — missed-payment DEFAULT + forfeiture (the last installments wave).
#
# An installment becomes `missed` once its due_date passes unpaid; a plan `defaults` only
# once its EARLIEST unpaid installment is overdue by MORE than the grace period (settings
# .INSTALLMENT_DEFAULT_GRACE_DAYS, default 30) — NOT on the first late day. On default the
# investor KEEPS the RELEASED (paid-for) tokens and FORFEITS the LOCKED (unpaid) ones: the
# position is reduced to the released amount, freeing that supply back to the property.
# NO money refund, NO on-chain clawback of kept tokens. Detection is run by the
# `check_installment_defaults` management command (scheduling it daily is a deploy concern).
# --------------------------------------------------------------------------- #
def mark_overdue_missed(today: date | None = None) -> int:
    """
    Mark every PENDING installment on an ACTIVE plan whose due_date has passed as MISSED
    (lifecycle bookkeeping). Idempotent; returns the count newly marked. PAID/CANCELLED
    rows are untouched, and this never changes plan/token state — defaulting is separate.
    """
    today = today or timezone.now().date()
    return (
        InstallmentPayment.objects.filter(
            plan__status=InstallmentPlanStatus.ACTIVE,
            status=InstallmentPaymentStatus.PENDING,
            due_date__lt=today,
        ).update(status=InstallmentPaymentStatus.MISSED)
    )


def find_defaultable_plan_ids(grace_days: int, today: date | None = None) -> list:
    """
    IDs of ACTIVE plans whose EARLIEST unpaid (pending/missed) installment is overdue by
    MORE than `grace_days` — i.e. its due_date < today − grace_days. Only ACTIVE plans
    qualify (draft never minted; completed fully paid; defaulted already handled).
    """
    today = today or timezone.now().date()
    cutoff = today - timedelta(days=grace_days)
    return list(
        InstallmentPlan.objects.filter(
            status=InstallmentPlanStatus.ACTIVE,
            payments__status__in=[
                InstallmentPaymentStatus.PENDING,
                InstallmentPaymentStatus.MISSED,
            ],
            payments__due_date__lt=cutoff,
        )
        .values_list("id", flat=True)
        .distinct()
    )


def default_plan(plan_id) -> dict:
    """
    Default ONE plan: forfeit the LOCKED (unpaid) tokens, KEEP the RELEASED (paid) ones,
    void the remaining schedule, mark the plan `defaulted`. Idempotent — an already-
    defaulted plan is a no-op (no double-forfeit). NO money refund; NO on-chain clawback.

    Forfeiture representation (a ledger/POSITION adjustment — flagged, no on-chain burn):
      * kept = floor(total_paid / total × token_amount); forfeited = token_amount − kept.
      * The OwnershipToken is reduced to `kept` (token_amount −= forfeited; locked_amount −=
        forfeited, so the kept tokens are fully unlocked + tradable) and its value/ownership%
        recomputed. The on-chain wallet still physically holds the minted tokens; the
        platform LEDGER no longer credits the forfeited ones to the investor (so they can't
        be listed/sold via the platform) and the supply is freed by reducing the linked
        Investment.token_amount to `kept` (drives availability via investments.sold_tokens).
    """
    from apps.investments.models import Investment
    from apps.notifications.models import Notification
    from apps.notifications.services import notify
    from apps.wallets.models import OwnershipToken

    with transaction.atomic():
        plan = InstallmentPlan.objects.select_for_update().get(pk=plan_id)
        if plan.status != InstallmentPlanStatus.ACTIVE:
            # Already defaulted/completed/draft → idempotent no-op (no double-forfeit).
            return {"defaulted": False, "already": True, "status": plan.status}

        inv = (
            Investment.objects.select_related("property")
            .filter(installment_plan_id=plan.id)
            .order_by("created_at")
            .first()
        )

        kept = forfeited = 0
        if inv is not None and inv.tokens_minted and inv.wallet_id:
            token_total = int(inv.token_amount)
            total_paid = _down_paid(plan) + sum(
                (Decimal(p.amount) for p in plan.payments.all()
                 if p.status == InstallmentPaymentStatus.PAID),
                Decimal("0"),
            )
            kept = _released_for(total_paid, Decimal(plan.total_amount), token_total)
            forfeited = max(0, token_total - kept)

            if forfeited > 0:
                prop = inv.property
                supply = int(prop.token_supply or 0)
                token = (
                    OwnershipToken.objects.select_for_update()
                    .filter(wallet_id=inv.wallet_id, property_id=prop.slug)
                    .first()
                )
                if token is not None:
                    # Reduce the position to the kept (paid) tokens, fully unlocked. The
                    # decrement rides on top of any market-listing escrow (unchanged).
                    token.token_amount = max(0, int(token.token_amount) - forfeited)
                    token.locked_amount = max(0, int(token.locked_amount) - forfeited)
                    token.token_value_usd = (
                        Decimal(token.token_amount) * prop.token_price
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    token.ownership_percentage = (
                        (Decimal(token.token_amount) / Decimal(supply) * Decimal("100"))
                        .quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
                        if supply else Decimal("0")
                    )
                    token.save(update_fields=[
                        "token_amount", "locked_amount", "token_value_usd",
                        "ownership_percentage", "updated_at",
                    ])
                # Free the forfeited supply: the linked COMPLETED investment now reflects
                # only the kept tokens (investments.sold_tokens → availability recovers).
                inv.token_amount = kept
                inv.ownership_percentage = (
                    (Decimal(kept) / Decimal(supply) * Decimal("100"))
                    .quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
                    if supply else Decimal("0")
                )
                inv.save(update_fields=["token_amount", "ownership_percentage", "updated_at"])

        # Void the remaining schedule (every non-paid row → cancelled).
        plan.payments.exclude(status=InstallmentPaymentStatus.PAID).update(
            status=InstallmentPaymentStatus.CANCELLED
        )

        plan.status = InstallmentPlanStatus.DEFAULTED
        plan.defaulted_at = timezone.now()
        plan.forfeited_tokens = forfeited
        plan.save(update_fields=["status", "defaulted_at", "forfeited_tokens", "updated_at"])

        if inv is not None:
            notify(
                plan.investor, Notification.Type.INSTALLMENT_DEFAULTED,
                params={
                    "property": inv.property.name, "slug": inv.property.slug,
                    "kept": kept, "forfeited": forfeited,
                },
                action_url="/installments",
            )

    return {"defaulted": True, "kept": kept, "forfeited": forfeited}
