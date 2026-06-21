"""
Installments read API — Wave A. Backs the investor `Installments.tsx` page.

  GET /api/installments/plans/   The caller's OWN installment plans + schedules, shaped to
                                 the objects Installments.tsx renders. SELF-SCOPED: a caller
                                 only ever sees their own plans.

There is NO write endpoint in this wave. Plans are built by `services.build_installment_plan`
(invoked by a later Checkout wave / admin / dev path), never by a user API write. NO money,
NO mint, NO "Pay Now" here — paying an installment is a later wave.
"""
from decimal import Decimal

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.properties.models import Property
from apps.wallets.models import OwnershipToken

from .models import InstallmentPayment, InstallmentPlan, InstallmentPaymentStatus


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
