"""
Stripe's SDK 15 returns objects that are not dicts (`.get()` raises). The service reads every
field through item access — checked here with REAL StripeObjects, not dict stand-ins.
"""
from types import SimpleNamespace
from unittest import mock

import stripe
from django.test import SimpleTestCase

from . import stripe_service


def _obj(data):
    return stripe.StripeObject.construct_from(data, "sk_test_x")


class StripeObjectReadTests(SimpleTestCase):
    def _fake(self, **resources):
        return mock.patch.object(stripe_service, "_stripe", return_value=SimpleNamespace(**resources))

    def test_payout_account_status(self):
        account = SimpleNamespace(retrieve=lambda _id: _obj({"payouts_enabled": True, "details_submitted": True}))
        with self._fake(Account=account):
            self.assertEqual(
                stripe_service.retrieve_account("acct_1"),
                {"payouts_enabled": True, "details_submitted": True},
            )

    def test_saved_card_details(self):
        pm = _obj({"id": "pm_1", "card": {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030},
                   "billing_details": {"name": None}})
        with self._fake(PaymentMethod=SimpleNamespace(retrieve=lambda _id: pm)):
            card = stripe_service.retrieve_card("pm_1")
        self.assertEqual((card["brand"], card["last4"], card["exp_year"], card["name"]), ("visa", "4242", 2030, ""))

    def test_setup_intent_and_customer(self):
        si = _obj({"customer": "cus_1", "status": "succeeded", "payment_method": "pm_1"})
        with self._fake(SetupIntent=SimpleNamespace(retrieve=lambda _id: si),
                        Customer=SimpleNamespace(retrieve=lambda _id: _obj({"id": "cus_1"}))):
            self.assertEqual(stripe_service.retrieve_setup_intent("seti_1")["payment_method"], "pm_1")
            self.assertTrue(stripe_service.customer_exists("cus_1"))

    def test_instant_payout_destination(self):
        ext = _obj({"data": [{"available_payout_methods": ["standard", "instant"]}]})
        account = SimpleNamespace(list_external_accounts=lambda _id, limit: ext)
        with self._fake(Account=account):
            self.assertTrue(stripe_service.has_instant_destination("acct_1"))
