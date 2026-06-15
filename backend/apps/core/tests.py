"""
Smoke tests for the auth foundation — one per endpoint. SPEC §6 (quality baseline).
"""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AuthFoundationTests(APITestCase):
    def setUp(self):
        self.register_url = reverse("core:register")
        self.login_url = reverse("core:login")
        self.refresh_url = reverse("core:token_refresh")
        self.me_url = reverse("core:me")
        self.session_url = reverse("core:session")
        self.logout_url = reverse("core:logout")
        self.payload = {
            "email": "investor@example.com",
            "password": "Str0ng-Passw0rd!",
            "full_name": "Test Investor",
            "phone": "+971500000000",
            "is_us_citizen": False,
        }

    def _register(self):
        return self.client.post(self.register_url, self.payload, format="json")

    # --- register -------------------------------------------------------- #
    def test_register_creates_user_and_investor_profile(self):
        resp = self._register()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("access_token", resp.data["session"])
        user = User.objects.get(email="investor@example.com")
        # No role sent -> baseline investor, immediately active. SPEC §3.0/§5.
        self.assertEqual(user.profile.role, "investor")
        self.assertEqual(user.profile.role_status, "active")
        self.assertEqual(user.profile.full_name, "Test Investor")

    # --- ROLE POLICY (corrected: frontend lets users choose a role) ------- #
    def test_register_persists_selected_investor_active(self):
        """Explicit investor selection is persisted and active (baseline role)."""
        resp = self.client.post(self.register_url, {**self.payload, "role": "investor"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        prof = User.objects.get(email=self.payload["email"]).profile
        self.assertEqual(prof.role, "investor")
        self.assertEqual(prof.role_status, "active")

    def test_register_persists_privileged_role_but_gates_it(self):
        """
        SECURITY guardrail (Part A #4): a privileged role the user selects IS stored
        (we follow the frontend) but is parked at PENDING_VERIFICATION — capabilities
        gated until KYC/KYB activates it. Does not change what the frontend sends.
        """
        for role in ("owner", "broker", "developer", "lp", "partner"):
            email = f"{role}@example.com"
            resp = self.client.post(
                self.register_url, {**self.payload, "email": email, "role": role}, format="json"
            )
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED, role)
            prof = User.objects.get(email=email).profile
            self.assertEqual(prof.role, role)
            self.assertEqual(prof.role_status, "pending_verification", role)
            self.assertFalse(prof.is_role_active, role)
            self.assertIsNone(prof.role_verified_at, role)

    def test_register_rejects_admin_self_assignment(self):
        """Anti-privilege-escalation: 'admin' can never be self-assigned. SPEC §5."""
        resp = self.client.post(self.register_url, {**self.payload, "role": "admin"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=self.payload["email"]).exists())

    def test_register_rejects_unknown_role(self):
        resp = self.client.post(self.register_url, {**self.payload, "role": "superadmin"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=self.payload["email"]).exists())

    def test_existing_account_cannot_elevate_role_via_api(self):
        """
        A user may SELECT a role at signup, but an EXISTING account must not be able
        to silently elevate. The profile serializer makes role & role_status read-only
        on every write path, so client-supplied values are ignored. SPEC §5.
        """
        from apps.core.serializers import ProfileSerializer

        self._register()
        profile = User.objects.get(email=self.payload["email"]).profile
        ser = ProfileSerializer(
            instance=profile,
            data={"role": "admin", "role_status": "active", "full_name": "Hacker"},
            partial=True,
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        ser.save()
        profile.refresh_from_db()
        self.assertEqual(profile.role, "investor")  # unchanged — escalation blocked
        self.assertEqual(profile.full_name, "Hacker")  # non-privileged field still writable

    # --- login ----------------------------------------------------------- #
    def test_login_returns_token_pair_and_user(self):
        self._register()
        resp = self.client.post(
            self.login_url,
            {"email": self.payload["email"], "password": self.payload["password"]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", resp.data["session"])
        self.assertIn("refresh_token", resp.data["session"])
        self.assertEqual(resp.data["user"]["email"], self.payload["email"])

    # --- refresh --------------------------------------------------------- #
    def test_token_refresh(self):
        self._register()
        login = self.client.post(
            self.login_url,
            {"email": self.payload["email"], "password": self.payload["password"]},
            format="json",
        )
        refresh = login.data["session"]["refresh_token"]
        resp = self.client.post(self.refresh_url, {"refresh": refresh}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)

    # --- me -------------------------------------------------------------- #
    def test_me_requires_auth_then_returns_profile(self):
        # Unauthenticated -> 401.
        self.assertEqual(self.client.get(self.me_url).status_code, status.HTTP_401_UNAUTHORIZED)
        reg = self._register()
        access = reg.data["session"]["access_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], self.payload["email"])
        self.assertEqual(resp.data["profile"]["role"], "investor")

    # --- session --------------------------------------------------------- #
    def test_session_shape(self):
        reg = self._register()
        access = reg.data["session"]["access_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.get(self.session_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(set(resp.data.keys()), {"user", "session", "profile"})
        self.assertEqual(resp.data["session"]["access_token"], access)

    # --- logout ---------------------------------------------------------- #
    def test_logout_blacklists_refresh(self):
        login_reg = self._register()
        access = login_reg.data["session"]["access_token"]
        refresh = login_reg.data["session"]["refresh_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp = self.client.post(self.logout_url, {"refresh": refresh}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_205_RESET_CONTENT)
        # The blacklisted refresh token can no longer be used.
        again = self.client.post(self.refresh_url, {"refresh": refresh}, format="json")
        self.assertEqual(again.status_code, status.HTTP_401_UNAUTHORIZED)
