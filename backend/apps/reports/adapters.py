"""
Per-context data adapters — Phase 13. Each adapter fetches the CALLER's own, already-
served data (the SAME self-scoped querysets the existing page endpoints use) and maps it
to (title, columns, rows, meta) for the generic CSV/PDF renderers. NO new business logic,
NO new totals — figures are the same ones the page already shows.

Each adapter: fn(user, *, year=None, period="") -> dict(title, period, columns, rows, meta,
disclaimer?). `columns` is [(key, header)]; `rows` is [dict keyed by column keys].
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone


def _money(value) -> str:
    try:
        return f"{Decimal(str(value)):.2f}"
    except Exception:  # noqa: BLE001
        return "0.00"


def _display_name(user) -> str:
    profile = getattr(user, "profile", None)
    return (getattr(profile, "full_name", None) or (user.email or "").split("@")[0]) or "Account"


def _in_year(dt, year):
    return year is None or (dt is not None and dt.year == int(year))


# --------------------------------------------------------------------------- #
# Wallet — internal-balance ledger (the just-built /api/wallets/balance/transactions/).
# --------------------------------------------------------------------------- #
def wallet(user, *, year=None, period="", **_):
    from apps.wallets.models import BalanceTransaction

    qs = BalanceTransaction.objects.filter(balance__user=user).select_related("balance")
    rows = []
    for t in qs:
        if not _in_year(t.created_at, year):
            continue
        signed = t.amount if t.entry_type == "credit" else -t.amount
        rows.append({
            "date": t.created_at.date().isoformat(),
            "type": t.entry_type,
            "source": t.source,
            "amount": _money(signed),
            "reference": t.reference or "",
            "memo": t.memo or "",
        })
    return {
        "title": "Wallet Statement",
        "period": period or (str(year) if year else "All time"),
        "columns": [
            ("date", "Date"), ("type", "Type"), ("source", "Source"),
            ("amount", "Amount (USD)"), ("reference", "Reference"), ("memo", "Memo"),
        ],
        "rows": rows,
        "meta": [("Account", _display_name(user)), ("Entries", len(rows))],
    }


# --------------------------------------------------------------------------- #
# Distributions — the caller's PAID distribution payouts (apps/distributions).
# --------------------------------------------------------------------------- #
def _distribution_payouts(user, year=None):
    from apps.distributions.models import Distribution, DistributionPayout

    qs = DistributionPayout.objects.filter(
        user=user, credited=True, distribution__status=Distribution.Status.PAID,
    ).select_related("distribution")
    out = []
    for p in qs:
        d = p.distribution
        if not _in_year(d.pay_date, year):
            continue
        out.append((p, d))
    return out


def distributions(user, *, year=None, period="", **_):
    items = _distribution_payouts(user, year)
    rows, total = [], Decimal("0")
    for p, d in items:
        total += Decimal(str(p.share_amount_usd))
        rows.append({
            "date": d.pay_date.isoformat(),
            "property": d.property_name or d.property_id,
            "type": d.dist_type or "",
            "period": d.period_label or d.pay_date.isoformat(),
            "amount": _money(p.share_amount_usd),
        })
    return {
        "title": "Distributions Statement",
        "period": period or (str(year) if year else "All time"),
        "columns": [
            ("date", "Pay date"), ("property", "Property"), ("type", "Type"),
            ("period", "Period"), ("amount", "Amount (USD)"),
        ],
        "rows": rows,
        "meta": [("Account", _display_name(user)), ("Total received", f"${_money(total)}")],
    }


def distributions_tax(user, *, year=None, **_):
    """An INFORMATIONAL annual distribution-income summary — NOT a tax document."""
    yr = int(year) if year else timezone.now().year
    items = _distribution_payouts(user, yr)
    rows, total = [], Decimal("0")
    for p, d in items:
        total += Decimal(str(p.share_amount_usd))
        rows.append({
            "date": d.pay_date.isoformat(),
            "property": d.property_name or d.property_id,
            "amount": _money(p.share_amount_usd),
        })
    return {
        "title": "Annual Distribution Income Summary",
        "period": str(yr),
        "columns": [("date", "Pay date"), ("property", "Property"), ("amount", "Amount (USD)")],
        "rows": rows,
        "meta": [
            ("Account", _display_name(user)),
            ("Tax year", yr),
            ("Total distribution income", f"${_money(total)}"),
        ],
        "disclaimer": (
            "Informational annual summary of distribution income from your account records. "
            "This is NOT a tax document, NOT tax advice, and NOT an official statement — "
            "consult a qualified professional. UNAUDITED testnet deployment."
        ),
    }


# --------------------------------------------------------------------------- #
# Owner earnings — per-property primary-sale proceeds (mirrors OwnerEarningsView; same
# figures — gross − (platform+management)% fees, COMPLETED+minted investments only).
# --------------------------------------------------------------------------- #
def owner_earnings(user, *, year=None, period="", **_):
    from django.db.models import Count, Sum

    from apps.investments.models import Investment, PaymentStatus
    from apps.properties.models import Property

    rows, total_net = [], Decimal("0")
    for prop in Property.objects.filter(submitted_by=user):
        agg = Investment.objects.filter(
            property=prop, payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
        ).aggregate(
            gross=Sum("amount_invested"), units=Sum("token_amount"),
            investors=Count("user", distinct=True),
        )
        gross = Decimal(agg["gross"] or 0)
        # Buyer-borne fees (Option A): the fee is charged to the buyer, not carved out of
        # the owner — so the owner's net proceeds equal the full token value (fees 0).
        fees = Decimal("0.00")
        net = gross.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_net += net
        rows.append({
            "property": prop.name,
            "units_sold": int(agg["units"] or 0),
            "investors": int(agg["investors"] or 0),
            "gross": _money(gross),
            "fees": _money(fees),
            "net": _money(net),
        })
    return {
        "title": "Owner Earnings Report",
        "period": period or "All time",
        "columns": [
            ("property", "Property"), ("units_sold", "Units sold"), ("investors", "Investors"),
            ("gross", "Gross (USD)"), ("fees", "Fees (USD)"), ("net", "Net proceeds (USD)"),
        ],
        "rows": rows,
        "meta": [("Account", _display_name(user)), ("Total net proceeds", f"${_money(total_net)}")],
    }


# --------------------------------------------------------------------------- #
# LP — the caller's LP ledger (deposits / earnings / withdrawals).
# --------------------------------------------------------------------------- #
def lp(user, *, year=None, period="", **_):
    from apps.lp.models import LPTransaction

    qs = LPTransaction.objects.filter(lp__user=user)
    rows = []
    for t in qs:
        if not _in_year(t.created_at, year):
            continue
        rows.append({
            "date": t.created_at.date().isoformat(),
            "type": t.tx_type,
            "amount": _money(t.amount),
            "status": t.status,
        })
    return {
        "title": "Liquidity Provider Transactions",
        "period": period or (str(year) if year else "All time"),
        "columns": [
            ("date", "Date"), ("type", "Type"), ("amount", "Amount (USD)"), ("status", "Status"),
        ],
        "rows": rows,
        "meta": [("Account", _display_name(user)), ("Entries", len(rows))],
    }


# --------------------------------------------------------------------------- #
# Broker — the caller-broker's commission ledger (reuses commission_ledger()).
# --------------------------------------------------------------------------- #
def broker_commissions(user, *, year=None, period="", **_):
    from apps.broker.services import commission_ledger

    broker = getattr(user, "broker_profile", None)
    ledger = commission_ledger(broker) if broker else {"commissions": [], "stats": {}}
    rows = []
    for c in ledger["commissions"]:
        if year and not (c.get("date", "").startswith(str(year))):
            continue
        rows.append({
            "date": c.get("date", ""),
            "referral": c.get("referral", ""),
            "property": c.get("property", ""),
            "investment": _money(c.get("amount", 0)),
            "commission": _money(c.get("commission", 0)),
            "status": c.get("status", ""),
        })
    total = ledger.get("stats", {}).get("total_commission", "0.00")
    return {
        "title": "Broker Commissions Statement",
        "period": period or (str(year) if year else "All time"),
        "columns": [
            ("date", "Date"), ("referral", "Referred investor"), ("property", "Property"),
            ("investment", "Investment (USD)"), ("commission", "Commission (USD)"),
            ("status", "Status"),
        ],
        "rows": rows,
        "meta": [("Account", _display_name(user)), ("Total commission", f"${_money(total)}")],
    }


# --------------------------------------------------------------------------- #
# Installments — the caller's own installment plans + their payment schedule
# (mirrors the InstallmentPlans read the page already serves; same figures). One row
# per cash item: the down payment, then each scheduled installment.
# --------------------------------------------------------------------------- #
def installments(user, *, year=None, period="", **_):
    from apps.installments.models import InstallmentPlan

    plans = (
        InstallmentPlan.objects.filter(investor=user)
        .select_related("property")
        .prefetch_related("payments")
    )
    rows = []
    total_value = paid = remaining = Decimal("0")
    plan_count = 0
    for plan in plans:
        plan_count += 1
        total_value += Decimal(str(plan.total_amount))
        dp_paid = plan.down_paid_at is not None
        dp_date = (plan.down_paid_at or plan.created_at)
        # Down payment row (lives on the plan, not as a payment row).
        if _in_year(dp_date, year):
            rows.append({
                "property": plan.property_name,
                "sequence": "DP",
                "due": dp_date.date().isoformat(),
                "amount": _money(plan.down_payment_amount),
                "status": "paid" if dp_paid else "pending",
                "paid": (plan.down_paid_at.date().isoformat() if dp_paid else ""),
            })
        dp_amt = Decimal(str(plan.down_payment_amount))
        paid += dp_amt if dp_paid else Decimal("0")
        remaining += Decimal("0") if dp_paid else dp_amt
        # Scheduled installments (default-ordered by sequence).
        for p in plan.payments.all():
            amt = Decimal(str(p.amount))
            if p.status == "paid":
                paid += amt
            elif p.status in ("pending", "missed"):
                remaining += amt
            if not _in_year(p.due_date, year):
                continue
            rows.append({
                "property": plan.property_name,
                "sequence": str(p.sequence),
                "due": p.due_date.isoformat(),
                "amount": _money(p.amount),
                "status": p.status,
                "paid": (p.paid_at.date().isoformat() if p.paid_at else ""),
            })
    return {
        "title": "Installment Schedule",
        "period": period or (str(year) if year else "All time"),
        "columns": [
            ("property", "Property"), ("sequence", "#"), ("due", "Due date"),
            ("amount", "Amount (USD)"), ("status", "Status"), ("paid", "Paid date"),
        ],
        "rows": rows,
        "meta": [
            ("Account", _display_name(user)),
            ("Plans", plan_count),
            ("Total plan value", f"${_money(total_value)}"),
            ("Paid to date", f"${_money(paid)}"),
            ("Remaining", f"${_money(remaining)}"),
        ],
    }


# The export registry: context slug → adapter. (`distributions/tax` is its own endpoint.)
ADAPTERS = {
    "wallet": wallet,
    "distributions": distributions,
    "installments": installments,
    "owner-earnings": owner_earnings,
    "lp": lp,
    "broker-commissions": broker_commissions,
}
