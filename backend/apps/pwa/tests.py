"""
PWA settings tests — a singleton global-config row with an ADMIN-ONLY write.

Covers: GET returns the singleton (auto-created, public read); a non-admin PATCH is
rejected (403); an admin PATCH updates + persists; the singleton stays single (no
duplicate rows); no PII/secret fields are exposed.
"""
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Profile, User

from .models import PWASettings


class PWASettingsTests(APITestCase):
    URL = "/api/pwa-settings/"

    def setUp(self):
        self.user = User.objects.create_user(email="plain@example.com", password="pw12345!")
        self.admin = User.objects.create_user(email="admin@example.com", password="pw12345!")
        # Promote to admin (profile.role == 'admin'); refresh to drop the cached
        # profile the creation signal left on the in-memory user.
        Profile.objects.filter(user=self.admin).update(role="admin")
        self.admin.refresh_from_db()

    def test_get_returns_singleton_public(self):
        # Readable without auth (branding + install prompt are app-wide).
        resp = self.client.get(self.URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.json()
        self.assertEqual(body["id"], 1)
        self.assertEqual(body["app_name"], "Capimax BRX")
        self.assertIn("install_prompt_enabled", body)
        # No PII / secret fields leak through.
        for forbidden in ("password", "secret", "key", "token", "private"):
            self.assertFalse(any(forbidden in k.lower() for k in body))

    def test_non_admin_patch_rejected(self):
        self.client.force_authenticate(self.user)
        resp = self.client.patch(self.URL, {"app_name": "Hacked"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # Nothing changed.
        self.assertEqual(PWASettings.load().app_name, "Capimax BRX")

    def test_anonymous_patch_rejected(self):
        resp = self.client.patch(self.URL, {"app_name": "Hacked"}, format="json")
        self.assertIn(
            resp.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_admin_patch_updates_and_persists(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.patch(
            self.URL,
            {
                "app_name": "Capimax Pro",
                "app_short_name": "CapPro",
                "app_description": "Updated description",
                "theme_color": "#123456",
                "install_prompt_enabled": False,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["app_name"], "Capimax Pro")
        self.assertFalse(resp.json()["install_prompt_enabled"])
        # Persisted.
        obj = PWASettings.load()
        self.assertEqual(obj.app_name, "Capimax Pro")
        self.assertEqual(obj.theme_color, "#123456")
        self.assertFalse(obj.install_prompt_enabled)

    def test_singleton_stays_single(self):
        self.client.force_authenticate(self.admin)
        self.client.get(self.URL)  # creates row 1
        self.client.patch(self.URL, {"app_name": "A"}, format="json")
        self.client.patch(self.URL, {"app_name": "B"}, format="json")
        # Repeated access via load() never creates a second row, and the pk is pinned
        # to 1 so pk=2 can never exist.
        PWASettings.load()
        PWASettings.load()
        self.assertEqual(PWASettings.objects.count(), 1)
        self.assertEqual(PWASettings.load().pk, 1)
