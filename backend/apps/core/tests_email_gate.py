"""A confirmed email is required before KYC and money actions (EMAIL_VERIFICATION_REQUIRED)."""
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.kyc.services import get_or_create_kyc

from .tokens import email_verification_token
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def _user(email, *, verified=False, kyc_approved=False):
    u = User.objects.create_user(email=email, password="pw-12345-strong")
    u.is_email_verified = verified
    u.save(update_fields=["is_email_verified"])
    if kyc_approved:
        k = get_or_create_kyc(u)
        k.mark_approved()
        k.save()
    return User.objects.get(pk=u.pk)


@override_settings(EMAIL_VERIFICATION_REQUIRED=True)
class EmailGateTests(APITestCase):
    def test_kyc_cannot_start_before_the_email_is_confirmed(self):
        self.client.force_authenticate(_user("new@ex.com"))
        resp = self.client.post("/api/kyc/submit/", {}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.data["code"], "email_unverified")

    def test_a_confirmed_email_passes_the_gate(self):
        self.client.force_authenticate(_user("ok@ex.com", verified=True))
        resp = self.client.post("/api/kyc/submit/", {}, format="json")
        self.assertNotEqual(resp.status_code, 403)

    def test_money_actions_ask_for_the_email_before_the_kyc(self):
        self.client.force_authenticate(_user("approved@ex.com", kyc_approved=True))
        invest = self.client.post("/api/investments/", {}, format="json")
        self.assertEqual(invest.status_code, 403)
        self.assertEqual(invest.data["code"], "email_unverified")
        withdraw = self.client.post("/api/wallets/withdrawals/", {"amount": 10, "method": "bank"}, format="json")
        self.assertEqual(withdraw.status_code, 403)
        self.assertEqual(withdraw.data["code"], "email_unverified")

    def test_admins_are_not_gated(self):
        admin = _user("staff@ex.com")
        admin.is_staff = True
        admin.save(update_fields=["is_staff"])
        self.client.force_authenticate(admin)
        resp = self.client.post("/api/kyc/submit/", {}, format="json")
        self.assertNotEqual(resp.status_code, 403)

    @override_settings(EMAIL_VERIFICATION_REQUIRED=False)
    def test_the_gate_can_be_switched_off(self):
        self.client.force_authenticate(_user("off@ex.com"))
        self.assertNotEqual(self.client.post("/api/kyc/submit/", {}, format="json").status_code, 403)

    def test_resend_then_confirm_opens_the_gate(self):
        user = _user("resend@ex.com")
        self.client.force_authenticate(user)
        session = self.client.get("/api/auth/session/").data
        self.assertFalse(session["user"]["is_email_verified"])
        resp = self.client.post("/api/auth/email/resend/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/verify-email?uid=", mail.outbox[0].body)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)
        self.client.force_authenticate(None)
        ok = self.client.post("/api/auth/email/verify/", {"uid": uid, "token": token}, format="json")
        self.assertEqual(ok.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        # The used link no longer works.
        again = self.client.post("/api/auth/email/verify/", {"uid": uid, "token": token}, format="json")
        self.assertEqual(again.status_code, 400)
        self.client.force_authenticate(user)
        self.assertTrue(self.client.post("/api/auth/email/resend/").data["verified"])
        self.assertNotEqual(self.client.post("/api/kyc/submit/", {}, format="json").status_code, 403)
