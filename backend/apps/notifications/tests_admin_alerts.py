"""Admins are told when something waits for their review (apps/notifications/admin_alerts.py)."""
from decimal import Decimal

from django.core import mail
from django.db import transaction
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.notifications.models import Notification
from apps.wallets.services import credit_user_balance, request_withdrawal

from .admin_alerts import notify_admins

TYPE = Notification.Type.ADMIN_REVIEW_NEEDED


def _users():
    admin = User.objects.create_user(email="boss@ex.com", password="pw-12345-strong", is_staff=True)
    retired = User.objects.create_user(
        email="old-admin@ex.com", password="pw-12345-strong", is_staff=True, is_active=False
    )
    investor = User.objects.create_user(email="inv@ex.com", password="pw-12345-strong")
    return admin, retired, investor


@override_settings(PUBLIC_API_ORIGIN="https://api.capimaxbrx.com")
class AdminAlertTests(TestCase):
    def setUp(self):
        self.admin, self.retired, self.investor = _users()

    def test_active_admins_get_an_in_app_alert_and_an_email_with_the_admin_link(self):
        credit_user_balance(self.investor, Decimal("300"), source="test")
        with self.captureOnCommitCallbacks(execute=True):
            wd = request_withdrawal(self.investor, Decimal("120"), method="bank")
        alerts = Notification.objects.filter(type=TYPE)
        self.assertEqual([n.user for n in alerts], [self.admin])  # not the inactive admin, not the investor
        url = f"https://api.capimaxbrx.com/admin/wallets/withdrawal/{wd.pk}/change/"
        self.assertEqual(alerts[0].action_url, url)
        self.assertIn("inv@ex.com", alerts[0].params["summary"])
        self.assertEqual(alerts[0].params["kind"], "Withdrawal request")
        sent = [m for m in mail.outbox if m.to == ["boss@ex.com"]]
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0].subject, "Review needed: Withdrawal request")
        self.assertIn(url, sent[0].body)

    def test_nothing_is_sent_when_the_request_rolls_back(self):
        try:
            with self.captureOnCommitCallbacks(execute=True):
                with transaction.atomic():
                    notify_admins("withdrawal", obj=self.investor, summary="x")
                    raise RuntimeError("boom")
        except RuntimeError:
            pass
        self.assertFalse(Notification.objects.filter(type=TYPE).exists())


@override_settings(PUBLIC_API_ORIGIN="https://api.capimaxbrx.com")
class AdminAlertApiTests(APITestCase):
    def test_a_new_support_ticket_alerts_the_admins(self):
        admin, _retired, investor = _users()
        self.client.force_authenticate(investor)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post("/api/support/tickets/", {
                "subject": "Cannot withdraw", "category": "payments", "priority": "high",
                "details": "The button does nothing.",
            }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        alert = Notification.objects.get(type=TYPE)
        self.assertEqual(alert.user, admin)
        self.assertIn("Cannot withdraw", alert.params["summary"])
        self.assertIn("/admin/support/supportticket/", alert.action_url)
