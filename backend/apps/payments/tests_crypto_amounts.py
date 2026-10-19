"""Crypto settles on what actually arrived (apps/payments/crypto_amounts.py)."""
import json
from decimal import Decimal
from unittest import mock

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.investments.models import PaymentStatus
from apps.investments.services import create_investment
from apps.notifications.models import Notification
from apps.wallets.models import Deposit, OwnershipToken, UserBalance
from apps.wallets.services import get_or_create_custodial_wallet

from . import nowpayments_service
from .crypto_amounts import received_usd, tolerance
from .models import Payment, PaymentState
from .services import get_or_create_payment
from .tests import _IPN_SECRET, _approved_user, _deployed_property, _fake_mint


def _balance(user):
    b = UserBalance.objects.filter(user=user).first()
    return b.current_balance if b else Decimal("0")


@override_settings(NOWPAYMENTS_IPN_SECRET=_IPN_SECRET)
class CryptoAmountTests(APITestCase):
    url = "/api/payments/nowpayments/ipn/"

    def setUp(self):
        self.prop = _deployed_property("crypto-amt")
        self.user = _approved_user("amt@example.com")
        get_or_create_custodial_wallet(self.user)
        self.inv = create_investment(
            user=self.user, prop=self.prop, token_amount=3, payment_method="crypto",
        )["investment"]
        self.due = Decimal(self.inv.settlement_amount)
        self.payment = get_or_create_payment(self.inv, amount=self.due, currency="usd", provider="nowpayments")
        self.payment.nowpayments_payment_id = "np_amt_1"
        self.payment.save(update_fields=["nowpayments_payment_id"])

    def _ipn(self, state, received_usd_value):
        # NOW asked for 1.0 coin worth `due`; `actually_paid` coins worth `received` arrived.
        payload = {
            "payment_id": "np_amt_1", "payment_status": state, "order_id": str(self.payment.id),
            "price_amount": str(self.due), "price_currency": "usd",
            "pay_amount": "1.0", "actually_paid": str(Decimal(received_usd_value) / self.due),
        }
        raw = json.dumps(payload).encode()
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint):
            return self.client.post(
                self.url, data=raw, content_type="application/json",
                HTTP_X_NOWPAYMENTS_SIG=nowpayments_service.sign_ipn(payload),
            )

    def _refresh(self):
        self.inv.refresh_from_db()
        self.payment.refresh_from_db()

    def test_paid_in_full_completes(self):
        self.assertEqual(self._ipn("finished", self.due).status_code, 200)
        self._refresh()
        self.assertTrue(self.inv.tokens_minted)
        self.assertEqual(self.payment.received_amount, self.due)

    def test_short_within_the_tolerance_still_completes(self):
        short = self.due - tolerance(self.due) + Decimal("0.01")
        self._ipn("partially_paid", short)
        self._refresh()
        self.assertTrue(self.inv.tokens_minted)
        self.assertEqual(_balance(self.user), 0)

    def test_short_beyond_the_tolerance_cancels_and_returns_what_arrived(self):
        self._ipn("partially_paid", self.due - Decimal("50"))
        self._refresh()
        self.assertFalse(self.inv.tokens_minted)
        self.assertEqual(self.inv.payment_status, PaymentStatus.FAILED)
        self.assertEqual(self.payment.status, PaymentState.FAILED)
        self.assertEqual(_balance(self.user), self.due - Decimal("50"))
        self.assertTrue(Notification.objects.filter(user=self.user, type="crypto_underpaid").exists())
        # Re-delivery → nothing more.
        self._ipn("partially_paid", self.due - Decimal("50"))
        self.assertEqual(_balance(self.user), self.due - Decimal("50"))

    def test_the_rest_arriving_later_is_also_returned_never_double(self):
        self._ipn("partially_paid", self.due - Decimal("50"))
        self._ipn("finished", self.due)  # the customer sent the rest afterwards
        self._refresh()
        self.assertFalse(self.inv.tokens_minted)  # the purchase stays cancelled
        self.assertEqual(_balance(self.user), self.due)  # everything that arrived, once

    def test_overpaid_completes_and_the_extra_goes_to_the_wallet(self):
        self._ipn("finished", self.due + Decimal("40"))
        self._ipn("finished", self.due + Decimal("40"))  # replay
        self._refresh()
        self.assertTrue(self.inv.tokens_minted)
        self.assertEqual(_balance(self.user), Decimal("40"))
        self.assertTrue(Notification.objects.filter(user=self.user, type="crypto_overpaid").exists())

    def test_amounts_missing_keep_the_old_rule(self):
        payload = {"payment_id": "np_amt_1", "payment_status": "finished", "order_id": str(self.payment.id)}
        raw = json.dumps(payload).encode()
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint):
            self.client.post(self.url, data=raw, content_type="application/json",
                             HTTP_X_NOWPAYMENTS_SIG=nowpayments_service.sign_ipn(payload))
        self._refresh()
        self.assertTrue(self.inv.tokens_minted)

    def test_a_lower_amount_after_completion_takes_nothing_back(self):
        self._ipn("finished", self.due)
        self._ipn("partially_paid", self.due - Decimal("50"))
        self._refresh()
        self.assertTrue(self.inv.tokens_minted)
        self.assertEqual(_balance(self.user), 0)


@override_settings(NOWPAYMENTS_IPN_SECRET=_IPN_SECRET)
class CryptoDepositAmountTests(APITestCase):
    url = "/api/payments/nowpayments/ipn/"

    def test_a_top_up_credits_exactly_what_arrived(self):
        user = _approved_user("dep-amt@example.com")
        dep = Deposit.objects.create(user=user, amount=Decimal("100"), payment_method="crypto")
        pay = Payment.objects.create(deposit=dep, provider="nowpayments", amount=Decimal("100"),
                                     currency="usd", nowpayments_payment_id="np_dep_1")
        payload = {"payment_id": "np_dep_1", "payment_status": "partially_paid",
                   "order_id": str(pay.id), "price_amount": "100", "pay_amount": "2.0",
                   "actually_paid": "1.9"}
        raw = json.dumps(payload).encode()
        for _ in range(2):  # replay → credited once
            self.client.post(self.url, data=raw, content_type="application/json",
                             HTTP_X_NOWPAYMENTS_SIG=nowpayments_service.sign_ipn(payload))
        self.assertEqual(_balance(user), Decimal("95.00"))
        dep.refresh_from_db()
        self.assertTrue(dep.credited)

    def test_received_value_math(self):
        self.assertEqual(received_usd({"price_amount": "100", "pay_amount": "2", "actually_paid": "1.5"}), Decimal("75.00"))
        self.assertIsNone(received_usd({"payment_status": "finished"}))
        self.assertEqual(tolerance(Decimal("100")), Decimal("1.00"))     # $1 floor
        self.assertEqual(tolerance(Decimal("1000")), Decimal("5.00"))    # 0.5%
