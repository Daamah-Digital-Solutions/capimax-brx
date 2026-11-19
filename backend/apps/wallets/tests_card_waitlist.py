"""BRX Visa cards are 'Coming soon': investors join a waitlist (client letter 2026-11-19)."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import CardWaitlistEntry

URL = "/api/wallets/card-waitlist/"


class CardWaitlistTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(email="wait@ex.com", password="pw-12345-strong")

    def test_needs_sign_in(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_join_once_then_update_the_card_choice(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(URL).json(), {"joined": False, "card_type": None, "joined_at": None})
        r = self.client.post(URL, {"card_type": "family"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["joined"])
        self.assertEqual(r.json()["card_type"], "family")
        r = self.client.post(URL, {"card_type": "dependent"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(CardWaitlistEntry.objects.filter(user=self.user).count(), 1)
        self.assertEqual(self.client.get(URL).json()["card_type"], "dependent")

    def test_unknown_card_type_is_refused(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(URL, {"card_type": "platinum"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(CardWaitlistEntry.objects.exists())
