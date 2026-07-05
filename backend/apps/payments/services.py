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
from apps.investments.services import settle_investment

from .models import Payment, PaymentState

log = logging.getLogger(__name__)


class PaymentNotFound(Exception):
    """No Payment matches the given PaymentIntent id."""


def get_or_create_payment(
    investment: Investment, *, amount, currency: str, provider: str = "stripe",
    installment_payment=None, is_installment_payoff: bool = False,
) -> Payment:
    """
    Return the pending Payment for this investment + provider, creating one if needed.
    Reuses an existing pending payment so re-clicking "Pay" doesn't spawn duplicates.

    `installment_payment` (Wave C) scopes the reuse to ONE scheduled installment: a normal
    purchase / down-payment passes None → the filter matches the historical NULL-FK rows
    (behaviour identical to before), while each installment gets its OWN pending Payment.
    `is_installment_payoff` (early payoff) distinguishes a "pay everything remaining" charge
    (anchored on the first unpaid row) from a single-installment charge on that same row.
    """
    existing = (
        Payment.objects.filter(
            investment=investment, provider=provider, status=PaymentState.PENDING,
            installment_payment=installment_payment,
            is_installment_payoff=is_installment_payoff,
        )
        .order_by("-created_at")
        .first()
    )
    if existing is not None:
        return existing
    return Payment.objects.create(
        investment=investment, provider=provider, amount=amount, currency=currency,
        installment_payment=installment_payment,
        is_installment_payoff=is_installment_payoff,
    )


# --------------------------------------------------------------------------- #
# Provider-agnostic core: complete/fail a Payment by row (the single place the
# Payment + Investment state and the mint side-effect live). Stripe and NOW both
# resolve their provider-specific id to a Payment, then call these.
# --------------------------------------------------------------------------- #
def _complete_payment(payment: Payment) -> dict:
    """
    Idempotently mark a Payment succeeded, then drive the settlement side-effect.

    Three settlement paths share this single gated core (so Stripe + NOW reuse it unchanged):
      * a DEPOSIT payment (deposit set) → CREDIT the user's internal balance
        (`credit_user_balance(source="deposit")`), idempotently. NO investment, NO mint.
      * a DOWN-PAYMENT / full-purchase payment (deposit + installment_payment NULL) → mark
        the Investment completed + mint (Phase 3 / Wave B) — UNCHANGED.
      * an INSTALLMENT payment (Wave C; installment_payment set) → do NOT touch the
        Investment and do NOT re-mint; progressively release locked→released + credit
        owner/broker on that installment (`settle_installment_payment`).

    Returns {processed, minted, settled?/credited?, reason?}. NEVER acts unless succeeded.
    """
    with transaction.atomic():
        # We DON'T select_related the FKs here: `investment` is now nullable, so a
        # select_related would LEFT-JOIN and Postgres forbids FOR UPDATE on the nullable
        # side of an outer join. We read the FK *ids* (plain columns on Payment, no join)
        # to branch, then load the related row separately where needed.
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        already = payment.status == PaymentState.SUCCEEDED
        if not already:
            payment.status = PaymentState.SUCCEEDED
            payment.failure_reason = ""
            payment.save(update_fields=["status", "failure_reason", "updated_at"])

        deposit_id = payment.deposit_id
        installment_payment_id = payment.installment_payment_id
        is_installment_payoff = payment.is_installment_payoff
        investment_id = None
        if deposit_id is None and installment_payment_id is None:
            # Down-payment / full purchase: settled AFTER commit via the shared helper
            # (mark completed + mint), so a PSP settlement and a Nova-certificate approval
            # run the exact same path. Read the id here (plain column, no join).
            investment_id = payment.investment_id

    # Side-effect AFTER commit. Every branch is itself idempotent (lock + status/flag
    # guard) and never fabricates a tx.
    if deposit_id is not None:
        # DEPOSIT: credit the balance once (no mint, no tokens). Idempotent via the
        # Deposit.credited flag under a row lock.
        credited = _credit_deposit(deposit_id)
        return {"processed": not already, "minted": False, "credited": credited}

    if installment_payment_id is not None:
        settled = False
        try:
            # Early payoff settles EVERY remaining row (full unlock + complete); a normal
            # per-installment charge settles only its own row. Both: progressive release +
            # per-installment owner/broker credit, NO new mint (tokens minted on down-pay).
            if is_installment_payoff:
                from apps.installments.services import settle_installment_payoff

                result = settle_installment_payoff(installment_payment_id)
            else:
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
        result = settle_investment(Investment.objects.get(pk=investment_id))
        minted = bool(result.get("minted"))
        reason = result.get("reason")
    except Exception:  # noqa: BLE001 - payment is recorded; settlement can be retried
        log.exception("Settlement after payment failed for payment %s", payment.pk)

    return {"processed": not already, "minted": minted, "reason": reason}


def _credit_deposit(deposit_id) -> bool:
    """
    Credit a confirmed DEPOSIT to the user's internal balance, exactly once. Returns True
    if it credited now, False if it was already credited (replayed webhook → no double
    credit). Settlement-gated: only ever reached from `_complete_payment`.
    """
    from django.utils import timezone

    from apps.wallets.models import Deposit
    from apps.wallets.services import credit_user_balance

    with transaction.atomic():
        deposit = Deposit.objects.select_for_update().get(pk=deposit_id)
        if deposit.credited:
            return False  # idempotent: already credited on an earlier delivery
        credit_user_balance(
            deposit.user, deposit.amount, source="deposit",
            reference=str(deposit.id), memo="Wallet top-up",
        )
        deposit.credited = True
        deposit.status = Deposit.Status.COMPLETED
        deposit.credited_at = timezone.now()
        deposit.save(update_fields=["credited", "status", "credited_at", "updated_at"])
    return True


def _fail_payment(payment: Payment, *, reason: str = "") -> None:
    """Mark a Payment failed (no mint/credit). Idempotent; never downgrades a paid one."""
    with transaction.atomic():
        # No select_related (nullable FKs + FOR UPDATE outer-join restriction); branch on ids.
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.status == PaymentState.SUCCEEDED:
            return  # a success already won — don't downgrade a paid investment/deposit
        payment.status = PaymentState.FAILED
        payment.failure_reason = (reason or "")[:300]
        payment.save(update_fields=["status", "failure_reason", "updated_at"])
        if payment.deposit_id is not None:
            from apps.wallets.models import Deposit

            Deposit.objects.filter(
                pk=payment.deposit_id, credited=False
            ).update(status=Deposit.Status.FAILED)
            return
        if payment.installment_payment_id is not None:
            return  # installment failure leaves the plan as-is (no investment to fail)
        inv = payment.investment
        if inv is not None and inv.payment_status != PaymentStatus.COMPLETED:
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
