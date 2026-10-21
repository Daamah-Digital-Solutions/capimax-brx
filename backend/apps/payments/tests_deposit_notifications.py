"""Wallet top-ups notify the investor (credited / bank transfer rejected)."""
from decimal import Decimal

from django.test import TestCase

from apps.core.models import User
from apps.notifications.models import Notification
from apps.wallets.models import Deposit

from .services import _credit_deposit, reject_bank_deposit


class DepositNotificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="dep@ex.com", password="pw-12345-strong")

    def test_credited_deposit_notifies_once(self):
        dep = Deposit.objects.create(user=self.user, amount=Decimal("250"), payment_method="card")
        self.assertTrue(_credit_deposit(dep.id))
        self.assertFalse(_credit_deposit(dep.id))  # replayed webhook → no second credit, no second note
        notes = Notification.objects.filter(user=self.user, type="deposit_credited")
        self.assertEqual(notes.count(), 1)
        self.assertEqual(notes.first().params["amount"], "250.00")

    def test_rejected_bank_deposit_notifies(self):
        dep = Deposit.objects.create(user=self.user, amount=Decimal("90"), payment_method="bank",
                                     reference="DEP-X")
        reject_bank_deposit(dep)
        self.assertTrue(Notification.objects.filter(user=self.user, type="deposit_rejected").exists())
