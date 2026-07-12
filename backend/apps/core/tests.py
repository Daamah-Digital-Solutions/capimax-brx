"""
Smoke tests for the auth foundation — one per endpoint. SPEC §6 (quality baseline).
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
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


class BrandedEmailTests(APITestCase):
    """The transactional emails send a branded HTML part + a text fallback that
    both carry the real action link. SPEC §6."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="mailtest@example.com", password="Str0ng-Passw0rd!"
        )

    def _assert_branded(self, msg, cta_label, path_fragment):
        # A multipart alternative: text/plain body + one text/html alternative.
        self.assertEqual(len(msg.alternatives), 1)
        html, mime = msg.alternatives[0]
        self.assertEqual(mime, "text/html")
        # Branding + CTA + the real link land in the HTML. The wordmark now renders as a
        # coloured "C" + "APIMAX" + "BRX" badge (brand redesign), so assert on "APIMAX".
        self.assertIn("APIMAX", html)
        self.assertIn(cta_label, html)
        self.assertIn(path_fragment, html)
        # The plain-text fallback carries the same link (no-HTML clients).
        self.assertIn(path_fragment, msg.body)
        self.assertIn("Capimax BRX", msg.body)

    def test_verification_email_is_branded_html_plus_text(self):
        from django.core import mail

        from apps.core.emails import send_verification_email

        link = send_verification_email(self.user)
        self.assertIn("/verify-email?uid=", link)
        self.assertEqual(len(mail.outbox), 1)
        self._assert_branded(mail.outbox[0], "Verify email", "/verify-email?uid=")

    def test_password_reset_email_is_branded_html_plus_text(self):
        from django.core import mail

        from apps.core.emails import send_password_reset_email

        link = send_password_reset_email(self.user)
        self.assertIn("/reset-password?uid=", link)
        self.assertEqual(len(mail.outbox), 1)
        self._assert_branded(mail.outbox[0], "Reset password", "/reset-password?uid=")


@override_settings(GOOGLE_OAUTH_CLIENT_ID="test-client-id.apps.googleusercontent.com")
class GoogleOAuthTests(APITestCase):
    """POST /api/auth/oauth/google/ verifies a GIS id_token and returns a JWT
    session, creating the account on first sign-in. SPEC §6."""

    def setUp(self):
        self.url = reverse("core:oauth_google")

    def _claims(self, email="newuser@gmail.com", name="Grace Hopper"):
        return {
            "iss": "https://accounts.google.com",
            "email": email,
            "email_verified": True,
            "name": name,
        }

    @patch("apps.core.views.verify_google_id_token")
    def test_first_signin_creates_verified_user_with_session(self, mock_verify):
        mock_verify.return_value = self._claims()
        resp = self.client.post(self.url, {"id_token": "fake"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", resp.data["session"])
        self.assertIn("refresh_token", resp.data["session"])
        user = User.objects.get(email__iexact="newuser@gmail.com")
        self.assertTrue(user.is_email_verified)
        # Baseline profile from the signal; Google display name applied on first sight.
        self.assertEqual(user.profile.role, "investor")
        self.assertEqual(user.profile.full_name, "Grace Hopper")
        # OAuth-only account has no usable password.
        self.assertFalse(user.has_usable_password())

    @patch("apps.core.views.verify_google_id_token")
    def test_returning_user_is_not_duplicated(self, mock_verify):
        existing = User.objects.create_user(email="dev@gmail.com", password="Str0ng-Passw0rd!")
        mock_verify.return_value = self._claims(email="DEV@gmail.com", name="Ignored")
        resp = self.client.post(self.url, {"id_token": "fake"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.filter(email__iexact="dev@gmail.com").count(), 1)
        self.assertEqual(str(resp.data["user"]["id"]), str(existing.id))

    @patch("apps.core.views.verify_google_id_token")
    def test_invalid_token_is_rejected(self, mock_verify):
        from apps.core.oauth import GoogleTokenError

        mock_verify.side_effect = GoogleTokenError("Invalid Google token.")
        resp = self.client.post(self.url, {"id_token": "bad"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.exists())

    @override_settings(GOOGLE_OAUTH_CLIENT_ID="")
    def test_unconfigured_server_returns_400(self):
        # No mock: the real helper short-circuits on missing client id (no network).
        resp = self.client.post(self.url, {"id_token": "whatever"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
