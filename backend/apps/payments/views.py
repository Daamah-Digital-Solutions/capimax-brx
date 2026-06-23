"""
Payments API — Phase 5 Wave 1 (Stripe card). SPEC §6.

  POST /api/payments/stripe/create-intent/  Start a card payment for an investment
                                            (auth + KYC-approved). Returns the
                                            client_secret the browser confirms with
                                            Stripe directly. 503 when keys deferred.
  GET  /api/payments/stripe/config/         Browser-safe publishable key.
  POST /api/payments/stripe/webhook/        PUBLIC, SIGNATURE-VERIFIED. The ONLY path
                                            that completes payment + triggers mint.

Minting is gated on the signed webhook, never on a frontend success. Raw card data
never reaches this server (Stripe Elements tokenises it in the browser).
"""
import logging

from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import KYCApprovedPermission
from apps.investments.models import Investment, PaymentStatus

from . import nowpayments_service, stripe_service
from .models import Payment
from .services import (
    get_or_create_payment,
    mark_nowpayments_failed,
    mark_payment_failed,
    process_successful_nowpayments,
    process_successful_payment,
)

log = logging.getLogger(__name__)


class StripeConfigView(APIView):
    """Return the browser-safe publishable key (empty when Stripe is deferred)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "configured": stripe_service.is_configured(),
                "publishable_key": stripe_service.publishable_key(),
            }
        )


class CreateStripeIntentView(APIView):
    """
    Start a Stripe card payment for one of the caller's investments. Requires an
    approved KYC (investing is KYC-gated) and ownership of the investment.
    """

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        investment_id = request.data.get("investment_id")
        if not investment_id:
            return Response(
                {"detail": "investment_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            investment = Investment.objects.get(id=investment_id, user=request.user)
        except (Investment.DoesNotExist, ValueError, Exception):
            return Response(
                {"detail": "Investment not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if investment.payment_method != "card":
            return Response(
                {"detail": "This investment is not a card payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if investment.payment_status not in (PaymentStatus.PENDING, PaymentStatus.PROCESSING):
            return Response(
                {"detail": "This investment is not awaiting payment."},
                status=status.HTTP_409_CONFLICT,
            )
        if not stripe_service.is_configured():
            return Response(
                {"configured": False, "code": "stripe_unconfigured",
                 "detail": "Card payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Charge the amount due for THIS payment: full price normally, the DOWN-PAYMENT
        # for an installment purchase (`charge_amount`). Identical for normal buys.
        payment = get_or_create_payment(
            investment, amount=investment.charge_amount, currency="usd"
        )
        try:
            intent = stripe_service.create_payment_intent(
                amount=investment.charge_amount,
                currency=payment.currency,
                metadata={"investment_id": str(investment.id), "payment_id": str(payment.id)},
            )
        except stripe_service.StripeError:
            log.warning("Stripe intent creation failed for investment %s", investment.id)
            return Response(
                {"detail": "Could not start the payment. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.stripe_payment_intent_id = intent["id"]
        payment.save(update_fields=["stripe_payment_intent_id", "updated_at"])
        investment.payment_status = PaymentStatus.PROCESSING
        investment.save(update_fields=["payment_status", "updated_at"])

        return Response(
            {
                "client_secret": intent["client_secret"],
                "publishable_key": stripe_service.publishable_key(),
                "payment_id": str(payment.id),
                "investment_id": str(investment.id),
            }
        )


class StripeWebhookView(APIView):
    """
    Stripe webhook receiver — the AUTOMATION HINGE. PUBLIC + signature-verified.
    We act ONLY on a verified signature; an invalid/absent signature is rejected
    (400) and changes nothing. payment_intent.succeeded → complete + mint (idempotent);
    payment_intent.payment_failed → mark failed, no mint.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # truly public; never evaluate a JWT here

    def post(self, request):
        raw = request.body or b""
        signature = request.headers.get(stripe_service.SIGNATURE_HEADER, "")

        if not stripe_service.webhook_configured():
            return Response(
                {"detail": "Stripe webhook is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        event = stripe_service.verify_and_parse_webhook(raw, signature)
        if event is None:
            log.warning("Rejected Stripe webhook with bad/absent signature.")
            return Response(
                {"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST
            )

        event_type = event.get("type", "")
        obj = (event.get("data") or {}).get("object") or {}
        intent_id = obj.get("id") or ""

        if event_type == "payment_intent.succeeded" and intent_id:
            try:
                process_successful_payment(intent_id)
            except Exception:  # noqa: BLE001 - ack so Stripe stops retrying; logged
                log.exception("Error processing succeeded intent %s", intent_id)
                return Response({"ok": True, "handled": False})
        elif event_type == "payment_intent.payment_failed" and intent_id:
            reason = (obj.get("last_payment_error") or {}).get("message", "")
            mark_payment_failed(intent_id, reason=reason)

        return Response({"ok": True})


# --------------------------------------------------------------------------- #
# NOW Payments (Phase 5 Wave 2 — crypto). Same architecture as Stripe above.
# --------------------------------------------------------------------------- #
class CreateNowPaymentsView(APIView):
    """
    Start a crypto payment for one of the caller's investments via NOW Payments.
    Requires approved KYC + ownership + a crypto-method, payable investment. Returns
    the REAL deposit address / amount / currency the user pays. 503 when deferred.
    """

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        investment_id = request.data.get("investment_id")
        pay_currency = (request.data.get("pay_currency") or "").strip().lower()
        if not investment_id or not pay_currency:
            return Response(
                {"detail": "investment_id and pay_currency are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            investment = Investment.objects.get(id=investment_id, user=request.user)
        except (Investment.DoesNotExist, ValueError, Exception):
            return Response(
                {"detail": "Investment not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if investment.payment_method != "crypto":
            return Response(
                {"detail": "This investment is not a crypto payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if investment.payment_status not in (PaymentStatus.PENDING, PaymentStatus.PROCESSING):
            return Response(
                {"detail": "This investment is not awaiting payment."},
                status=status.HTTP_409_CONFLICT,
            )
        if not nowpayments_service.is_configured():
            return Response(
                {"configured": False, "code": "nowpayments_unconfigured",
                 "detail": "Crypto payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Charge the amount due for THIS payment: full price normally, the DOWN-PAYMENT
        # for an installment purchase (`charge_amount`). Identical for normal buys.
        payment = get_or_create_payment(
            investment, amount=investment.charge_amount, currency="usd",
            provider="nowpayments",
        )
        ipn_url = request.build_absolute_uri(reverse("payments:nowpayments-ipn"))
        try:
            created = nowpayments_service.create_payment(
                price_amount=investment.charge_amount,
                price_currency="usd",
                pay_currency=pay_currency,
                order_id=str(payment.id),
                ipn_callback_url=ipn_url,
            )
        except nowpayments_service.NowPaymentsError:
            log.warning("NOW Payments create failed for investment %s", investment.id)
            return Response(
                {"detail": "Could not start the crypto payment. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.nowpayments_payment_id = created["payment_id"]
        payment.pay_currency = created["pay_currency"]
        payment.pay_address = created["pay_address"]
        payment.pay_amount = created["pay_amount"]
        payment.save(update_fields=[
            "nowpayments_payment_id", "pay_currency", "pay_address", "pay_amount",
            "updated_at",
        ])
        investment.payment_status = PaymentStatus.PROCESSING
        investment.save(update_fields=["payment_status", "updated_at"])

        return Response({
            "payment_id": created["payment_id"],
            "pay_address": created["pay_address"],
            "pay_amount": str(created["pay_amount"]) if created["pay_amount"] is not None else None,
            "pay_currency": created["pay_currency"],
            "investment_id": str(investment.id),
        })


# --------------------------------------------------------------------------- #
# Deposit / top-up — an external pay-in that CREDITS the user's internal balance
# (NOT a buy: no Investment, no mint). Reuses the SAME gated Stripe/NOW path; on the
# confirmed webhook/IPN the completion core routes a deposit Payment to a balance
# credit. Settlement-gated, idempotent, inert (503) until provider keys land.
# --------------------------------------------------------------------------- #
from decimal import Decimal, InvalidOperation  # noqa: E402

from apps.wallets.models import Deposit  # noqa: E402

MAX_DEPOSIT = Decimal("1000000")  # sanity cap on a single top-up


def _parse_deposit_amount(raw):
    """Return a positive 2-dp Decimal deposit amount, or (None, error_response)."""
    try:
        amount = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return None, Response(
            {"detail": "A valid amount is required."}, status=status.HTTP_400_BAD_REQUEST
        )
    if amount <= 0 or amount > MAX_DEPOSIT:
        return None, Response(
            {"detail": "Amount must be greater than 0 and within limits."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return amount, None


class CreateDepositStripeIntentView(APIView):
    """
    Start a Stripe card payment to TOP UP the caller's balance. KYC-gated (matches the
    buy flow). On the confirmed webhook the balance is credited — never here. 503 when
    Stripe keys are deferred (honest, not a silent success).
    """

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        amount, err = _parse_deposit_amount(request.data.get("amount"))
        if err:
            return err
        if not stripe_service.is_configured():
            return Response(
                {"configured": False, "code": "stripe_unconfigured",
                 "detail": "Card payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        deposit = Deposit.objects.create(
            user=request.user, amount=amount, payment_method="card"
        )
        payment = Payment.objects.create(
            deposit=deposit, provider="stripe", amount=amount, currency="usd"
        )
        try:
            intent = stripe_service.create_payment_intent(
                amount=amount, currency=payment.currency,
                metadata={"deposit_id": str(deposit.id), "payment_id": str(payment.id)},
            )
        except stripe_service.StripeError:
            log.warning("Stripe deposit intent creation failed for user %s", request.user.id)
            return Response(
                {"detail": "Could not start the deposit. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.stripe_payment_intent_id = intent["id"]
        payment.save(update_fields=["stripe_payment_intent_id", "updated_at"])
        return Response(
            {
                "client_secret": intent["client_secret"],
                "publishable_key": stripe_service.publishable_key(),
                "payment_id": str(payment.id),
                "deposit_id": str(deposit.id),
            }
        )


class CreateDepositNowPaymentsView(APIView):
    """
    Start a crypto payment (NOW Payments) to TOP UP the caller's balance. KYC-gated.
    Returns the REAL deposit address / amount the user pays; the balance is credited
    only on the confirmed IPN. 503 when NOW keys are deferred.
    """

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        amount, err = _parse_deposit_amount(request.data.get("amount"))
        if err:
            return err
        pay_currency = (request.data.get("pay_currency") or "").strip().lower()
        if not pay_currency:
            return Response(
                {"detail": "pay_currency is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not nowpayments_service.is_configured():
            return Response(
                {"configured": False, "code": "nowpayments_unconfigured",
                 "detail": "Crypto payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        deposit = Deposit.objects.create(
            user=request.user, amount=amount, payment_method="crypto"
        )
        payment = Payment.objects.create(
            deposit=deposit, provider="nowpayments", amount=amount, currency="usd"
        )
        ipn_url = request.build_absolute_uri(reverse("payments:nowpayments-ipn"))
        try:
            created = nowpayments_service.create_payment(
                price_amount=amount, price_currency="usd", pay_currency=pay_currency,
                order_id=str(payment.id), ipn_callback_url=ipn_url,
            )
        except nowpayments_service.NowPaymentsError:
            log.warning("NOW deposit create failed for user %s", request.user.id)
            return Response(
                {"detail": "Could not start the crypto deposit. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.nowpayments_payment_id = created["payment_id"]
        payment.pay_currency = created["pay_currency"]
        payment.pay_address = created["pay_address"]
        payment.pay_amount = created["pay_amount"]
        payment.save(update_fields=[
            "nowpayments_payment_id", "pay_currency", "pay_address", "pay_amount",
            "updated_at",
        ])
        return Response({
            "payment_id": created["payment_id"],
            "pay_address": created["pay_address"],
            "pay_amount": str(created["pay_amount"]) if created["pay_amount"] is not None else None,
            "pay_currency": created["pay_currency"],
            "deposit_id": str(deposit.id),
        })


class NowPaymentsIpnView(APIView):
    """
    NOW Payments IPN receiver — the AUTOMATION HINGE. PUBLIC + signature-verified.
    Acts ONLY on a verified signature; invalid/absent → 400, no state change.
    Terminal SUCCESS (finished/confirmed) → complete + mint (idempotent across the
    waiting→confirming→confirmed→finished sequence); failed/expired/refunded → mark
    failed, no mint. In-flight statuses are acknowledged with no action.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # truly public; never evaluate a JWT here

    def post(self, request):
        raw = request.body or b""
        signature = request.headers.get(nowpayments_service.IPN_SIGNATURE_HEADER, "")

        if not nowpayments_service.ipn_configured():
            return Response(
                {"detail": "NOW Payments IPN is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = nowpayments_service.verify_ipn(raw, signature)
        if payload is None:
            log.warning("Rejected NOW Payments IPN with bad/absent signature.")
            return Response(
                {"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST
            )

        info = nowpayments_service.parse_ipn(payload)
        pid = info["payment_id"]
        state = info["payment_status"]
        if not pid:
            return Response({"ok": True, "handled": False})

        if state in nowpayments_service.SUCCESS_STATES:
            try:
                process_successful_nowpayments(pid)
            except Exception:  # noqa: BLE001 - ack so NOW stops retrying; logged
                log.exception("Error processing NOW payment %s", pid)
                return Response({"ok": True, "handled": False})
        elif state in nowpayments_service.FAILURE_STATES:
            mark_nowpayments_failed(pid, reason=f"NOW status: {state}")
        # waiting / confirming / sending / partially_paid → no mint, just acknowledge.

        return Response({"ok": True})
