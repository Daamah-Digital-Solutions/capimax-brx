"""
Partner onboarding (KYB) + public directory tests — Phase 11 Wave A. Run against
Postgres (capimax_brx).

Covers the LOCKED decisions:
  * Apply creates a pending profile; partner fills company/directory details; apply is
    idempotent; GET 404 when none.
  * KYB submit → under_review + persists business info.
  * Shared Sumsub webhook routes partner-business-level (KYB) GREEN → partner approved +
    the partner role activated; RED → rejected; bad/absent signature → 401 (no change);
    resolve-by-level + externalUserId.
  * dev_grant_partner_kyb approves + activates the role; --revoke removes it; refuses to
    run in production (DEBUG=False).
  * One partner can't see another partner's profile.
  * HasActivatedPartner allows an approved partner + denies others.
  * FIVE-WAY no-regression: investor KYC + LP/OWNER/DEVELOPER KYB are all unaffected and
    never cross-claimed by the partner handler (and vice-versa).
  * KYB access-token degrades to 503 when Sumsub is unconfigured.
  * DIRECTORY INDEPENDENCE: a KYB-approved partner with directory_status pending does NOT
    appear in the public directory; approve_directory makes them appear; reject keeps
    them out; the public endpoint (AllowAny) returns only directory-approved profiles.
  * NO money model is created for partners.
"""
import hashlib
import hmac
import json
from io import StringIO

from django.apps import apps as django_apps
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, APITestCase, force_authenticate
from rest_framework.views import APIView

from apps.core.models import Profile, User
from apps.core.permissions import HasActivatedPartner

from .models import (
    PartnerDirectoryStatus,
    PartnerKYBStatus,
    PartnerProfile,
    PartnerStatus,
)
from .services import approve_directory, approve_kyb, get_or_create_partner, reject_directory


def _mk_user(email="partner@example.com", *, role=Profile.Role.PARTNER):
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    profile = user.profile
    profile.role = role
    if role in (Profile.Role.PARTNER,):
        profile.role_status = Profile.RoleStatus.PENDING_VERIFICATION
        profile.role_verified_at = None
    profile.save()
    return user


_APPLY = {
    "contact_name": "Sara Nimr",
    "email": "sara@valuco.com",
    "phone": "+971500000009",
    # Directory fields may be supplied at apply time.
    "company_name": "ValuCo Appraisals",
    "company_name_ar": "فاليو كو للتقييم",
    "category": "valuation",
    "description": "Professional valuation services.",
    "description_ar": "خدمات تقييم احترافية.",
    "country": "UAE",
    "country_ar": "الإمارات",
    "website": "https://www.valuco.example.com",
}
_KYB = {
    "business_type": "llc",
    "business_registration_number": "REG-PARTNER-1",
    "tax_id": "TAX-77",
    "business_address": "5 Business Bay, Dubai",
    "business_description": "Valuation vendor",
}


# --------------------------------------------------------------------------- #
# Apply + profile + directory details
# --------------------------------------------------------------------------- #
class PartnerApplyTests(APITestCase):
    def test_get_profile_404_when_none(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.get("/api/partner/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_apply_creates_pending_profile_with_directory_data(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/partner/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], PartnerStatus.PENDING)
        self.assertEqual(resp.data["kyb_status"], PartnerKYBStatus.NOT_STARTED)
        # Directory data persisted; directory_status defaults to pending (NOT public yet).
        self.assertEqual(resp.data["company_name"], "ValuCo Appraisals")
        self.assertEqual(resp.data["category"], "valuation")
        self.assertEqual(resp.data["directory_status"], PartnerDirectoryStatus.PENDING)
        self.assertTrue(PartnerProfile.objects.filter(user=user).exists())

    def test_post_updates_directory_details_when_profile_exists(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        self.client.post("/api/partner/profile/", _APPLY, format="json")
        # A second POST updates directory fields (the partner edits their own listing).
        resp = self.client.post(
            "/api/partner/profile/",
            {"company_name": "ValuCo Global", "website": "https://valuco.global"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["company_name"], "ValuCo Global")
        self.assertEqual(resp.data["website"], "https://valuco.global")
        self.assertEqual(PartnerProfile.objects.filter(user=user).count(), 1)

    def test_partner_cannot_see_another_partners_profile(self):
        a = _mk_user("a-partner@example.com")
        self.client.force_authenticate(a)
        self.client.post("/api/partner/profile/", _APPLY, format="json")
        b = _mk_user("b-partner@example.com")
        self.client.force_authenticate(b)
        resp = self.client.get("/api/partner/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# KYB submit
# --------------------------------------------------------------------------- #
class PartnerKYBSubmitTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)
        self.client.post("/api/partner/profile/", _APPLY, format="json")

    def test_kyb_submit_moves_under_review(self):
        resp = self.client.post("/api/partner/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["kyb_status"], PartnerKYBStatus.UNDER_REVIEW)
        self.assertEqual(resp.data["business_type"], "llc")
        self.assertIsNotNone(resp.data["kyb_submitted_at"])

    def test_kyb_submit_requires_profile(self):
        other = _mk_user("nopartner@example.com")
        self.client.force_authenticate(other)
        resp = self.client.post("/api/partner/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# The shared Sumsub webhook (the automation hinge for partner KYB) — FIVE-WAY.
# --------------------------------------------------------------------------- #
_WEBHOOK_SECRET = "test-webhook-secret"
_PARTNER_LEVEL = "partner-kyb-level"
_DEV_LEVEL = "developer-kyb-level"
_OWNER_LEVEL = "owner-kyb-level"
_LP_LEVEL = "basic-kyb-level"
_KYC_LEVEL = "basic-kyc-level"


def _sign(raw: bytes) -> str:
    return hmac.new(_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


@override_settings(
    SUMSUB_WEBHOOK_SECRET=_WEBHOOK_SECRET,
    SUMSUB_PARTNER_KYB_LEVEL_NAME=_PARTNER_LEVEL,
    SUMSUB_DEVELOPER_KYB_LEVEL_NAME=_DEV_LEVEL,
    SUMSUB_OWNER_KYB_LEVEL_NAME=_OWNER_LEVEL,
    SUMSUB_KYB_LEVEL_NAME=_LP_LEVEL,
)
class PartnerWebhookTests(APITestCase):
    url = "/api/kyc/webhook/sumsub/"

    def _post(self, payload: dict, *, sign=True, bad=False):
        raw = json.dumps(payload).encode()
        headers = {}
        if sign:
            headers["HTTP_X_PAYLOAD_DIGEST"] = "deadbeef" if bad else _sign(raw)
        return self.client.post(self.url, data=raw, content_type="application/json", **headers)

    def test_partner_green_approves_and_activates_role(self):
        user = _mk_user("green-partner@example.com")
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        partner.sumsub_applicant_id = "partner-appl-1"
        partner.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "partner-appl-1",
            "levelName": _PARTNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "partner")
        partner.refresh_from_db()
        self.assertEqual(partner.status, PartnerStatus.APPROVED)
        self.assertEqual(partner.kyb_status, PartnerKYBStatus.APPROVED)
        # KYB approval does NOT publish to the directory.
        self.assertEqual(partner.directory_status, PartnerDirectoryStatus.PENDING)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    def test_partner_green_resolves_by_level_and_external_id(self):
        user = _mk_user("level-partner@example.com")
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "unknown-appl",
            "levelName": _PARTNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        partner.refresh_from_db()
        self.assertEqual(partner.status, PartnerStatus.APPROVED)

    def test_partner_red_rejects(self):
        user = _mk_user("red-partner@example.com")
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        partner.sumsub_applicant_id = "partner-appl-2"
        partner.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "partner-appl-2",
            "levelName": _PARTNER_LEVEL,
            "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]},
        }
        resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        partner.refresh_from_db()
        self.assertEqual(partner.status, PartnerStatus.REJECTED)
        self.assertIn("FORGERY", partner.kyb_rejection_reason)

    def test_bad_signature_rejected_no_state_change(self):
        user = _mk_user("badsig-partner@example.com")
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        partner.sumsub_applicant_id = "partner-appl-3"
        partner.save()
        payload = {
            "type": "applicantReviewed",
            "applicantId": "partner-appl-3",
            "levelName": _PARTNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        resp = self._post(payload, bad=True)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        partner.refresh_from_db()
        self.assertEqual(partner.status, PartnerStatus.PENDING)

    # ----- FIVE-WAY cross-claim isolation -------------------------------------- #
    def test_developer_kyb_event_not_claimed_by_partner(self):
        from apps.developer.models import DeveloperStatus
        from apps.developer.services import get_or_create_developer

        user = _mk_user("partner-and-dev@example.com", role=Profile.Role.DEVELOPER)
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        dev, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        dev.sumsub_applicant_id = "dev-appl-zz"
        dev.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "dev-appl-zz",
            "levelName": _DEV_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.data.get("domain"), "developer")
        partner = PartnerProfile.objects.get(user=user)
        self.assertEqual(partner.status, PartnerStatus.PENDING)
        dev.refresh_from_db()
        self.assertEqual(dev.status, DeveloperStatus.APPROVED)

    def test_owner_kyb_event_not_claimed_by_partner(self):
        from apps.owner.models import OwnerStatus
        from apps.owner.services import get_or_create_owner

        user = _mk_user("partner-and-owner@example.com", role=Profile.Role.OWNER)
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        owner.sumsub_applicant_id = "own-appl-zz"
        owner.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "own-appl-zz",
            "levelName": _OWNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.data.get("domain"), "owner")
        partner = PartnerProfile.objects.get(user=user)
        self.assertEqual(partner.status, PartnerStatus.PENDING)
        owner.refresh_from_db()
        self.assertEqual(owner.status, OwnerStatus.APPROVED)

    def test_lp_kyb_event_not_claimed_by_partner(self):
        from apps.lp.models import LPStatus
        from apps.lp.services import get_or_create_lp

        user = _mk_user("partner-and-lp@example.com", role=Profile.Role.LP)
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "S", "email": user.email})
        lp.sumsub_applicant_id = "lp-appl-zz"
        lp.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "lp-appl-zz",
            "levelName": _LP_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.data.get("domain"), "lp")
        partner = PartnerProfile.objects.get(user=user)
        self.assertEqual(partner.status, PartnerStatus.PENDING)
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.APPROVED)

    def test_investor_kyc_not_claimed_by_partner(self):
        from apps.kyc.services import get_or_create_kyc

        user = _mk_user("partner-and-kyc@example.com", role=Profile.Role.INVESTOR)
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        kyc = get_or_create_kyc(user)
        kyc.sumsub_applicant_id = "kyc-appl-zz"
        kyc.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "kyc-appl-zz",
            "levelName": _KYC_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertNotIn(resp.data.get("domain"), ("partner", "developer", "owner", "lp"))
        partner = PartnerProfile.objects.get(user=user)
        self.assertEqual(partner.status, PartnerStatus.PENDING)
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, "approved")

    def test_partner_event_does_not_touch_other_domains(self):
        # The inverse: a partner GREEN must approve ONLY the partner, even when the same
        # user holds developer + owner + LP profiles too.
        from apps.developer.models import DeveloperStatus
        from apps.developer.services import get_or_create_developer
        from apps.lp.models import LPStatus
        from apps.lp.services import get_or_create_lp
        from apps.owner.models import OwnerStatus
        from apps.owner.services import get_or_create_owner

        user = _mk_user("quad@example.com", role=Profile.Role.PARTNER)
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        partner.sumsub_applicant_id = "partner-only-appl"
        partner.save()
        dev, _ = get_or_create_developer(user, defaults={"contact_name": "S", "email": user.email})
        owner, _ = get_or_create_owner(user, defaults={"contact_name": "S", "email": user.email})
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "S", "email": user.email})
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "partner-only-appl",
            "levelName": _PARTNER_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.data.get("domain"), "partner")
        dev.refresh_from_db()
        owner.refresh_from_db()
        lp.refresh_from_db()
        self.assertEqual(dev.status, DeveloperStatus.PENDING)
        self.assertEqual(owner.status, OwnerStatus.PENDING)
        self.assertEqual(lp.status, LPStatus.PENDING)


# --------------------------------------------------------------------------- #
# dev_grant_partner_kyb
# --------------------------------------------------------------------------- #
class DevGrantPartnerKYBTests(APITestCase):
    @override_settings(DEBUG=True)
    def test_dev_grant_approves_and_activates_role(self):
        user = _mk_user("partner-grant@example.com")
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        with self.captureOnCommitCallbacks(execute=True):
            call_command("dev_grant_partner_kyb", "--email", user.email, stdout=StringIO())
        partner = PartnerProfile.objects.get(user=user)
        self.assertEqual(partner.status, PartnerStatus.APPROVED)
        # Dev grant is KYB only — directory stays pending.
        self.assertEqual(partner.directory_status, PartnerDirectoryStatus.PENDING)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    @override_settings(DEBUG=True)
    def test_dev_grant_revoke_removes_record(self):
        user = _mk_user("partner-grant2@example.com")
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        call_command("dev_grant_partner_kyb", "--email", user.email, "--revoke", stdout=StringIO())
        self.assertFalse(PartnerProfile.objects.filter(user=user).exists())

    @override_settings(DEBUG=False)
    def test_dev_grant_refuses_in_production(self):
        _mk_user("prod-partner@example.com")
        with self.assertRaises(Exception):
            call_command("dev_grant_partner_kyb", "--email", "prod-partner@example.com", stdout=StringIO())


# --------------------------------------------------------------------------- #
# HasActivatedPartner gate
# --------------------------------------------------------------------------- #
class _GatedView(APIView):
    permission_classes = [IsAuthenticated, HasActivatedPartner]

    def get(self, request):
        return Response({"ok": True})


class HasActivatedPartnerTests(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = _GatedView.as_view()

    def _call(self, user):
        request = self.factory.get("/gated/")
        force_authenticate(request, user=user)
        return self.view(request)

    def test_allows_approved_partner(self):
        user = _mk_user("gate-ok-partner@example.com")
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        partner.status = PartnerStatus.APPROVED
        partner.save()
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_denies_pending_partner(self):
        user = _mk_user("gate-pending-partner@example.com")
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_denies_user_without_partner_profile(self):
        user = _mk_user("gate-none-partner@example.com", role=Profile.Role.INVESTOR)
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_directory_approved_alone_does_not_open_kyb_gate(self):
        # A partner who is directory-approved but NOT KYB-approved must still be denied
        # the capability gate — the two states are independent.
        user = _mk_user("gate-dironly@example.com")
        partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        approve_directory(partner)  # directory approved, KYB still pending
        resp = self._call(user)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# --------------------------------------------------------------------------- #
# KYB access-token degrade
# --------------------------------------------------------------------------- #
class PartnerKYBAccessTokenTests(APITestCase):
    @override_settings(SUMSUB_APP_TOKEN="", SUMSUB_SECRET_KEY="")
    def test_access_token_503_when_unconfigured(self):
        user = _mk_user("token-partner@example.com")
        self.client.force_authenticate(user)
        get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
        resp = self.client.post("/api/partner/kyb/access-token/")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "kyb_provider_unconfigured")


# --------------------------------------------------------------------------- #
# Public directory — DIRECTORY INDEPENDENCE (the separate admin approve/reject step)
# --------------------------------------------------------------------------- #
def _full_partner(email, company, *, kyb_approved=True, category="valuation"):
    user = _mk_user(email)
    partner, _ = get_or_create_partner(user, defaults={"contact_name": "S", "email": user.email})
    partner.company_name = company
    partner.company_name_ar = company + " AR"
    partner.category = category
    partner.country = "UAE"
    partner.website = "https://example.com"
    if kyb_approved:
        partner.mark_approved()
    partner.save()
    return user, partner


class PublicDirectoryTests(APITestCase):
    url = "/api/partner/profile/"
    directory = "/api/partners/directory/"

    def test_directory_is_public_allowany(self):
        # No auth required to read the public directory.
        resp = self.client.get(self.directory)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_kyb_approved_but_directory_pending_is_not_listed(self):
        _user, partner = _full_partner("dir1@example.com", "Alpha Valuers")
        self.assertEqual(partner.directory_status, PartnerDirectoryStatus.PENDING)
        names = {row["name"] for row in self.client.get(self.directory).data}
        self.assertNotIn("Alpha Valuers", names)

    def test_approve_directory_makes_partner_appear(self):
        _user, partner = _full_partner("dir2@example.com", "Beta Valuers")
        approve_directory(partner)
        rows = self.client.get(self.directory).data
        names = {row["name"] for row in rows}
        self.assertIn("Beta Valuers", names)
        # Shape check: the public row carries display fields + a verified badge, no PII.
        beta = next(r for r in rows if r["name"] == "Beta Valuers")
        self.assertEqual(beta["category"], "valuation")
        self.assertTrue(beta["verified"])  # KYB-approved
        self.assertNotIn("email", beta)
        self.assertNotIn("contact_name", beta)
        self.assertNotIn("sumsub_applicant_id", beta)

    def test_reject_directory_keeps_partner_out(self):
        _user, partner = _full_partner("dir3@example.com", "Gamma Valuers")
        approve_directory(partner)
        reject_directory(partner, notes="Logo missing")
        names = {row["name"] for row in self.client.get(self.directory).data}
        self.assertNotIn("Gamma Valuers", names)

    def test_directory_approved_without_kyb_appears_but_unverified(self):
        # Directory is independent of KYB: a directory-approved but KYB-pending partner
        # is listed, with verified=False.
        _user, partner = _full_partner("dir4@example.com", "Delta Valuers", kyb_approved=False)
        approve_directory(partner)
        rows = self.client.get(self.directory).data
        delta = next((r for r in rows if r["name"] == "Delta Valuers"), None)
        self.assertIsNotNone(delta)
        self.assertFalse(delta["verified"])

    def test_directory_only_lists_directory_approved(self):
        _user_a, listed = _full_partner("dir5a@example.com", "Listed Co")
        _full_partner("dir5b@example.com", "Hidden Co")
        # Approve only "Listed Co"; "Hidden Co" stays directory-pending.
        approve_directory(listed)
        names = {row["name"] for row in self.client.get(self.directory).data}
        self.assertIn("Listed Co", names)
        self.assertNotIn("Hidden Co", names)


# --------------------------------------------------------------------------- #
# NO money model for partners (decision: partners never earn)
# --------------------------------------------------------------------------- #
class PartnerNoMoneyTests(APITestCase):
    def test_partners_app_defines_no_money_model(self):
        model_names = {m.__name__.lower() for m in django_apps.get_app_config("partners").get_models()}
        for forbidden in ("userbalance", "balance", "withdrawal", "earning", "payout", "wallet"):
            self.assertNotIn(forbidden, model_names)
        # The only model in the partners app is the PartnerProfile.
        self.assertEqual(model_names, {"partnerprofile"})
