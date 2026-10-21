"""
Per-context data adapters. Each one reads the CALLER's own records (the same querysets the
pages use) and returns a document payload for the PDF/CSV renderers:

    title, subtitle (the period), ref_prefix, note,
    summary  [(label, value[, strong])]          — the figures panel (PDF only)
    sections [{title, hint?, columns, rows, totals?, empty?}]   — tables, in order
    columns, rows                                 — the main table (also the CSV)

Rows hold RAW values (Decimal, ISO dates); the PDF formats them per column (`fmt`) and the
CSV keeps them machine-readable. No new business rules — only what the pages already show.

Every adapter: fn(user, *, rng: Range) -> dict, where `rng` is the requested period.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .brand import Col, day, money
from .labels import source_label

D0 = Decimal("0")


def _money(value) -> str:
    try:
        return f"{Decimal(str(value)):.2f}"
    except Exception:  # noqa: BLE001
        return "0.00"


def _usd(value) -> str:
    return f"{money(value)} USD"


def _display_name(user) -> str:
    profile = getattr(user, "profile", None)
    return (getattr(profile, "full_name", None) or (user.email or "").split("@")[0]) or "Account"


# --------------------------------------------------------------------------- #
# Periods
# --------------------------------------------------------------------------- #
@dataclass
class Range:
    start: datetime | None = None  # inclusive
    end: datetime | None = None  # exclusive
    label: str = "All time"
    year: int | None = None

    def has(self, when) -> bool:
        if when is None:
            return self.start is None and self.end is None
        if isinstance(when, date) and not isinstance(when, datetime):
            when = timezone.make_aware(datetime.combine(when, time.min))
        if self.start and when < self.start:
            return False
        if self.end and when >= self.end:
            return False
        return True


def _aware(d: date) -> datetime:
    return timezone.make_aware(datetime.combine(d, time.min))


def _parse_day(value) -> date | None:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def resolve_range(period: str = "", year=None, start=None, end=None) -> Range:
    """month | quarter | year (this calendar period to date), a full `year`, or start/end
    dates (YYYY-MM-DD, end inclusive). Anything else → all time."""
    today = timezone.localdate()
    p = (period or "").strip().lower()
    s, e = _parse_day(start), _parse_day(end)
    if s or e:
        lo = s
        hi = (e + timedelta(days=1)) if e else None
        label = f"{day(lo) if lo else 'Start'} – {day(e) if e else day(today)}"
        return Range(_aware(lo) if lo else None, _aware(hi) if hi else None, label)
    if p in ("month", "monthly"):
        lo = today.replace(day=1)
    elif p in ("quarter", "quarterly"):
        lo = date(today.year, 3 * ((today.month - 1) // 3) + 1, 1)
    elif p in ("year", "annual", "yearly", "ytd"):
        lo = date(today.year, 1, 1)
    else:
        lo = None
    if lo:
        return Range(_aware(lo), _aware(today + timedelta(days=1)), f"{day(lo)} – {day(today)}", today.year)
    if year:
        try:
            y = int(year)
            return Range(_aware(date(y, 1, 1)), _aware(date(y + 1, 1, 1)),
                         f"01 Jan {y} – 31 Dec {y}", y)
        except (TypeError, ValueError):
            pass
    return Range(label=f"All time, to {day(today)}")


# --------------------------------------------------------------------------- #
# Wallet — full account statement (opening / closing balance, every movement)
# --------------------------------------------------------------------------- #
def wallet(user, *, rng: Range, **_):
    from apps.wallets.models import BalanceTransaction, OwnershipToken, UserBalance

    bal = UserBalance.objects.filter(user=user).first()
    current = Decimal(bal.current_balance) if bal else D0
    entries = list(BalanceTransaction.objects.filter(balance__user=user).order_by("created_at", "id"))

    def signed(t):
        return Decimal(t.amount) if t.entry_type == "credit" else -Decimal(t.amount)

    after_end = sum((signed(t) for t in entries if rng.end and t.created_at >= rng.end), D0)
    in_range = [t for t in entries if rng.has(t.created_at)]
    closing = current - after_end
    net = sum((signed(t) for t in in_range), D0)
    opening = closing - net
    money_in = sum((Decimal(t.amount) for t in in_range if t.entry_type == "credit"), D0)
    money_out = sum((Decimal(t.amount) for t in in_range if t.entry_type != "credit"), D0)

    rows, running = [], opening
    for t in in_range:
        running += signed(t)
        rows.append({
            "date": t.created_at.date().isoformat(),
            "type": source_label(t.source),
            "description": t.memo or (f"Ref. {t.reference}" if t.reference else ""),
            "amount": signed(t).quantize(Decimal("0.01")),
            "balance": running.quantize(Decimal("0.01")),
            "reference": t.reference or "",
        })
    columns = [
        Col("date", "Date", 0.95, fmt="date"),
        Col("type", "Type", 1.45, wrap=True),
        Col("description", "Description", 2.1, wrap=True),
        Col("amount", "Amount (USD)", 1.1, "right", tone="signed", fmt="signed"),
        Col("balance", "Balance (USD)", 1.1, "right", fmt="money"),
    ]

    holdings = []
    for tok in OwnershipToken.objects.filter(wallet__user=user, token_amount__gt=0).order_by("property_name"):
        holdings.append({
            "property": tok.property_name, "symbol": tok.token_symbol,
            "units": tok.token_amount, "ownership": tok.ownership_percentage,
            "value": Decimal(tok.token_value_usd),
        })
    return {
        "title": "Wallet Account Statement",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "STM",
        "note": ("Generated from the Capimax BRX wallet ledger. Times are UTC; the period includes "
                 "both dates. A withdrawal being paid out is shown when it was booked. This "
                 "statement is informational and is not a tax document."),
        "summary": [
            ("Opening balance", _usd(opening)), ("Money in", _usd(money_in)),
            ("Money out", _usd(money_out)), ("Closing balance", _usd(closing), True),
            ("Movements", str(len(rows))), ("Available now", _usd(current)),
        ],
        "sections": [
            {"title": "Wallet movements", "columns": columns, "rows": rows,
             "empty": "No wallet movements in this period.",
             "totals": {"type": "Net change", "amount": net}},
            {"title": "Property units held", "hint": "at the issue date",
             "columns": [Col("property", "Property", 2.4, wrap=True), Col("symbol", "Token", 0.9),
                         Col("units", "Units", 0.8, "right", fmt="int"),
                         Col("ownership", "Ownership", 1.0, "right", fmt="pct"),
                         Col("value", "Value (USD)", 1.2, "right", fmt="money")],
             "rows": holdings, "empty": "No property units held.", "csv": False},
        ],
        "columns": [("date", "Date"), ("type", "Type"), ("description", "Description"),
                    ("amount", "Amount (USD)"), ("balance", "Balance (USD)"), ("reference", "Reference")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Portfolio — holdings, cost and value, on-chain contracts, certificates
# --------------------------------------------------------------------------- #
def portfolio(user, *, rng: Range, **_):
    from apps.certificates.models import Certificate
    from apps.distributions.models import Distribution, DistributionPayout
    from apps.properties.models import Property
    from apps.wallets.positions import token_positions

    w = getattr(user, "wallet", None) if hasattr(user, "wallet") else None
    try:
        positions = token_positions(user, user.wallet) if w is not None else []
    except Exception:  # noqa: BLE001 — no wallet yet
        positions = []
    positions = [p for p in positions if (p.get("token_amount") or 0) > 0]

    rows, total_value, total_cost, costed_value = [], D0, D0, D0
    has_cost = False
    for p in positions:
        owed = Decimal(str(p.get("remaining_principal") or 0))
        value = Decimal(str(p.get("token_value_usd") or 0)) - owed
        cost = None if p.get("invested_usd") is None else Decimal(str(p["invested_usd"])) - owed
        total_value += value
        if cost is not None:
            has_cost = True
            total_cost += cost
            costed_value += value
        country = (p.get("country") or "").strip()
        country = country.upper() if len(country) <= 3 else country.title()
        city = (p.get("city") or "").strip().title()
        location = ", ".join(x for x in (city, country) if x) or (p.get("location") or "")
        rows.append({
            "property": p.get("property_name"), "location": location,
            "units": p.get("token_amount"), "ownership": p.get("ownership_percentage"),
            "avg_cost": p.get("avg_cost_per_token"), "unit_price": p.get("unit_price"),
            "invested": cost, "value": value,
            "gain": (value - cost) if cost is not None else None,
        })
    gain = costed_value - total_cost if has_cost else None
    gain_pct = (gain / total_cost * 100) if (has_cost and total_cost > 0) else None

    distributions_total = sum(
        (Decimal(x.share_amount_usd) for x in DistributionPayout.objects.filter(
            user=user, credited=True, distribution__status=Distribution.Status.PAID)), D0)

    contracts = []
    slugs = [p.get("property_id") for p in positions]
    for prop in Property.objects.filter(slug__in=slugs).select_related("token_metadata").order_by("name"):
        tm = getattr(prop, "token_metadata", None)
        addr = (getattr(tm, "deployed_contract_address", "") or "").strip()
        net = (getattr(tm, "deployment_network", "") or "").lower()
        contracts.append({
            "property": prop.name,
            "standard": getattr(tm, "standard", "") or "",
            "contract": addr or "Pending deployment",
            "network": ("BSC Testnet" if "test" in net else "BSC Mainnet") if addr else "—",
        })

    certs = [{
        "certificate": c.certificate_id, "property": c.property_name, "units": c.units_purchased,
        "issued": c.issue_date.isoformat() if c.issue_date else "", "status": c.status,
    } for c in Certificate.objects.filter(user=user).order_by("-issue_date")[:60]]

    columns = [
        Col("property", "Property", 2.0, wrap=True), Col("units", "Units", 0.7, "right", fmt="int"),
        Col("ownership", "Own. %", 0.8, "right", fmt="pct"),
        Col("unit_price", "Unit price", 0.95, "right", fmt="money"),
        Col("invested", "Invested", 1.05, "right", fmt="money"),
        Col("value", "Value", 1.05, "right", fmt="money"),
        Col("gain", "Gain / loss", 1.05, "right", tone="signed", fmt="signed"),
    ]
    return {
        "title": "Portfolio Statement",
        "subtitle": f"Holdings as of {day(timezone.now())}",
        "ref_prefix": "PRT",
        "note": ("Values use each property's current unit price; units on a running installment "
                 "plan are shown net of the installments still owed. Figures come from your "
                 "Capimax BRX account records and are not an offer or a valuation report."),
        "summary": [
            ("Properties", str(len(rows))), ("Units held", f"{sum(int(r['units'] or 0) for r in rows):,}"),
            ("Distributions received", _usd(distributions_total)),
            ("Total invested", _usd(total_cost) if has_cost else "—"),
            ("Current value", _usd(total_value), True),
            ("Gain / loss", (f"{money(gain, signed=True)} USD"
                             + (f"  ({gain_pct:+.2f}%)" if gain_pct is not None else "")) if gain is not None else "—"),
        ],
        "sections": [
            {"title": "Holdings", "columns": columns, "rows": rows, "empty": "No property units held.",
             "totals": {"property": "Total", "invested": total_cost if has_cost else "",
                        "value": total_value, "gain": gain if gain is not None else ""}},
            {"title": "On-chain token contracts", "csv": False,
             "columns": [Col("property", "Property", 1.8, wrap=True), Col("standard", "Standard", 0.8),
                         Col("contract", "Contract address", 2.6), Col("network", "Network", 0.9)],
             "rows": contracts, "empty": "No contracts."},
            {"title": "Ownership certificates", "csv": False,
             "columns": [Col("certificate", "Certificate", 1.6), Col("property", "Property", 2.0, wrap=True),
                         Col("units", "Units", 0.6, "right", fmt="int"),
                         Col("issued", "Issued", 0.9, fmt="date"),
                         Col("status", "Status", 0.9, tone="status", fmt="label")],
             "rows": certs, "empty": "No certificates issued yet."},
        ],
        "columns": [("property", "Property"), ("location", "Location"), ("units", "Units"),
                    ("ownership", "Ownership %"), ("avg_cost", "Average cost (USD)"),
                    ("unit_price", "Unit price (USD)"), ("invested", "Invested (USD)"),
                    ("value", "Value (USD)"), ("gain", "Gain (USD)")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Distributions — the caller's paid rental-income payouts
# --------------------------------------------------------------------------- #
def _distribution_payouts(user, rng: Range):
    from apps.distributions.models import Distribution, DistributionPayout

    qs = DistributionPayout.objects.filter(
        user=user, credited=True, distribution__status=Distribution.Status.PAID,
    ).select_related("distribution").order_by("distribution__pay_date")
    return [(p, p.distribution) for p in qs if rng.has(p.distribution.pay_date)]


def distributions(user, *, rng: Range, **_):
    items = _distribution_payouts(user, rng)
    rows, total = [], D0
    for p, d in items:
        total += Decimal(str(p.share_amount_usd))
        rows.append({
            "date": d.pay_date.isoformat(),
            "property": d.property_name or d.property_id,
            "type": d.dist_type or "",
            "period": d.period_label or d.pay_date.isoformat(),
            "amount": Decimal(str(p.share_amount_usd)),
        })
    columns = [
        Col("date", "Pay date", 0.95, fmt="date"), Col("property", "Property", 2.2, wrap=True),
        Col("type", "Type", 1.0, fmt="label"), Col("period", "Period", 1.1),
        Col("amount", "Amount (USD)", 1.1, "right", fmt="money"),
    ]
    return {
        "title": "Distributions Statement",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "DST",
        "note": ("Rental income credited to your Capimax BRX wallet. Informational statement from "
                 "your account records; not a tax document."),
        "summary": [("Total received", _usd(total), True), ("Payouts", str(len(rows))),
                    ("Properties", str(len({r["property"] for r in rows})))],
        "sections": [{"title": "Payouts", "columns": columns, "rows": rows,
                      "empty": "No distributions in this period.",
                      "totals": {"property": "Total", "amount": total}}],
        "columns": [("date", "Pay date"), ("property", "Property"), ("type", "Type"),
                    ("period", "Period"), ("amount", "Amount (USD)")],
        "rows": rows,
    }


def distributions_tax(user, *, rng: Range | None = None, year=None, **_):
    """An INFORMATIONAL annual distribution-income summary — NOT a tax document."""
    yr = int(year) if year else (rng.year if rng and rng.year else timezone.now().year)
    yr_rng = resolve_range(year=yr)
    items = _distribution_payouts(user, yr_rng)
    rows, total = [], D0
    by_prop: dict[str, Decimal] = {}
    for p, d in items:
        amt = Decimal(str(p.share_amount_usd))
        total += amt
        name = d.property_name or d.property_id
        by_prop[name] = by_prop.get(name, D0) + amt
        rows.append({"date": d.pay_date.isoformat(), "property": name, "amount": amt})
    return {
        "title": "Annual Distribution Income Summary",
        "subtitle": f"Tax year {yr}",
        "ref_prefix": "TAX",
        "note": ("Informational annual summary of distribution income from your account records. "
                 "This is NOT a tax document, NOT tax advice and NOT an official statement — "
                 "consult a qualified professional."),
        "summary": [("Tax year", str(yr)), ("Total distribution income", _usd(total), True),
                    ("Payouts", str(len(rows)))],
        "sections": [
            {"title": "By property", "csv": False,
             "columns": [Col("property", "Property", 3.0, wrap=True),
                         Col("amount", "Income (USD)", 1.2, "right", fmt="money")],
             "rows": [{"property": k, "amount": v} for k, v in sorted(by_prop.items())],
             "empty": "No distribution income in this year.",
             "totals": {"property": "Total", "amount": total}},
            {"title": "Payouts",
             "columns": [Col("date", "Pay date", 1.0, fmt="date"), Col("property", "Property", 3.0, wrap=True),
                         Col("amount", "Amount (USD)", 1.2, "right", fmt="money")],
             "rows": rows, "empty": "No payouts in this year."},
        ],
        "columns": [("date", "Pay date"), ("property", "Property"), ("amount", "Amount (USD)")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Owner / developer — primary-sale proceeds per property
# --------------------------------------------------------------------------- #
def owner_earnings(user, *, rng: Range, **_):
    from apps.investments.models import RESALE_PAYMENT_METHODS, Investment, PaymentStatus
    from apps.properties.models import Property

    rows, total_net, total_units = [], D0, 0
    investors_all = set()
    for prop in Property.objects.filter(submitted_by=user).order_by("name"):
        sales = [i for i in Investment.objects.filter(
            property=prop, payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
        ).exclude(payment_method__in=RESALE_PAYMENT_METHODS) if rng.has(i.created_at)]
        gross = sum((Decimal(i.amount_invested) for i in sales), D0)
        units = sum(int(i.token_amount or 0) for i in sales)
        investors = {i.user_id for i in sales}
        investors_all |= investors
        # Buyer-borne fees: the owner's net proceeds equal the full unit value (fees 0).
        net = gross.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_net += net
        total_units += units
        rows.append({"property": prop.name, "units_sold": units, "investors": len(investors),
                     "gross": gross, "fees": D0, "net": net})
    columns = [
        Col("property", "Property", 2.3, wrap=True), Col("units_sold", "Units sold", 0.9, "right", fmt="int"),
        Col("investors", "Investors", 0.85, "right", fmt="int"),
        Col("gross", "Gross (USD)", 1.1, "right", fmt="money"), Col("fees", "Fees (USD)", 0.9, "right", fmt="money"),
        Col("net", "Net (USD)", 1.1, "right", fmt="money"),
    ]
    return {
        "title": "Owner Earnings Report",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "OWN",
        "note": ("Primary sales of your listed properties (resales between investors are not "
                 "included). Buyer-paid fees are not deducted from your proceeds."),
        "summary": [("Properties", str(len(rows))), ("Units sold", f"{total_units:,}"),
                    ("Investors", str(len(investors_all))), ("Net proceeds", _usd(total_net), True)],
        "sections": [{"title": "By property", "columns": columns, "rows": rows,
                      "empty": "No listed properties.",
                      "totals": {"property": "Total", "units_sold": total_units, "net": total_net}}],
        "columns": [("property", "Property"), ("units_sold", "Units sold"), ("investors", "Investors"),
                    ("gross", "Gross (USD)"), ("fees", "Fees (USD)"), ("net", "Net proceeds (USD)")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Liquidity provider — account summary, holdings, transactions
# --------------------------------------------------------------------------- #
def lp(user, *, rng: Range, **_):
    from apps.lp.models import LiquidityProvider, LPHolding, LPTransaction

    prof = LiquidityProvider.objects.filter(user=user).first()
    txs = [t for t in LPTransaction.objects.filter(lp__user=user).order_by("created_at") if rng.has(t.created_at)]
    rows = [{
        "date": t.created_at.date().isoformat(), "type": t.tx_type, "status": t.status,
        "method": t.withdrawal_method or "", "reference": t.bank_reference or t.crypto_tx_hash or "",
        "amount": (-Decimal(t.amount) if t.tx_type == "withdrawal" else Decimal(t.amount)),
    } for t in txs]
    money_in = sum((r["amount"] for r in rows if r["amount"] > 0), D0)
    money_out = -sum((r["amount"] for r in rows if r["amount"] < 0), D0)

    holdings = [{
        "property": h.property_name, "symbol": h.token_symbol, "units": h.token_amount,
        "cost": Decimal(h.purchase_price), "value": Decimal(h.current_value), "status": h.status,
    } for h in LPHolding.objects.filter(lp__user=user).exclude(status=LPHolding.Status.SOLD).order_by("property_name")]

    summary = [("In this period", _usd(money_in)), ("Out this period", _usd(money_out)),
               ("Transactions", str(len(rows)))]
    if prof:
        summary = [
            ("Total deposited", _usd(prof.total_deposited)), ("Total earnings", _usd(prof.total_earnings)),
            ("Total withdrawn", _usd(prof.total_withdrawn)),
            ("Current balance", _usd(prof.current_balance), True),
        ] + summary
    extra = []
    if prof and prof.company_name:
        extra.append(("Company", prof.company_name))
    columns = [
        Col("date", "Date", 0.95, fmt="date"), Col("type", "Type", 1.0, fmt="label"),
        Col("method", "Method", 0.8, fmt="label"), Col("reference", "Reference", 1.6),
        Col("status", "Status", 0.95, tone="status", fmt="label"),
        Col("amount", "Amount (USD)", 1.1, "right", tone="signed", fmt="signed"),
    ]
    return {
        "title": "Liquidity Provider Statement",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "LPS",
        "holder_extra": extra,
        "note": ("Generated from your Capimax BRX liquidity-provider ledger. Withdrawals leave your "
                 "balance when requested and return if a payout fails. Informational statement."),
        "summary": summary,
        "sections": [
            {"title": "Transactions", "columns": columns, "rows": rows,
             "empty": "No transactions in this period.",
             "totals": {"type": "Net", "amount": money_in - money_out}},
            {"title": "Units held", "csv": False,
             "columns": [Col("property", "Property", 2.2, wrap=True), Col("symbol", "Token", 0.8),
                         Col("units", "Units", 0.7, "right", fmt="int"),
                         Col("cost", "Cost (USD)", 1.0, "right", fmt="money"),
                         Col("value", "Value (USD)", 1.0, "right", fmt="money"),
                         Col("status", "Status", 1.0, fmt="label")],
             "rows": holdings, "empty": "No units held."},
        ],
        "columns": [("date", "Date"), ("type", "Type"), ("method", "Method"), ("reference", "Reference"),
                    ("status", "Status"), ("amount", "Amount (USD)")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Broker — commissions
# --------------------------------------------------------------------------- #
def broker_commissions(user, *, rng: Range, **_):
    from apps.broker.services import commission_ledger

    broker = getattr(user, "broker_profile", None)
    ledger = commission_ledger(broker) if broker else {"commissions": [], "stats": {}}
    rows, total = [], D0
    for c in ledger["commissions"]:
        when = _parse_day(c.get("date", ""))
        if (rng.start or rng.end) and not (when and rng.has(when)):
            continue
        amt = Decimal(str(c.get("commission", 0) or 0))
        total += amt
        rows.append({
            "date": c.get("date", ""), "referral": c.get("referral", ""),
            "property": c.get("property", ""), "investment": Decimal(str(c.get("amount", 0) or 0)),
            "commission": amt, "status": c.get("status", ""),
        })
    columns = [
        Col("date", "Date", 0.95, fmt="date"), Col("referral", "Referred investor", 1.5, wrap=True),
        Col("property", "Property", 1.7, wrap=True),
        Col("investment", "Investment (USD)", 1.1, "right", fmt="money"),
        Col("commission", "Commission (USD)", 1.1, "right", fmt="money"),
        Col("status", "Status", 0.9, tone="status", fmt="label"),
    ]
    return {
        "title": "Broker Commissions Statement",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "BRK",
        "note": "Commissions on investments made by the investors you referred.",
        "summary": [("Commission in period", _usd(total), True), ("Commissions", str(len(rows))),
                    ("All-time commission", _usd(ledger.get("stats", {}).get("total_commission", "0")))],
        "sections": [{"title": "Commissions", "columns": columns, "rows": rows,
                      "empty": "No commissions in this period.",
                      "totals": {"referral": "Total", "commission": total}}],
        "columns": [("date", "Date"), ("referral", "Referred investor"), ("property", "Property"),
                    ("investment", "Investment (USD)"), ("commission", "Commission (USD)"), ("status", "Status")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Installments — every plan, or one plan's schedule
# --------------------------------------------------------------------------- #
_SCHEDULE_COLS = [
    Col("sequence", "#", 0.45), Col("due", "Due date", 1.0, fmt="date"),
    Col("amount", "Amount (USD)", 1.05, "right", fmt="money"),
    Col("fee", "Fee (USD)", 0.85, "right", fmt="money"),
    Col("status", "Status", 0.9, tone="status", fmt="label"), Col("paid", "Paid on", 1.0, fmt="date"),
]


def _plan_rows(plan, rng: Range | None = None):
    rows, paid, remaining = [], D0, D0
    dp_paid = plan.down_paid_at is not None
    dp_date = plan.down_paid_at or plan.created_at
    dp_amt = Decimal(str(plan.down_payment_amount))
    if rng is None or rng.has(dp_date):
        rows.append({"property": plan.property_name, "sequence": "DP", "due": dp_date.date().isoformat(),
                     "amount": dp_amt, "fee": D0, "status": "paid" if dp_paid else "pending",
                     "paid": plan.down_paid_at.date().isoformat() if dp_paid else ""})
    paid += dp_amt if dp_paid else D0
    remaining += D0 if dp_paid else dp_amt
    next_due = None
    for p in plan.payments.all():
        amt = Decimal(str(p.amount))
        if p.status == "paid":
            paid += amt
        elif p.status in ("pending", "missed"):
            remaining += amt
            if p.status == "pending" and (next_due is None or p.due_date < next_due.due_date):
                next_due = p
        if rng is not None and not rng.has(p.due_date):
            continue
        rows.append({"property": plan.property_name, "sequence": str(p.sequence), "due": p.due_date.isoformat(),
                     "amount": amt, "fee": Decimal(str(p.fee_amount or 0)), "status": p.status,
                     "paid": p.paid_at.date().isoformat() if p.paid_at else ""})
    return rows, paid, remaining, next_due


def installments(user, *, rng: Range, **_):
    from apps.installments.models import InstallmentPlan

    plans = InstallmentPlan.objects.filter(investor=user).select_related("property").prefetch_related("payments")
    rows, plan_rows = [], []
    total_value = paid = remaining = D0
    for plan in plans:
        r, pd, rem, nxt = _plan_rows(plan, rng)
        rows += r
        total_value += Decimal(str(plan.total_amount))
        paid += pd
        remaining += rem
        plan_rows.append({"property": plan.property_name, "total": Decimal(str(plan.total_amount)),
                          "paid": pd, "remaining": rem, "status": plan.status,
                          "next": nxt.due_date.isoformat() if nxt else ""})
    return {
        "title": "Installment Plans Statement",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "INS",
        "note": ("Your installment plans as recorded on Capimax BRX. Units on a plan become fully "
                 "yours with the final payment; a missed installment can lead to the plan being "
                 "cancelled under its terms."),
        "summary": [("Plans", str(len(plan_rows))), ("Total plan value", _usd(total_value)),
                    ("Paid to date", _usd(paid)), ("Remaining", _usd(remaining), True)],
        "sections": [
            {"title": "Plans", "csv": False,
             "columns": [Col("property", "Property", 2.2, wrap=True),
                         Col("total", "Plan value", 1.0, "right", fmt="money"),
                         Col("paid", "Paid", 1.0, "right", fmt="money"),
                         Col("remaining", "Remaining", 1.0, "right", fmt="money"),
                         Col("next", "Next due", 0.95, fmt="date"),
                         Col("status", "Status", 0.85, tone="status", fmt="label")],
             "rows": plan_rows, "empty": "No installment plans."},
            {"title": "Payment schedule",
             "columns": [Col("property", "Property", 2.0, wrap=True)] + _SCHEDULE_COLS,
             "rows": rows, "empty": "No payments in this period."},
        ],
        "columns": [("property", "Property"), ("sequence", "#"), ("due", "Due date"),
                    ("amount", "Amount (USD)"), ("fee", "Fee (USD)"), ("status", "Status"), ("paid", "Paid date")],
        "rows": rows,
    }


def installment_plan(user, plan_id):
    """One plan's full schedule (the per-plan download on the Installments page)."""
    from django.http import Http404

    from apps.installments.models import InstallmentPlan

    plan = (InstallmentPlan.objects.filter(pk=plan_id, investor=user)
            .select_related("property").prefetch_related("payments").first())
    if plan is None:
        raise Http404
    rows, paid, remaining, nxt = _plan_rows(plan)
    fees = sum((r["fee"] for r in rows), D0)
    return {
        "title": "Installment Schedule",
        "subtitle": plan.property_name,
        "ref_prefix": "PLN",
        "ref_id": plan.pk,
        "holder_extra": [("Plan status", plan.status.replace("_", " ").capitalize())],
        "note": ("This schedule reflects the installment plan recorded on Capimax BRX at the issue "
                 "date. Units on the plan become fully yours with the final payment."),
        "summary": [
            ("Plan value", _usd(plan.total_amount)),
            ("Down payment", f"{_usd(plan.down_payment_amount)} ({money(plan.down_payment_percent)}%)"),
            ("Installments", f"{plan.number_of_installments} × {money(plan.installment_amount)} USD"),
            ("Frequency", str(plan.frequency).replace("_", " ").capitalize()),
            ("Paid to date", _usd(paid)), ("Remaining", _usd(remaining), True),
            ("Next due", f"{day(nxt.due_date)} — {_usd(nxt.amount)}" if nxt else "—"),
            ("Units", f"{plan.units_total:,}" if plan.units_total else "—"),
            ("Fee rate", f"{money(plan.fee_rate)}%" if plan.fee_rate else "None"),
        ],
        "sections": [{"title": "Payment schedule", "columns": _SCHEDULE_COLS, "rows": rows,
                      "empty": "No payments.",
                      "totals": {"sequence": "Total", "amount": sum((r["amount"] for r in rows), D0),
                                 "fee": fees}}],
        "columns": [("sequence", "#"), ("due", "Due date"), ("amount", "Amount (USD)"),
                    ("fee", "Fee (USD)"), ("status", "Status"), ("paid", "Paid date")],
        "rows": rows,
    }


# --------------------------------------------------------------------------- #
# Investment report (Reports & Analytics) — performance, allocation, income
# --------------------------------------------------------------------------- #
def analytics(user, *, rng: Range, **_):
    port = portfolio(user, rng=rng)
    holdings = port["sections"][0]["rows"]
    total_value = sum((Decimal(str(h["value"] or 0)) for h in holdings), D0)

    alloc = []
    for h in sorted(holdings, key=lambda x: -(x["value"] or 0)):
        share = (Decimal(str(h["value"] or 0)) / total_value * 100) if total_value > 0 else D0
        ret = (Decimal(str(h["gain"])) / Decimal(str(h["invested"])) * 100
               if h.get("gain") is not None and h.get("invested") else None)
        alloc.append({"property": h["property"], "value": h["value"], "share": share,
                      "invested": h["invested"], "gain": h["gain"],
                      "return": f"{ret:+.2f}%" if ret is not None else "—"})

    by_place: dict[str, Decimal] = {}
    for h in holdings:
        key = h.get("location") or "Other"
        by_place[key] = by_place.get(key, D0) + Decimal(str(h["value"] or 0))
    places = [{"location": k, "value": v, "share": (v / total_value * 100) if total_value > 0 else D0}
              for k, v in sorted(by_place.items(), key=lambda kv: -kv[1])]

    payouts = _distribution_payouts(user, rng)
    months: dict[str, Decimal] = {}
    for p, d in payouts:
        k = d.pay_date.strftime("%Y-%m")
        months[k] = months.get(k, D0) + Decimal(str(p.share_amount_usd))
    income = [{"month": f"{calendar.month_abbr[int(k[5:])]} {k[:4]}", "amount": v}
              for k, v in sorted(months.items())]
    income_total = sum(months.values(), D0)

    summary = port["summary"][:]
    summary[2] = ("Income in period", _usd(income_total))
    return {
        "title": "Investment Performance Report",
        "subtitle": f"{rng.label} (UTC)",
        "ref_prefix": "RPT",
        "note": ("Performance is measured on holdings with a recorded cost, at today's unit prices. "
                 "Past performance does not guarantee future results. Informational report from "
                 "your Capimax BRX account records."),
        "summary": summary,
        "sections": [
            {"title": "Allocation and return by property",
             "columns": [Col("property", "Property", 2.2, wrap=True),
                         Col("invested", "Invested", 1.0, "right", fmt="money"),
                         Col("value", "Value", 1.0, "right", fmt="money"),
                         Col("share", "Of portfolio", 0.95, "right", fmt="pct"),
                         Col("gain", "Gain / loss", 1.0, "right", tone="signed", fmt="signed"),
                         Col("return", "Return", 0.8, "right")],
             "rows": alloc, "empty": "No holdings.",
             "totals": {"property": "Total", "value": total_value}},
            {"title": "Allocation by location", "csv": False,
             "columns": [Col("location", "Location", 3.0), Col("value", "Value (USD)", 1.2, "right", fmt="money"),
                         Col("share", "Of portfolio", 1.0, "right", fmt="pct")],
             "rows": places, "empty": "No holdings."},
            {"title": "Rental income by month", "csv": False,
             "columns": [Col("month", "Month", 3.0), Col("amount", "Income (USD)", 1.2, "right", fmt="money")],
             "rows": income, "empty": "No rental income in this period.",
             "totals": {"month": "Total", "amount": income_total}},
        ] + port["sections"][1:2],
        "columns": [("property", "Property"), ("invested", "Invested (USD)"), ("value", "Value (USD)"),
                    ("share", "Of portfolio %"), ("gain", "Gain (USD)"), ("return", "Return")],
        "rows": alloc,
    }


# The export registry: context slug → adapter. (`distributions/tax` is its own endpoint.)
ADAPTERS = {
    "wallet": wallet,
    "portfolio": portfolio,
    "analytics": analytics,
    "distributions": distributions,
    "installments": installments,
    "owner-earnings": owner_earnings,
    "lp": lp,
    "broker-commissions": broker_commissions,
}
