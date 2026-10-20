"""
Automatic withdrawals to the investor's bank through Stripe Connect.

  link        the investor opens a Stripe-hosted onboarding once (an Express account) and
              adds their bank account — and optionally a debit card for instant payouts.
  request     the amount (plus nothing else) leaves the wallet at once, like any withdrawal.
              Up to WITHDRAWAL_AUTO_APPROVE_LIMIT it is paid right away; above it waits for an
              admin ("Approve and pay via Stripe" in the Django admin).
  pay         a Stripe Transfer of (amount − fee) to the connected account; Stripe then pays
              their bank on its own schedule. Instant: an instant payout to their debit card,
              for PAYOUT_INSTANT_FEE_PERCENT (rounded up to the cent), up to PAYOUT_INSTANT_MAX.
              If the instant leg fails the money still arrives the standard way and the fee is
              returned to the wallet.
  failures    a refused transfer fails the withdrawal and returns the amount to the wallet;
              a platform Stripe balance too low to fund it leaves it waiting for an admin.

Crypto withdrawals stay manual (an operator pays). Nothing here runs unless "bank" is in
PAYOUT_AUTO_METHODS and Stripe is configured.
"""
from __future__ import annotations

import logging
from decimal import ROUND_UP, Decimal

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.payments import stripe_service

from .models import BalanceTransaction, StripeConnectAccount, Withdrawal

log = logging.getLogger(__name__)


def bank_auto_enabled() -> bool:
    return "bank" in [m.strip() for m in settings.PAYOUT_AUTO_METHODS] and stripe_service.is_configured()


def connect_account(user, *, refresh: bool = False):
    acct = StripeConnectAccount.objects.filter(user=user).first()
    if acct and refresh and not acct.payouts_enabled and bank_auto_enabled():
        try:
            info = stripe_service.retrieve_account(acct.account_id)
            acct.payouts_enabled = info["payouts_enabled"]
            acct.details_submitted = info["details_submitted"]
            acct.save(update_fields=["payouts_enabled", "details_submitted", "updated_at"])
        except stripe_service.StripeError:
            pass
    return acct


def instant_fee(amount: Decimal) -> Decimal:
    pct = Decimal(str(settings.PAYOUT_INSTANT_FEE_PERCENT))
    return (Decimal(amount) * pct / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_UP)


def options(user) -> dict:
    """What the withdraw form can offer this investor."""
    acct = connect_account(user, refresh=True) if bank_auto_enabled() else None
    ready = bool(acct and acct.payouts_enabled)
    return {
        "bank_auto": bank_auto_enabled(),
        "connect_status": "none" if acct is None else ("verified" if ready else "pending"),
        "auto_approve_limit": float(settings.WITHDRAWAL_AUTO_APPROVE_LIMIT),
        "instant_enabled": bool(settings.PAYOUT_INSTANT_ENABLED and ready),
        "instant_fee_percent": float(settings.PAYOUT_INSTANT_FEE_PERCENT),
        "instant_max": float(settings.PAYOUT_INSTANT_MAX),
    }


def start_onboarding(user, country: str = "") -> str:
    """The Stripe-hosted page where the investor links their bank (and debit card). The account
    is created in the investor's country (asked once, before the first link)."""
    if not bank_auto_enabled():
        raise ValidationError({"code": "payouts_manual", "detail": "Automatic bank payouts are not enabled."})
    acct = StripeConnectAccount.objects.filter(user=user).first()
    if acct is None:
        country = (country or "").strip().upper()
        if len(country) != 2 or not country.isalpha():
            raise ValidationError({"code": "country_required", "detail": "Choose the country of your bank account."})
        acct = StripeConnectAccount.objects.create(
            user=user,
            account_id=stripe_service.create_express_account(
                email=user.email, user_id=str(user.pk), country=country),
        )
    back = f"{settings.FRONTEND_URL.rstrip('/')}/wallet?payouts=linked"
    return stripe_service.create_account_link(account_id=acct.account_id, refresh_url=back, return_url=back)


def request_auto_withdrawal(user, amount, *, speed: str = "standard", notes: str = "") -> Withdrawal:
    """A bank withdrawal paid automatically to the investor's connected Stripe account."""
    from .services import request_withdrawal

    amount = Decimal(amount)
    acct = connect_account(user, refresh=True)
    if not bank_auto_enabled() or acct is None or not acct.payouts_enabled:
        raise ValidationError({"code": "connect_not_ready",
                               "detail": "Link your bank account with Stripe first."})
    fee = Decimal("0")
    if speed == "instant":
        if not settings.PAYOUT_INSTANT_ENABLED:
            raise ValidationError({"code": "instant_not_available", "detail": "Instant withdrawals are off."})
        if amount > Decimal(str(settings.PAYOUT_INSTANT_MAX)):
            raise ValidationError({"code": "instant_limit_exceeded",
                                   "detail": f"Instant withdrawals are limited to ${settings.PAYOUT_INSTANT_MAX:,.0f}."})
        if not stripe_service.has_instant_destination(acct.account_id):
            raise ValidationError({"code": "instant_not_available",
                                   "detail": "Add an eligible debit card in your Stripe payout account first."})
        fee = instant_fee(amount)
        if fee >= amount:
            raise ValidationError({"amount": "The amount is too small for an instant withdrawal."})
    with transaction.atomic():
        wd = request_withdrawal(user, amount, method="bank", notes=notes)
        wd.provider = "stripe"
        wd.speed = speed
        wd.fee_amount = fee
        wd.destination_label = (f"Stripe payout account ···{acct.account_id[-4:]}"
                                + (" (instant)" if speed == "instant" else ""))
        wd.save(update_fields=["provider", "speed", "fee_amount", "destination_label"])
        if amount <= Decimal(str(settings.WITHDRAWAL_AUTO_APPROVE_LIMIT)):
            transaction.on_commit(lambda: execute_safely(wd.pk))
    return wd


def execute_safely(withdrawal_id) -> str:
    """execute() after the request committed: an unexpected error leaves it pending for an
    admin (and alerts) instead of failing the investor's request."""
    try:
        return execute(withdrawal_id)
    except Exception:
        log.exception("Automatic payout of withdrawal %s crashed; left for an admin", withdrawal_id)
        return "error"


def execute(withdrawal_id) -> str:
    """Pay an approved automatic withdrawal. Returns what happened."""
    from apps.wallets.services import credit_user_balance

    from .payouts import complete_withdrawal, fail_withdrawal

    with transaction.atomic():
        wd = Withdrawal.objects.select_for_update().select_related("user").get(pk=withdrawal_id)
        if wd.provider != "stripe" or wd.status != Withdrawal.Status.PENDING:
            return "skipped"
        acct = StripeConnectAccount.objects.filter(user=wd.user, payouts_enabled=True).first()
        if acct is None:
            return "skipped"
        wd.status = Withdrawal.Status.PROCESSING
        wd.save(update_fields=["status"])

    send = wd.amount - wd.fee_amount
    try:
        transfer_id = stripe_service.create_transfer(
            amount=send, account_id=acct.account_id, idempotency_key=f"wd-{wd.pk}",
            metadata={"withdrawal_id": str(wd.pk), "reference": wd.reference},
        )
    except stripe_service.StripeBalanceInsufficient:
        Withdrawal.objects.filter(pk=wd.pk).update(
            status=Withdrawal.Status.PENDING,
            failure_reason="Waiting: the platform's Stripe balance is too low — pay manually or retry.",
        )
        log.error("Withdrawal %s could not be funded from the platform Stripe balance", wd.reference)
        return "awaiting_balance"
    except stripe_service.StripeError as exc:
        fail_withdrawal(wd.pk, reason=f"Stripe refused the transfer: {exc}")
        return "failed"

    if wd.speed == "instant":
        try:
            stripe_service.create_instant_payout(
                amount=send, account_id=acct.account_id, idempotency_key=f"wd-{wd.pk}-instant",
            )
        except stripe_service.StripeError:
            # The money is in their Stripe account and reaches the bank the standard way;
            # the instant fee wasn't earned, so it goes back to the wallet.
            with transaction.atomic():
                Withdrawal.objects.filter(pk=wd.pk).update(speed="standard", fee_amount=0)
                if wd.fee_amount > 0 and not BalanceTransaction.objects.filter(
                    source="instant_fee_refund", reference=str(wd.pk)
                ).exists():
                    credit_user_balance(
                        wd.user, wd.fee_amount, source="instant_fee_refund", reference=str(wd.pk),
                        memo=f"Instant payout not available for {wd.reference} — fee returned",
                    )
    complete_withdrawal(wd.pk, payout_reference=transfer_id)
    return "paid"
