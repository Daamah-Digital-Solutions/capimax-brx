"""Ticket conversation: the user replies, support replies in the admin (user is told)."""
from django.test import Client
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.notifications.models import Notification

from .models import SupportTicket


class TicketThreadTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="tk@ex.com", password="pw-12345-strong")
        self.other = User.objects.create_user(email="tk2@ex.com", password="pw-12345-strong")
        self.staff = User.objects.create_superuser(email="staff@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(self.user)
        r = self.client.post("/api/support/tickets/", {"subject": "Card failed", "category": "payments",
                                                         "details": "My card was declined."}, format="json")
        self.ticket = SupportTicket.objects.get(pk=r.json()["id"])

    def test_user_reply_and_privacy(self):
        r = self.client.post(f"/api/support/tickets/{self.ticket.pk}/messages/", {"body": "Any news?"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["messages"][0]["body"], "Any news?")
        self.assertFalse(r.json()["messages"][0]["from_support"])
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f"/api/support/tickets/{self.ticket.pk}/messages/",
                                          {"body": "x"}, format="json").status_code, 404)

    def test_staff_reply_in_admin_notifies_and_waits_for_user(self):
        c = Client()
        c.force_login(self.staff)
        url = f"/admin/support/supportticket/{self.ticket.pk}/change/"
        data = {
            "status": "open",
            "messages-TOTAL_FORMS": "1", "messages-INITIAL_FORMS": "0",
            "messages-MIN_NUM_FORMS": "0", "messages-MAX_NUM_FORMS": "1000",
            "messages-0-body": "Please try again — the limit was lifted.",
            "messages-0-ticket": str(self.ticket.pk),
        }
        r = c.post(url, data, HTTP_HOST="localhost")
        self.assertIn(r.status_code, (302, 200))
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, "pending")
        self.assertTrue(Notification.objects.filter(user=self.user, type="support_reply").exists())
        thread = self.client.get(f"/api/support/tickets/{self.ticket.pk}/").json()
        self.assertTrue(thread["messages"][-1]["from_support"])
