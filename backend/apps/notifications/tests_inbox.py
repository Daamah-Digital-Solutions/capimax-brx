"""Inbox: messages from the platform team to one user or to everyone holding a role."""
from rest_framework.test import APITestCase

from apps.core.models import User

from .inbox import deliver
from .models import MessageBroadcast, Notification, PlatformMessage


class InboxTests(APITestCase):
    def setUp(self):
        from apps.owner.models import OwnerProfile

        self.owner = User.objects.create_user(email="own@ex.com", password="pw-12345-strong")
        OwnerProfile.objects.create(user=self.owner, status="approved")
        self.pending_owner = User.objects.create_user(email="own2@ex.com", password="pw-12345-strong")
        OwnerProfile.objects.create(user=self.pending_owner, status="pending")
        self.investor = User.objects.create_user(email="inv@ex.com", password="pw-12345-strong")

    def test_role_broadcast_reaches_only_approved_holders(self):
        b = MessageBroadcast.objects.create(audience="owners", subject="Valuation due", body="Please upload {it}.")
        self.assertEqual(deliver(b), 1)
        self.assertEqual(list(PlatformMessage.objects.values_list("recipient__email", flat=True)), ["own@ex.com"])
        self.assertTrue(Notification.objects.filter(user=self.owner, type="platform_message").exists())
        self.assertFalse(PlatformMessage.objects.filter(recipient=self.investor).exists())

    def test_inbox_list_read_and_privacy(self):
        b = MessageBroadcast.objects.create(audience="user", user=self.owner, subject="Hello", body="Full text")
        deliver(b)
        self.client.force_authenticate(self.owner)
        data = self.client.get("/api/notifications/messages/").json()
        self.assertEqual(data["unread"], 1)
        mid = data["messages"][0]["id"]
        self.assertNotIn("body", data["messages"][0])
        one = self.client.get(f"/api/notifications/messages/{mid}/").json()
        self.assertEqual(one["body"], "Full text")
        self.assertEqual(self.client.get("/api/notifications/messages/").json()["unread"], 0)
        self.client.force_authenticate(self.investor)
        self.assertEqual(self.client.get(f"/api/notifications/messages/{mid}/").status_code, 404)

    def test_one_user_needs_a_user(self):
        from django.core.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            MessageBroadcast(audience="user", subject="x", body="y").full_clean()
