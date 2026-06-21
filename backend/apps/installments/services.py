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
from datetime import date
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
