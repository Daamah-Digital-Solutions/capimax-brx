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
import logging
from decimal import ROUND_HALF_UP, Decimal

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings
from django.urls import reverse

from apps.core.permissions import KYCApprovedPermission
from apps.payments import nowpayments_service, stripe_service
from apps.payments.services import get_or_create_payment
from apps.payments.views import crypto_min_amount_block

log = logging.getLogger(__name__)
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken

from .models import (
    InstallmentPayment,
    InstallmentPlan,
    InstallmentPaymentStatus,
    InstallmentPlanStatus,
)
from .terms import fee_for, resolve_term
from .position import holder_view
from .services import (
    _released_for,
    compute_schedule,
    holder_wallet_id,
    pay_installments_from_balance,
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
                "pk", "slug", "name", "name_ar", "token_price"
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
            down_fee = fee_for(plan.down_payment_amount, plan.fee_rate or 0)
            # Display schedule = a synthesized down-payment row (display-only; the DB keeps
            # the down-payment on the plan) followed by the N installment rows.
            display_payments = [
                {
                    "sequence": 0,
                    "type": "down_payment",
                    "date": (plan.down_paid_at or plan.created_at).date().isoformat(),
                    "amount": float(plan.down_payment_amount),
                    "fee": float(down_fee),
                    "charge": float(plan.down_payment_amount + down_fee),
                    "status": "paid" if down_paid else "pending",
                }
            ] + [
                {
                    "sequence": p.sequence,
                    "type": "installment",
                    "date": p.due_date.isoformat(),
                    "amount": float(p.amount),
                    # Off-plan §4: installment fee on the row (0 on older plans) — the investor
                    # pays amount + fee.
                    "fee": float(p.fee_amount),
                    "charge": float(p.charge_amount),
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

            # Token split of THIS plan (full-mint-then-lock): released = the paid share,
            # floor(paid / total × units). Until the down-payment confirms (mint), nothing is
            # released. Derived from the plan's own payments, not the wallet's locked_amount,
            # which also holds market-listing escrow (e.g. the plan listed as a position).
            # A defaulted plan keeps the wallet's figures (its forfeited units are gone).
            inv = next(iter(plan.investments.all()), None)
            token_amount_full = locked_tokens = released_tokens = None
            if inv is not None:
                token_amount_full = int(inv.token_amount)
                wallet_id = holder_wallet_id(plan, inv)
                if not (inv.tokens_minted and wallet_id):
                    locked_tokens = token_amount_full  # not minted yet → all locked
                elif plan.defaulted_at is None:
                    locked_tokens = token_amount_full - _released_for(
                        paid_amount, Decimal(plan.total_amount), token_amount_full
                    )
                else:
                    otoken = OwnershipToken.objects.filter(
                        wallet_id=wallet_id, property_id=slug
                    ).first()
                    locked_tokens = min(int(otoken.locked_amount), token_amount_full) if otoken else 0
                released_tokens = token_amount_full - locked_tokens

            # Next to pay = the earliest unpaid row, an overdue ("missed") one included.
            pending = next(
                (p for p in payments if p.status in (
                    InstallmentPaymentStatus.PENDING, InstallmentPaymentStatus.MISSED,
                )),
                None,
            )
            if pending is not None and (next_due is None or pending.due_date < next_due[0]):
                next_due = (pending.due_date, pending.charge_amount)

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
                    "nextPaymentAmount": float(pending.charge_amount) if pending else 0.0,
                    "overdueInstallments": sum(
                        1 for p in payments if p.status == InstallmentPaymentStatus.MISSED
                    ),
                    # Off-plan §4 terms (null/0 on plans started before it shipped).
                    "termMonths": plan.term_months,
                    "unitPrice": float(plan.unit_price) if plan.unit_price is not None else None,
                    "feeRate": float(plan.fee_rate or 0),
                    "installmentFee": float(fee_for(plan.installment_amount, plan.fee_rate or 0)),
                    "progress": round(progress, 2),
                    "downPaid": down_paid,
                    # Real on-chain token split (full-mint-then-lock). null until minted.
                    # After a DEFAULT (Wave D) tokenAmount/releasedTokens reflect the KEPT
                    # (paid) position (the forfeited tokens are removed); `forfeitedTokens`
                    # surfaces how many unpaid tokens were forfeited for the honest display.
                    "tokenAmount": token_amount_full,
                    "releasedTokens": released_tokens,
                    "lockedTokens": locked_tokens,
                    "forfeitedTokens": int(plan.forfeited_tokens or 0),
                    "defaultedAt": plan.defaulted_at.isoformat() if plan.defaulted_at else None,
                    "payments": display_payments,
                    # Off-plan §6: the plan as a sellable position — value at today's price,
                    # the holder's own cost and gain, why it can't be listed, its listing.
                    "position": (
                        holder_view(plan, prop.token_price, inv)
                        if prop is not None and plan.status == InstallmentPlanStatus.ACTIVE
                        else None
                    ),
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


BALANCE_PROVIDER = "balance"  # pay from the wallet balance (settles immediately)
PROVIDERS = ("stripe", "nowpayments", BALANCE_PROVIDER)


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
        if provider not in PROVIDERS:
            return Response(
                {"detail": "provider must be 'stripe', 'nowpayments' or 'balance'."},
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

        # Always charge the LOWEST-sequence unpaid row (an overdue one first) → installments
        # clear in order; the investor can't skip ahead.
        ip = (
            plan.payments.filter(
                status__in=[InstallmentPaymentStatus.PENDING, InstallmentPaymentStatus.MISSED]
            )
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

        # The investor pays the row's base amount + its installment fee (0 on older plans).
        if provider == BALANCE_PROVIDER:
            return self._pay_from_balance(request, plan, [ip])
        if provider == "stripe":
            return self._start_stripe(inv, ip, ip.charge_amount)
        return self._start_nowpayments(request, inv, ip, ip.charge_amount)

    def _pay_from_balance(self, request, plan, rows, is_payoff=False):
        """Pay the given unpaid rows from the investor's wallet balance, settling at once."""
        result = pay_installments_from_balance(plan, [r.id for r in rows])
        if result.get("code") == "insufficient_balance":
            return Response(
                {
                    "code": "insufficient_balance",
                    "detail": "Your wallet balance doesn't cover this payment. Top up and try again.",
                    "amount": str(result["amount"]),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if result.get("code") == "already_paid":
            return Response(
                {"detail": "This installment was already paid."}, status=status.HTTP_409_CONFLICT
            )
        return Response({
            "provider": BALANCE_PROVIDER,
            "settled": True,
            "amount": str(result["amount"]),
            "rows_settled": result["rows_settled"],
            "payoff": is_payoff,
        })

    # -- providers (mirror apps/payments/views.py, charging `amount` against `ip`) -- #
    # `amount` is one installment for pay-next, or the SUM of all remaining rows for a
    # payoff; `is_payoff` flags the Payment so the webhook settles every remaining row.
    def _start_stripe(self, inv, ip, amount, is_payoff=False):
        if not stripe_service.is_configured():
            return Response(
                {"configured": False, "code": "stripe_unconfigured",
                 "detail": "Card payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        payment = get_or_create_payment(
            inv, amount=amount, currency="usd", provider="stripe",
            installment_payment=ip, is_installment_payoff=is_payoff,
        )
        try:
            intent = stripe_service.create_payment_intent(
                amount=amount,
                currency=payment.currency,
                metadata={
                    "investment_id": str(inv.id),
                    "payment_id": str(payment.id),
                    "installment_payment_id": str(ip.id),
                    "installment_payoff": "1" if is_payoff else "0",
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
            "amount": str(amount),
            "payoff": is_payoff,
        })

    def _start_nowpayments(self, request, inv, ip, amount, is_payoff=False):
        # Crypto now rides NOW's HOSTED INVOICE (a link the buyer completes on NOW's page),
        # matching the buy + deposit flows — no in-app coin picker / address screen.
        if not nowpayments_service.is_configured():
            return Response(
                {"configured": False, "code": "nowpayments_unconfigured",
                 "detail": "Crypto payments are not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # A single small installment can fall under NOW's ~$19 floor → give the exact figure
        # (the buyer can pay off all remaining at once, or use card) before writing any rows.
        below_min = crypto_min_amount_block(amount, "usdttrc20")
        if below_min is not None:
            return below_min
        payment = get_or_create_payment(
            inv, amount=amount, currency="usd", provider="nowpayments",
            installment_payment=ip, is_installment_payoff=is_payoff,
        )
        ipn_url = request.build_absolute_uri(reverse("payments:nowpayments-ipn"))
        base = settings.FRONTEND_URL.rstrip("/")
        try:
            created = nowpayments_service.create_invoice(
                price_amount=amount,
                price_currency="usd",
                order_id=str(payment.id),
                ipn_callback_url=ipn_url,
                success_url=f"{base}/installments",
                cancel_url=f"{base}/installments",
            )
        except nowpayments_service.NowPaymentsError as exc:
            log.warning("NOW installment invoice failed for investment %s: %s", inv.id, exc)
            return Response(
                {"detail": "Could not start the crypto payment. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        # The bare payment id isn't known until the buyer picks a coin on NOW's page — the IPN
        # backfills it, matched by order_id (= this Payment.id).
        return Response({
            "provider": "nowpayments",
            "invoice_url": created["invoice_url"],
            "invoice_id": created["invoice_id"],
            "installment_payment_id": str(ip.id),
            "sequence": ip.sequence,
            "amount": str(amount),
            "payoff": is_payoff,
        })


class PayoffInstallmentView(PayNextInstallmentView):
    """
    EARLY PAYOFF — start a single GATED charge for ALL remaining installments of an ACTIVE
    plan (Stripe or NOW). Reuses the pay-next provider machinery, but charges the SUM of the
    plan's unpaid rows in one payment, anchored on the FIRST unpaid row and flagged as a
    payoff. On the confirmed webhook/IPN the shared core routes to `settle_installment_payoff`
    (settle every remaining row → full unlock + complete the plan) — NO new mint.

      POST /api/installments/plans/<plan_id>/pay-off/
      body: { "provider": "stripe" | "nowpayments", "pay_currency": "<for crypto>" }
    """

    def post(self, request, plan_id):
        provider = (request.data.get("provider") or "stripe").strip().lower()
        if provider not in PROVIDERS:
            return Response(
                {"detail": "provider must be 'stripe', 'nowpayments' or 'balance'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            plan = InstallmentPlan.objects.get(id=plan_id, investor=request.user)
        except (InstallmentPlan.DoesNotExist, ValueError, Exception):
            return Response(
                {"detail": "Installment plan not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if plan.status != InstallmentPlanStatus.ACTIVE:
            return Response(
                {"detail": "This plan is not active yet (the down-payment must clear first)."},
                status=status.HTTP_409_CONFLICT,
            )

        # ALL unpaid rows (pending or missed), earliest first. The first is the anchor; the
        # charge is their exact cent-summed total (the final row may carry the rounding cent).
        unpaid = list(
            plan.payments.filter(
                status__in=[InstallmentPaymentStatus.PENDING, InstallmentPaymentStatus.MISSED]
            ).order_by("sequence")
        )
        if not unpaid:
            return Response(
                {"detail": "No installments remain on this plan."},
                status=status.HTTP_409_CONFLICT,
            )
        anchor = unpaid[0]
        total = sum((p.charge_amount for p in unpaid), Decimal("0"))  # base + fee per row

        inv = plan.investments.order_by("created_at").first()
        if inv is None or not inv.tokens_minted:
            return Response(
                {"detail": "The plan position has not been minted yet."},
                status=status.HTTP_409_CONFLICT,
            )

        if provider == BALANCE_PROVIDER:
            return self._pay_from_balance(request, plan, unpaid, is_payoff=True)
        if provider == "stripe":
            return self._start_stripe(inv, anchor, total, is_payoff=True)
        return self._start_nowpayments(request, inv, anchor, total, is_payoff=True)


class InstallmentPreviewView(APIView):
    """
    LIVE PLAN PREVIEW — the single source of truth for every installment calculator on the
    property page (InstallmentCalculator, DynamicInstallmentPlanner, InstallmentScheduleSection,
    PostConstructionPaymentPlan). Given a property + the investor's chosen terms it returns the
    SAME cent-exact schedule `build_installment_plan` would persist at checkout, plus the real
    buyer-borne fee — so the preview shown equals the amount later charged.

      POST /api/installments/preview/
      body: { "property": "<slug>", "units": <int>, "down_payment_percent": <num>,
              "n_installments": <int>, "frequency": "monthly"|"quarterly" }

    PURE PREVIEW: delegates to `compute_schedule` (the pure engine math) + the installment fee
    (Property.fee_installment). Writes NOTHING — no plan, no payment, no money, no mint. PUBLIC:
    it is math over public property values and carries no user data. The per-investor position
    is `units × token_price` (the SAME basis Checkout uses), never the full property value.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        slug = (data.get("property") or "").strip()
        if not slug:
            return Response(
                {"detail": "property (slug) is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            prop = Property.objects.get(slug=slug)
        except Property.DoesNotExist:
            return Response(
                {"detail": "Property not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # Only properties sold through installment plans can be previewed (mirrors
        # build_installment_plan; off-plan §4 payment mode).
        if not prop.allows_installments():
            return Response(
                {"property": "This property is not sold through installment plans."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            units = int(data.get("units") or 1)
        except (TypeError, ValueError):
            return Response(
                {"units": "units must be a whole number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if units < 1:
            return Response(
                {"units": "At least one unit is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Per-investor position = units × token_price (the Checkout basis), NOT the full
        # property value. This is the plan total the schedule is computed against.
        position = (Decimal(units) * Decimal(str(prop.token_price))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # Off-plan §4: only a term this property offers (resolve_term → 400 otherwise), priced
        # exactly as build_installment_plan will: a down payment now + (term - 1) monthly
        # installments, with the installment fee on the down payment and on every installment.
        months, term_pct = resolve_term(
            prop,
            down_payment_percent=data.get("down_payment_percent"),
            n_installments=data.get("n_installments"),
            frequency=(data.get("frequency") or "monthly"),
            term_months=data.get("term_months"),
        )
        sched = compute_schedule(
            total_amount=position,
            down_payment_percent=term_pct,
            n_installments=months - 1,
            frequency="monthly",
        )
        fee_rate = Decimal(prop.fee_installment)
        down = sched["down_payment"]
        total = sched["total"]
        fee = fee_for(down, fee_rate)  # charged now, with the down payment

        # Enrich each installment row with its fee + the running cumulative/balance/ownership
        # the charts + tables need. cumulative INCLUDES the down-payment (ownership starts at
        # down%) and counts principal only (the fee buys no units).
        rows = []
        cumulative = down
        for r in sched["rows"]:
            cumulative = cumulative + r["amount"]
            ownership = (cumulative / total * Decimal("100")) if total else Decimal("0")
            row_fee = fee_for(r["amount"], fee_rate)
            rows.append(
                {
                    "sequence": r["sequence"],
                    "dueDate": r["due_date"].isoformat(),
                    "amount": float(r["amount"]),
                    "fee": float(row_fee),
                    "charge": float(r["amount"] + row_fee),
                    "cumulative": float(cumulative),
                    "balance": float(max(Decimal("0"), total - cumulative)),
                    "ownershipPercent": round(float(ownership), 2),
                }
            )

        return Response(
            {
                "property": prop.slug,
                "units": units,
                "unitPrice": float(prop.token_price),
                "total": float(total),
                "fee": float(fee),
                "feeRate": float(fee_rate),
                "downPayment": float(down),
                "downPaymentPercent": float(term_pct),
                "installmentAmount": float(sched["installment_amount"]),
                "installmentFee": float(fee_for(sched["installment_amount"], fee_rate)),
                "numberOfInstallments": len(rows),
                "termMonths": months,
                "durationMonths": months,
                "frequency": "monthly",
                # Charged NOW at checkout = down payment + its installment fee.
                "amountDueNow": float(down + fee),
                "rows": rows,
            }
        )
