"""A PDF receipt for every payment and wallet movement (apps/reports/receipts.py)."""
from decimal import Decimal

from rest_framework.test import APITestCase

from apps.core.models import User
from apps.installments.services import pay_installments_from_balance
from apps.installments.tests_offplan_economics import _active_plan, _prop
from apps.investments.services import create_investment
from apps.payments.models import Payment
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet


def _read(resp) -> bytes:
    return b"".join(resp.streaming_content) if hasattr(resp, "streaming_content") else resp.content


class ReceiptTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="rcpt@ex.com", password="pw-12345-strong")
        get_or_create_custodial_wallet(self.user)
        self.client.force_authenticate(self.user)

    def test_every_wallet_movement_has_a_receipt(self):
        credit_user_balance(self.user, Decimal("500"), source="deposit", reference="DEP-1")
        tx = BalanceTransaction.objects.get(balance__user=self.user, source="deposit")
        listing = self.client.get("/api/reports/receipts/").data
        self.assertEqual(listing[0]["kind"], "ledger")
        self.assertTrue(listing[0]["number"].startswith("RCT-"))
        resp = self.client.get(f"/api/reports/receipts/ledger/{tx.pk}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertTrue(_read(resp).startswith(b"%PDF"))

    def test_a_card_purchase_has_a_receipt_with_its_lines(self):
        prop = Property(**_valid_property_kwargs(slug="rcpt-1", total_value=Decimal("10000")))
        prop.save()
        inv = create_investment(user=self.user, prop=prop, token_amount=2, payment_method="card")["investment"]
        pay = Payment.objects.create(investment=inv, provider="stripe", amount=inv.settlement_amount,
                                     currency="usd", status="succeeded")
        listing = self.client.get("/api/reports/receipts/").data
        self.assertEqual(listing[0]["kind"], "payment")
        self.assertIn("2 unit(s)", listing[0]["title"])
        self.assertEqual(self.client.get(f"/api/reports/receipts/payment/{pay.pk}/").status_code, 200)

    def test_a_paid_installment_points_to_its_wallet_debit(self):
        plan = _active_plan(self.user, _prop("rcpt-inst"), units=10, months=12)
        credit_user_balance(self.user, Decimal("1000"), source="test")
        row = plan.payments.order_by("sequence").first()
        pay_installments_from_balance(plan, [row.pk])
        resp = self.client.get(f"/api/reports/receipts/installment/{row.pk}/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(_read(resp).startswith(b"%PDF"))

    def test_someone_elses_receipt_is_404(self):
        other = User.objects.create_user(email="other-r@ex.com", password="pw-12345-strong")
        credit_user_balance(other, Decimal("5"), source="deposit")
        tx = BalanceTransaction.objects.get(balance__user=other)
        self.assertEqual(self.client.get(f"/api/reports/receipts/ledger/{tx.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/reports/receipts/nope/{tx.pk}/").status_code, 404)
