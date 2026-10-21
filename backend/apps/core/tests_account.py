"""Settings › account: profile, password, two-factor, signed-in devices, deactivate/delete."""
import shutil
import tempfile
import time
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import LoginSession, User
from apps.notifications.models import Notification

from . import totp

PW = "Str0ng-Passw0rd!"
_MEDIA = tempfile.mkdtemp(prefix="capimax-acct-")


def _png():
    return SimpleUploadedFile(
        "me.png",
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82",
        content_type="image/png",
    )


@override_settings(MEDIA_ROOT=_MEDIA)
class AccountSettingsTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create_user(email="acct@ex.com", password=PW)

    def _login(self, ua="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1", **extra):
        return self.client.post("/api/auth/login/", {"email": "acct@ex.com", "password": PW, **extra},
                                format="json", HTTP_USER_AGENT=ua)

    def _auth(self, session):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {session['access_token']}")

    def test_login_creates_a_device_session_that_can_be_ended(self):
        a = self._login().json()["session"]
        b = self._login(ua="Mozilla/5.0 (Windows NT 10.0) Chrome/120").json()["session"]
        self._auth(a)
        rows = self.client.get("/api/auth/sessions/").json()
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]["current"])
        self.assertEqual(rows[0]["device"]["os"], "iOS")
        self.assertNotIn("ip_address", rows[0])  # no location shown
        # end the Windows session → its tokens stop working at once
        self.assertEqual(self.client.delete(f"/api/auth/sessions/{b['session_id']}/").status_code, 204)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {b['access_token']}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.client.credentials()
        r = self.client.post("/api/auth/token/refresh/", {"refresh": b["refresh_token"]}, format="json")
        self.assertEqual(r.status_code, 401)
        # the current one still works and refreshes
        r = self.client.post("/api/auth/token/refresh/", {"refresh": a["refresh_token"]}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_end_other_sessions(self):
        a = self._login().json()["session"]
        self._login(); self._login()
        self._auth(a)
        self.assertEqual(self.client.post("/api/auth/sessions/end-others/").json()["ended"], 2)
        self.assertEqual(LoginSession.objects.filter(user=self.user, revoked_at__isnull=True).count(), 1)

    def test_profile_update_and_avatar(self):
        self._auth(self._login().json()["session"])
        r = self.client.patch("/api/auth/me/profile/", {"first_name": "Sara", "last_name": "Ali",
                                                        "phone": "+971500000000", "country": "AE", "city": "Dubai"},
                              format="json")
        self.assertEqual(r.status_code, 200)
        p = r.json()["profile"]
        self.assertEqual((p["full_name"], p["country"], p["city"]), ("Sara Ali", "AE", "Dubai"))
        r = self.client.post("/api/auth/me/avatar/", {"avatar": _png()}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertIn("/media/avatars/", r.json()["avatar_url"])
        self.assertNotIn("me.png", r.json()["avatar_url"])  # random name

    def test_password_change(self):
        a = self._login().json()["session"]
        b = self._login().json()["session"]
        self._auth(a)
        bad = self.client.post("/api/auth/password/change/", {"current_password": "nope", "new_password": "N3w-Passw0rd!x"}, format="json")
        self.assertEqual(bad.json()["code"], "wrong_password")
        ok = self.client.post("/api/auth/password/change/", {"current_password": PW, "new_password": "N3w-Passw0rd!x"}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("N3w-Passw0rd!x"))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {b['access_token']}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)  # other device signed out
        self.assertTrue(Notification.objects.filter(user=self.user, type="password_changed").exists())

    def test_two_factor_flow(self):
        self._auth(self._login().json()["session"])
        setup = self.client.post("/api/auth/2fa/setup/").json()
        self.assertTrue(setup["otpauth_uri"].startswith("otpauth://totp/"))
        self.assertEqual(self.client.post("/api/auth/2fa/enable/", {"code": "000000"}, format="json").json()["code"], "otp_invalid")
        code = totp._code(setup["secret"], int(time.time() // 30))
        self.assertTrue(self.client.post("/api/auth/2fa/enable/", {"code": code}, format="json").json()["enabled"])
        self.client.credentials()
        r = self._login()
        self.assertEqual(r.status_code, 400)
        self.assertIn("otp_required", str(r.json()["code"]))
        self.assertIn("otp_invalid", str(self._login(otp="123456").json()["code"]))
        r = self._login(otp=totp._code(setup["secret"], int(time.time() // 30)))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["user"]["profile"]["totp_enabled"])

    def test_deactivate(self):
        self._auth(self._login().json()["session"])
        self.assertEqual(self.client.post("/api/auth/account/deactivate/", {"password": "x"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/account/deactivate/", {"password": PW}, format="json").status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.client.credentials()
        self.assertNotEqual(self._login().status_code, 200)

    def test_delete_refused_while_holding_money_then_allowed(self):
        from apps.wallets.services import credit_user_balance, debit_user_balance

        self._auth(self._login().json()["session"])
        credit_user_balance(self.user, Decimal("50"), source="test")
        r = self.client.post("/api/auth/account/delete/", {"password": PW, "confirm": "DELETE"}, format="json")
        self.assertEqual(r.json()["code"], "account_not_empty")
        self.assertIn("wallet_balance", r.json()["blockers"])
        debit_user_balance(self.user, Decimal("50"), source="test")
        r = self.client.post("/api/auth/account/delete/", {"password": PW, "confirm": "DELETE"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertTrue(self.user.email.startswith("deleted-"))
        self.assertEqual(self.user.profile.full_name, "")
