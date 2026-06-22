"""
Installments API — Wave A read + Wave C per-installment gated payment.

  GET  /api/installments/plans/                 The caller's OWN plans + schedules, shaped to
                                                Installments.tsx. SELF-SCOPED.
  POST /api/installments/plans/<id>/pay-next/   Wave C: start a GATED charge for the caller's
                                                NEXT due installment (Stripe or NOW). On the
                                                confirmed webhook/IPN the shared payments core
                                                routes to settle_installment_payment
                                                (progressive locked→released + per-installment
                                                owner/broker credit) — NO second mint.

Plans are built by `services.build_installment_plan` (the Checkout wave), never by a user API
write. Paying an installment reuses the EXISTING Stripe/NOW machinery; we never mint on a
frontend response.
"""
from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.urls import reverse

from apps.core.permissions import KYCApprovedPermission
from apps.payments import nowpayments_service, stripe_service
from apps.payments.services import get_or_create_payment
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken

from .models import (
    InstallmentPayment,
    InstallmentPlan,
    InstallmentPaymentStatus,
    InstallmentPlanStatus,
)


class InstallmentPlansView(APIView):
    """Summary + the caller's installment plans (each with its schedule rows)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = list(
            InstallmentPlan.objects.filter(investor=request.user).prefetch_related(
                "payments", "investments"
            )
        )

        # Resolve bilingual property names (one query). plan.property_id is the FK pk
        # (Property pk), not the slug — resolve the slug + names via the FK set.
        prop_pks = {p.property_id for p in plans}
        props = {
            prop.pk: prop
            for prop in Property.objects.filter(pk__in=prop_pks).only(
                "pk", "slug", "name", "name_ar"
            )
        }

        plan_rows = []
        total_commitment = Decimal("0")
        total_paid = Decimal("0")
        next_due = None  # (date, amount)

        for plan in plans:
            prop = props.get(plan.property_id)
            slug = prop.slug if prop else ""
            name_en = prop.name if prop else plan.property_name
            name_ar = prop.name_ar if prop else plan.property_name

            payments = sorted(plan.payments.all(), key=lambda p: p.sequence)
            paid_installments = sum(
                1 for p in payments if p.status == InstallmentPaymentStatus.PAID
            )
            # Wave B: a CONFIRMED down-payment is tracked on the plan (down_paid_at).
            down_paid = plan.down_paid_at is not None
            # Display schedule = a synthesized down-payment row (display-only; the DB keeps
            # the down-payment on the plan) followed by the N installment rows.
            display_payments = [
                {
                    "sequence": 0,
                    "type": "down_payment",
                    "date": (plan.down_paid_at or plan.created_at).date().isoformat(),
                    "amount": float(plan.down_payment_amount),
                    "status": "paid" if down_paid else "pending",
                }
            ] + [
                {
                    "sequence": p.sequence,
                    "type": "installment",
                    "date": p.due_date.isoformat(),
                    "amount": float(p.amount),
                    "status": p.status,
                }
                for p in payments
            ]

            # Paid = the down-payment (once confirmed) + any paid installments (Wave C).
            paid_amount = sum(
                (p.amount for p in payments if p.status == InstallmentPaymentStatus.PAID),
                Decimal("0"),
            ) + (plan.down_payment_amount if down_paid else Decimal("0"))
            # Released % == paid % (full-mint-then-lock: released share tracks money paid).
            progress = (
                float((paid_amount / plan.total_amount) * 100) if plan.total_amount else 0.0
            )

            # Real on-chain token split from the linked (down-payment) investment's
            # OwnershipToken: released = token_amount − locked_amount. Until the down-payment
            # confirms (mint), nothing is released.
            inv = next(iter(plan.investments.all()), None)
            token_amount_full = locked_tokens = released_tokens = None
            if inv is not None:
                token_amount_full = int(inv.token_amount)
                if inv.tokens_minted and inv.wallet_id:
                    otoken = OwnershipToken.objects.filter(
                        wallet_id=inv.wallet_id, property_id=slug
                    ).first()
                    locked_tokens = min(int(otoken.locked_amount), token_amount_full) if otoken else 0
                else:
                    locked_tokens = token_amount_full  # not minted yet → all locked
                released_tokens = token_amount_full - locked_tokens

            pending = next(
                (p for p in payments if p.status == InstallmentPaymentStatus.PENDING), None
            )
            if pending is not None and (next_due is None or pending.due_date < next_due[0]):
                next_due = (pending.due_date, pending.amount)

            total_commitment += plan.total_amount
            total_paid += paid_amount

            plan_rows.append(
                {
                    "id": str(plan.id),
                    "propertyId": slug,
                    "property": name_ar,
                    "propertyEn": name_en,
                    "status": plan.status,
                    "totalAmount": float(plan.total_amount),
                    "downPayment": float(plan.down_payment_amount),
                    "downPaymentPercent": float(plan.down_payment_percent),
                    "installmentAmount": float(plan.installment_amount),
                    "totalInstallments": plan.number_of_installments,
                    "paidInstallments": paid_installments,
                    "remainingInstallments": plan.number_of_installments - paid_installments,
                    "frequency": plan.frequency,
                    "durationMonths": plan.duration_months,
                    "nextDueDate": pending.due_date.isoformat() if pending else None,
                    "progress": round(progress, 2),
                    "downPaid": down_paid,
                    # Real on-chain token split (full-mint-then-lock). null until minted.
                    "tokenAmount": token_amount_full,
                    "releasedTokens": released_tokens,
                    "lockedTokens": locked_tokens,
                    "payments": display_payments,
                }
            )

        stats = {
            "totalCommitment": float(total_commitment),
            "totalPaid": float(total_paid),
            "remainingAmount": float(total_commitment - total_paid),
            "nextPaymentAmount": float(next_due[1]) if next_due else 0.0,
            "nextPaymentDate": next_due[0].isoformat() if next_due else None,
            "activePlans": sum(1 for p in plans if p.status in ("draft", "active")),
            "completedPlans": sum(1 for p in plans if p.status == "completed"),
        }

        return Response({"stats": stats, "plans": plan_rows})


class PayNextInstallmentView(APIView):
    """
    Wave C — start a GATED charge for the caller's NEXT due installment on an ACTIVE plan.

    Mirrors the Stripe/NOW create-intent views, but the charge funds one InstallmentPayment
    (not a new investment): the Payment carries `installment_payment`, so the shared webhook
    core (`_complete_payment`) routes the confirmation to `settle_installment_payment`
    (progressive release + per-installment owner/broker credit) instead of a mint. The
    investment is NEVER re-touched (it was completed by the down-payment); there is NO new
    mint and NO token clawback — only locked→released movement on confirmation.

      POST /api/installments/plans/<plan_id>/pay-next/
      body: { "provider": "stripe" | "nowpayments", "pay_currency": "<for crypto>" }

    Self-scoped (investor == caller) + KYC-gated (mirrors the PSP views). Charges the REAL
    next-due `InstallmentPayment.amount` (the final row may differ by the rounding cent).
    """

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request, plan_id):
        provider = (request.data.get("provider") or "stripe").strip().lower()
        if provider not in ("stripe", "nowpayments"):
            return Response(
                {"detail": "provider must be 'stripe' or 'nowpayments'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            plan = InstallmentPlan.objects.get(id=plan_id, investor=request.user)
        except (InstallmentPlan.DoesNotExist, ValueError, Exception):
            return Response(
                {"detail": "Installment plan not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # The plan must be ACTIVE — i.e. the down-payment has confirmed + minted (otherwise
        # there are no locked tokens to progressively release).
        if plan.status != InstallmentPlanStatus.ACTIVE:
            return Response(
                {"detail": "This plan is not active yet (the down-payment must clear first)."},
                status=status.HTTP_409_CONFLICT,
            )

        # Always charge the LOWEST-sequence pending row → installments clear in order; the
        # investor can't skip ahead.
        ip = (
            plan.payments.filter(status=InstallmentPaymentStatus.PENDING)
            .order_by("sequence")
            .first()
        )
        if ip is None:
            return Response(
                {"detail": "No installment is due on this plan."},
                status=status.HTTP_409_CONFLICT,
            )

        inv = plan.investments.order_by("created_at").first()
        if inv is None or not inv.tokens_minted:
            return Response(
                {"detail": "The plan position has not been minted yet."},
                status=status.HTTP_409_CONFLICT,
            )

        if provider == "stripe":
            return self._start_stripe(inv, ip)
        return self._start_nowpayments(request, inv, ip)

    # -- providers (mirror apps/payments/views.py, charging the installment amount) -- #
    def _start_stripe(self, inv, ip):
        if not stripe_service.is_configured():
            return Response(
                {"configured": False, "code": "stripe_unconfigured",
                 "detail": "Card payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        payment = get_or_create_payment(
            inv, amount=ip.amount, currency="usd", provider="stripe",
            installment_payment=ip,
        )
        try:
            intent = stripe_service.create_payment_intent(
                amount=ip.amount,
                currency=payment.currency,
                metadata={
                    "investment_id": str(inv.id),
                    "payment_id": str(payment.id),
                    "installment_payment_id": str(ip.id),
                },
            )
        except stripe_service.StripeError:
            return Response(
                {"detail": "Could not start the payment. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        payment.stripe_payment_intent_id = intent["id"]
        payment.save(update_fields=["stripe_payment_intent_id", "updated_at"])
        return Response({
            "provider": "stripe",
            "client_secret": intent["client_secret"],
            "publishable_key": stripe_service.publishable_key(),
            "payment_id": str(payment.id),
            "installment_payment_id": str(ip.id),
            "sequence": ip.sequence,
            "amount": str(ip.amount),
        })

    def _start_nowpayments(self, request, inv, ip):
        pay_currency = (request.data.get("pay_currency") or "").strip().lower()
        if not pay_currency:
            return Response(
                {"detail": "pay_currency is required for a crypto payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not nowpayments_service.is_configured():
            return Response(
                {"configured": False, "code": "nowpayments_unconfigured",
                 "detail": "Crypto payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        payment = get_or_create_payment(
            inv, amount=ip.amount, currency="usd", provider="nowpayments",
            installment_payment=ip,
        )
        ipn_url = request.build_absolute_uri(reverse("payments:nowpayments-ipn"))
        try:
            created = nowpayments_service.create_payment(
                price_amount=ip.amount,
                price_currency="usd",
                pay_currency=pay_currency,
                order_id=str(payment.id),
                ipn_callback_url=ipn_url,
            )
        except nowpayments_service.NowPaymentsError:
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
        return Response({
            "provider": "nowpayments",
            "payment_id": created["payment_id"],
            "pay_address": created["pay_address"],
            "pay_amount": str(created["pay_amount"]) if created["pay_amount"] is not None else None,
            "pay_currency": created["pay_currency"],
            "installment_payment_id": str(ip.id),
            "sequence": ip.sequence,
            "amount": str(ip.amount),
        })
