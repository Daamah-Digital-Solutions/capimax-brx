"""
Crypto (NOWPayments) settles on what actually ARRIVED, not on the invoice amount.

NOW's IPN carries the invoice price in USD (price_amount), the crypto amount it asked for
(pay_amount) and the crypto amount that actually arrived (actually_paid), so the USD value
received is price_amount × actually_paid / pay_amount. Once a payment reaches a final state:

  wallet top-up       → the wallet is credited with what arrived (whatever it is).
  purchase/installment:
    arrived ≥ due − tolerance  → completes; anything above due + tolerance goes to the wallet.
    arrived < due − tolerance  → the purchase is cancelled and what arrived goes to the wallet.
  tolerance = max(CRYPTO_UNDERPAY_TOLERANCE_PERCENT of the amount due, CRYPTO_UNDERPAY_TOLERANCE_USD)

Every wallet credit is keyed on the payment, so a re-delivered or later IPN never credits
twice: if more arrives after an underpayment was returned, only the difference is credited.
When NOW doesn't send the amounts, the old rule applies (finished = paid in full).
"""
from __future__ import annotations

import logging
from decimal import ROUND_DOWN, Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction

from apps.wallets.models import BalanceTransaction

from . import nowpayments_service
from .models import Payment, PaymentState

log = logging.getLogger(__name__)

_CENT = Decimal("0.01")
UNDERPAID_SOURCE = "crypto_underpaid_refund"
OVERPAID_SOURCE = "crypto_overpaid_credit"
FINAL_STATES = nowpayments_service.SUCCESS_STATES | {"partially_paid", "expired", "failed"}


def _dec(value):
    try:
        return Decimal(str(value)) if value not in (None, "") else None
    except (InvalidOperation, ValueError):
        return None


def received_usd(payload: dict):
    """USD value that actually arrived, or None when NOW didn't send the amounts."""
    price, asked, paid = (
        _dec(payload.get("price_amount")), _dec(payload.get("pay_amount")),
        _dec(payload.get("actually_paid")),
    )
    if price is None or not asked or paid is None or asked <= 0:
        return None
    return (price * paid / asked).quantize(_CENT, rounding=ROUND_DOWN)


def tolerance(due: Decimal) -> Decimal:
    pct = Decimal(str(getattr(settings, "CRYPTO_UNDERPAY_TOLERANCE_PERCENT", 0.5)))
    usd = Decimal(str(getattr(settings, "CRYPTO_UNDERPAY_TOLERANCE_USD", 1.0)))
    return max((Decimal(due) * pct / Decimal("100")).quantize(_CENT), usd)


def _payer(payment: Payment):
    """Who paid: the depositor, the plan holder for an installment, else the buyer."""
    if payment.deposit_id:
        return payment.deposit.user
    if payment.installment_payment_id:
        return payment.installment_payment.plan.investor
    return payment.investment.user


def _already_returned(payment: Payment) -> Decimal:
    total = Decimal("0")
    for tx in BalanceTransaction.objects.filter(
        source=UNDERPAID_SOURCE, reference__startswith=str(payment.pk)
    ):
        total += Decimal(tx.amount)
    return total


def _credit(payment, amount: Decimal, source: str, ref_suffix: str, memo: str) -> bool:
    from apps.wallets.services import credit_user_balance

    reference = f"{payment.pk}{ref_suffix}"
    if amount <= 0 or BalanceTransaction.objects.filter(source=source, reference=reference).exists():
        return False
    credit_user_balance(_payer(payment), amount, source=source, reference=reference, memo=memo)
    return True


def handle_now_ipn(payment_id: str, order_id: str, state: str, payload: dict) -> str:
    """Apply one verified NOW IPN. Returns what was done (for logs/tests)."""
    from apps.notifications.services import NotificationType, notify

    from .services import (
        PaymentNotFound,
        _complete_payment,
        _fail_payment,
        _resolve_now_payment,
    )

    payment = _resolve_now_payment(payment_id, order_id)
    if payment is None:
        if state in nowpayments_service.SUCCESS_STATES:
            raise PaymentNotFound(payment_id)
        return "unknown_payment"

    received = received_usd(payload)
    if received is not None and received != payment.received_amount:
        Payment.objects.filter(pk=payment.pk).update(received_amount=received)

    if state == "refunded":  # NOW sent the money back to the customer
        _fail_payment(payment, reason="NOW status: refunded")
        return "refunded"
    if state not in FINAL_STATES:
        return "in_flight"

    if received is None:  # amounts not sent → the old rule
        if state in nowpayments_service.SUCCESS_STATES:
            _complete_payment(payment)
            return "completed"
        if state != "partially_paid":
            _fail_payment(payment, reason=f"NOW status: {state}")
            return "failed"
        return "in_flight"

    due = Decimal(payment.amount)

    # Wallet top-up: credit exactly what arrived.
    if payment.deposit_id:
        if received <= 0:
            _fail_payment(payment, reason=f"NOW status: {state} — nothing received")
            return "failed"
        from apps.wallets.models import Deposit

        with transaction.atomic():
            dep = Deposit.objects.select_for_update().get(pk=payment.deposit_id)
            if not dep.credited and dep.amount != received:
                dep.amount = received
                dep.save(update_fields=["amount", "updated_at"])
        _complete_payment(payment)
        return "deposit_credited"

    # An underpayment was already returned: only top up what arrived since.
    returned = _already_returned(payment)
    if returned > 0:
        extra = received - returned
        if _credit(payment, extra, UNDERPAID_SOURCE, f":{received}",
                   f"More crypto arrived after the purchase was cancelled (+${extra})"):
            return "late_extra_returned"
        return "noop"

    tol = tolerance(due)
    if received >= due - tol:
        _complete_payment(payment)
        excess = received - due
        if excess > tol:
            if _credit(payment, excess, OVERPAID_SOURCE, "",
                       f"Crypto payment above the amount due (+${excess})"):
                notify(
                    _payer(payment), NotificationType.CRYPTO_OVERPAID,
                    params={"received": f"{received:,.2f}", "due": f"{due:,.2f}", "extra": f"{excess:,.2f}"},
                    action_url="/wallet",
                )
        return "completed"

    # Underpaid beyond the tolerance: cancel, return what arrived to the wallet — unless an
    # earlier IPN already completed it in full (never take back a settled purchase).
    if Payment.objects.filter(pk=payment.pk, status=PaymentState.SUCCEEDED).exists():
        log.warning("NOW payment %s: lower amount reported after it completed — ignored", payment.pk)
        return "noop"
    _fail_payment(payment, reason=f"Underpaid: ${received} received of ${due}")
    if _credit(payment, received, UNDERPAID_SOURCE, "",
               f"Crypto payment below the amount due — ${received} returned"):
        notify(
            _payer(payment), NotificationType.CRYPTO_UNDERPAID,
            params={"received": f"{received:,.2f}", "due": f"{due:,.2f}"},
            action_url="/wallet",
        )
    log.warning("NOW payment %s underpaid: %s of %s (returned to wallet)", payment.pk, received, due)
    return "underpaid_returned"
