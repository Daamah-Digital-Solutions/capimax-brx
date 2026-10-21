"""Broker referrals by hand: client invitations and property referrals with owner authorization."""
import shutil
import tempfile

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.notifications.models import Notification

from .models import BrokerLead
from .tests import _approved_broker, _mk_user

_MEDIA = tempfile.mkdtemp(prefix="capimax-leads-")


def _pdf(name="authorization.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")


@override_settings(MEDIA_ROOT=_MEDIA)
class BrokerLeadTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        self.broker = _approved_broker("bk-leads@ex.com")
        self.client.force_authenticate(self.broker.user)

    def test_client_invite_email_and_joined_on_signup(self):
        r = self.client.post("/api/broker/leads/clients/", {"name": "Omar", "email": "omar@ex.com"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn(f"/ref/{self.broker.referral_code}", mail.outbox[-1].body)
        self.assertEqual(self.client.post("/api/broker/leads/clients/", {"name": "Omar", "email": "omar@ex.com"},
                                          format="json").status_code, 409)
        # Omar signs up through the link → his invitation is "joined".
        from .services import attribute_referral

        omar = User.objects.create_user(email="omar@ex.com", password="pw-12345-strong")
        attribute_referral(omar.profile, self.broker.referral_code)
        self.assertEqual(BrokerLead.objects.get(email="omar@ex.com").status, "joined")

    def test_existing_user_cannot_be_invited(self):
        _mk_user(email="taken@ex.com")
        r = self.client.post("/api/broker/leads/clients/", {"name": "T", "email": "taken@ex.com"}, format="json")
        self.assertEqual(r.json()["code"], "already_registered")

    def test_property_then_owner_confirms_by_link(self):
        r = self.client.post("/api/broker/leads/properties/", {
            "title": "Palm Villa 12", "location": "Dubai", "owner_name": "Sara", "owner_email": "sara@ex.com",
            "owner_role": "owner", "files": [_pdf("deed.pdf")],
        }, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        lead = BrokerLead.objects.get(pk=r.json()["id"])
        self.assertEqual(lead.status, "awaiting_authorization")
        self.assertEqual(len(r.json()["documents"]), 1)
        # The broker sends the owner the confirmation link.
        r = self.client.post(f"/api/broker/leads/{lead.pk}/authorization/request/")
        self.assertEqual(r.json()["authorization"], "requested")
        lead.refresh_from_db()
        self.assertIn(f"/broker-authorization/{lead.auth_token}", mail.outbox[-1].body)
        # The owner (not signed in) reviews and confirms.
        self.client.force_authenticate(None)
        info = self.client.get(f"/api/broker/authorize/{lead.auth_token}/").json()
        self.assertEqual(info["property"], "Palm Villa 12")
        self.assertEqual(self.client.post(f"/api/broker/authorize/{lead.auth_token}/", {"confirm": True},
                                          format="json").status_code, 400)  # name required
        self.assertTrue(self.client.post(f"/api/broker/authorize/{lead.auth_token}/",
                                         {"confirm": True, "name": "Sara Ali"}, format="json").json()["confirmed"])
        lead.refresh_from_db()
        self.assertEqual((lead.authorization, lead.status), ("confirmed", "under_review"))
        self.assertEqual(lead.auth_confirmed_name, "Sara Ali")
        self.assertTrue(Notification.objects.filter(user=self.broker.user, type="broker_lead_update").exists())

    def test_uploaded_authorization_and_privacy(self):
        r = self.client.post("/api/broker/leads/properties/", {"title": "Tower B", "location": "Riyadh",
                                                               "owner_name": "Dev Co", "owner_role": "developer"},
                             format="multipart")
        lead_id = r.json()["id"]
        r = self.client.post(f"/api/broker/leads/{lead_id}/authorization/upload/", {"file": _pdf()}, format="multipart")
        self.assertEqual((r.json()["authorization"], r.json()["status"]), ("uploaded", "under_review"))
        doc = r.json()["documents"][0]["id"]
        self.assertEqual(self.client.get(f"/api/broker/leads/{lead_id}/documents/{doc}/download/").status_code, 200)
        other = _approved_broker("bk-other@ex.com")
        self.client.force_authenticate(other.user)
        self.assertEqual(self.client.get(f"/api/broker/leads/{lead_id}/documents/{doc}/download/").status_code, 404)
        self.assertEqual(self.client.get("/api/broker/leads/").json(), [])

    def test_unapproved_broker_is_refused(self):
        self.client.force_authenticate(_mk_user(email="nobroker@ex.com"))
        self.assertEqual(self.client.get("/api/broker/leads/").status_code, 403)
