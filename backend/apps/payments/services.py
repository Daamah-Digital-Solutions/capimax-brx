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
    investment: Investment, *, amount, currency: str, provider: str = "stripe",
    installment_payment=None,
) -> Payment:
    """
    Return the pending Payment for this investment + provider, creating one if needed.
    Reuses an existing pending payment so re-clicking "Pay" doesn't spawn duplicates.

    `installment_payment` (Wave C) scopes the reuse to ONE scheduled installment: a normal
    purchase / down-payment passes None → the filter matches the historical NULL-FK rows
    (behaviour identical to before), while each installment gets its OWN pending Payment.
    """
    existing = (
        Payment.objects.filter(
            investment=investment, provider=provider, status=PaymentState.PENDING,
            installment_payment=installment_payment,
        )
        .order_by("-created_at")
        .first()
    )
    if existing is not None:
        return existing
    return Payment.objects.create(
        investment=investment, provider=provider, amount=amount, currency=currency,
        installment_payment=installment_payment,
    )


# --------------------------------------------------------------------------- #
# Provider-agnostic core: complete/fail a Payment by row (the single place the
# Payment + Investment state and the mint side-effect live). Stripe and NOW both
# resolve their provider-specific id to a Payment, then call these.
# --------------------------------------------------------------------------- #
def _complete_payment(payment: Payment) -> dict:
    """
    Idempotently mark a Payment succeeded, then drive the settlement side-effect.

    Two settlement paths share this single gated core (so Stripe + NOW reuse it unchanged):
      * a DOWN-PAYMENT / full-purchase payment (installment_payment is NULL) → mark the
        Investment completed + mint (Phase 3 / Wave B) — UNCHANGED.
      * an INSTALLMENT payment (Wave C; installment_payment set) → do NOT touch the
        Investment (it was already completed by the down-payment) and do NOT re-mint;
        instead progressively release locked→released + credit owner/broker on that
        installment (`settle_installment_payment`).

    Returns {processed, minted, settled?, reason?}. NEVER acts unless the Payment is succeeded.
    """
    with transaction.atomic():
        # NOTE: only the non-nullable `investment` is select_related here. The nullable
        # `installment_payment` would LEFT-JOIN and Postgres forbids FOR UPDATE on the
        # nullable side of an outer join (the Wave-B trap) — we read just its id (a column
        # on Payment, no join) to branch.
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

        installment_payment_id = payment.installment_payment_id
        investment_id = None
        if installment_payment_id is None:
            # Down-payment / full purchase: complete the investment, mint below.
            inv = payment.investment
            if inv.payment_status != PaymentStatus.COMPLETED:
                inv.payment_status = PaymentStatus.COMPLETED
                inv.save(update_fields=["payment_status", "updated_at"])
            investment_id = inv.pk

    # Side-effect AFTER commit. Both branches are themselves idempotent (lock + status
    # guard) and never fabricate a tx.
    if installment_payment_id is not None:
        settled = False
        try:
            from apps.installments.services import settle_installment_payment

            result = settle_installment_payment(installment_payment_id)
            settled = bool(result.get("settled"))
        except Exception:  # noqa: BLE001 - payment is recorded; settlement can be retried
            log.exception(
                "Installment settlement after payment failed for payment %s", payment.pk
            )
        # No mint on the installment path (tokens already minted on the down-payment).
        return {"processed": not already, "minted": False, "settled": settled}

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
