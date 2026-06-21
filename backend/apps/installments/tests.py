"""
Installments — Wave A tests. Run against Postgres (capimax_brx).

Covers: cent-exact schedule (down + Σ installments == total, with a rounding remainder
absorbed by the final row); installment-model eligibility (others rejected); rows created
in draft/pending; self-scoped read; and the WAVE-A INVARIANT that NO money/mint/token
logic is touched (no BalanceTransaction, no OwnershipToken, no Investment, no chain call).
"""
from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction, OwnershipToken

from .models import (
    InstallmentFrequency,
    InstallmentPayment,
    InstallmentPaymentStatus,
    InstallmentPlan,
    InstallmentPlanStatus,
)
from .services import build_installment_plan, compute_schedule


def _make_property(slug, *, model="installment", category="construction",
                   total_value="5000000", token_price="100"):
    p = Property(**_valid_property_kwargs(
        slug=slug, model=model, category=category,
        total_value=Decimal(str(total_value)), token_price=Decimal(str(token_price)),
    ))
    p.save()
    return p


class ScheduleMathTests(TestCase):
    """Pure cent-exactness — the heart of Wave A."""

    def test_schedule_with_rounding_remainder_is_cent_exact(self):
        # 1000 @ 30% down, 3 monthly: down=300, financed=700, 700/3 = 233.33 floor,
        # final row absorbs the 0.01 leftover → 233.33, 233.33, 233.34.
        s = compute_schedule(
            total_amount="1000", down_payment_percent=30, n_installments=3,
            frequency=InstallmentFrequency.MONTHLY,
        )
        self.assertEqual(s["down_payment"], Decimal("300.00"))
        self.assertEqual(s["installment_amount"], Decimal("233.33"))
        amounts = [r["amount"] for r in s["rows"]]
        self.assertEqual(amounts, [Decimal("233.33"), Decimal("233.33"), Decimal("233.34")])
        # down + Σ installments == total, to the cent.
        self.assertEqual(s["down_payment"] + sum(amounts), Decimal("1000.00"))

    def test_schedule_clean_division_no_remainder(self):
        # 5000 @ 25% down, 24 monthly: down=1250, financed=3750, /24 = 156.25 exactly.
        s = compute_schedule(
            total_amount="5000", down_payment_percent=25, n_installments=24,
            frequency=InstallmentFrequency.MONTHLY,
        )
        self.assertEqual(s["down_payment"], Decimal("1250.00"))
        self.assertTrue(all(r["amount"] == Decimal("156.25") for r in s["rows"]))
        self.assertEqual(
            s["down_payment"] + sum(r["amount"] for r in s["rows"]), Decimal("5000.00")
        )

    def test_quarterly_steps_three_months(self):
        s = compute_schedule(
            total_amount="1200", down_payment_percent=40, n_installments=4,
            frequency=InstallmentFrequency.QUARTERLY,
        )
        self.assertEqual(s["duration_months"], 12)  # 4 × 3
        # due dates step by 3 months
        d0, d1 = s["rows"][0]["due_date"], s["rows"][1]["due_date"]
        months_apart = (d1.year - d0.year) * 12 + (d1.month - d0.month)
        self.assertEqual(months_apart, 3)


class BuildPlanTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="inv@example.com", password="pw12345!")
        self.prop = _make_property("inst-build")

    def test_builds_draft_plan_with_pending_rows_cent_exact(self):
        plan = build_installment_plan(
            self.user, self.prop, total_amount="1000",
            down_payment_percent=30, n_installments=3,
            frequency=InstallmentFrequency.MONTHLY,
        )
        self.assertEqual(plan.status, InstallmentPlanStatus.DRAFT)
        self.assertEqual(plan.down_payment_amount, Decimal("300.00"))
        self.assertEqual(plan.number_of_installments, 3)
        self.assertEqual(plan.duration_months, 3)

        rows = list(InstallmentPayment.objects.filter(plan=plan).order_by("sequence"))
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(r.status == InstallmentPaymentStatus.PENDING for r in rows))
        self.assertTrue(all(r.paid_at is None for r in rows))
        self.assertEqual(
            plan.down_payment_amount + sum(r.amount for r in rows), plan.total_amount
        )

    def test_non_installment_property_rejected(self):
        ready = _make_property("ready-x", model="ready", category="ready")
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            build_installment_plan(
                self.user, ready, total_amount="1000",
                down_payment_percent=30, n_installments=3,
            )
        # nothing was written
        self.assertEqual(InstallmentPlan.objects.count(), 0)
        self.assertEqual(InstallmentPayment.objects.count(), 0)

    def test_no_money_or_mint_touched(self):
        """WAVE-A INVARIANT: building a plan moves no money and mints no tokens."""
        build_installment_plan(
            self.user, self.prop, total_amount="1000",
            down_payment_percent=30, n_installments=3,
        )
        self.assertEqual(BalanceTransaction.objects.count(), 0)
        self.assertEqual(OwnershipToken.objects.count(), 0)
        self.assertEqual(Investment.objects.count(), 0)


class ReadEndpointTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice@example.com", password="pw12345!")
        self.bob = User.objects.create_user(email="bob@example.com", password="pw12345!")
        self.prop = _make_property("inst-read")
        self.plan = build_installment_plan(
            self.alice, self.prop, total_amount="1000",
            down_payment_percent=30, n_installments=3,
        )

    def test_self_scoped_read_returns_own_plan(self):
        self.client.force_authenticate(self.alice)
        resp = self.client.get("/api/installments/plans/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["plans"]), 1)
        row = resp.data["plans"][0]
        self.assertEqual(row["totalInstallments"], 3)
        self.assertEqual(row["downPayment"], 300.0)
        self.assertEqual(row["status"], "draft")
        # display schedule = synthesized down row + 3 installment rows
        self.assertEqual(len(row["payments"]), 4)
        self.assertEqual(row["payments"][0]["type"], "down_payment")
        self.assertEqual(resp.data["stats"]["totalCommitment"], 1000.0)
        self.assertEqual(resp.data["stats"]["totalPaid"], 0.0)

    def test_other_user_sees_no_plans(self):
        self.client.force_authenticate(self.bob)
        resp = self.client.get("/api/installments/plans/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["plans"], [])

    def test_requires_auth(self):
        resp = self.client.get("/api/installments/plans/")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
