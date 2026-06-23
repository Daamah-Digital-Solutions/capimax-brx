"""
Support-ticket tests — self-scoped CRUD for the Support.tsx UI (was 100% mock).
Run against Postgres (capimax_brx).

Covers: create persists the form's EXACT fields + auto TKT-#### ref + default status open;
self-scoped list (a second user sees none, gets 404 on another's ticket — no PII leak); the
real unresolved_count (open+pending counted, resolved excluded); admin advances status
(open→pending→resolved) while a non-admin is 403; invalid category/priority → 400.
No money/chain touched.
"""
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User

from .models import SupportTicket


class SupportTicketTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice-sup@example.com", password="pw12345!")
        self.bob = User.objects.create_user(email="bob-sup@example.com", password="pw12345!")
        # Admin via is_staff (IsAdminRole allows staff) — avoids the profile-cache pitfall.
        self.admin = User.objects.create_user(email="admin-sup@example.com", password="pw12345!")
        self.admin.is_staff = True
        self.admin.save(update_fields=["is_staff"])

    def _create(self, **extra):
        payload = {
            "subject": "Distribution payment delay",
            "category": "investment",
            "priority": "high",
            "details": "My last distribution has not arrived.",
            **extra,
        }
        return self.client.post("/api/support/tickets/", payload, format="json")

    # --- create -------------------------------------------------------------- #
    def test_create_persists_exact_form_fields(self):
        self.client.force_authenticate(self.alice)
        resp = self._create()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertEqual(body["subject"], "Distribution payment delay")
        self.assertEqual(body["category"], "investment")
        self.assertEqual(body["priority"], "high")
        self.assertEqual(body["details"], "My last distribution has not arrived.")
        # Default status + a TKT-#### reference assigned.
        self.assertEqual(body["status"], "open")
        self.assertTrue(body["reference"].startswith("TKT-"))
        self.assertEqual(SupportTicket.objects.filter(user=self.alice).count(), 1)

    def test_priority_defaults_to_low_when_omitted(self):
        self.client.force_authenticate(self.alice)
        resp = self.client.post(
            "/api/support/tickets/",
            {"subject": "Q", "category": "other", "details": "x"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["priority"], "low")

    def test_invalid_category_and_priority_rejected(self):
        self.client.force_authenticate(self.alice)
        bad_cat = self._create(category="banana")
        self.assertEqual(bad_cat.status_code, status.HTTP_400_BAD_REQUEST)
        bad_pri = self._create(priority="urgent")
        self.assertEqual(bad_pri.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_requires_auth(self):
        resp = self._create()
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # --- self-scoping -------------------------------------------------------- #
    def test_list_is_self_scoped_with_real_unresolved_count(self):
        self.client.force_authenticate(self.alice)
        self._create(category="investment")              # open
        self._create(category="payments")                # open
        third = self._create(category="account").json()  # will be resolved below
        # Resolve one via admin so unresolved should count only the other two.
        self.client.force_authenticate(self.admin)
        self.client.patch(f"/api/support/admin/tickets/{third['id']}/", {"status": "resolved"}, format="json")

        self.client.force_authenticate(self.alice)
        body = self.client.get("/api/support/tickets/").json()
        self.assertEqual(len(body["tickets"]), 3)
        self.assertEqual(body["unresolved_count"], 2)

        # Bob sees NONE of alice's tickets.
        self.client.force_authenticate(self.bob)
        bob_body = self.client.get("/api/support/tickets/").json()
        self.assertEqual(len(bob_body["tickets"]), 0)
        self.assertEqual(bob_body["unresolved_count"], 0)

    def test_detail_is_self_scoped_404_for_others(self):
        self.client.force_authenticate(self.alice)
        tid = self._create().json()["id"]
        # Owner can read.
        self.assertEqual(
            self.client.get(f"/api/support/tickets/{tid}/").status_code, status.HTTP_200_OK
        )
        # Another user → 404 (never leaks existence/content).
        self.client.force_authenticate(self.bob)
        self.assertEqual(
            self.client.get(f"/api/support/tickets/{tid}/").status_code, status.HTTP_404_NOT_FOUND
        )

    # --- admin status advance ------------------------------------------------ #
    def test_admin_can_advance_status_non_admin_403(self):
        self.client.force_authenticate(self.alice)
        tid = self._create().json()["id"]

        # A non-admin (even the owner) cannot hit the admin endpoint.
        forbidden = self.client.patch(
            f"/api/support/admin/tickets/{tid}/", {"status": "resolved"}, format="json"
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # Admin advances open → pending → resolved.
        self.client.force_authenticate(self.admin)
        r1 = self.client.patch(f"/api/support/admin/tickets/{tid}/", {"status": "pending"}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r1.json()["status"], "pending")
        r2 = self.client.patch(f"/api/support/admin/tickets/{tid}/", {"status": "resolved"}, format="json")
        self.assertEqual(r2.json()["status"], "resolved")
        self.assertEqual(SupportTicket.objects.get(id=tid).status, "resolved")
