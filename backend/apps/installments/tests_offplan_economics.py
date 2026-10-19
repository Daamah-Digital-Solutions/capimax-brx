"""
Off-plan model, phase 4 — installment economics (OFFPLAN_EXIT_MODEL_AR.md §4).

- Terms: default 6/12/18/24 months at 30/25/20/15% down (admin can replace per property);
  a term = a down payment now + (term - 1) monthly installments; anything else is refused.
- Fee: Property.fee_installment (4%) on the down payment and on every installment, instead
  of the platform fee. The unit price is locked on the plan.
- Paying: from the wallet (manual or the hourly auto-debit); a late installment has no
  penalty and is never forfeited — one reminder, then collected once the wallet is funded.
"""
from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment
from apps.kyc.services import get_or_create_kyc
from apps.notifications.models import Notification
from apps.properties.models import InstallmentTerm, Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import UserBalance
from apps.wallets.services import credit_user_balance

from .models import InstallmentPaymentStatus, InstallmentPlan, InstallmentPlanStatus
from .services import build_installment_plan, collect_due_installments, default_plan


def _prop(slug="ofp", **overrides):
    data = dict(slug=slug, model="installment", total_value=Decimal("1000000"),
                token_price=Decimal("100"), offplan_payment="installments")
    data.update(overrides)
    p = Property(**_valid_property_kwargs(**data))
    p.save()
    return p


def _investor(email="inv@ex.com"):
    u = User.objects.create_user(email=email, password="pw-12345-strong")
    kyc = get_or_create_kyc(u)
    kyc.mark_approved()
    kyc.save()
    return User.objects.get(pk=u.pk)


def _active_plan(user, prop, *, units=10, months=12, pct="25", rate="4"):
    """A started plan (down payment settled) with the off-plan economics."""
    plan = build_installment_plan(
        user, prop, total_amount=Decimal(units) * prop.token_price,
        down_payment_percent=Decimal(pct), n_installments=months - 1, frequency="monthly",
        fee_rate=Decimal(rate), term_months=months, unit_price=prop.token_price, units_total=units,
    )
    plan.status = InstallmentPlanStatus.ACTIVE
    plan.down_paid_at = timezone.now()
    plan.save(update_fields=["status", "down_paid_at"])
    # The position the plan pays for (minted when the down payment settled).
    Investment.objects.create(
        user=user, property=prop, property_name=prop.name,
        amount_invested=plan.total_amount, token_amount=units, token_symbol="BRX",
        price_per_token=prop.token_price, ownership_percentage=Decimal("0"),
        payment_method="card", payment_status="completed", tokens_minted=True,
        is_installment=True, down_payment_amount=plan.down_payment_amount,
        installment_plan=plan,
    )
    return plan


def _balance(user):
    b = UserBalance.objects.filter(user=user).first()
    return b.current_balance if b else Decimal("0")


class PreviewTermsTests(APITestCase):
    def preview(self, prop, **body):
        return self.client.post("/api/installments/preview/", {"property": prop.slug, "units": 10, **body}, format="json")

    def test_default_18_month_term_is_20_percent_down_plus_17_installments_with_fees(self):
        d = self.preview(_prop(), term_months=18).data
        self.assertEqual((d["termMonths"], d["downPaymentPercent"], d["numberOfInstallments"]), (18, 20.0, 17))
        self.assertEqual((d["downPayment"], d["fee"], d["amountDueNow"]), (200.0, 8.0, 208.0))  # 4% of 200
        self.assertEqual(d["feeRate"], 4.0)
        first = d["rows"][0]
        self.assertEqual((first["amount"], first["fee"], first["charge"]), (47.05, 1.88, 48.93))
        self.assertAlmostEqual(d["downPayment"] + sum(r["amount"] for r in d["rows"]), 1000.0, places=2)
        self.assertEqual(d["rows"][-1]["ownershipPercent"], 100.0)

    def test_a_term_that_is_not_offered_is_refused_with_the_options(self):
        resp = self.preview(_prop(), term_months=36)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("6 months (30% down)", str(resp.data))
        # The right term with the wrong down payment is refused too.
        self.assertEqual(self.preview(_prop(slug="o2"), term_months=12, down_payment_percent=20).status_code, 400)

    def test_old_clients_shape_maps_to_a_term(self):
        d = self.preview(_prop(), down_payment_percent=25, n_installments=11, frequency="monthly").data
        self.assertEqual(d["termMonths"], 12)

    def test_admin_terms_replace_the_default_table(self):
        p = _prop()
        InstallmentTerm.objects.create(property=p, duration_months=9, down_payment_percent=Decimal("40"))
        self.assertEqual(self.preview(p, term_months=9).data["downPayment"], 400.0)
        self.assertEqual(self.preview(p, term_months=12).status_code, 400)
        detail = self.client.get(f"/api/properties/{p.slug}/").data
        self.assertEqual(detail["installmentTerms"], [{"months": 9, "downPaymentPercent": 40.0}])
        self.assertEqual(detail["offplanPayment"], "installments")


class StartPlanEconomicsTests(APITestCase):
    def test_plan_locks_the_price_and_charges_the_installment_fee_instead_of_the_platform_fee(self):
        user = _investor()
        self.client.force_authenticate(user)
        p = _prop()
        resp = self.client.post("/api/investments/", {
            "property_id": p.slug, "token_amount": 10, "payment_method": "card",
            "is_installment": True, "term_months": 12,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        inv = Investment.objects.get(pk=resp.data["investment_id"])
        plan = inv.installment_plan
        self.assertEqual((plan.term_months, plan.number_of_installments), (12, 11))
        self.assertEqual((plan.unit_price, plan.units_total, plan.fee_rate), (Decimal("100.00"), 10, Decimal("4.00")))
        self.assertEqual(inv.down_payment_amount, Decimal("250.00"))
        self.assertEqual(inv.fee_amount, Decimal("10.00"))  # 4% of the down payment, NOT 2% of 1000
        self.assertEqual(inv.settlement_amount, Decimal("260.00"))
        row = plan.payments.order_by("sequence").first()
        self.assertEqual(row.fee_amount, (row.amount * Decimal("0.04")).quantize(Decimal("0.01")))


class PayFromWalletTests(APITestCase):
    def setUp(self):
        self.user = _investor()
        self.client.force_authenticate(self.user)
        self.plan = _active_plan(self.user, _prop())
        self.first = self.plan.payments.order_by("sequence").first()

    def test_pay_next_from_the_wallet_debits_amount_plus_fee(self):
        credit_user_balance(self.user, Decimal("1000"), source="test")
        resp = self.client.post(f"/api/installments/plans/{self.plan.id}/pay-next/", {"provider": "balance"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.first.refresh_from_db()
        self.assertEqual(self.first.status, InstallmentPaymentStatus.PAID)
        self.assertEqual(_balance(self.user), Decimal("1000") - self.first.charge_amount)

    def test_insufficient_wallet_pays_nothing(self):
        resp = self.client.post(f"/api/installments/plans/{self.plan.id}/pay-next/", {"provider": "balance"}, format="json")
        self.assertEqual((resp.status_code, resp.data["code"]), (400, "insufficient_balance"))
        self.first.refresh_from_db()
        self.assertEqual(self.first.status, InstallmentPaymentStatus.PENDING)

    def test_pay_off_everything_from_the_wallet(self):
        remaining = sum(r.charge_amount for r in self.plan.payments.all())
        credit_user_balance(self.user, remaining, source="test")
        resp = self.client.post(f"/api/installments/plans/{self.plan.id}/pay-off/", {"provider": "balance"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.COMPLETED)
        self.assertEqual(_balance(self.user), Decimal("0"))

    def test_an_overdue_installment_is_the_next_one_to_pay(self):
        self.plan.payments.filter(pk=self.first.pk).update(status=InstallmentPaymentStatus.MISSED)
        credit_user_balance(self.user, Decimal("1000"), source="test")
        self.client.post(f"/api/installments/plans/{self.plan.id}/pay-next/", {"provider": "balance"}, format="json")
        self.first.refresh_from_db()
        self.assertEqual(self.first.status, InstallmentPaymentStatus.PAID)


class AutoDebitTests(TestCase):
    def setUp(self):
        self.user = _investor()
        self.plan = _active_plan(self.user, _prop())
        rows = list(self.plan.payments.order_by("sequence"))
        # Make the first two installments due (one overdue).
        today = timezone.now().date()
        for r, d in zip(rows[:2], (today - timedelta(days=40), today)):
            r.due_date = d
            r.save(update_fields=["due_date"])
        self.due = rows[:2]

    def reminders(self):
        return Notification.objects.filter(user=self.user, type=Notification.Type.INSTALLMENT_DUE_UNPAID)

    def test_collects_what_the_wallet_covers_in_order_and_reminds_once(self):
        credit_user_balance(self.user, self.due[0].charge_amount, source="test")
        self.assertEqual(collect_due_installments(), {"collected": 1, "insufficient": 1})
        self.assertEqual(self.reminders().count(), 1)
        # A second run does not spam the reminder.
        self.assertEqual(collect_due_installments(), {"collected": 0, "insufficient": 1})
        self.assertEqual(self.reminders().count(), 1)
        # Topping up lets the next run collect it — no penalty, nothing forfeited.
        credit_user_balance(self.user, self.due[1].charge_amount, source="test")
        self.assertEqual(collect_due_installments(), {"collected": 1, "insufficient": 0})
        statuses = list(self.plan.payments.filter(pk__in=[r.pk for r in self.due]).values_list("status", flat=True))
        self.assertEqual(statuses, [InstallmentPaymentStatus.PAID] * 2)
        self.assertEqual(_balance(self.user), Decimal("0"))

    def test_future_installments_are_not_collected_early(self):
        credit_user_balance(self.user, Decimal("10000"), source="test")
        collect_due_installments()
        self.assertEqual(self.plan.payments.filter(status=InstallmentPaymentStatus.PAID).count(), 2)

    def test_the_hourly_command_runs(self):
        call_command("collect_due_installments", verbosity=0)


class NoForfeitureTests(TestCase):
    def test_late_plans_are_never_defaulted(self):
        user = _investor()
        plan = _active_plan(user, _prop())
        plan.payments.update(due_date=timezone.now().date() - timedelta(days=200))
        call_command("check_installment_defaults", "--yes", verbosity=0)
        plan.refresh_from_db()
        self.assertEqual(plan.status, InstallmentPlanStatus.ACTIVE)
        self.assertEqual(plan.forfeited_tokens, 0)
        with self.assertRaises(RuntimeError):
            default_plan(plan.id)


class InstallmentDueSoonReminderTests(TestCase):
    """One reminder, INSTALLMENT_REMINDER_DAYS (3) before the due date, with the top-up needed."""

    def test_reminds_once_three_days_before(self):
        from .services import remind_upcoming_installments

        user = _investor("soon@ex.com")
        plan = _active_plan(user, _prop("soon"), units=10, months=12)
        first = plan.payments.order_by("sequence").first()
        today = first.due_date - timedelta(days=4)
        self.assertEqual(remind_upcoming_installments(today=today), 0)  # too early
        today = first.due_date - timedelta(days=3)
        self.assertEqual(remind_upcoming_installments(today=today), 1)
        self.assertEqual(remind_upcoming_installments(today=today), 0)  # once only
        note = Notification.objects.get(user=user, type="installment_due_soon")
        self.assertEqual(note.params["sequence"], 1)
        self.assertEqual(note.params["top_up"], f"{first.charge_amount:,.2f}")  # empty wallet

    def test_the_command_runs_reminders_too(self):
        user = _investor("soon2@ex.com")
        plan = _active_plan(user, _prop("soon2"), units=10, months=12)
        first = plan.payments.order_by("sequence").first()
        call_command("collect_due_installments", "--today", (first.due_date - timedelta(days=1)).isoformat())
        self.assertTrue(Notification.objects.filter(user=user, type="installment_due_soon").exists())
