"""
Receipts — one PDF per payment, numbered, for the person who paid or was paid.

  wallet movement   every BalanceTransaction (top-up, purchase from the wallet, installment
                    debit, withdrawal, refund, distribution, sale proceeds, …)
  card / crypto     every succeeded Payment that didn't go through the wallet (a purchase, a
                    down payment, an installment, an early payoff, a top-up)
  installment       a paid installment row → whichever of the two above settled it

Receipt numbers are stable: RCT-<yyyymmdd of the payment>-<first 8 of its id>. Only the owner
can fetch a receipt; anything else is a 404. Layout reuses the statement renderer (pdf.py).
"""
from __future__ import annotations

from decimal import Decimal

from django.http import Http404

from .adapters import _display_name, _money
from .pdf import render_statement_pdf

RECEIPT_NOTE = (
    "Receipt generated from Capimax BRX account records (testnet deployment). Keep it for your "
    "records; it is not a tax invoice."
)

SOURCE_LABELS = {
    "deposit": "Wallet top-up",
    "withdrawal": "Withdrawal request",
    "withdrawal_refund": "Withdrawal not completed — amount returned",
    "reinvestment": "Purchase paid from the wallet",
    "installment": "Installment paid from the wallet",
    "installment_autodebit": "Installment auto-debited from the wallet",
    "distribution": "Rental income distribution",
    "secondary_market_purchase": "Secondary market purchase",
    "secondary_market_sale": "Secondary market sale proceeds",
    "lp_market_sale": "Sale to a liquidity provider",
    "primary_sale": "Primary sale proceeds",
    "broker_commission": "Referral commission",
    "purchase_refund": "Purchase refunded to the wallet",
    "crypto_underpaid_refund": "Crypto payment below the amount due — returned",
    "crypto_overpaid_credit": "Crypto payment above the amount due — extra credited",
    "family_accrual_release": "Family allocation released",
}

PROVIDER_LABELS = {"stripe": "Card (Stripe)", "nowpayments": "Crypto (NOWPayments)", "balance": "Wallet"}


def receipt_number(when, obj_id) -> str:
    return f"RCT-{when:%Y%m%d}-{str(obj_id).replace('-', '')[:8].upper()}"


def _pdf(*, number, when, user, method, reference, items, total, title="Payment Receipt"):
    rows = [{"item": label, "amount": value} for label, value in items]
    rows.append({"item": "Total", "amount": total})
    return render_statement_pdf(
        title=title,
        columns=[("item", "Description"), ("amount", "Amount (USD)")],
        rows=rows,
        meta=[
            ("Receipt no.", number),
            ("Date", f"{when:%Y-%m-%d %H:%M} UTC"),
            ("Account", f"{_display_name(user)} ({user.email})"),
            ("Paid with", method),
            ("Reference", reference or "—"),
        ],
        disclaimer=RECEIPT_NOTE,
    )


# --------------------------------------------------------------------------- #
# Wallet movements
# --------------------------------------------------------------------------- #
def ledger_receipt(user, tx_id) -> tuple[str, bytes]:
    from apps.wallets.models import BalanceTransaction

    tx = BalanceTransaction.objects.filter(pk=tx_id, balance__user=user).first()
    if tx is None:
        raise Http404
    label = SOURCE_LABELS.get(tx.source, tx.source.replace("_", " ").capitalize())
    direction = "credited to" if tx.entry_type == "credit" else "debited from"
    number = receipt_number(tx.created_at, tx.pk)
    pdf = _pdf(
        number=number, when=tx.created_at, user=user, method="Wallet balance",
        reference=tx.reference,
        items=[(f"{label} — {direction} your wallet", _money(tx.amount))]
        + ([(tx.memo[:90], "")] if tx.memo else []),
        total=_money(tx.amount),
        title="Wallet Transaction Receipt",
    )
    return f"{number}.pdf", pdf


# --------------------------------------------------------------------------- #
# Card / crypto payments
# --------------------------------------------------------------------------- #
def _payment_owner(payment):
    if payment.deposit_id:
        return payment.deposit.user
    if payment.installment_payment_id:
        return payment.installment_payment.plan.investor
    return payment.investment.user if payment.investment_id else None


def _payment_items(payment) -> list[tuple[str, str]]:
    if payment.deposit_id:
        return [("Wallet top-up", _money(payment.amount))]
    if payment.installment_payment_id:
        ip = payment.installment_payment
        plan = ip.plan
        if payment.is_installment_payoff:
            return [(f"Early payoff of the installments of {plan.property_name}", _money(payment.amount))]
        items = [(f"Installment {ip.sequence}/{plan.number_of_installments} — {plan.property_name}", _money(ip.amount))]
        if ip.fee_amount:
            items.append((f"Installment fee ({plan.fee_rate}%)", _money(ip.fee_amount)))
        return items
    inv = payment.investment
    base = Decimal(inv.charge_amount)
    what = (
        f"Down payment — {inv.token_amount} unit(s) of {inv.property_name}"
        if inv.is_installment
        else f"{inv.token_amount} unit(s) of {inv.property_name} at {_money(inv.price_per_token)}"
    )
    items = [(what, _money(base))]
    if inv.fee_amount:
        items.append(("Fees", _money(inv.fee_amount)))
    if inv.discount_amount:
        items.append(("Discount", f"-{_money(inv.discount_amount)}"))
    return items


def payment_receipt(user, payment_id) -> tuple[str, bytes]:
    from apps.payments.models import Payment, PaymentState

    payment = Payment.objects.filter(pk=payment_id, status=PaymentState.SUCCEEDED).first()
    if payment is None or _payment_owner(payment) != user:
        raise Http404
    number = receipt_number(payment.updated_at, payment.pk)
    pdf = _pdf(
        number=number, when=payment.updated_at, user=user,
        method=PROVIDER_LABELS.get(payment.provider, payment.provider),
        reference=payment.stripe_payment_intent_id or payment.nowpayments_payment_id,
        items=_payment_items(payment), total=_money(payment.amount),
    )
    return f"{number}.pdf", pdf


# --------------------------------------------------------------------------- #
# A paid installment → its card/crypto payment or its wallet debit
# --------------------------------------------------------------------------- #
def installment_receipt(user, row_id) -> tuple[str, bytes]:
    from apps.installments.models import InstallmentPayment, InstallmentPaymentStatus
    from apps.payments.models import Payment, PaymentState
    from apps.wallets.models import BalanceTransaction

    ip = InstallmentPayment.objects.select_related("plan").filter(
        pk=row_id, status=InstallmentPaymentStatus.PAID
    ).first()
    if ip is None:
        raise Http404
    pay = Payment.objects.filter(installment_payment=ip, status=PaymentState.SUCCEEDED).first()
    if pay is None:  # paid as part of an early payoff anchored on an earlier row
        pay = (
            Payment.objects.filter(
                installment_payment__plan=ip.plan, is_installment_payoff=True,
                status=PaymentState.SUCCEEDED, updated_at__gte=ip.paid_at,
            ).order_by("updated_at").first()
            if ip.paid_at else None
        )
    if pay is not None:
        return payment_receipt(user, pay.pk)
    tx = BalanceTransaction.objects.filter(
        balance__user=user, source__in=["installment", "installment_autodebit"],
        reference__in=[str(ip.pk)] + [str(r) for r in ip.plan.payments.values_list("pk", flat=True)],
        created_at__lte=ip.paid_at,
    ).order_by("-created_at").first() if ip.paid_at else None
    if tx is not None and ip.plan.investor_id == user.pk:
        return ledger_receipt(user, tx.pk)
    raise Http404


def list_receipts(user, limit: int = 200) -> list[dict]:
    """Every receipt the user can download, newest first."""
    from apps.payments.models import Payment, PaymentState
    from apps.wallets.models import BalanceTransaction

    out = []
    for tx in BalanceTransaction.objects.filter(balance__user=user).order_by("-created_at")[:limit]:
        out.append({
            "kind": "ledger", "id": str(tx.pk), "number": receipt_number(tx.created_at, tx.pk),
            "date": tx.created_at.isoformat(),
            "title": SOURCE_LABELS.get(tx.source, tx.source.replace("_", " ").capitalize()),
            "amount": float(tx.amount), "direction": tx.entry_type,
        })
    from django.db.models import Q

    # Card/crypto charges for purchases and installments (a top-up already shows up as its
    # wallet credit above, so it isn't listed twice).
    payments = (
        Payment.objects.filter(status=PaymentState.SUCCEEDED, deposit__isnull=True)
        .filter(
            Q(installment_payment__plan__investor=user)
            | Q(installment_payment__isnull=True, investment__user=user)
        )
        .select_related("investment", "installment_payment__plan")
        .order_by("-updated_at")
    )
    for p in payments[:limit]:
        out.append({
            "kind": "payment", "id": str(p.pk), "number": receipt_number(p.updated_at, p.pk),
            "date": p.updated_at.isoformat(), "title": _payment_items(p)[0][0],
            "amount": float(p.amount), "direction": "debit",
            "method": PROVIDER_LABELS.get(p.provider, p.provider),
        })
    return sorted(out, key=lambda r: r["date"], reverse=True)[:limit]
