"""Error alerts (apps/core/alerts.py) and browser error reports (apps/core/monitoring.py)."""
import logging

from django.core import mail
from django.core.cache import caches
from django.core.management.base import BaseCommand
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from .alerts import alert_on_failure

ADMINS = [("ops@example.com", "ops@example.com")]


SECRET = "PRIVATE-KEY-0xDEADBEEF"


def _fail(secret):
    raise RuntimeError("settlement broke")


@override_settings(ADMINS=ADMINS)
class AlertEmailTests(TestCase):
    def setUp(self):
        caches["alerts"].clear()
        self.log = logging.getLogger("apps.payments.services")

    def _raise_and_log(self, msg="Mint failed for %s", arg="inv-1"):
        try:
            _fail(secret=SECRET)
        except RuntimeError:
            self.log.exception(msg, arg)

    def test_an_app_error_is_emailed_once_per_window(self):
        self._raise_and_log()
        self._raise_and_log()  # same error again → no second email
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("[Capimax BRX alert]", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["ops@example.com"])
        self._raise_and_log(msg="Another failure %s")  # a different error → its own email
        self.assertEqual(len(mail.outbox), 2)

    def test_stack_locals_are_not_in_the_email(self):
        self._raise_and_log()
        body = mail.outbox[0].body
        self.assertIn("settlement broke", body)
        self.assertNotIn(SECRET, body)
        self.assertNotIn("SECRET_KEY", body)  # no settings dump

    def test_info_is_not_emailed(self):
        self.log.info("all good")
        self.log.warning("just a warning")
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(ADMINS=[])
    def test_no_recipients_no_email(self):
        self._raise_and_log()
        self.assertEqual(len(mail.outbox), 0)

    def test_a_failing_scheduled_command_alerts_and_still_fails(self):
        class Cmd(BaseCommand):
            @alert_on_failure
            def handle(self, *args, **opts):
                raise ValueError("cron job broke")

        with self.assertRaises(ValueError):
            Cmd().handle()
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("cron job broke", mail.outbox[0].body)


@override_settings(ADMINS=ADMINS)
class ClientErrorReportTests(APITestCase):
    url = "/api/monitoring/client-errors/"

    def setUp(self):
        caches["alerts"].clear()

    def test_a_browser_crash_is_logged_and_emailed(self):
        resp = self.client.post(self.url, {
            "message": "TypeError: x is undefined", "stack": "at Checkout (index.js:1:2)",
            "source": "boundary", "url": "https://www.capimaxbrx.com/checkout",
        }, format="json")
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("TypeError: x is undefined", mail.outbox[0].body)
        self.assertIn("/checkout", mail.outbox[0].body)

    def test_stale_bundle_errors_are_logged_but_not_emailed(self):
        resp = self.client.post(self.url, {
            "message": "Failed to fetch dynamically imported module: /assets/Portfolio-abc.js",
        }, format="json")
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(len(mail.outbox), 0)

    def test_garbage_is_ignored_quietly(self):
        self.assertEqual(self.client.post(self.url, {"nope": 1}, format="json").status_code, 204)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_expired_token_does_not_block_the_report(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        resp = self.client.post(self.url, {"message": "boom"}, format="json")
        self.assertEqual(resp.status_code, 204)
