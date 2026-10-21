"""The unified document design: periods, the account statement's balances, the new documents
(portfolio, investment report, one plan's schedule) and Arabic names."""
import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.wallets.models import BalanceTransaction
from apps.wallets.services import credit_user_balance, debit_user_balance

from .adapters import resolve_range, wallet
from .brand import Doc, Holder, holder_for


def _read(resp) -> bytes:
    return b"".join(resp.streaming_content) if resp.streaming else resp.content


class PeriodTests(APITestCase):
    def test_keywords_and_dates(self):
        today = timezone.localdate()
        m = resolve_range("month")
        self.assertEqual(m.start.date(), today.replace(day=1))
        self.assertTrue(m.has(timezone.now()))
        q = resolve_range("quarterly")
        self.assertEqual(q.start.month, 3 * ((today.month - 1) // 3) + 1)
        y = resolve_range(year=2024)
        self.assertTrue(y.has(datetime.date(2024, 12, 31)))
        self.assertFalse(y.has(datetime.date(2025, 1, 1)))
        r = resolve_range(start="2026-01-01", end="2026-01-31")
        self.assertTrue(r.has(datetime.date(2026, 1, 31)))  # end is inclusive
        self.assertFalse(r.has(datetime.date(2026, 2, 1)))
        self.assertIsNone(resolve_range("anything").start)


class AccountStatementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="stm@ex.com", password="pw-12345-strong")
        credit_user_balance(self.user, Decimal("1000.00"), source="deposit", reference="T1")
        debit_user_balance(self.user, Decimal("250.00"), source="withdrawal", reference="W1")
        # Move the first entry back a year: it is before the period below.
        first = BalanceTransaction.objects.get(reference="T1")
        BalanceTransaction.objects.filter(pk=first.pk).update(created_at=timezone.now() - datetime.timedelta(days=400))

    def test_opening_closing_and_running_balance(self):
        p = wallet(self.user, rng=resolve_range("year"))
        summary = dict((s[0], s[1]) for s in p["summary"])
        self.assertEqual(summary["Opening balance"], "1,000.00 USD")
        self.assertEqual(summary["Money out"], "250.00 USD")
        self.assertEqual(summary["Closing balance"], "750.00 USD")
        self.assertEqual(len(p["rows"]), 1)
        self.assertEqual(p["rows"][0]["balance"], Decimal("750.00"))
        self.assertEqual(p["rows"][0]["type"], "Withdrawal request")  # a label, not a slug

    def test_period_filter_via_api(self):
        self.client.force_authenticate(self.user)
        body = _read(self.client.get("/api/reports/wallet/export/?fmt=csv&period=month")).decode("utf-8")
        self.assertIn("-250.00", body)
        self.assertNotIn("1000.00", body)  # last year's top-up is outside this month
        body = _read(self.client.get("/api/reports/wallet/export/?fmt=csv")).decode("utf-8")
        self.assertIn("1000.00", body)


class NewDocumentsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="docs@ex.com", password="pw-12345-strong")
        self.other = User.objects.create_user(email="docs-other@ex.com", password="pw-12345-strong")

    def test_portfolio_and_report_pdfs(self):
        self.client.force_authenticate(self.user)
        for ctx in ("portfolio", "analytics", "lp", "owner-earnings", "broker-commissions", "installments"):
            res = self.client.get(f"/api/reports/{ctx}/export/?fmt=pdf&period=quarter")
            self.assertEqual(res.status_code, 200, ctx)
            self.assertTrue(_read(res).startswith(b"%PDF"), ctx)

    def test_one_plan_schedule_is_owner_only(self):
        from apps.installments.models import InstallmentFrequency
        from apps.installments.services import build_installment_plan
        from apps.installments.tests import _make_property

        plan = build_installment_plan(
            self.user, _make_property("doc-plan"), total_amount="1000",
            down_payment_percent=30, n_installments=3, frequency=InstallmentFrequency.MONTHLY,
        )
        self.client.force_authenticate(self.user)
        res = self.client.get(f"/api/reports/installments/{plan.pk}/pdf/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(_read(res).startswith(b"%PDF"))
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/reports/installments/{plan.pk}/pdf/").status_code, 404)

    def test_arabic_holder_and_wallet_block(self):
        self.user.profile.full_name = "أحمد محمود"
        self.user.profile.save()
        h = holder_for(self.user)
        self.assertEqual(h.name, "أحمد محمود")
        d = Doc(title="Test", ref="T-1")
        d.holder(Holder(name=h.name, email=h.email, wallet_address="0x" + "a" * 40, network="BNB Smart Chain"))
        d.table([("property", "Property"), ("amount", "Amount (USD)")],
                [{"property": "برج المارينا", "amount": "10.00"}] * 80)
        pdf = d.finish()
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertGreaterEqual(pdf.count(b"/Type /Page\n") + pdf.count(b"/Type /Page "), 2)  # spilled over
