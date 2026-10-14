"""
Installment terms an off-plan property offers (OFFPLAN_EXIT_MODEL_AR.md §4).

A term is (months, down payment %): the investor pays the down payment now and the rest in
(months - 1) equal monthly installments. A property's admin-set terms win; a property with
none offers the default table below. The installment fee (Property.fee_installment, default
4%) is charged on the down payment and on every installment, instead of the platform fee.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from rest_framework.exceptions import ValidationError

_CENTS = Decimal("0.01")

# months -> down payment %
DEFAULT_TERMS: tuple[tuple[int, Decimal], ...] = (
    (6, Decimal("30")),
    (12, Decimal("25")),
    (18, Decimal("20")),
    (24, Decimal("15")),
)


def terms_for(prop) -> list[tuple[int, Decimal]]:
    """The terms this property offers, shortest first."""
    rows = sorted(prop.installment_terms.all(), key=lambda t: (t.order, t.duration_months))
    if rows:
        return [(int(t.duration_months), Decimal(t.down_payment_percent)) for t in rows]
    return list(DEFAULT_TERMS)


def _fmt(pct: Decimal) -> str:
    return f"{pct.normalize():f}"


def resolve_term(prop, *, down_payment_percent=None, n_installments=None,
                 frequency="monthly", term_months=None) -> tuple[int, Decimal]:
    """
    Return the offered (months, down %) matching the request, or raise a 400.

    Accepts the term directly (`term_months`) or the engine's shape (`n_installments`
    monthly installments = a term of n + 1 months). A down % that is sent must match the term.
    """
    offered = terms_for(prop)
    if term_months is not None:
        months = int(term_months)
    else:
        if (frequency or "monthly") != "monthly":
            raise ValidationError({"frequency": "Installment plans are paid monthly."})
        if n_installments is None:
            raise ValidationError({"installment": "Choose an installment term."})
        months = int(n_installments) + 1
    for m, pct in offered:
        if m != months:
            continue
        if down_payment_percent is not None and Decimal(str(down_payment_percent)).quantize(
            _CENTS
        ) != pct.quantize(_CENTS):
            raise ValidationError(
                {"down_payment_percent": f"The down payment for a {m}-month plan is {_fmt(pct)}%."}
            )
        return m, pct
    available = ", ".join(f"{m} months ({_fmt(p)}% down)" for m, p in offered)
    raise ValidationError(
        {"installment": f"This installment term isn't offered for this property. Available: {available}."}
    )


def fee_for(base, rate) -> Decimal:
    """Installment fee on one payment's base amount (cent-rounded)."""
    return (Decimal(base) * Decimal(rate) / Decimal(100)).quantize(_CENTS, rounding=ROUND_HALF_UP)
