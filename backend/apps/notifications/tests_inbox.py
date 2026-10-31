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

    def test_investors_broadcast_reaches_investors_and_holders_only(self):
        from apps.investments.models import Investment, PaymentStatus
        from apps.properties.models import Property
        from apps.properties.tests import _valid_property_kwargs

        prop = Property.objects.create(**_valid_property_kwargs())
        broker = User.objects.create_user(email="brk@ex.com", password="pw-12345-strong")
        holder = User.objects.create_user(email="brk-holder@ex.com", password="pw-12345-strong")
        unpaid = User.objects.create_user(email="brk-unpaid@ex.com", password="pw-12345-strong")
        for u in (self.owner, self.pending_owner, broker, holder, unpaid):
            u.profile.role = "broker"
            u.profile.save(update_fields=["role"])
        Investment.objects.create(user=holder, property=prop, token_amount=1, amount_invested=100, price_per_token=100, ownership_percentage=0, payment_status=PaymentStatus.COMPLETED)
        Investment.objects.create(user=holder, property=prop, token_amount=2, amount_invested=200, price_per_token=100, ownership_percentage=0, payment_status=PaymentStatus.COMPLETED)
        Investment.objects.create(user=unpaid, property=prop, token_amount=1, amount_invested=100, price_per_token=100, ownership_percentage=0, payment_status=PaymentStatus.PENDING)

        b = MessageBroadcast.objects.create(audience="investors", subject="Update", body="News.")
        self.assertEqual(deliver(b), 2)  # one message each, even with two purchases
        self.assertEqual(
            set(PlatformMessage.objects.values_list("recipient__email", flat=True)),
            {"inv@ex.com", "brk-holder@ex.com"},
        )

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
