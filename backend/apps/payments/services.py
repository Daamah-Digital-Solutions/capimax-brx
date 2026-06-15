"""
Payment processing services — Phase 5 Wave 1.

The webhook-gated completion path: a SIGNATURE-VERIFIED Stripe event flips the
Payment to succeeded, marks the Investment completed, and triggers the EXISTING
confirmed-on-chain mint (Phase 3) into the user's wallet — idempotently.

IDEMPOTENCY (Stripe may resend a webhook): processing keys on the unique
`stripe_payment_intent_id` + the Payment status guard + the already-idempotent
`mint_investment` (which no-ops if the investment is already minted). A given
PaymentIntent therefore mints EXACTLY once, never twice.
"""
from __future__ import annotations

import logging

from django.db import transaction

from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import mint_investment

from .models import Payment, PaymentState

log = logging.getLogger(__name__)


class PaymentNotFound(Exception):
    """No Payment matches the given PaymentIntent id."""


def get_or_create_payment(
    investment: Investment, *, amount, currency: str, provider: str = "stripe"
) -> Payment:
    """
    Return the pending Payment for this investment + provider, creating one if needed.
    Reuses an existing pending payment so re-clicking "Pay" doesn't spawn duplicates.
    """
    existing = (
        Payment.objects.filter(
            investment=investment, provider=provider, status=PaymentState.PENDING
        )
        .order_by("-created_at")
        .first()
    )
    if existing is not None:
        return existing
    return Payment.objects.create(
        investment=investment, provider=provider, amount=amount, currency=currency
    )


# --------------------------------------------------------------------------- #
# Provider-agnostic core: complete/fail a Payment by row (the single place the
# Payment + Investment state and the mint side-effect live). Stripe and NOW both
# resolve their provider-specific id to a Payment, then call these.
# --------------------------------------------------------------------------- #
def _complete_payment(payment: Payment) -> dict:
    """
    Idempotently mark a Payment succeeded + Investment completed, then mint.
    Returns {processed, minted, reason?}. NEVER mints unless the Payment is succeeded.
    """
    with transaction.atomic():
        payment = (
            Payment.objects.select_for_update()
            .select_related("investment")
            .get(pk=payment.pk)
        )
        already = payment.status == PaymentState.SUCCEEDED
        if not already:
            payment.status = PaymentState.SUCCEEDED
            payment.failure_reason = ""
            payment.save(update_fields=["status", "failure_reason", "updated_at"])

        inv = payment.investment
        if inv.payment_status != PaymentStatus.COMPLETED:
            inv.payment_status = PaymentStatus.COMPLETED
            inv.save(update_fields=["payment_status", "updated_at"])
        investment_id = inv.pk

    # Mint AFTER commit. mint_investment is itself idempotent (locks the investment,
    # no-ops if already minted) and never fabricates a tx.
    minted = False
    reason = None
    try:
        result = mint_investment(Investment.objects.get(pk=investment_id))
        minted = bool(result.get("minted"))
        reason = result.get("reason")
    except Exception:  # noqa: BLE001 - payment is recorded; mint can be retried
        log.exception("Mint after payment failed for payment %s", payment.pk)

    return {"processed": not already, "minted": minted, "reason": reason}


def _fail_payment(payment: Payment, *, reason: str = "") -> None:
    """Mark a Payment failed (no mint). Idempotent; never downgrades a paid one."""
    with transaction.atomic():
        payment = Payment.objects.select_for_update().select_related("investment").get(
            pk=payment.pk
        )
        if payment.status == PaymentState.SUCCEEDED:
            return  # a success already won — don't downgrade a paid investment
        payment.status = PaymentState.FAILED
        payment.failure_reason = (reason or "")[:300]
        payment.save(update_fields=["status", "failure_reason", "updated_at"])
        inv = payment.investment
        if inv.payment_status != PaymentStatus.COMPLETED:
            inv.payment_status = PaymentStatus.FAILED
            inv.save(update_fields=["payment_status", "updated_at"])


# --------------------------------------------------------------------------- #
# Stripe entry points (Wave 1) — resolve the intent id → Payment → core.
# --------------------------------------------------------------------------- #
def mark_payment_failed(payment_intent_id: str, *, reason: str = "") -> None:
    payment = Payment.objects.filter(
        stripe_payment_intent_id=payment_intent_id
    ).first()
    if payment is None:
        return
    _fail_payment(payment, reason=reason)
    log.info("Stripe payment failed for intent %s", payment_intent_id)


def process_successful_payment(payment_intent_id: str) -> dict:
    payment = Payment.objects.filter(
        stripe_payment_intent_id=payment_intent_id
    ).first()
    if payment is None:
        raise PaymentNotFound(payment_intent_id)
    return _complete_payment(payment)


# --------------------------------------------------------------------------- #
# NOW Payments entry points (Wave 2) — resolve the NOW payment id → Payment → core.
# Idempotent across the waiting→confirming→confirmed→finished IPN sequence: only a
# terminal-success call completes+mints, and the core no-ops on re-delivery.
# --------------------------------------------------------------------------- #
def process_successful_nowpayments(nowpayments_payment_id: str) -> dict:
    payment = Payment.objects.filter(
        nowpayments_payment_id=nowpayments_payment_id
    ).first()
    if payment is None:
        raise PaymentNotFound(nowpayments_payment_id)
    return _complete_payment(payment)


def mark_nowpayments_failed(nowpayments_payment_id: str, *, reason: str = "") -> None:
    payment = Payment.objects.filter(
        nowpayments_payment_id=nowpayments_payment_id
    ).first()
    if payment is None:
        return
    _fail_payment(payment, reason=reason)
    log.info("NOW Payments payment failed for id %s", nowpayments_payment_id)
