"""LP payout bank account: the complete form, IBAN / SWIFT checks."""
from rest_framework.test import APITestCase

from apps.core.models import User

from .models import LiquidityProvider

URL = "/api/lp/profile/bank-details/"
FULL = {
    "bank_account_holder": "Gulf Capital LLC", "bank_name": "Emirates NBD", "bank_country": "UAE",
    "bank_currency": "aed", "bank_iban": "AE07 0331 2345 6789 0123 456", "bank_account_number": "",
    "bank_swift": "ebiladax", "bank_routing_code": "", "bank_address": "Dubai", "bank_intermediary_swift": "",
    "beneficiary_address": "Business Bay, Dubai",
}


class LPBankTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="lpb@ex.com", password="pw-12345-strong")
        LiquidityProvider.objects.create(user=self.user, contact_name="LP", email="lpb@ex.com", status="approved")
        self.client.force_authenticate(self.user)

    def test_full_account_saved_and_normalised(self):
        r = self.client.patch(URL, FULL, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        lp = LiquidityProvider.objects.get(user=self.user)
        self.assertEqual(lp.bank_iban, "AE070331234567890123456")
        self.assertEqual(lp.bank_swift, "EBILADAX")
        self.assertEqual(lp.bank_currency, "AED")
        self.assertEqual(r.json()["bank_account_holder"], "Gulf Capital LLC")

    def test_bad_iban_and_swift_rejected(self):
        r = self.client.patch(URL, {**FULL, "bank_iban": "AE07 0331 2345 6789 0123 457", "bank_swift": "XX"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("bank_iban", r.json())
        self.assertIn("bank_swift", r.json())

    def test_us_account_without_iban_needs_account_number(self):
        us = {**FULL, "bank_country": "USA", "bank_iban": "", "bank_routing_code": "021000021"}
        self.assertEqual(self.client.patch(URL, us, format="json").status_code, 400)
        us["bank_account_number"] = "123456789"
        self.assertEqual(self.client.patch(URL, us, format="json").status_code, 200)

    def test_required_fields(self):
        r = self.client.patch(URL, {**FULL, "bank_account_holder": "", "bank_country": ""}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(set(r.json()) & {"bank_account_holder", "bank_country"}, {"bank_account_holder", "bank_country"})
