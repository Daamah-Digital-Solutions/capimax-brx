"""
Owner onboarding (KYB) tests — Phase 7 Wave A. Run against Postgres (capimax_brx).

Covers the LOCKED decisions:
  * Apply creates a pending profile; apply is idempotent; GET 404 when none.
  * KYB submit → under_review + persists business info.
  * Shared Sumsub webhook routes owner-business-level (KYB) GREEN → owner approved +
    the owner role activated; RED → rejected; bad/absent signature → 401 (no state
    change); resolve-by-level + externalUserId.
  * dev_grant_owner_kyb approves + activates the role; --revoke removes the record;
    refuses to run in production (DEBUG=False).
  * One owner can't see another owner's profile.
  * HasActivatedOwner allows an approved owner + denies others.
  * Investor KYC + LP KYB are unaffected (no regression / no cross-claim).
  * KYB access-token degrades to 503 when Sumsub is unconfigured.
"""
import hashlib
import hmac
import json
from io import StringIO

from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, APITestCase, force_authenticate
from rest_framework.views import APIView

from apps.core.models import Profile, User
from apps.core.permissions import HasActivatedOwner

from .models import OwnerKYBStatus, OwnerProfile, OwnerStatus
from .services import get_or_create_owner


def _mk_user(email="owner@example.com", *, role=Profile.Role.OWNER):
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    # The signal creates the profile as investor/active; set the owner role parked at
    # pending_verification to exercise the activation hinge.
    profile = user.profile
    profile.role = role
    if role in (Profile.Role.OWNER,):
        profile.role_status = Profile.RoleStatus.PENDING_VERIFICATION
        profile.role_verified_at = None
    profile.save()
    return user


_APPLY = {
    "company_name": "Marina Estates",
    "contact_name": "Sara Ali",
    "email": "sara@marina.com",
    "phone": "+971500000000",
    "country": "UAE",
}
_KYB = {
    "business_type": "llc",
    "business_registration_number": "REG-OWN-1",
    "tax_id": "TAX-7",
    "business_address": "1 Marina, Dubai",
    "business_description": "Real estate holdings",
}


# --------------------------------------------------------------------------- #
# Apply + profile
# --------------------------------------------------------------------------- #
class OwnerApplyTests(APITestCase):
    def test_get_profile_404_when_none(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.get("/api/owner/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_apply_creates_pending_profile(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/owner/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], OwnerStatus.PENDING)
        self.assertEqual(resp.data["kyb_status"], OwnerKYBStatus.NOT_STARTED)
        self.assertTrue(OwnerProfile.objects.filter(user=user).exists())

    def test_apply_is_idempotent(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        self.client.post("/api/owner/profile/", _APPLY, format="json")
        resp = self.client.post("/api/owner/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(OwnerProfile.objects.filter(user=user).count(), 1)

    def test_owner_cannot_see_another_owners_profile(self):
        a = _mk_user("a-owner@example.com")
        self.client.force_authenticate(a)
        self.client.post("/api/owner/profile/", _APPLY, format="json")
        # A different owner sees their own (none) — 404, never A's row.
        b = _mk_user("b-owner@example.com")
        self.client.force_authenticate(b)
        resp = self.client.get("/api/owner/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# KYB submit
# --------------------------------------------------------------------------- #
class OwnerKYBSubmitTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)
        self.client.post("/api/owner/profile/", _APPLY, format="json")

    def test_kyb_submit_moves_under_review(self):
        resp = self.client.post("/api/owner/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["kyb_status"], OwnerKYBStatus.UNDER_REVIEW)
        self.assertEqual(resp.data["business_type"], "llc")
        self.assertIsNotNone(resp.data["kyb_submitted_at"])

    def test_kyb_submit_requires_profile(self):
        other = _mk_user("noowner@example.com")
        self.client.force_authenticate(other)
        resp = self.client.post("/api/owner/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# The shared Sumsub webhook (the automation hinge for owner KYB)
# --------------------------------------------------------------------------- #
_WEBHOOK_SECRET = "test-webhook-secret"
_OWNER_LEVEL = "owner-kyb-level"
_LP_LEVEL = "basic-kyb-level"


def _sign(raw: bytes) -> str:
    return hmac.new(_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


@override_settings(
    SUMSUB_WEBHOOK_SECRET=_WEBHOOK_SECRET,
    SUMSUB_OWNER_KYB_LEVEL_NAME=_OWNER_LEVEL,
    SUMSUB_KYB_LEVEL_NAME=_LP_LEVEL,
)
class OwnerWebhookTests(APITestCase):
    url = "/api/kyc/webhook/sumsub/"

    def _post(self, payload: dict, *, sign=True, bad=False):
        raw = json.dumps(payload).encode()
        headers = {}
        if sign:
            headers["HTTP_X_PAYLOAD_DIGEST"] = "deadbeef" if bad else _sign(raw)
        return self.client.post(self.url, data=raw, content_type="application/json", **headers)

    def test_owner_green_approves_and_activates_role(self):
        user = _mk_user("green-owner@example.com")
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.sumsub_applicant_id = "own-appl-1"
        owner.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "own-appl-1",
            "levelName": _OWNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "owner")
        owner.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.APPROVED)
        self.assertEqual(owner.kyb_status, OwnerKYBStatus.APPROVED)
        # role activated
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    def test_owner_green_resolves_by_level_and_external_id(self):
        # No applicant id on the owner record — resolve by owner level + externalUserId.
        user = _mk_user("level-owner@example.com")
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "unknown-appl",
            "levelName": _OWNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        owner.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.APPROVED)

    def test_owner_red_rejects(self):
        user = _mk_user("red-owner@example.com")
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.sumsub_applicant_id = "own-appl-2"
        owner.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "own-appl-2",
            "levelName": _OWNER_LEVEL,
            "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]},
        }
        resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        owner.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.REJECTED)
        self.assertIn("FORGERY", owner.kyb_rejection_reason)

    def test_bad_signature_rejected_no_state_change(self):
        user = _mk_user("badsig-owner@example.com")
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.sumsub_applicant_id = "own-appl-3"
        owner.save()
        payload = {
            "type": "applicantReviewed",
            "applicantId": "own-appl-3",
            "levelName": _OWNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        resp = self._post(payload, bad=True)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        owner.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.PENDING)

    def test_lp_kyb_event_not_claimed_by_owner(self):
        # An LP-business event for a user who ALSO has an owner profile must NOT be
        # claimed by the owner handler (level name differs) — it routes to LP.
        from apps.lp.services import get_or_create_lp
        from apps.lp.models import LPStatus

        user = _mk_user("dual@example.com", role=Profile.Role.LP)
        # user has both an owner profile and an LP profile
        get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "S", "email": user.email})
        lp.sumsub_applicant_id = "lp-appl-x"
        lp.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "lp-appl-x",
            "levelName": _LP_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "lp")
        # owner untouched
        owner = OwnerProfile.objects.get(user=user)
        self.assertEqual(owner.status, OwnerStatus.PENDING)
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.APPROVED)

    def test_investor_kyc_unaffected_when_no_owner(self):
        from apps.kyc.services import get_or_create_kyc

        user = _mk_user("inv-only@example.com", role=Profile.Role.INVESTOR)
        kyc = get_or_create_kyc(user)
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "kyc-appl-9",
            "levelName": "basic-kyc-level",
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn(resp.data.get("domain"), ("owner", "lp"))
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, "approved")


# --------------------------------------------------------------------------- #
# dev_grant_owner_kyb
# --------------------------------------------------------------------------- #
class DevGrantOwnerKYBTests(APITestCase):
    @override_settings(DEBUG=True)
    def test_dev_grant_approves_and_activates_role(self):
        user = _mk_user("dev-owner@example.com")
        get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        with self.captureOnCommitCallbacks(execute=True):
            call_command("dev_grant_owner_kyb", "--email", user.email, stdout=StringIO())
        owner = OwnerProfile.objects.get(user=user)
        self.assertEqual(owner.status, OwnerStatus.APPROVED)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    @override_settings(DEBUG=True)
    def test_dev_grant_revoke_removes_record(self):
        user = _mk_user("dev-owner2@example.com")
        get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        call_command("dev_grant_owner_kyb", "--email", user.email, "--revoke", stdout=StringIO())
        self.assertFalse(OwnerProfile.objects.filter(user=user).exists())

    @override_settings(DEBUG=False)
    def test_dev_grant_refuses_in_production(self):
        _mk_user("prod-owner@example.com")
        with self.assertRaises(Exception):
            call_command("dev_grant_owner_kyb", "--email", "prod-owner@example.com", stdout=StringIO())


# --------------------------------------------------------------------------- #
# HasActivatedOwner gate (proves the next wave's submission gate works)
# --------------------------------------------------------------------------- #
class _GatedView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedOwner]

    def get(self, request):
        return Response({"ok": True})


class HasActivatedOwnerTests(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = _GatedView.as_view()

    def _call(self, user):
        request = self.factory.get("/gated/")
        force_authenticate(request, user=user)
        return self.view(request)

    def test_allows_approved_owner(self):
        user = _mk_user("gate-ok@example.com")
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.status = OwnerStatus.APPROVED
        owner.save()
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_denies_pending_owner(self):
        user = _mk_user("gate-pending@example.com")
        get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_denies_user_without_owner_profile(self):
        user = _mk_user("gate-none@example.com", role=Profile.Role.INVESTOR)
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# --------------------------------------------------------------------------- #
# KYB access-token degrade
# --------------------------------------------------------------------------- #
class OwnerKYBAccessTokenTests(APITestCase):
    @override_settings(SUMSUB_APP_TOKEN="", SUMSUB_SECRET_KEY="")
    def test_access_token_503_when_unconfigured(self):
        user = _mk_user("token-owner@example.com")
        self.client.force_authenticate(user)
        get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        resp = self.client.post("/api/owner/kyb/access-token/")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "kyb_provider_unconfigured")


# =========================================================================== #
# PROPERTY SUBMISSION INTAKE — Phase 7 Wave B. Gated to APPROVED owners; intake
# only (NO Property created/published; review→publish is Wave C).
# =========================================================================== #
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.properties.models import Property

from .models import PropertySubmission, SubmissionDocument, SubmissionStatus
from .services import get_or_create_owner as _goc


def _approved_owner(email="approved-owner@example.com"):
    """A user with role=owner and an APPROVED OwnerProfile (passes HasActivatedOwner)."""
    user = _mk_user(email)
    owner, _ = _goc(user, defaults={"contact_name": "S", "email": user.email})
    owner.status = OwnerStatus.APPROVED
    owner.kyb_status = OwnerKYBStatus.APPROVED
    owner.save()
    return user


_SUB = {
    "name": "Marina Tower",
    "property_type": "residential",
    "construction_status": "ready",
    "description": "A ready, income-producing tower.",
    "country": "UAE",
    "city": "dubai",
    "district": "Marina",
    "address": "1 Marina Walk",
    "property_value_usd": "5000000",
    "min_investment": "1000",
    "expected_yield": "8.5",
    "duration_years": 5,
    "distribution_model": "quarterly",
}


def _pdf(name="title.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 fake", content_type="application/pdf")


class SubmissionGateTests(APITestCase):
    def test_approved_owner_can_create_draft(self):
        user = _approved_owner()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/owner/submissions/", _SUB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], SubmissionStatus.DRAFT)
        self.assertEqual(resp.data["name"], "Marina Tower")
        # money serialized as JSON numbers
        self.assertEqual(resp.data["property_value_usd"], 5000000.0)
        self.assertEqual(resp.data["expected_yield"], 8.5)

    def test_pending_owner_denied_403(self):
        user = _mk_user("pending-owner@example.com")  # owner role, pending (not approved)
        _goc(user, defaults={"contact_name": "S", "email": user.email})
        self.client.force_authenticate(user)
        resp = self.client.post("/api/owner/submissions/", _SUB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_owner_role_denied_403(self):
        from apps.core.models import User as _U
        user = _U.objects.create_user(email="investor@example.com", password="pw-12345-strong")
        self.client.force_authenticate(user)
        resp = self.client.get("/api/owner/submissions/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class SubmissionLifecycleTests(APITestCase):
    def setUp(self):
        self.user = _approved_owner()
        self.client.force_authenticate(self.user)
        self.sub_id = self.client.post(
            "/api/owner/submissions/", _SUB, format="json"
        ).data["id"]

    def _upload(self, doc_type, name=None):
        return self.client.post(
            f"/api/owner/submissions/{self.sub_id}/documents/",
            {"file": _pdf(name or f"{doc_type}.pdf"), "document_type": doc_type,
             "document_name": doc_type},
            format="multipart",
        )

    def test_submit_blocked_without_required_docs(self):
        resp = self.client.post(f"/api/owner/submissions/{self.sub_id}/submit/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["code"], "missing_required_documents")
        self.assertIn("title", resp.data["missing"])
        sub = PropertySubmission.objects.get(pk=self.sub_id)
        self.assertEqual(sub.status, SubmissionStatus.DRAFT)

    def test_submit_succeeds_with_required_docs(self):
        for t in ("title", "valuation", "legal"):
            self.assertEqual(self._upload(t).status_code, status.HTTP_201_CREATED)
        resp = self.client.post(f"/api/owner/submissions/{self.sub_id}/submit/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], SubmissionStatus.SUBMITTED)
        self.assertIsNotNone(resp.data["submitted_at"])

    def test_patch_only_while_draft(self):
        # Edit a draft — allowed.
        ok = self.client.patch(
            f"/api/owner/submissions/{self.sub_id}/",
            {"name": "Renamed Tower"}, format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(ok.data["name"], "Renamed Tower")
        # Submit, then editing must be blocked (409).
        for t in ("title", "valuation", "legal"):
            self._upload(t)
        self.client.post(f"/api/owner/submissions/{self.sub_id}/submit/")
        blocked = self.client.patch(
            f"/api/owner/submissions/{self.sub_id}/",
            {"name": "Too late"}, format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(blocked.data["code"], "not_a_draft")

    def test_no_property_row_created_or_published(self):
        before = Property.objects.count()
        for t in ("title", "valuation", "legal"):
            self._upload(t)
        self.client.post(f"/api/owner/submissions/{self.sub_id}/submit/")
        # Intake must NOT touch the catalog at all (Wave C publishes).
        self.assertEqual(Property.objects.count(), before)

    def test_document_list_and_download_owner_scoped(self):
        self._upload("title", "deed.pdf")
        lst = self.client.get(f"/api/owner/submissions/{self.sub_id}/documents/")
        self.assertEqual(len(lst.data), 1)
        self.assertEqual(lst.data[0]["document_type"], "title")
        doc_id = lst.data[0]["id"]
        dl = self.client.get(
            f"/api/owner/submissions/{self.sub_id}/documents/{doc_id}/download/"
        )
        self.assertEqual(dl.status_code, status.HTTP_200_OK)

    def test_document_delete_only_while_draft(self):
        up = self._upload("noc")
        doc_id = up.data["id"]
        dele = self.client.delete(
            f"/api/owner/submissions/{self.sub_id}/documents/{doc_id}/"
        )
        self.assertEqual(dele.status_code, status.HTTP_204_NO_CONTENT)


# =========================================================================== #
# REVIEW → PUBLISH pipeline — Phase 7 Wave C. Admin-reviewed materialization of a
# submission into a published Property. NO investor/LP/payments touched.
# =========================================================================== #
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError

from apps.properties.models import InstallmentSchedule, Property
from apps.owner.services import (
    SubmissionNotReviewable,
    publish_submission,
    reject_submission,
)


def _submitted(submission_overrides=None):
    """An APPROVED owner with a SUBMITTED submission (ready to review)."""
    user = _approved_owner(f"rev-{(submission_overrides or {}).get('name', 'x')}@ex.com".replace(" ", ""))
    data = dict(_SUB)
    data.update(submission_overrides or {})
    sub = PropertySubmission.objects.create(
        submitter=user, status=SubmissionStatus.SUBMITTED, **data
    )
    return user, sub


class PublishPipelineTests(APITestCase):
    def test_approval_materializes_one_published_property(self):
        _, sub = _submitted({"name": "Pub Tower"})
        before = Property.objects.count()
        result = publish_submission(sub, model="ready")
        self.assertEqual(Property.objects.count(), before + 1)
        prop = result.published_property
        self.assertIsNotNone(prop)
        self.assertTrue(prop.is_published)          # ends published
        self.assertEqual(result.status, SubmissionStatus.APPROVED)
        self.assertIsNotNone(result.reviewed_at)

    def test_category_and_token_supply_autoderive_from_assigned_model(self):
        _, sub = _submitted({"name": "Derive", "property_value_usd": Decimal("5000000")})
        result = publish_submission(sub, model="ready_portfolio")
        prop = result.published_property
        self.assertEqual(prop.model, "ready_portfolio")
        self.assertEqual(prop.category, "ready_portfolio")   # derived from model
        self.assertEqual(prop.token_supply, 50000)           # 5,000,000 / 100

    def test_clean_rejects_bad_economics_no_property(self):
        _, sub = _submitted({"name": "BadYield"})
        before = Property.objects.count()
        with self.assertRaises(DjangoValidationError):
            publish_submission(sub, model="ready", overrides={"expected_yield": Decimal("452")})
        # Atomic rollback — no Property created, submission not approved.
        self.assertEqual(Property.objects.count(), before)
        sub.refresh_from_db()
        self.assertEqual(sub.status, SubmissionStatus.SUBMITTED)
        self.assertIsNone(sub.published_property_id)

    def test_owner_property_link_is_set(self):
        user, sub = _submitted({"name": "Linked"})
        result = publish_submission(sub, model="ready")
        self.assertEqual(result.published_property.submitted_by_id, user.id)
        self.assertEqual(result.published_property_id, result.published_property.id)

    def test_publish_is_idempotent(self):
        _, sub = _submitted({"name": "Idem"})
        first = publish_submission(sub, model="ready")
        count_after_first = Property.objects.count()
        # Re-run → returns the same submission, creates no second property.
        again = publish_submission(sub, model="ready")
        self.assertEqual(again.published_property_id, first.published_property_id)
        self.assertEqual(Property.objects.count(), count_after_first)

    def test_draft_cannot_be_published(self):
        user = _approved_owner("draft-pub@ex.com")
        sub = PropertySubmission.objects.create(
            submitter=user, status=SubmissionStatus.DRAFT, **_SUB
        )
        with self.assertRaises(SubmissionNotReviewable):
            publish_submission(sub, model="ready")
        self.assertEqual(Property.objects.filter(submitted_by=user).count(), 0)

    def test_nested_record_created_when_model_needs_it(self):
        _, sub = _submitted({"name": "Inst", "construction_status": "off-plan"})
        nested = {
            "total_installments": 24, "monthly_amount": Decimal("1000"),
            "next_payment_date": "2026-08-01", "activation_date": "2026-07-01",
        }
        result = publish_submission(sub, model="installment", nested=nested)
        prop = result.published_property
        self.assertEqual(prop.model, "installment")
        self.assertEqual(prop.category, "construction")
        self.assertTrue(InstallmentSchedule.objects.filter(property=prop).exists())

    def test_published_property_visible_in_marketplace_after_publish(self):
        _, sub = _submitted({"name": "Marketplace Visible"})
        # Before publish: not in the public catalog.
        resp = self.client.get("/api/properties/")
        slugs_before = {p["id"] for p in resp.data}
        result = publish_submission(sub, model="ready")
        slug = result.published_property.slug
        self.assertNotIn(slug, slugs_before)
        # After publish: present (is_published=True; AllowAny marketplace read).
        resp2 = self.client.get("/api/properties/")
        slugs_after = {p["id"] for p in resp2.data}
        self.assertIn(slug, slugs_after)


class RejectPipelineTests(APITestCase):
    def test_rejection_records_notes_creates_no_property(self):
        user, sub = _submitted({"name": "Rejectable"})
        before = Property.objects.count()
        result = reject_submission(sub, review_notes="Valuation insufficient.")
        self.assertEqual(result.status, SubmissionStatus.REJECTED)
        self.assertEqual(result.review_notes, "Valuation insufficient.")
        self.assertEqual(Property.objects.count(), before)
        self.assertIsNone(result.published_property_id)

    def test_owner_sees_rejection_and_published_slug(self):
        user, sub = _submitted({"name": "OwnerSees"})
        reject_submission(sub, review_notes="Try again with more docs.")
        self.client.force_authenticate(user)
        resp = self.client.get(f"/api/owner/submissions/{sub.id}/")
        self.assertEqual(resp.data["status"], "rejected")
        self.assertEqual(resp.data["review_notes"], "Try again with more docs.")
        self.assertIsNone(resp.data["published_property_slug"])

    def test_owner_sees_approved_slug(self):
        user, sub = _submitted({"name": "ApprovedSees"})
        publish_submission(sub, model="ready")
        self.client.force_authenticate(user)
        resp = self.client.get(f"/api/owner/submissions/{sub.id}/")
        self.assertEqual(resp.data["status"], "approved")
        self.assertIsNotNone(resp.data["published_property_slug"])


# =========================================================================== #
# OWNER EARNINGS / LEDGER — Phase 7 Wave D. A completed primary sale credits the
# owner's UserBalance net of fees (chain MOCKED so the suite stays network-free).
# =========================================================================== #
from unittest import mock

from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import mint_investment
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction, UserBalance
from apps.wallets.services import get_or_create_custodial_wallet

_FAKE_MINT = {"tx_hash": "0x" + "cd" * 32, "block_number": 555, "chain_id": 97}


def _owned_deployed_property(owner, *, slug="owned1", total_value=Decimal("5000000"),
                             fee_platform=Decimal("1.5"), fee_management=Decimal("0.5")):
    """A published, on-chain-deployed Property linked to `owner` (submitted_by)."""
    p = Property(**_valid_property_kwargs(
        slug=slug, total_value=total_value, fee_platform=fee_platform, fee_management=fee_management,
    ))
    p.submitted_by = owner
    p.save()  # token_supply auto-derives = 50000
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "11" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _completed_investment(buyer, prop, token_amount):
    """An investor with a custodial wallet + a COMPLETED (not-yet-minted) investment."""
    wallet, _ = get_or_create_custodial_wallet(buyer)
    inv = Investment.objects.create(
        user=buyer, property=prop, property_name=prop.name,
        amount_invested=Decimal(token_amount) * prop.token_price, token_amount=token_amount,
        token_symbol="BRX1", price_per_token=prop.token_price,
        ownership_percentage=Decimal("0.1"), payment_method="card",
        payment_status=PaymentStatus.COMPLETED, wallet=wallet,
    )
    return inv


@mock.patch("apps.investments.services.chain_service.mint", return_value=_FAKE_MINT)
class OwnerEarningsCreditTests(APITestCase):
    def test_primary_sale_credits_owner_net_of_fees(self, _m):
        owner = _approved_owner("earn-owner@ex.com")
        prop = _owned_deployed_property(owner)  # fees 1.5% + 0.5% = 2%
        buyer = User.objects.create_user(email="buyer-e@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)  # gross = 10 * 100 = 1000
        result = mint_investment(inv)
        self.assertTrue(result["minted"])
        # 1000 − 2% = 980 credited to the owner.
        self.assertEqual(result["owner_credited"], "980.00")
        bal = UserBalance.objects.get(user=owner)
        self.assertEqual(bal.current_balance, Decimal("980.00"))
        # Exactly one primary_sale ledger entry keyed to this investment.
        entries = BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id))
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.first().entry_type, "credit")

    def test_credit_is_idempotent_on_replay(self, _m):
        owner = _approved_owner("earn-owner2@ex.com")
        prop = _owned_deployed_property(owner, slug="owned2")
        buyer = User.objects.create_user(email="buyer-e2@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)
        mint_investment(inv)
        # Replay the completion → mint short-circuits (already minted); no 2nd credit.
        again = mint_investment(inv)
        self.assertTrue(again.get("already"))
        bal = UserBalance.objects.get(user=owner)
        self.assertEqual(bal.current_balance, Decimal("980.00"))  # credited once
        self.assertEqual(
            BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id)).count(), 1
        )

    def test_null_owner_seeded_property_does_not_crash_and_credits_no_one(self, _m):
        # A seeded property (submitted_by=None) sells fine; nobody is credited.
        prop = Property(**_valid_property_kwargs(slug="seeded-sale", total_value=Decimal("5000000")))
        prop.save()
        self.assertIsNone(prop.submitted_by_id)
        meta, _ = TokenMetadata.objects.get_or_create(property=prop)
        meta.deployed_contract_address = "0x" + "11" * 20
        meta.deployment_chain_id = 97
        meta.save()
        buyer = User.objects.create_user(email="buyer-e3@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 5)
        result = mint_investment(inv)
        self.assertTrue(result["minted"])
        self.assertIsNone(result["owner_credited"])
        self.assertEqual(BalanceTransaction.objects.filter(source="primary_sale").count(), 0)

    def test_no_distribution_rows_written(self, _m):
        # Owner earnings must NOT touch the (separate, mock) distributions domain.
        owner = _approved_owner("earn-owner4@ex.com")
        prop = _owned_deployed_property(owner, slug="owned4")
        buyer = User.objects.create_user(email="buyer-e4@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)
        mint_investment(inv)
        # Only a CREDIT primary_sale entry exists; no DEBIT, no other ledger source.
        self.assertEqual(
            set(BalanceTransaction.objects.values_list("source", flat=True)), {"primary_sale"}
        )


@mock.patch("apps.investments.services.chain_service.mint", return_value=_FAKE_MINT)
class OwnerEarningsApiTests(APITestCase):
    def test_owner_reads_earnings_balance_and_withdraws(self, _m):
        owner = _approved_owner("earn-api@ex.com")
        prop = _owned_deployed_property(owner, slug="owned-api")
        buyer = User.objects.create_user(email="buyer-api@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)
        mint_investment(inv)

        self.client.force_authenticate(owner)
        # Earnings summary (per property + totals).
        earn = self.client.get("/api/owner/earnings/")
        self.assertEqual(earn.status_code, status.HTTP_200_OK)
        self.assertEqual(earn.data["total_net_proceeds"], 980.0)
        self.assertEqual(earn.data["total_units_sold"], 10)
        self.assertEqual(len(earn.data["properties"]), 1)
        self.assertEqual(earn.data["properties"][0]["net_proceeds"], 980.0)
        self.assertEqual(earn.data["properties"][0]["fees"], 20.0)

        # Balance via the SHARED wallet endpoint (same as investors/LPs).
        bal = self.client.get("/api/wallets/balance/")
        self.assertEqual(bal.data["current_balance"], 980.0)

        # Withdraw via the SHARED withdrawal endpoint → debits the balance.
        wd = self.client.post(
            "/api/wallets/withdrawals/", {"amount": "500", "method": "bank"}, format="json"
        )
        self.assertEqual(wd.status_code, status.HTTP_201_CREATED)
        bal2 = self.client.get("/api/wallets/balance/")
        self.assertEqual(bal2.data["current_balance"], 480.0)

    def test_earnings_owner_scoped(self, _m):
        owner = _approved_owner("earn-scoped@ex.com")
        prop = _owned_deployed_property(owner, slug="owned-scoped")
        buyer = User.objects.create_user(email="buyer-sc@ex.com", password="pw-12345-strong")
        mint_investment(_completed_investment(buyer, prop, 10))
        # A different user sees none of this owner's earnings.
        other = _approved_owner("earn-other@ex.com")
        self.client.force_authenticate(other)
        resp = self.client.get("/api/owner/earnings/")
        self.assertEqual(resp.data["total_net_proceeds"], 0.0)
        self.assertEqual(resp.data["properties"], [])


class AdminReviewActionTests(APITestCase):
    """Exercise the Django admin review surface (intermediate form → publish service)."""

    def setUp(self):
        from django.urls import reverse
        self.changelist = reverse("admin:owner_propertysubmission_changelist")
        self.admin = User.objects.create_superuser(email="admin@ex.com", password="pw-12345-strong")
        self.client.force_login(self.admin)
        _, self.sub = _submitted({"name": "Admin Review Tower"})

    def test_publish_action_renders_form_then_publishes(self):
        from decimal import Decimal as _D

        # Step 1: select the action → intermediate form renders (no publish yet).
        r1 = self.client.post(self.changelist, {
            "action": "approve_and_publish",
            "_selected_action": [str(self.sub.pk)],
        })
        self.assertEqual(r1.status_code, 200)
        self.assertContains(r1, "Investment model")
        self.assertEqual(Property.objects.filter(submitted_by=self.sub.submitter).count(), 0)

        # Step 2: submit the confirm form → publishes a real Property.
        r2 = self.client.post(self.changelist, {
            "action": "approve_and_publish",
            "_selected_action": [str(self.sub.pk)],
            "apply": "1",
            "model": "ready",
            "name_ar": "برج", "image": "https://example.com/h.png",
            "location": "Dubai", "location_ar": "دبي", "description_ar": "وصف",
            "country": "uae", "city": "dubai", "asset_type": "residential",
            "status": "ready", "yield_type": "rental", "risk_level": "low",
            "exit_availability": "both", "total_value": "5000000", "token_price": "100",
            "min_investment": "1000", "expected_yield": "8.5",
        }, follow=True)
        self.assertEqual(r2.status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, SubmissionStatus.APPROVED)
        prop = self.sub.published_property
        self.assertIsNotNone(prop)
        self.assertTrue(prop.is_published)
        self.assertEqual(prop.submitted_by_id, self.sub.submitter_id)
        self.assertEqual(prop.name_ar, "برج")

    def test_reject_action_publishes_nothing(self):
        before = Property.objects.count()
        r = self.client.post(self.changelist, {
            "action": "reject",
            "_selected_action": [str(self.sub.pk)],
            "apply": "1",
            "review_notes": "Insufficient documentation.",
        }, follow=True)
        self.assertEqual(r.status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, SubmissionStatus.REJECTED)
        self.assertEqual(self.sub.review_notes, "Insufficient documentation.")
        self.assertEqual(Property.objects.count(), before)


class SeededPropertyUnaffectedTests(APITestCase):
    def test_existing_property_without_owner_link_still_works(self):
        # A seeded/admin property has submitted_by=NULL and saves/lists fine.
        p = Property(**_valid_seed_kwargs())
        p.full_clean()
        p.save()
        self.assertIsNone(p.submitted_by_id)
        resp = self.client.get("/api/properties/")
        self.assertIn(p.slug, {row["id"] for row in resp.data})


def _valid_seed_kwargs():
    return dict(
        slug="seeded-unaffected", name="Seeded", name_ar="مبذور",
        location="Dubai", location_ar="دبي", country="uae", city="dubai",
        image="https://example.com/i.png", asset_type="residential", model="ready",
        category="ready", status="ready", yield_type="rental", risk_level="low",
        total_value=Decimal("1000000"), token_price=Decimal("100"),
        duration="5 years", duration_ar="5 سنوات", exit_availability="both",
        description="x", description_ar="x", is_published=True,
    )


class SubmissionIsolationTests(APITestCase):
    def test_owner_cannot_see_or_edit_another_submission(self):
        a = _approved_owner("a-sub@example.com")
        self.client.force_authenticate(a)
        sub_id = self.client.post("/api/owner/submissions/", _SUB, format="json").data["id"]

        b = _approved_owner("b-sub@example.com")
        self.client.force_authenticate(b)
        # B doesn't see A's submission in their list.
        lst = self.client.get("/api/owner/submissions/")
        self.assertEqual(len(lst.data), 0)
        # B can't fetch or edit A's submission (404, owner-scoped).
        self.assertEqual(
            self.client.get(f"/api/owner/submissions/{sub_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.patch(f"/api/owner/submissions/{sub_id}/", {"name": "X"},
                              format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        # And the row is untouched.
        self.assertEqual(PropertySubmission.objects.get(pk=sub_id).name, "Marina Tower")
