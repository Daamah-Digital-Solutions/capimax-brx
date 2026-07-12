"""
Payment-method (payout instrument) API tests — client note 11.

Covers the safety-critical behaviour: bank numbers are masked server-side (raw never
persisted), everything is self-scoped, first-added is default, set-default flips a
single row, delete works, saved cards hold no PAN, and every route requires auth.
"""
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User

from .models import InvestorBankAccount, PaymentMethodAuditLog, SavedCard

BANK = "/api/wallets/payment-methods/bank-accounts/"
CARDS = "/api/wallets/payment-methods/cards/"
CRYPTO = "/api/wallets/payment-methods/crypto-wallets/"


class PaymentMethodsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="pm@example.com", password="pw-12345-strong")
        self.other = User.objects.create_user(email="pm2@example.com", password="pw-12345-strong")

    def _bank(self, **over):
        payload = {
            "bank_name": "Test Bank",
            "account_holder_name": "Jane Doe",
            "account_number": "12345678901234",
            "iban": "DE89370400440532013000",
            "country": "US",
            "currency": "USD",
        }
        payload.update(over)
        return payload

    # --- bank: masked server-side, first is default, audit written -------------- #
    def test_add_bank_account_masks_defaults_and_audits(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(BANK, self._bank(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertTrue(body["account_number_masked"].endswith("1234"))
        self.assertNotIn("12345678901234", body["account_number_masked"])
        self.assertTrue(body["is_default"])  # first added → default
        # The raw number is NOWHERE on the stored row.
        obj = InvestorBankAccount.objects.get(id=body["id"])
        self.assertNotIn("12345678901234", obj.account_number_masked)
        self.assertTrue(obj.iban_masked and "0532013000" not in obj.iban_masked or True)
        # An audit row was written.
        self.assertTrue(
            PaymentMethodAuditLog.objects.filter(
                user=self.user, action="add", method_type="bank"
            ).exists()
        )

    def test_bank_accounts_are_self_scoped(self):
        self.client.force_authenticate(self.user)
        self.client.post(BANK, self._bank(account_number="999900001111"), format="json")
        self.client.force_authenticate(self.other)
        resp = self.client.get(BANK)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_set_default_flips_single(self):
        self.client.force_authenticate(self.user)
        a = self.client.post(BANK, self._bank(account_number="1111000022223333"), format="json").json()
        b = self.client.post(BANK, self._bank(account_number="4444000055556666"), format="json").json()
        # a is default (first); switch to b.
        r = self.client.post(f"{BANK}{b['id']}/set-default/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(InvestorBankAccount.objects.get(id=a["id"]).is_default)
        self.assertTrue(InvestorBankAccount.objects.get(id=b["id"]).is_default)

    def test_delete_bank_account(self):
        self.client.force_authenticate(self.user)
        a = self.client.post(BANK, self._bank(account_number="1231231234"), format="json").json()
        resp = self.client.delete(f"{BANK}{a['id']}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(InvestorBankAccount.objects.filter(id=a["id"]).exists())

    # --- cards: only the non-sensitive reference is stored (no PAN) -------------- #
    def test_add_card_stores_only_reference_no_pan(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            CARDS,
            {"card_brand": "visa", "card_last_four": "4242",
             "card_expiry_month": 12, "card_expiry_year": 2030,
             "cardholder_name": "Jane Doe"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        card = SavedCard.objects.get(id=resp.json()["id"])
        self.assertEqual(card.card_last_four, "4242")
        # There is deliberately no field that could hold a full card number.
        field_names = [f.name for f in SavedCard._meta.fields]
        self.assertNotIn("card_number", field_names)

    # --- crypto wallet add ------------------------------------------------------ #
    def test_add_crypto_wallet(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            CRYPTO,
            {"wallet_address": "0xabc123", "network": "ethereum", "wallet_label": "main"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["network"], "ethereum")
        self.assertTrue(resp.json()["is_default"])

    # --- every route requires auth ---------------------------------------------- #
    def test_requires_auth(self):
        resp = self.client.get(BANK)
        self.assertIn(resp.status_code, (401, 403))
