"""Closing withdrawals: a failed payout returns the money, exactly once (apps/wallets/payouts.py,
apps/lp/payouts.py)."""
from decimal import Decimal

from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory, TestCase
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.lp.models import KYBStatus, LiquidityProvider, LPStatus, LPTransaction
from apps.lp.payouts import (
    LPWithdrawalError,
    complete_lp_withdrawal,
    fail_lp_withdrawal,
    request_lp_withdrawal,
)
from apps.notifications.models import Notification

from .admin import WithdrawalAdmin
from .models import BalanceTransaction, UserBalance, Withdrawal
from .payouts import WithdrawalStateError, complete_withdrawal, fail_withdrawal, mark_processing
from .services import credit_user_balance, request_withdrawal


def _balance(user):
    return UserBalance.objects.get(user=user).current_balance


class InvestorWithdrawalTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="wd@ex.com", password="pw-12345-strong")
        credit_user_balance(self.user, Decimal("500"), source="test")
        self.wd = request_withdrawal(self.user, Decimal("200"), method="bank")

    def test_the_amount_leaves_the_wallet_at_request(self):
        self.assertEqual(_balance(self.user), Decimal("300"))

    def test_a_failed_payout_returns_the_money_once(self):
        fail_withdrawal(self.wd.pk, reason="IBAN rejected by the bank")
        fail_withdrawal(self.wd.pk, reason="again")  # replay → no second refund
        self.assertEqual(_balance(self.user), Decimal("500"))
        self.assertEqual(
            BalanceTransaction.objects.filter(source="withdrawal_refund", reference=str(self.wd.pk)).count(), 1
        )
        self.wd.refresh_from_db()
        self.assertEqual(self.wd.status, Withdrawal.Status.FAILED)
        self.assertEqual(self.wd.failure_reason, "IBAN rejected by the bank")
        self.assertTrue(Notification.objects.filter(user=self.user, type="withdrawal_failed").exists())

    def test_processing_then_paid_keeps_the_money_out(self):
        mark_processing(self.wd.pk)
        complete_withdrawal(self.wd.pk, payout_reference="BANK-TX-991")
        self.wd.refresh_from_db()
        self.assertEqual(self.wd.status, Withdrawal.Status.COMPLETED)
        self.assertEqual(self.wd.payout_reference, "BANK-TX-991")
        self.assertEqual(_balance(self.user), Decimal("300"))
        self.assertTrue(Notification.objects.filter(user=self.user, type="withdrawal_completed").exists())

    def test_a_paid_withdrawal_cannot_be_failed(self):
        complete_withdrawal(self.wd.pk)
        with self.assertRaises(WithdrawalStateError):
            fail_withdrawal(self.wd.pk)
        self.assertEqual(_balance(self.user), Decimal("300"))

    def test_admin_status_is_read_only_and_the_action_refunds(self):
        admin_user = User.objects.create_superuser(email="ops@ex.com", password="pw-12345-strong")
        ma = WithdrawalAdmin(Withdrawal, AdminSite())
        request = RequestFactory().post("/")
        request.user = admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        self.assertIn("status", ma.get_readonly_fields(request, self.wd))
        ma.action_failed(request, Withdrawal.objects.filter(pk=self.wd.pk))
        self.assertEqual(_balance(self.user), Decimal("500"))


class LPWithdrawalTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(email="lpwd@ex.com", password="pw-12345-strong")
        self.lp = LiquidityProvider.objects.create(
            user=user, contact_name="LP", email=user.email, status=LPStatus.APPROVED,
            kyb_status=KYBStatus.APPROVED, current_balance=Decimal("1000"),
        )

    def _lp(self):
        self.lp.refresh_from_db()
        return self.lp

    def test_the_balance_is_taken_at_request_so_it_cannot_be_spent_twice(self):
        request_lp_withdrawal(self.lp.pk, Decimal("700"), method="bank")
        self.assertEqual(self._lp().current_balance, Decimal("300"))
        with self.assertRaises(LPWithdrawalError):
            request_lp_withdrawal(self.lp.pk, Decimal("700"), method="bank")

    def test_failed_returns_paid_counts(self):
        a = request_lp_withdrawal(self.lp.pk, Decimal("100"), method="bank")
        b = request_lp_withdrawal(self.lp.pk, Decimal("200"), method="crypto")
        fail_lp_withdrawal(a.pk, reason="wrong address")
        complete_lp_withdrawal(b.pk, payout_reference="0xabc")
        lp = self._lp()
        self.assertEqual(lp.current_balance, Decimal("800"))
        self.assertEqual(lp.total_withdrawn, Decimal("200"))

    def test_a_legacy_withdrawal_is_debited_when_paid(self):
        legacy = LPTransaction.objects.create(
            lp=self.lp, tx_type="withdrawal", amount=Decimal("150"), balance_debited=False,
        )
        fail_lp_withdrawal(legacy.pk)  # never took money → gives none back
        self.assertEqual(self._lp().current_balance, Decimal("1000"))
        legacy2 = LPTransaction.objects.create(
            lp=self.lp, tx_type="withdrawal", amount=Decimal("150"), balance_debited=False,
        )
        complete_lp_withdrawal(legacy2.pk)
        self.assertEqual(self._lp().current_balance, Decimal("850"))


class LPWithdrawalApiTests(APITestCase):
    def test_the_endpoint_takes_the_amount(self):
        user = User.objects.create_user(email="lpapi@ex.com", password="pw-12345-strong")
        lp = LiquidityProvider.objects.create(
            user=user, contact_name="LP", email=user.email, status=LPStatus.APPROVED,
            kyb_status=KYBStatus.APPROVED, current_balance=Decimal("500"),
        )
        self.client.force_authenticate(user)
        ok = self.client.post("/api/lp/withdrawals/", {"amount": "400", "withdrawal_method": "bank"}, format="json")
        self.assertEqual(ok.status_code, 201, ok.data)
        again = self.client.post("/api/lp/withdrawals/", {"amount": "400", "withdrawal_method": "bank"}, format="json")
        self.assertEqual(again.status_code, 400)
        lp.refresh_from_db()
        self.assertEqual(lp.current_balance, Decimal("100"))
