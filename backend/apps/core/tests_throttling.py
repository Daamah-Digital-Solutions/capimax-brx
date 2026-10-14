"""Brute-force protection on auth endpoints + the Django admin login (apps/core/throttling.py)."""
from django.conf import settings
from django.core.cache import caches
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from apps.core.models import User

RATES = {
    "auth_login": "3/min",
    "auth_login_account": "100/hour",
    "auth_register": "100/hour",
    "auth_password_reset": "100/hour",
    "auth_password_reset_account": "2/hour",
    "auth_password_reset_confirm": "100/hour",
    "auth_token_refresh": "2/min",
    "auth_oauth": "100/min",
    "auth_email_verify": "100/hour",
    "admin_login": "3/min",
}
ON = override_settings(AUTH_THROTTLE_ENABLED=True, AUTH_THROTTLE_RATES=RATES)


def _login(client, email="a@ex.com", ip="1.1.1.1", **extra):
    return client.post(
        "/api/auth/login/", {"email": email, "password": "wrong-password"},
        format="json", REMOTE_ADDR=ip, **extra,
    )


@ON
class AuthThrottleTests(APITestCase):
    def setUp(self):
        caches["throttle"].clear()

    def test_login_is_limited_per_ip(self):
        codes = [_login(self.client).status_code for _ in range(4)]
        self.assertEqual(codes, [401, 401, 401, 429])
        # A different IP has its own allowance.
        self.assertEqual(_login(self.client, ip="2.2.2.2").status_code, 401)

    @override_settings(AUTH_THROTTLE_RATES={**RATES, "auth_login": "100/min", "auth_login_account": "2/hour"})
    def test_login_is_limited_per_account_across_ips(self):
        codes = [_login(self.client, ip=f"3.3.3.{i}").status_code for i in range(3)]
        self.assertEqual(codes, [401, 401, 429])
        # Same email in different case/spacing is the same account.
        self.assertEqual(_login(self.client, email="  A@EX.com ", ip="4.4.4.4").status_code, 429)
        self.assertEqual(_login(self.client, email="other@ex.com", ip="4.4.4.4").status_code, 401)

    def test_password_reset_email_bombing_is_limited(self):
        User.objects.create_user(email="victim@ex.com", password="pw-12345-strong")
        codes = [
            self.client.post("/api/auth/password/reset/", {"email": "victim@ex.com"},
                             format="json", REMOTE_ADDR=f"5.5.5.{i}").status_code
            for i in range(3)
        ]
        self.assertEqual(codes, [200, 200, 429])

    def test_token_refresh_is_limited(self):
        codes = [
            self.client.post("/api/auth/token/refresh/", {"refresh": "bad"}, format="json",
                             REMOTE_ADDR="6.6.6.6").status_code
            for _ in range(3)
        ]
        self.assertEqual(codes[-1], 429)

    def test_real_client_ip_comes_from_the_proxy_appended_hop(self):
        rf = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
        with override_settings(REST_FRAMEWORK=rf):
            # Behind nginx every request comes from 127.0.0.1; the client is the last XFF hop.
            for _ in range(3):
                _login(self.client, ip="127.0.0.1", HTTP_X_FORWARDED_FOR="9.9.9.9")
            self.assertEqual(_login(self.client, ip="127.0.0.1", HTTP_X_FORWARDED_FOR="9.9.9.9").status_code, 429)
            # Another real client behind the same proxy is NOT blocked…
            self.assertEqual(_login(self.client, ip="127.0.0.1", HTTP_X_FORWARDED_FOR="8.8.8.8").status_code, 401)
            # …and the blocked client can't escape by forging an earlier XFF value.
            spoofed = _login(self.client, ip="127.0.0.1", HTTP_X_FORWARDED_FOR="1.2.3.4, 9.9.9.9")
            self.assertEqual(spoofed.status_code, 429)

    @override_settings(AUTH_THROTTLE_ENABLED=False)
    def test_disabled_means_no_limit(self):
        self.assertTrue(all(_login(self.client).status_code == 401 for _ in range(8)))


@ON
class AdminLoginRateLimitTests(TestCase):
    def setUp(self):
        caches["throttle"].clear()

    def test_admin_login_posts_are_limited(self):
        post = lambda ip="7.7.7.7": self.client.post(  # noqa: E731
            "/admin/login/", {"username": "x@ex.com", "password": "nope"}, REMOTE_ADDR=ip
        )
        codes = [post().status_code for _ in range(4)]
        self.assertEqual(codes[:3], [200, 200, 200])  # form re-shown with the error
        self.assertEqual(codes[3], 429)
        self.assertEqual(post(ip="7.7.7.8").status_code, 200)
        # Viewing the login page is never limited.
        self.assertEqual(self.client.get("/admin/login/", REMOTE_ADDR="7.7.7.7").status_code, 200)
