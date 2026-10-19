"""
Closing an investor withdrawal (the payout itself is still made by an operator, off-platform).

The amount left the wallet when the withdrawal was requested (services.request_withdrawal).
From then on a withdrawal only moves forward through these functions — never by editing the
status by hand — so the money can't get lost:

  pending ──▶ processing ──▶ completed   (paid out; nothing returns)
     └──────────┴──────────▶ failed      (not paid; the amount goes back to the wallet, once)

The refund is keyed on the withdrawal (BalanceTransaction source="withdrawal_refund",
reference=<withdrawal id>), so running it twice never credits twice. The user is told in
both cases.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import BalanceTransaction, Withdrawal

REFUND_SOURCE = "withdrawal_refund"
OPEN = (Withdrawal.Status.PENDING, Withdrawal.Status.PROCESSING)


class WithdrawalStateError(Exception):
    """The withdrawal is not in a state that allows this step."""


def _lock(withdrawal_id) -> Withdrawal:
    return Withdrawal.objects.select_for_update().select_related("user").get(pk=withdrawal_id)


def mark_processing(withdrawal_id) -> Withdrawal:
    with transaction.atomic():
        wd = _lock(withdrawal_id)
        if wd.status != Withdrawal.Status.PENDING:
            raise WithdrawalStateError(f"{wd.reference} is {wd.status}, not pending.")
        wd.status = Withdrawal.Status.PROCESSING
        wd.save(update_fields=["status"])
        return wd


def complete_withdrawal(withdrawal_id, *, payout_reference: str = "") -> Withdrawal:
    """The operator paid it out. Final: the money stays out of the wallet."""
    from apps.notifications.services import NotificationType, notify

    with transaction.atomic():
        wd = _lock(withdrawal_id)
        if wd.status == Withdrawal.Status.COMPLETED:
            return wd
        if wd.status not in OPEN:
            raise WithdrawalStateError(f"{wd.reference} is {wd.status}; it can't be completed.")
        wd.status = Withdrawal.Status.COMPLETED
        wd.processed_at = timezone.now()
        if payout_reference:
            wd.payout_reference = payout_reference[:120]
        wd.save(update_fields=["status", "processed_at", "payout_reference"])
        notify(
            wd.user, NotificationType.WITHDRAWAL_COMPLETED,
            params={"amount": str(wd.amount), "reference": wd.reference},
            action_url="/wallet",
        )
        return wd


def fail_withdrawal(withdrawal_id, *, reason: str = "") -> Withdrawal:
    """The payout didn't happen: close it and return the amount to the wallet (once)."""
    from apps.notifications.services import NotificationType, notify

    from .services import credit_user_balance

    with transaction.atomic():
        wd = _lock(withdrawal_id)
        if wd.status == Withdrawal.Status.FAILED:
            return wd
        if wd.status not in OPEN:
            raise WithdrawalStateError(
                f"{wd.reference} is {wd.status}; a paid-out withdrawal can't be failed."
            )
        wd.status = Withdrawal.Status.FAILED
        wd.processed_at = timezone.now()
        wd.failure_reason = (reason or "")[:300]
        wd.save(update_fields=["status", "processed_at", "failure_reason"])
        if not BalanceTransaction.objects.filter(source=REFUND_SOURCE, reference=str(wd.pk)).exists():
            credit_user_balance(
                wd.user, wd.amount, source=REFUND_SOURCE, reference=str(wd.pk),
                memo=f"Withdrawal {wd.reference} was not completed — amount returned",
            )
        notify(
            wd.user, NotificationType.WITHDRAWAL_FAILED,
            params={"amount": str(wd.amount), "reference": wd.reference,
                    "reason": wd.failure_reason or "—"},
            action_url="/wallet",
        )
        return wd
