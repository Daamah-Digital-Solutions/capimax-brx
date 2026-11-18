"""
Liquidity-provider withdrawals (payout made by an operator, off-platform).

Requesting one now takes the amount out of the LP's balance at once, under a row lock, so two
requests can never spend the same balance. From then on it only moves forward:

  pending ──▶ processing ──▶ completed   (paid out → counted in total_withdrawn)
     └──────────┴──────────▶ failed      (not paid → the amount returns to the balance)
"""
from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import LiquidityProvider, LPTransaction

OPEN = (LPTransaction.TxStatus.PENDING, LPTransaction.TxStatus.PROCESSING)


class LPWithdrawalError(Exception):
    """Not enough balance, or the withdrawal is not in a state that allows this step."""


def reference_of(tx) -> str:
    """The withdrawal's short reference shown to the LP and the team (LP-XXXXXXXX)."""
    return "LP-" + str(tx.pk).replace("-", "")[:8].upper()


def _tell(tx, lp, kind, **extra):
    """Tell the LP about its withdrawal (in-app + email), inside the step's transaction."""
    from apps.notifications.services import NotificationType, notify

    notify(
        lp.user, getattr(NotificationType, kind),
        params={"amount": str(tx.amount), "reference": reference_of(tx), **extra},
        action_url="/liquidity-provider#withdrawals",
    )


def request_lp_withdrawal(lp_id, amount, *, method: str, notes: str = "") -> LPTransaction:
    amount = Decimal(amount)
    with transaction.atomic():
        lp = LiquidityProvider.objects.select_for_update().get(pk=lp_id)
        if amount <= 0 or amount > lp.current_balance:
            raise LPWithdrawalError("Insufficient balance.")
        lp.current_balance = lp.current_balance - amount
        lp.save(update_fields=["current_balance", "updated_at"])
        tx = LPTransaction.objects.create(
            lp=lp, tx_type="withdrawal", amount=amount, currency="USD",
            status=LPTransaction.TxStatus.PENDING, withdrawal_method=method,
            notes=notes or None,
        )
        _tell(tx, lp, "LP_WITHDRAWAL_REQUESTED")
        return tx


def _lock(tx_id):
    tx = LPTransaction.objects.select_for_update().get(pk=tx_id, tx_type="withdrawal")
    lp = LiquidityProvider.objects.select_for_update().get(pk=tx.lp_id)
    return tx, lp


def mark_processing(tx_id) -> LPTransaction:
    with transaction.atomic():
        tx, lp = _lock(tx_id)
        if tx.status != LPTransaction.TxStatus.PENDING:
            raise LPWithdrawalError(f"Withdrawal is {tx.status}, not pending.")
        tx.status = LPTransaction.TxStatus.PROCESSING
        tx.save(update_fields=["status"])
        _tell(tx, lp, "LP_WITHDRAWAL_PROCESSING")
        return tx


def complete_lp_withdrawal(tx_id, *, payout_reference: str = "") -> LPTransaction:
    with transaction.atomic():
        tx, lp = _lock(tx_id)
        if tx.status == LPTransaction.TxStatus.COMPLETED:
            return tx
        if tx.status not in OPEN:
            raise LPWithdrawalError(f"Withdrawal is {tx.status}; it can't be completed.")
        if not tx.balance_debited:
            # A withdrawal from before the rule: the balance is taken now, when it is paid.
            if tx.amount > lp.current_balance:
                raise LPWithdrawalError("The LP balance no longer covers this withdrawal.")
            lp.current_balance = lp.current_balance - tx.amount
            tx.balance_debited = True
        tx.status = LPTransaction.TxStatus.COMPLETED
        tx.processed_at = timezone.now()
        if payout_reference:
            tx.bank_reference = payout_reference[:120]
        tx.save(update_fields=["status", "processed_at", "bank_reference", "balance_debited"])
        lp.total_withdrawn = lp.total_withdrawn + tx.amount
        lp.save(update_fields=["current_balance", "total_withdrawn", "updated_at"])
        _tell(tx, lp, "LP_WITHDRAWAL_COMPLETED", payout_reference=tx.bank_reference or "—")
        return tx


def fail_lp_withdrawal(tx_id, *, reason: str = "") -> LPTransaction:
    with transaction.atomic():
        tx, lp = _lock(tx_id)
        if tx.status == LPTransaction.TxStatus.FAILED:
            return tx
        if tx.status not in OPEN:
            raise LPWithdrawalError(f"Withdrawal is {tx.status}; a paid-out withdrawal can't be failed.")
        tx.status = LPTransaction.TxStatus.FAILED
        tx.processed_at = timezone.now()
        tx.failure_reason = (reason or "")[:300]
        tx.save(update_fields=["status", "processed_at", "failure_reason"])
        # Only withdrawals that took the money at request time give it back (older ones,
        # from before this rule, never debited the balance).
        if tx.balance_debited:
            lp.current_balance = lp.current_balance + tx.amount
            lp.save(update_fields=["current_balance", "updated_at"])
        _tell(tx, lp, "LP_WITHDRAWAL_FAILED", reason=tx.failure_reason or "—")
        return tx
