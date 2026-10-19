"""Automatic withdrawals through Stripe Connect (apps/wallets/auto_payouts.py). Stripe is mocked."""
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.payments import stripe_service

from . import auto_payouts
from .models import BalanceTransaction, StripeConnectAccount, UserBalance, Withdrawal
from .services import credit_user_balance

AUTO = dict(
    STRIPE_SECRET_KEY="sk_test_x", PAYOUT_AUTO_METHODS=["bank"], WITHDRAWAL_AUTO_APPROVE_LIMIT=5000.0,
    PAYOUT_INSTANT_ENABLED=True, PAYOUT_INSTANT_FEE_PERCENT=1.0, PAYOUT_INSTANT_MAX=9999.0,
)


def _balance(user):
    return UserBalance.objects.get(user=user).current_balance


@override_settings(**AUTO)
class AutoWithdrawalTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="auto@ex.com", password="pw-12345-strong")
        credit_user_balance(self.user, Decimal("8000"), source="test")
        StripeConnectAccount.objects.create(user=self.user, account_id="acct_123ABCD", payouts_enabled=True)
        p = mock.patch.object(stripe_service, "create_transfer", return_value="tr_1")
        self.transfer = p.start()
        self.addCleanup(p.stop)

    def _request(self, amount, speed="standard"):
        with self.captureOnCommitCallbacks(execute=True):
            wd = auto_payouts.request_auto_withdrawal(self.user, Decimal(amount), speed=speed)
        wd.refresh_from_db()
        return wd

    def test_up_to_the_limit_is_paid_at_once(self):
        wd = self._request("5000")
        self.assertEqual(wd.status, Withdrawal.Status.COMPLETED)
        self.assertEqual(wd.provider, "stripe")
        self.assertEqual(wd.payout_reference, "tr_1")
        self.assertEqual(self.transfer.call_args.kwargs["amount"], Decimal("5000"))
        self.assertEqual(self.transfer.call_args.kwargs["idempotency_key"], f"wd-{wd.pk}")
        self.assertEqual(_balance(self.user), Decimal("3000"))

    def test_above_the_limit_waits_for_an_admin(self):
        wd = self._request("5000.01")
        self.assertEqual(wd.status, Withdrawal.Status.PENDING)
        self.transfer.assert_not_called()
        self.assertEqual(auto_payouts.execute(wd.pk), "paid")
        wd.refresh_from_db()
        self.assertEqual(wd.status, Withdrawal.Status.COMPLETED)

    def test_instant_sends_amount_minus_fee(self):
        with mock.patch.object(stripe_service, "has_instant_destination", return_value=True), \
                mock.patch.object(stripe_service, "create_instant_payout", return_value="po_1") as po:
            wd = self._request("1000", speed="instant")
        self.assertEqual(wd.fee_amount, Decimal("10.00"))
        self.assertEqual(self.transfer.call_args.kwargs["amount"], Decimal("990.00"))
        self.assertEqual(po.call_args.kwargs["amount"], Decimal("990.00"))
        self.assertEqual(wd.status, Withdrawal.Status.COMPLETED)
        self.assertEqual(_balance(self.user), Decimal("7000"))

    def test_instant_fee_rounds_up_to_the_cent(self):
        self.assertEqual(auto_payouts.instant_fee(Decimal("100.01")), Decimal("1.01"))

    def test_failed_instant_leg_falls_back_and_returns_the_fee(self):
        with mock.patch.object(stripe_service, "has_instant_destination", return_value=True), \
                mock.patch.object(stripe_service, "create_instant_payout",
                                  side_effect=stripe_service.StripeError("no")):
            wd = self._request("1000", speed="instant")
        self.assertEqual(wd.status, Withdrawal.Status.COMPLETED)
        self.assertEqual(wd.speed, "standard")
        self.assertEqual(wd.fee_amount, Decimal("0"))
        self.assertEqual(_balance(self.user), Decimal("7010"))
        self.assertEqual(BalanceTransaction.objects.filter(source="instant_fee_refund").count(), 1)

    def test_instant_over_the_cap_is_refused(self):
        with mock.patch.object(stripe_service, "has_instant_destination", return_value=True), \
                self.settings(PAYOUT_INSTANT_MAX=500.0):
            with self.assertRaises(Exception):
                auto_payouts.request_auto_withdrawal(self.user, Decimal("600"), speed="instant")
        self.assertFalse(Withdrawal.objects.exists())
        self.assertEqual(_balance(self.user), Decimal("8000"))

    def test_refused_transfer_fails_and_refunds(self):
        self.transfer.side_effect = stripe_service.StripeError("refused")
        wd = self._request("300")
        self.assertEqual(wd.status, Withdrawal.Status.FAILED)
        self.assertEqual(_balance(self.user), Decimal("8000"))

    def test_low_platform_balance_waits_for_an_admin(self):
        self.transfer.side_effect = stripe_service.StripeBalanceInsufficient("low")
        with self.assertLogs("apps.wallets.auto_payouts", level="ERROR"):
            wd = self._request("300")
        self.assertEqual(wd.status, Withdrawal.Status.PENDING)
        self.assertIn("Stripe balance", wd.failure_reason)
        self.assertEqual(_balance(self.user), Decimal("7700"))

    def test_not_linked_is_refused(self):
        StripeConnectAccount.objects.all().update(payouts_enabled=False)
        with mock.patch.object(stripe_service, "retrieve_account",
                               return_value={"payouts_enabled": False, "details_submitted": True}):
            with self.assertRaises(Exception):
                auto_payouts.request_auto_withdrawal(self.user, Decimal("100"))
        self.assertFalse(Withdrawal.objects.exists())

    def test_manual_withdrawals_are_never_sent_to_stripe(self):
        from .services import request_withdrawal

        wd = request_withdrawal(self.user, Decimal("100"), method="bank")
        self.assertEqual(auto_payouts.execute(wd.pk), "skipped")
        self.transfer.assert_not_called()


class AutoWithdrawalApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="auto-api@ex.com", password="pw-12345-strong")
        self.user.is_email_verified = True
        self.user.save()
        credit_user_balance(self.user, Decimal("1000"), source="test")
        self.client.force_authenticate(self.user)

    def test_off_by_default(self):
        body = self.client.get("/api/wallets/payouts/options/").json()
        self.assertFalse(body["bank_auto"])
        resp = self.client.post("/api/wallets/withdrawals/",
                                {"amount": "100", "method": "bank", "route": "auto"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()["code"], "connect_not_ready")
        self.assertEqual(_balance(self.user), Decimal("1000"))

    @override_settings(**AUTO)
    def test_connect_returns_a_stripe_link_and_reuses_the_account(self):
        with mock.patch.object(stripe_service, "create_express_account", return_value="acct_new") as ca, \
                mock.patch.object(stripe_service, "create_account_link", return_value="https://connect.stripe.com/x"):
            r1 = self.client.post("/api/wallets/payouts/connect/")
            r2 = self.client.post("/api/wallets/payouts/connect/")
        self.assertEqual(r1.json()["url"], "https://connect.stripe.com/x")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(ca.call_count, 1)

    @override_settings(**AUTO)
    def test_auto_withdrawal_through_the_api(self):
        StripeConnectAccount.objects.create(user=self.user, account_id="acct_9", payouts_enabled=True)
        with mock.patch.object(stripe_service, "create_transfer", return_value="tr_api"):
            with self.captureOnCommitCallbacks(execute=True):
                resp = self.client.post("/api/wallets/withdrawals/",
                                        {"amount": "250", "method": "bank", "route": "auto"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        wd = Withdrawal.objects.get(user=self.user)
        self.assertEqual(wd.status, Withdrawal.Status.COMPLETED)
        self.assertEqual(self.client.get("/api/wallets/payouts/options/").json()["connect_status"], "verified")

    @override_settings(**AUTO)
    def test_crypto_cannot_be_automatic(self):
        resp = self.client.post("/api/wallets/withdrawals/",
                                {"amount": "100", "method": "crypto", "route": "auto"}, format="json")
        self.assertEqual(resp.json()["code"], "auto_bank_only")
