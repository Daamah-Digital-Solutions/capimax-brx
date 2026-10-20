"""Multi-role accounts (apps/roles)."""
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.notifications.models import Notification

from .models import RoleApplication

_MEDIA = tempfile.mkdtemp(prefix="capimax-roles-")


def _pdf(name="doc.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")


BROKER = {"name": "Sara Brokerage", "license_number": "RERA-123", "phone": "+971500000000", "country": "AE"}
LP = {"name": "Gulf Capital", "entity_type": "institution", "country": "AE", "commitment": "250k_1m",
      "investor_status": "institutional", "source_of_funds": "Business revenue", "phone": "+971500000001"}
COMPANY = {"company_name": "Build Co", "registration_number": "CR-9", "phone": "+20100000000", "country": "EG"}


@override_settings(MEDIA_ROOT=_MEDIA)
class RoleFlowTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create_user(email="multi@ex.com", password="pw-12345-strong")
        self.user.is_email_verified = True
        self.user.save()
        self.admin = User.objects.create_user(email="adm@ex.com", password="pw-12345-strong", is_staff=True)
        self.client.force_authenticate(self.user)

    def _roles(self):
        return {r["role"]: r for r in self.client.get("/api/roles/").json()["roles"]}

    def _apply(self, slug, data, **files):
        return self.client.post(f"/api/roles/applications/{slug}/", {**data, **files}, format="multipart")

    def test_new_account_is_an_investor_only(self):
        roles = self._roles()
        self.assertEqual(roles["investor"]["status"], "active")
        self.assertEqual(roles["owner"]["approval"], "instant")
        self.assertEqual(roles["broker"]["approval"], "admin")
        self.assertTrue(all(roles[r]["status"] == "available" for r in ("owner", "broker", "lp", "developer", "partner")))

    def test_owner_is_granted_instantly_and_can_be_switched_to(self):
        self.assertEqual(self.client.post("/api/roles/owner/").status_code, 201)
        self.assertEqual(self._roles()["owner"]["status"], "active")
        # the owner area (property submissions) is open now
        self.assertEqual(self.client.get("/api/owner/submissions/").status_code, 200)
        resp = self.client.post("/api/roles/switch/", {"role": "owner"}, format="json")
        self.assertEqual(resp.json()["current"], "owner")
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.role, "owner")

    def test_cannot_switch_to_a_role_not_held(self):
        resp = self.client.post("/api/roles/switch/", {"role": "broker"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_broker_application_needs_its_documents(self):
        resp = self._apply("broker", BROKER, id_document=_pdf())
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("license", resp.json())
        self.assertFalse(RoleApplication.objects.exists())

    def test_broker_apply_approve_and_use(self):
        resp = self._apply("broker", BROKER, id_document=_pdf("id.pdf"), license=_pdf("lic.pdf"))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._roles()["broker"]["status"], "pending")
        # the broker area stays closed while pending
        self.assertEqual(self.client.get("/api/broker/commissions/").status_code, status.HTTP_403_FORBIDDEN)

        from . import services

        services.approve(RoleApplication.objects.get().pk, self.admin)
        self.assertEqual(self._roles()["broker"]["status"], "active")
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))  # a fresh request user
        self.assertEqual(self.client.get("/api/broker/commissions/").status_code, 200)
        broker = User.objects.get(pk=self.user.pk).broker_profile
        self.assertEqual(broker.license_number, "RERA-123")
        self.assertTrue(broker.referral_code)
        n = Notification.objects.get(user=self.user, type="role_approved")
        self.assertEqual(n.action_url, "/broker-dashboard")
        # already held → the apply page refuses
        self.assertEqual(self._apply("broker", BROKER).status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejected_application_can_be_edited_and_resubmitted_keeping_documents(self):
        from . import services

        self._apply("lp", LP, proof_of_funds=_pdf("bank.pdf"), id_document=_pdf("id.pdf"))
        services.reject(RoleApplication.objects.get().pk, self.admin, "Bank statement older than 3 months")
        lp = self._roles()["lp"]
        self.assertEqual(lp["status"], "rejected")
        self.assertIn("3 months", lp["review_note"])
        self.assertTrue(Notification.objects.filter(user=self.user, type="role_rejected").exists())
        # resubmit with only the new bank statement — the ID stays
        resp = self._apply("liquidity_provider", {**LP, "commitment": "1m_plus"}, proof_of_funds=_pdf("bank2.pdf"))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        app = RoleApplication.objects.get()
        self.assertEqual(app.status, "pending")
        self.assertEqual(app.review_note, "")
        docs = {d.kind: d.original_name for d in app.documents.all()}
        self.assertEqual(docs, {"proof_of_funds": "bank2.pdf", "id_document": "id.pdf"})
        services.approve(app.pk, self.admin)
        lp = User.objects.get(pk=self.user.pk).liquidity_provider
        self.assertEqual((lp.status, lp.kyb_status), ("approved", "approved"))
        self.assertEqual(int(lp.investment_amount), 1_000_000)

    def test_developer_and_partner_by_approval(self):
        from . import services

        for slug in ("developer", "partner"):
            resp = self._apply(slug, COMPANY, id_document=_pdf(), company_registration=_pdf())
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED, slug)
        for app in RoleApplication.objects.all():
            services.approve(app.pk, self.admin)
        roles = self._roles()
        self.assertEqual((roles["developer"]["status"], roles["partner"]["status"]), ("active", "active"))
        self.assertEqual(User.objects.get(pk=self.user.pk).developer_profile.company_name, "Build Co")

    def test_application_page_payload(self):
        body = self.client.get("/api/roles/applications/liquidity_provider/").json()
        self.assertEqual(body["status"], "available")
        self.assertIsNone(body["application"])
        self.assertIn("investor_status", body["form"]["fields"])
        self.assertEqual(self.client.get("/api/roles/applications/nope/").status_code, 404)

    def test_invalid_choice_is_refused(self):
        resp = self._apply("lp", {**LP, "investor_status": "whale"}, proof_of_funds=_pdf(), id_document=_pdf())
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("investor_status", resp.json())
