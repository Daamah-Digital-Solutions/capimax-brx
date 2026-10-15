"""
Reconcile paid purchases whose tokens never arrived (run hourly by cron).

A purchase can be paid but left without its units when the settlement after the payment
fails: the PSP webhook records the payment and answers 200 (so the PSP won't redeliver), a
chain call errors or times out, the buyer has no custodial wallet yet, or an admin approval
of a Nova certificate errors half-way. Nothing retried those. This finds them and finishes
them, oldest first:

  A. completed, not minted, not refunded          → mint_investment (create the wallet first
                                                     when it's missing)
  B. a succeeded payment / approved certificate,
     investment still pending, processing or
     failed and not refunded                       → settle_investment (mints, or refunds the
                                                     buyer if it can no longer be honoured)

Case A deliberately calls mint_investment, not settle_investment: re-running the late-payment
checks on a row that is already completed could wrongly refund it.

Never mints twice: for a property deployed on this chain, if the wallet already holds MORE
units on-chain than our ledger says (a chain call that timed out but was mined), the row is
left alone and reported for manual review instead of minting again.

Rows younger than RECONCILE_GRACE_MINUTES are skipped so a webhook still being processed isn't
raced. Every row is handled on its own; a failure is logged at ERROR (→ alert email) and the
run continues.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone

from apps.chain import service as chain_service
from apps.wallets.models import OwnershipToken, UserWallet
from apps.wallets.services import get_or_create_custodial_wallet

from .models import RESALE_PAYMENT_METHODS, Investment, PaymentStatus
from .services import _deployed_on_this_chain, mint_investment, settle_investment

log = logging.getLogger(__name__)


def _grace_cutoff():
    minutes = int(getattr(settings, "RECONCILE_GRACE_MINUTES", 15))
    return timezone.now() - timedelta(minutes=minutes)


def unminted_completed():
    """Case A: paid and completed, but the units were never issued."""
    return (
        Investment.objects.filter(
            payment_status=PaymentStatus.COMPLETED, tokens_minted=False,
            refunded_at__isnull=True, updated_at__lt=_grace_cutoff(),
        )
        .exclude(payment_method__in=RESALE_PAYMENT_METHODS)
        .order_by("created_at")
    )


def paid_but_unsettled():
    """Case B: the money arrived (PSP payment succeeded, or a Nova certificate was approved)
    but the investment was never completed nor refunded."""
    return (
        Investment.objects.filter(
            payment_status__in=[
                PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED,
            ],
            refunded_at__isnull=True, updated_at__lt=_grace_cutoff(),
        )
        .filter(
            Q(
                payments__status="succeeded",
                payments__deposit__isnull=True,
                payments__installment_payment__isnull=True,
            )
            | Q(sukuk_certificate__status="approved")
        )
        .distinct()
        .order_by("created_at")
    )


def _chain_holds_more_than_ledger(inv, wallet) -> bool:
    """True when the wallet already holds more units on-chain than our ledger records."""
    contract = _deployed_on_this_chain(inv.property)
    if not contract:
        return False
    on_chain = chain_service.read_balance(contract, wallet.wallet_address)
    ledger = (
        OwnershipToken.objects.filter(wallet=wallet, property_id=inv.property.slug)
        .aggregate(total=Sum("token_amount"))["total"]
        or 0
    )
    return int(on_chain) > int(ledger)


def _finish_unminted(inv) -> str:
    wallet = inv.wallet or UserWallet.objects.filter(user=inv.user).first()
    if wallet is None:
        wallet, _created = get_or_create_custodial_wallet(inv.user)
    if _chain_holds_more_than_ledger(inv, wallet):
        log.error(
            "Investment %s (%s × %s) is unminted in the ledger but the wallet already holds "
            "more units on-chain than recorded — not minting again; review it by hand.",
            inv.pk, inv.token_amount, inv.property.slug,
        )
        return "needs_review"
    result = mint_investment(inv)
    return "minted" if result.get("minted") else f"pending:{result.get('reason', '?')}"


def _finish_unsettled(inv) -> str:
    if not inv.wallet_id and not UserWallet.objects.filter(user=inv.user).exists():
        get_or_create_custodial_wallet(inv.user)
    result = settle_investment(inv)
    if result.get("minted"):
        return "minted"
    reason = str(result.get("reason") or "")
    return reason if reason.startswith("refunded") else f"pending:{reason or '?'}"


def reconcile(*, dry_run: bool = False) -> dict:
    """Finish every stranded purchase. Returns counts per outcome."""
    outcomes: dict[str, int] = {}
    work = [(inv, _finish_unminted) for inv in unminted_completed().select_related("property", "user")]
    work += [(inv, _finish_unsettled) for inv in paid_but_unsettled().select_related("property", "user")]
    for inv, finish in work:
        if dry_run:
            key = "would_mint" if finish is _finish_unminted else "would_settle"
        else:
            try:
                key = finish(inv)
            except Exception:  # noqa: BLE001 — one bad row must not stop the others
                log.exception("Could not finish stranded investment %s", inv.pk)
                key = "error"
        outcomes[key] = outcomes.get(key, 0) + 1
        if key not in ("minted", "would_mint", "would_settle") and not key.startswith("refunded"):
            log.warning("Stranded investment %s → %s", inv.pk, key)
    return outcomes
