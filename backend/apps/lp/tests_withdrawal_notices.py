"""LP withdrawals tell the LP at every step (client letter 2026-11): received, being paid, paid
(with the transfer reference) and returned (with the reason), in-app and by email."""
from decimal import Decimal

from django.core import mail
from django.test import TestCase

from apps.notifications.models import Notification

from . import payouts
from .models import KYBStatus, LiquidityProvider, LPStatus
from .tests import _mk_user


class LPWithdrawalNoticeTests(TestCase):
    def setUp(self):
        self.user = _mk_user("lp-notice@ex.com")
        self.lp = LiquidityProvider.objects.create(
            user=self.user, contact_name="LP", email=self.user.email, status=LPStatus.APPROVED,
            kyb_status=KYBStatus.APPROVED, current_balance=Decimal("1000"),
        )

    def _types(self):
        return list(Notification.objects.filter(user=self.user).order_by("created_at").values_list("type", flat=True))

    def test_paid_path(self):
        with self.captureOnCommitCallbacks(execute=True):
            tx = payouts.request_lp_withdrawal(self.lp.pk, "300", method="bank")
        with self.captureOnCommitCallbacks(execute=True):
            payouts.mark_processing(tx.pk)
        with self.captureOnCommitCallbacks(execute=True):
            payouts.complete_lp_withdrawal(tx.pk, payout_reference="FT-778899")
        self.assertEqual(self._types(), ["lp_withdrawal_requested", "lp_withdrawal_processing", "lp_withdrawal_completed"])
        done = Notification.objects.get(user=self.user, type="lp_withdrawal_completed")
        self.assertEqual(done.params["payout_reference"], "FT-778899")
        self.assertEqual(done.params["reference"], payouts.reference_of(tx))
        self.assertEqual(done.action_url, "/liquidity-provider#withdrawals")
        self.assertEqual(len(mail.outbox), 3)
        self.assertIn("FT-778899", mail.outbox[-1].body)

    def test_returned_path(self):
        tx = payouts.request_lp_withdrawal(self.lp.pk, "200", method="crypto")
        payouts.fail_lp_withdrawal(tx.pk, reason="Wrong network")
        failed = Notification.objects.get(user=self.user, type="lp_withdrawal_failed")
        self.assertEqual(failed.params["reason"], "Wrong network")
        self.lp.refresh_from_db()
        self.assertEqual(self.lp.current_balance, Decimal("1000"))
        # a repeat does not notify twice
        payouts.fail_lp_withdrawal(tx.pk, reason="Wrong network")
        self.assertEqual(Notification.objects.filter(user=self.user, type="lp_withdrawal_failed").count(), 1)
