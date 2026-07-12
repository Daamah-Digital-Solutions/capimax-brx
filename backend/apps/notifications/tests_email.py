"""
Event-email tests (client notes 5 & 21 & 22).

Proves the single chokepoint: notify() also sends a branded email once the surrounding
transaction commits; the copy is Ecosystem-aligned (no "investment" wording); a muted
category suppresses both the in-app notification and the email; and a type with no email
copy sends nothing.
"""
from django.core import mail

from rest_framework.test import APITestCase

from apps.core.event_emails import send_event_email
from apps.core.models import User
from apps.notifications.models import NotificationPreference
from apps.notifications.services import NotificationType, notify


class EventEmailTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="mail@example.com", password="pw-12345-strong")

    def test_notify_sends_branded_email_on_commit(self):
        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=True):
            notify(self.user, NotificationType.KYC_APPROVED)
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertEqual(msg.to, ["mail@example.com"])
        self.assertIn("verification is approved", msg.subject.lower())
        # Branded HTML carries the wordmark, the Ecosystem tagline, and the corporate footer.
        html = msg.alternatives[0][0]
        self.assertIn("APIMAX", html)
        self.assertIn("Real Estate Tokenization Ecosystem", html)
        self.assertIn("Wilmington", html)  # legal entity address in the footer
        self.assertIn(SUPPORT := "info@capimaxbrx.com", html)
        # Ecosystem wording — the word "investment" appears nowhere in the message.
        self.assertNotIn("investment", (msg.body + html).lower())

    def test_investment_minted_email_is_ecosystem_worded(self):
        mail.outbox = []
        sent = send_event_email(
            self.user, "investment_minted", {"tokens": "10", "property": "Demo Tower"}
        )
        self.assertTrue(sent)
        msg = mail.outbox[0]
        blob = (msg.subject + msg.body + msg.alternatives[0][0]).lower()
        self.assertIn("ownership", blob)
        self.assertIn("demo tower", blob)  # params interpolated
        self.assertNotIn("investment", blob)  # note 22: the word is gone from the copy

    def test_unknown_type_sends_nothing(self):
        mail.outbox = []
        sent = send_event_email(self.user, "partner_deliverable_submitted", {})
        self.assertFalse(sent)
        self.assertEqual(len(mail.outbox), 0)

    def test_muted_category_suppresses_notification_and_email(self):
        pref = NotificationPreference.get_for(self.user)
        pref.security = False
        pref.save()
        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=True):
            result = notify(self.user, NotificationType.KYC_APPROVED)
        self.assertIsNone(result)
        self.assertEqual(len(mail.outbox), 0)
