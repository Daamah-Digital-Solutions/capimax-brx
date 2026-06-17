"""
Developer onboarding (KYB) tests — Phase 8 Wave A. Run against Postgres (capimax_brx).

Covers the LOCKED decisions:
  * Apply creates a pending profile; apply is idempotent; GET 404 when none.
  * KYB submit → under_review + persists business info.
  * Shared Sumsub webhook routes developer-business-level (KYB) GREEN → developer
    approved + the developer role activated; RED → rejected; bad/absent signature →
    401 (no state change); resolve-by-level + externalUserId.
  * dev_grant_developer_kyb approves + activates the role; --revoke removes the record;
    refuses to run in production (DEBUG=False).
  * One developer can't see another developer's profile.
  * HasActivatedDeveloper allows an approved developer + denies others.
  * FOUR-WAY no-regression: investor KYC + LP KYB + OWNER KYB are all unaffected and
    never cross-claimed by the developer handler (and vice-versa).
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
from apps.core.permissions import HasActivatedDeveloper

from .models import DeveloperKYBStatus, DeveloperProfile, DeveloperStatus
from .services import get_or_create_developer


def _mk_user(email="dev@example.com", *, role=Profile.Role.DEVELOPER):
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    # The signal creates the profile as investor/active; set the developer role parked
    # at pending_verification to exercise the activation hinge.
    profile = user.profile
    profile.role = role
    if role in (Profile.Role.DEVELOPER,):
        profile.role_status = Profile.RoleStatus.PENDING_VERIFICATION
        profile.role_verified_at = None
    profile.save()
    return user


_APPLY = {
    "company_name": "BuildCo Developments",
    "contact_name": "Omar Hassan",
    "email": "omar@buildco.com",
    "phone": "+971500000001",
    "country": "UAE",
}
_KYB = {
    "business_type": "llc",
    "business_registration_number": "REG-DEV-1",
    "tax_id": "TAX-9",
    "business_address": "2 Business Bay, Dubai",
    "business_description": "Under-construction developments",
}


# --------------------------------------------------------------------------- #
# Apply + profile
# --------------------------------------------------------------------------- #
class DeveloperApplyTests(APITestCase):
    def test_get_profile_404_when_none(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.get("/api/developer/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_apply_creates_pending_profile(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/developer/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], DeveloperStatus.PENDING)
        self.assertEqual(resp.data["kyb_status"], DeveloperKYBStatus.NOT_STARTED)
        self.assertTrue(DeveloperProfile.objects.filter(user=user).exists())

    def test_apply_is_idempotent(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        self.client.post("/api/developer/profile/", _APPLY, format="json")
        resp = self.client.post("/api/developer/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(DeveloperProfile.objects.filter(user=user).count(), 1)

    def test_developer_cannot_see_another_developers_profile(self):
        a = _mk_user("a-dev@example.com")
        self.client.force_authenticate(a)
        self.client.post("/api/developer/profile/", _APPLY, format="json")
        # A different developer sees their own (none) — 404, never A's row.
        b = _mk_user("b-dev@example.com")
        self.client.force_authenticate(b)
        resp = self.client.get("/api/developer/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# KYB submit
# --------------------------------------------------------------------------- #
class DeveloperKYBSubmitTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)
        self.client.post("/api/developer/profile/", _APPLY, format="json")

    def test_kyb_submit_moves_under_review(self):
        resp = self.client.post("/api/developer/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["kyb_status"], DeveloperKYBStatus.UNDER_REVIEW)
        self.assertEqual(resp.data["business_type"], "llc")
        self.assertIsNotNone(resp.data["kyb_submitted_at"])

    def test_kyb_submit_requires_profile(self):
        other = _mk_user("nodev@example.com")
        self.client.force_authenticate(other)
        resp = self.client.post("/api/developer/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# The shared Sumsub webhook (the automation hinge for developer KYB) — FOUR-WAY.
# --------------------------------------------------------------------------- #
_WEBHOOK_SECRET = "test-webhook-secret"
_DEV_LEVEL = "developer-kyb-level"
_OWNER_LEVEL = "owner-kyb-level"
_LP_LEVEL = "basic-kyb-level"
_KYC_LEVEL = "basic-kyc-level"


def _sign(raw: bytes) -> str:
    return hmac.new(_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


@override_settings(
    SUMSUB_WEBHOOK_SECRET=_WEBHOOK_SECRET,
    SUMSUB_DEVELOPER_KYB_LEVEL_NAME=_DEV_LEVEL,
    SUMSUB_OWNER_KYB_LEVEL_NAME=_OWNER_LEVEL,
    SUMSUB_KYB_LEVEL_NAME=_LP_LEVEL,
)
class DeveloperWebhookTests(APITestCase):
    url = "/api/kyc/webhook/sumsub/"

    def _post(self, payload: dict, *, sign=True, bad=False):
        raw = json.dumps(payload).encode()
        headers = {}
        if sign:
            headers["HTTP_X_PAYLOAD_DIGEST"] = "deadbeef" if bad else _sign(raw)
        return self.client.post(self.url, data=raw, content_type="application/json", **headers)

    def test_developer_green_approves_and_activates_role(self):
        user = _mk_user("green-dev@example.com")
        developer, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        developer.sumsub_applicant_id = "dev-appl-1"
        developer.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "dev-appl-1",
            "levelName": _DEV_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "developer")
        developer.refresh_from_db()
        self.assertEqual(developer.status, DeveloperStatus.APPROVED)
        self.assertEqual(developer.kyb_status, DeveloperKYBStatus.APPROVED)
        # role activated
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    def test_developer_green_resolves_by_level_and_external_id(self):
        # No applicant id on the developer record — resolve by developer level + extId.
        user = _mk_user("level-dev@example.com")
        developer, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "unknown-appl",
            "levelName": _DEV_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        developer.refresh_from_db()
        self.assertEqual(developer.status, DeveloperStatus.APPROVED)

    def test_developer_red_rejects(self):
        user = _mk_user("red-dev@example.com")
        developer, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        developer.sumsub_applicant_id = "dev-appl-2"
        developer.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "dev-appl-2",
            "levelName": _DEV_LEVEL,
            "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]},
        }
        resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        developer.refresh_from_db()
        self.assertEqual(developer.status, DeveloperStatus.REJECTED)
        self.assertIn("FORGERY", developer.kyb_rejection_reason)

    def test_bad_signature_rejected_no_state_change(self):
        user = _mk_user("badsig-dev@example.com")
        developer, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        developer.sumsub_applicant_id = "dev-appl-3"
        developer.save()
        payload = {
            "type": "applicantReviewed",
            "applicantId": "dev-appl-3",
            "levelName": _DEV_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        resp = self._post(payload, bad=True)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        developer.refresh_from_db()
        self.assertEqual(developer.status, DeveloperStatus.PENDING)

    # ----- FOUR-WAY cross-claim isolation -------------------------------------- #
    def test_owner_kyb_event_not_claimed_by_developer(self):
        # An OWNER-business event for a user who ALSO has a developer profile must NOT
        # be claimed by the developer handler (level name differs) — it routes to owner.
        from apps.owner.models import OwnerStatus
        from apps.owner.services import get_or_create_owner

        user = _mk_user("dev-and-owner@example.com", role=Profile.Role.OWNER)
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.sumsub_applicant_id = "own-appl-z"
        owner.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "own-appl-z",
            "levelName": _OWNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "owner")
        # developer untouched
        developer = DeveloperProfile.objects.get(user=user)
        self.assertEqual(developer.status, DeveloperStatus.PENDING)
        owner.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.APPROVED)

    def test_lp_kyb_event_not_claimed_by_developer(self):
        from apps.lp.models import LPStatus
        from apps.lp.services import get_or_create_lp

        user = _mk_user("dev-and-lp@example.com", role=Profile.Role.LP)
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "S", "email": user.email})
        lp.sumsub_applicant_id = "lp-appl-z"
        lp.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "lp-appl-z",
            "levelName": _LP_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "lp")
        developer = DeveloperProfile.objects.get(user=user)
        self.assertEqual(developer.status, DeveloperStatus.PENDING)
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.APPROVED)

    def test_investor_kyc_not_claimed_by_developer(self):
        from apps.kyc.services import get_or_create_kyc

        user = _mk_user("dev-and-kyc@example.com", role=Profile.Role.INVESTOR)
        # user also has a developer profile, but an investor-KYC event must not be claimed
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        kyc = get_or_create_kyc(user)
        kyc.sumsub_applicant_id = "kyc-appl-z"
        kyc.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "kyc-appl-z",
            "levelName": _KYC_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn(resp.data.get("domain"), ("developer", "owner", "lp"))
        developer = DeveloperProfile.objects.get(user=user)
        self.assertEqual(developer.status, DeveloperStatus.PENDING)
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, "approved")

    def test_developer_event_does_not_touch_owner_or_lp(self):
        # The inverse: a developer GREEN must approve ONLY the developer, even when the
        # same user holds owner + LP profiles too.
        from apps.lp.models import LPStatus
        from apps.lp.services import get_or_create_lp
        from apps.owner.models import OwnerStatus
        from apps.owner.services import get_or_create_owner

        user = _mk_user("triple@example.com", role=Profile.Role.DEVELOPER)
        developer, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        developer.sumsub_applicant_id = "dev-only-appl"
        developer.save()
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "S", "email": user.email})
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "dev-only-appl",
            "levelName": _DEV_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.data.get("domain"), "developer")
        owner.refresh_from_db()
        lp.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.PENDING)
        self.assertEqual(lp.status, LPStatus.PENDING)


# --------------------------------------------------------------------------- #
# dev_grant_developer_kyb
# --------------------------------------------------------------------------- #
class DevGrantDeveloperKYBTests(APITestCase):
    @override_settings(DEBUG=True)
    def test_dev_grant_approves_and_activates_role(self):
        user = _mk_user("dev-grant@example.com")
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        with self.captureOnCommitCallbacks(execute=True):
            call_command("dev_grant_developer_kyb", "--email", user.email, stdout=StringIO())
        developer = DeveloperProfile.objects.get(user=user)
        self.assertEqual(developer.status, DeveloperStatus.APPROVED)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    @override_settings(DEBUG=True)
    def test_dev_grant_revoke_removes_record(self):
        user = _mk_user("dev-grant2@example.com")
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        call_command("dev_grant_developer_kyb", "--email", user.email, "--revoke", stdout=StringIO())
        self.assertFalse(DeveloperProfile.objects.filter(user=user).exists())

    @override_settings(DEBUG=False)
    def test_dev_grant_refuses_in_production(self):
        _mk_user("prod-dev@example.com")
        with self.assertRaises(Exception):
            call_command("dev_grant_developer_kyb", "--email", "prod-dev@example.com", stdout=StringIO())


# --------------------------------------------------------------------------- #
# HasActivatedDeveloper gate (proves the next wave's submission gate works)
# --------------------------------------------------------------------------- #
class _GatedView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedDeveloper]

    def get(self, request):
        return Response({"ok": True})


class HasActivatedDeveloperTests(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = _GatedView.as_view()

    def _call(self, user):
        request = self.factory.get("/gated/")
        force_authenticate(request, user=user)
        return self.view(request)

    def test_allows_approved_developer(self):
        user = _mk_user("gate-ok-dev@example.com")
        developer, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        developer.status = DeveloperStatus.APPROVED
        developer.save()
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_denies_pending_developer(self):
        user = _mk_user("gate-pending-dev@example.com")
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_denies_user_without_developer_profile(self):
        user = _mk_user("gate-none-dev@example.com", role=Profile.Role.INVESTOR)
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# --------------------------------------------------------------------------- #
# KYB access-token degrade
# --------------------------------------------------------------------------- #
class DeveloperKYBAccessTokenTests(APITestCase):
    @override_settings(SUMSUB_APP_TOKEN="", SUMSUB_SECRET_KEY="")
    def test_access_token_503_when_unconfigured(self):
        user = _mk_user("token-dev@example.com")
        self.client.force_authenticate(user)
        get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        resp = self.client.post("/api/developer/kyb/access-token/")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "kyb_provider_unconfigured")


# =========================================================================== #
# DEVELOPER PROPERTY SUBMISSION — Phase 8 Wave B. An APPROVED developer reuses the
# SHARED owner submission machinery (apps/owner: PropertySubmission +
# SubmissionDocument, mounted at /api/owner/submissions/) — the only change is the gate
# now accepts an approved developer OR owner (HasActivatedPropertySubmitter). Intake
# only: NO Property is created/published (that is Wave C). Mirrors the owner's Wave-B
# tests for the developer role + cross-role isolation/no-regression.
# =========================================================================== #
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.developer.services import get_or_create_developer as _gocd
from apps.owner.models import PropertySubmission, SubmissionStatus
from apps.properties.models import Property


def _approved_developer(email="approved-dev@example.com"):
    """A user with role=developer and an APPROVED DeveloperProfile (passes the gate)."""
    user = _mk_user(email)
    dev, _ = _gocd(user, defaults={"contact_name": "S", "email": user.email})
    dev.status = DeveloperStatus.APPROVED
    dev.kyb_status = DeveloperKYBStatus.APPROVED
    dev.save()
    return user


_SUB = {
    "name": "Skyline Tower (Off-Plan)",
    "property_type": "residential",
    "construction_status": "under-construction",
    "description": "An under-construction tower funded in phases.",
    "country": "UAE",
    "city": "dubai",
    "district": "Business Bay",
    "address": "10 Marasi Drive",
    "property_value_usd": "8000000",
    "min_investment": "1000",
    "expected_yield": "12.5",
    "duration_years": 3,
    "distribution_model": "quarterly",
}


def _pdf(name="title.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 fake", content_type="application/pdf")


class DeveloperSubmissionGateTests(APITestCase):
    def test_approved_developer_can_create_draft(self):
        user = _approved_developer()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/owner/submissions/", _SUB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], SubmissionStatus.DRAFT)
        self.assertEqual(resp.data["construction_status"], "under-construction")
        # The submission records the developer as the submitter.
        sub = PropertySubmission.objects.get(pk=resp.data["id"])
        self.assertEqual(sub.submitter_id, user.id)

    def test_pending_developer_denied_403(self):
        user = _mk_user("pending-dev-sub@example.com")  # developer role, pending (not approved)
        _gocd(user, defaults={"contact_name": "S", "email": user.email})
        self.client.force_authenticate(user)
        resp = self.client.post("/api/owner/submissions/", _SUB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_developer_without_profile_denied_403(self):
        user = _mk_user("nodevprofile@example.com", role=Profile.Role.INVESTOR)
        self.client.force_authenticate(user)
        resp = self.client.get("/api/owner/submissions/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_approved_owner_still_works_no_regression(self):
        # Generalizing the gate must NOT break the owner path.
        from apps.owner.models import OwnerKYBStatus, OwnerStatus
        from apps.owner.services import get_or_create_owner

        user = _mk_user("owner-still-works@example.com", role=Profile.Role.OWNER)
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.status = OwnerStatus.APPROVED
        owner.kyb_status = OwnerKYBStatus.APPROVED
        owner.save()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/owner/submissions/", _SUB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class DeveloperSubmissionLifecycleTests(APITestCase):
    def setUp(self):
        self.user = _approved_developer()
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

    def test_submit_succeeds_with_required_docs_no_property_created(self):
        before = Property.objects.count()
        for t in ("title", "valuation", "legal"):
            self.assertEqual(self._upload(t).status_code, status.HTTP_201_CREATED)
        resp = self.client.post(f"/api/owner/submissions/{self.sub_id}/submit/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], SubmissionStatus.SUBMITTED)
        self.assertIsNotNone(resp.data["submitted_at"])
        # Intake only — Wave B must NOT touch the catalog (Wave C publishes).
        self.assertEqual(Property.objects.count(), before)

    def test_developer_sees_only_own_submission_in_list(self):
        lst = self.client.get("/api/owner/submissions/")
        self.assertEqual(len(lst.data), 1)
        self.assertEqual(lst.data[0]["id"], self.sub_id)


class DeveloperOwnerCrossIsolationTests(APITestCase):
    def test_developer_cannot_see_owner_submission_and_vice_versa(self):
        from apps.owner.models import OwnerKYBStatus, OwnerStatus
        from apps.owner.services import get_or_create_owner

        # An approved OWNER creates a submission.
        owner_user = _mk_user("iso-owner@example.com", role=Profile.Role.OWNER)
        owner, _ = get_or_create_owner(owner_user, defaults={"contact_name": "S", "email": owner_user.email})
        owner.status = OwnerStatus.APPROVED
        owner.kyb_status = OwnerKYBStatus.APPROVED
        owner.save()
        self.client.force_authenticate(owner_user)
        owner_sub_id = self.client.post("/api/owner/submissions/", _SUB, format="json").data["id"]

        # An approved DEVELOPER creates their own.
        dev_user = _approved_developer("iso-dev@example.com")
        self.client.force_authenticate(dev_user)
        dev_sub_id = self.client.post("/api/owner/submissions/", _SUB, format="json").data["id"]

        # The developer's list contains only their own; can't fetch the owner's (404).
        lst = self.client.get("/api/owner/submissions/")
        ids = {row["id"] for row in lst.data}
        self.assertEqual(ids, {dev_sub_id})
        self.assertEqual(
            self.client.get(f"/api/owner/submissions/{owner_sub_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

        # And the owner can't fetch the developer's submission either.
        self.client.force_authenticate(owner_user)
        self.assertEqual(
            self.client.get(f"/api/owner/submissions/{dev_sub_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )


# =========================================================================== #
# DEVELOPER REVIEW→PUBLISH + EARNINGS — Phase 8 Wave C+D (VERIFICATION). The owner
# publish pipeline (apps/owner.services.publish_submission) + the primary-sale credit
# (apps/investments.services._credit_owner_for_primary_sale) + the earnings read
# (OwnerEarningsView) are ALL submitter-agnostic — they read `submission.submitter` /
# `Property.submitted_by` generically (no `owner_profile` read, no behaviour-gating
# "owner" label). These tests PROVE a developer submitter works through publish +
# earnings with NO developer-specific code. Chain is MOCKED so the suite stays
# network-free; the REAL on-chain proof is the separate testnet run.
# =========================================================================== #
from decimal import Decimal
from unittest import mock

from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import mint_investment
from apps.owner.services import publish_submission, reject_submission
from apps.properties.models import InstallmentSchedule, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction, UserBalance
from apps.wallets.services import get_or_create_custodial_wallet

_FAKE_MINT = {"tx_hash": "0x" + "ef" * 32, "block_number": 777, "chain_id": 97}


def _developer_submitted(dev_user, **overrides):
    """A SUBMITTED PropertySubmission whose submitter is a developer (ready to review)."""
    data = dict(_SUB)
    data.update(overrides)
    return PropertySubmission.objects.create(
        submitter=dev_user, status=SubmissionStatus.SUBMITTED, **data
    )


class DeveloperPublishPipelineTests(APITestCase):
    def test_publish_developer_uc_submission_links_developer(self):
        dev = _approved_developer("pub-dev@example.com")
        sub = _developer_submitted(dev, name="Dev UC Tower", construction_status="under-construction")
        before = Property.objects.count()
        nested = {
            "total_installments": 24, "monthly_amount": Decimal("1000"),
            "next_payment_date": "2026-09-01", "activation_date": "2026-08-01",
        }
        result = publish_submission(sub, model="installment", nested=nested)
        self.assertEqual(Property.objects.count(), before + 1)
        prop = result.published_property
        self.assertTrue(prop.is_published)                 # ends published (False→True)
        self.assertEqual(prop.submitted_by_id, dev.id)     # the DEVELOPER is linked
        self.assertEqual(prop.model, "installment")
        self.assertEqual(prop.category, "construction")     # auto-derived from the UC model
        self.assertTrue(InstallmentSchedule.objects.filter(property=prop).exists())
        self.assertEqual(result.status, SubmissionStatus.APPROVED)

    def test_published_developer_property_in_marketplace(self):
        dev = _approved_developer("pub-dev2@example.com")
        sub = _developer_submitted(dev, name="Dev Marketplace")
        # Before publish: not in the public catalog.
        slugs_before = {p["id"] for p in self.client.get("/api/properties/").data}
        result = publish_submission(sub, model="phasing")
        slug = result.published_property.slug
        self.assertNotIn(slug, slugs_before)
        # After publish: present (is_published=True; AllowAny marketplace read, NO change).
        self.assertIn(slug, {p["id"] for p in self.client.get("/api/properties/").data})

    def test_developer_sees_approved_state_and_slug(self):
        dev = _approved_developer("states-dev@example.com")
        sub = _developer_submitted(dev, name="Dev Approved")
        publish_submission(sub, model="phasing")
        self.client.force_authenticate(dev)
        resp = self.client.get(f"/api/owner/submissions/{sub.id}/")
        self.assertEqual(resp.data["status"], "approved")
        self.assertIsNotNone(resp.data["published_property_slug"])

    def test_developer_sees_rejected_state_and_notes(self):
        dev = _approved_developer("rej-dev@example.com")
        sub = _developer_submitted(dev, name="Dev Rejected")
        before = Property.objects.count()
        reject_submission(sub, review_notes="Needs more documentation.")
        self.assertEqual(Property.objects.count(), before)  # no Property on reject
        self.client.force_authenticate(dev)
        resp = self.client.get(f"/api/owner/submissions/{sub.id}/")
        self.assertEqual(resp.data["status"], "rejected")
        self.assertEqual(resp.data["review_notes"], "Needs more documentation.")


def _developer_owned_deployed_property(dev, *, slug="dev-owned1", total_value=Decimal("5000000"),
                                       fee_platform=Decimal("1.5"), fee_management=Decimal("0.5")):
    """A published, on-chain-deployed Property linked to `dev` (submitted_by)."""
    p = Property(**_valid_property_kwargs(
        slug=slug, total_value=total_value, fee_platform=fee_platform, fee_management=fee_management,
    ))
    p.submitted_by = dev
    p.save()  # token_supply auto-derives = 50000
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "22" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _completed_investment(buyer, prop, token_amount):
    """An investor with a custodial wallet + a COMPLETED (not-yet-minted) investment."""
    wallet, _ = get_or_create_custodial_wallet(buyer)
    return Investment.objects.create(
        user=buyer, property=prop, property_name=prop.name,
        amount_invested=Decimal(token_amount) * prop.token_price, token_amount=token_amount,
        token_symbol="BRX1", price_per_token=prop.token_price,
        ownership_percentage=Decimal("0.1"), payment_method="card",
        payment_status=PaymentStatus.COMPLETED, wallet=wallet,
    )


@mock.patch("apps.investments.services.chain_service.mint", return_value=_FAKE_MINT)
class DeveloperEarningsTests(APITestCase):
    def test_primary_sale_credits_developer_net_of_fees(self, _m):
        dev = _approved_developer("earn-dev@example.com")
        prop = _developer_owned_deployed_property(dev)  # fees 1.5% + 0.5% = 2%
        buyer = User.objects.create_user(email="buyer-d@example.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)  # gross = 10 * 100 = 1000
        result = mint_investment(inv)
        self.assertTrue(result["minted"])
        self.assertEqual(result["owner_credited"], "980.00")  # 1000 − 2% = 980 → DEVELOPER
        self.assertEqual(UserBalance.objects.get(user=dev).current_balance, Decimal("980.00"))
        entries = BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id))
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.first().entry_type, "credit")

    def test_credit_is_idempotent_on_replay(self, _m):
        dev = _approved_developer("earn-dev2@example.com")
        prop = _developer_owned_deployed_property(dev, slug="dev-owned2")
        buyer = User.objects.create_user(email="buyer-d2@example.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)
        mint_investment(inv)
        again = mint_investment(inv)  # replay → short-circuits
        self.assertTrue(again.get("already"))
        self.assertEqual(UserBalance.objects.get(user=dev).current_balance, Decimal("980.00"))
        self.assertEqual(
            BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id)).count(), 1
        )

    def test_developer_reads_earnings_balance_and_withdraws(self, _m):
        dev = _approved_developer("earn-dev3@example.com")
        prop = _developer_owned_deployed_property(dev, slug="dev-owned3")
        buyer = User.objects.create_user(email="buyer-d3@example.com", password="pw-12345-strong")
        mint_investment(_completed_investment(buyer, prop, 10))

        self.client.force_authenticate(dev)
        # Earnings summary (the owner endpoint reads submitted_by generically).
        earn = self.client.get("/api/owner/earnings/")
        self.assertEqual(earn.status_code, status.HTTP_200_OK)
        self.assertEqual(earn.data["total_net_proceeds"], 980.0)
        self.assertEqual(earn.data["total_units_sold"], 10)
        self.assertEqual(len(earn.data["properties"]), 1)
        self.assertEqual(earn.data["properties"][0]["net_proceeds"], 980.0)
        # Balance + withdraw via the SHARED wallet stack (same as owner/investor/LP).
        self.assertEqual(self.client.get("/api/wallets/balance/").data["current_balance"], 980.0)
        wd = self.client.post(
            "/api/wallets/withdrawals/", {"amount": "500", "method": "bank"}, format="json"
        )
        self.assertEqual(wd.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.get("/api/wallets/balance/").data["current_balance"], 480.0)

    def test_earnings_developer_scoped(self, _m):
        dev = _approved_developer("earn-dev4@example.com")
        prop = _developer_owned_deployed_property(dev, slug="dev-owned4")
        buyer = User.objects.create_user(email="buyer-d4@example.com", password="pw-12345-strong")
        mint_investment(_completed_investment(buyer, prop, 10))
        # A different developer sees none of this developer's earnings.
        other = _approved_developer("earn-other-dev@example.com")
        self.client.force_authenticate(other)
        resp = self.client.get("/api/owner/earnings/")
        self.assertEqual(resp.data["total_net_proceeds"], 0.0)
        self.assertEqual(resp.data["properties"], [])
