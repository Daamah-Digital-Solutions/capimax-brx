"""
Owner services — Phase 7 Wave A. The single place owner status / KYB transitions
and the "approve → activate the owner role" side effect live (mirrors
apps/lp/services.py).

`approve_kyb` is the automation hinge: it is called by the shared Sumsub webhook
(owner-business-level GREEN), by `dev_grant_owner_kyb`, and by the admin exception
action — ALL converge here so approval behaves identically regardless of trigger,
and ALWAYS activates the user's owner role (core.permissions.HasActivatedOwner +
the role_status gate).

Owner activation is tied to the existing role/role_status system: when the user's
chosen role is `owner`, KYB approval flips `profile.role_status` to ACTIVE — exactly
how LP KYB activates the LP role. The authoritative owner capability gate reads the
OwnerProfile record (status == approved), since owner verification is a related
entity, not just an auth role.
"""
from __future__ import annotations

import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.models import Profile
from apps.notifications.services import NotificationType, notify

from .models import (
    REQUIRED_SUBMISSION_DOC_TYPES,
    OwnerKYBStatus,
    OwnerProfile,
    OwnerStatus,
    PropertySubmission,
    SubmissionStatus,
)

log = logging.getLogger(__name__)


class MissingRequiredDocuments(Exception):
    """A draft can't be submitted until the required documents are uploaded."""

    def __init__(self, missing):
        self.missing = list(missing)
        super().__init__("Missing required documents: " + ", ".join(self.missing))


def get_or_create_owner(user, *, defaults: dict | None = None) -> tuple[OwnerProfile, bool]:
    """Return (owner, created). Defaults fill required fields for the dev/bootstrap path."""
    base = {"contact_name": "", "email": user.email or ""}
    base.update(defaults or {})
    return OwnerProfile.objects.get_or_create(user=user, defaults=base)


def _activate_owner_role(user) -> None:
    """
    Flip the user's role_status to ACTIVE when their chosen role is `owner` (the
    privileged-role gate, like LP KYB activating the LP role). A user whose primary
    role is something else may still hold an approved owner entity; we don't disturb
    their primary role in that case.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        return
    if profile.role == Profile.Role.OWNER and profile.role_status != Profile.RoleStatus.ACTIVE:
        profile.role_status = Profile.RoleStatus.ACTIVE
        profile.save(update_fields=["role_status", "role_verified_at", "updated_at"])


@transaction.atomic
def approve_kyb(owner: OwnerProfile, *, review_answer: str = "", source: str = "webhook") -> OwnerProfile:
    """
    Approve an owner's KYB (idempotent) → owner approved + KYB approved, and activate
    the user's owner role. `source` is for audit/logging only ("webhook"|"dev"|"admin").
    """
    owner = OwnerProfile.objects.select_for_update().get(pk=owner.pk)
    already = owner.status == OwnerStatus.APPROVED
    owner.mark_approved(review_answer=review_answer)
    owner.save()
    transaction.on_commit(lambda: _activate_owner_role(owner.user))
    if not already:
        log.info("Owner KYB approved (source=%s) for user %s", source, owner.user_id)
        notify(owner.user, NotificationType.KYB_APPROVED, params={"role": "owner"})
    return owner


@transaction.atomic
def reject_kyb(owner: OwnerProfile, *, reason: str = "", review_answer: str = "",
               source: str = "webhook") -> OwnerProfile:
    owner = OwnerProfile.objects.select_for_update().get(pk=owner.pk)
    already = owner.status == OwnerStatus.REJECTED
    owner.mark_rejected(reason=reason, review_answer=review_answer)
    owner.save()
    log.info("Owner KYB rejected (source=%s) for user %s", source, owner.user_id)
    if not already:
        notify(owner.user, NotificationType.KYB_REJECTED, params={"role": "owner"})
    return owner


def submit_kyb(owner: OwnerProfile, *, business_info: dict | None = None) -> OwnerProfile:
    """
    Persist business/KYB fields and advance KYB to `under_review`. Creates the
    OWNER-business-level Sumsub applicant if the provider is configured (inert
    otherwise).
    """
    from apps.kyc import sumsub

    if business_info:
        allowed = {
            "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description",
        }
        for key, value in business_info.items():
            if key in allowed and value not in (None, ""):
                setattr(owner, key, value)

    # Create a Sumsub owner-KYB applicant once, if configured and not already linked.
    if sumsub.is_configured() and not owner.sumsub_applicant_id:
        try:
            owner.sumsub_applicant_id = sumsub.create_applicant(
                owner.user_id, level_name=settings.SUMSUB_OWNER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Could not create Sumsub owner-KYB applicant for user %s", owner.user_id)

    owner.mark_kyb_submitted()
    owner.save()
    return owner


# --------------------------------------------------------------------------- #
# Shared Sumsub webhook routing (the automation hinge for owner KYB).
# --------------------------------------------------------------------------- #
def try_handle_owner_kyb_webhook(info: dict) -> bool:
    """
    Called from the shared Sumsub webhook (apps/kyc/views.py). Returns True iff this
    event belongs to an OWNER (an owner-business-level applicant), in which case it is
    fully handled here; False means "not an owner event — fall through to the next
    handler (LP, then investor KYC)".

    Resolution is by the owner-KYB applicant id (unique per Sumsub applicant), or —
    when the event carries the configured OWNER KYB level name — by the
    externalUserId's owner profile.
    """
    owner = _resolve_owner(info)
    if owner is None:
        return False

    if info.get("type") in ("applicantReviewed", "applicantWorkflowCompleted"):
        answer = info.get("review_answer")
        if answer == "GREEN":
            approve_kyb(owner, review_answer="GREEN", source="webhook")
        elif answer == "RED":
            reject_kyb(owner, reason=info.get("reject_reason", ""), review_answer="RED",
                       source="webhook")
    return True


def _resolve_owner(info: dict) -> OwnerProfile | None:
    applicant_id = info.get("applicant_id")
    if applicant_id:
        owner = OwnerProfile.objects.filter(sumsub_applicant_id=applicant_id).first()
        if owner:
            return owner
    # Fall back to externalUserId, but ONLY when the event is an OWNER-business-level
    # one — otherwise an LP-KYB or investor-KYC event for a user who also has an owner
    # profile would be wrongly claimed here.
    level = (info.get("level_name") or "").strip()
    owner_level = getattr(settings, "SUMSUB_OWNER_KYB_LEVEL_NAME", "")
    if level and owner_level and level == owner_level:
        external = info.get("external_user_id")
        if external:
            return OwnerProfile.objects.filter(user_id=external).first()
    return None


# --------------------------------------------------------------------------- #
# Property submission intake — Phase 7 Wave B.
# --------------------------------------------------------------------------- #
def submit_submission(submission: PropertySubmission) -> PropertySubmission:
    """
    Transition a DRAFT → SUBMITTED. Validates that the required documents (Title Deed,
    Valuation Report, Legal Documents — the form's `required: true` items) are present.
    Idempotent for an already-submitted record (returns it unchanged). Raises
    MissingRequiredDocuments if a required doc is missing. NO Property is created.
    """
    if submission.status != SubmissionStatus.DRAFT:
        # Already submitted/under review — nothing to do (idempotent).
        return submission

    present = set(
        submission.documents.values_list("document_type", flat=True)
    )
    missing = [t for t in REQUIRED_SUBMISSION_DOC_TYPES if t not in present]
    if missing:
        raise MissingRequiredDocuments(missing)

    submission.status = SubmissionStatus.SUBMITTED
    submission.submitted_at = timezone.now()
    submission.save(update_fields=["status", "submitted_at", "updated_at"])
    log.info("Property submission %s submitted by user %s", submission.id, submission.submitter_id)
    return submission


# --------------------------------------------------------------------------- #
# Review → publish pipeline — Phase 7 Wave C.
#
# ADMIN-reviewed (not automation): a human reviews each submission, ASSIGNS the
# investment model (the owner never picked one), and on approval materializes a real,
# published Property in the catalog the investor marketplace reads. The investor
# marketplace needs NO change — it already reads Property where is_published=True.
# --------------------------------------------------------------------------- #

# Submission form value → Property enum mappings (the form's options vs the catalog
# enums in apps/properties/models.py).
_ASSET_TYPE_MAP = {
    "residential": "residential", "commercial": "commercial", "mixed": "mixed",
    "industrial": "industrial", "land": "land",
}
_STATUS_MAP = {
    "ready": "ready", "under-construction": "construction", "off-plan": "construction",
}
# The submission form offers USA/UK/EG which the GCC-only Property.Country enum does not
# carry; the admin picks/overrides the country during review. UAE/SA map cleanly.
_COUNTRY_MAP = {"UAE": "uae", "SA": "ksa"}

# A neutral placeholder image so a one-click publish yields a valid (URLField) Property;
# the admin overrides it with the real hero image during review.
_PLACEHOLDER_IMAGE = "https://placehold.co/800x600?text=Property"


class SubmissionNotReviewable(Exception):
    """The submission isn't in a state that can be published/rejected."""


def _unique_slug(name: str) -> str:
    """A unique Property slug from the submission name + a short uuid suffix."""
    from django.utils.text import slugify

    from apps.properties.models import Property

    base = slugify(name)[:48] or "property"
    slug = f"{base}-{uuid.uuid4().hex[:6]}"
    # Vanishingly unlikely to collide, but guarantee uniqueness.
    while Property.objects.filter(slug=slug).exists():
        slug = f"{base}-{uuid.uuid4().hex[:6]}"
    return slug


def _property_defaults_from(submission: PropertySubmission) -> dict:
    """
    Map the submission fields → Property fields, with safe defaults for the fields the
    6-step form never collected (the admin refines these via `overrides`). NOTE: `model`
    is NOT defaulted here — the admin must assign it (locked decision).
    """
    district = (submission.district or "").strip()
    city = (submission.city or "").strip()
    location = ", ".join([p for p in (district, city) if p]) or city or "—"
    return {
        "name": submission.name or "Untitled property",
        "name_ar": submission.name or "Untitled property",          # admin refines
        "location": location,
        "location_ar": location,                                    # admin refines
        "country": _COUNTRY_MAP.get(submission.country, "uae"),     # admin can override
        "city": city or "—",
        "image": _PLACEHOLDER_IMAGE,                                # admin replaces
        "asset_type": _ASSET_TYPE_MAP.get(submission.property_type, "residential"),
        "status": _STATUS_MAP.get(submission.construction_status, "ready"),
        "yield_type": "rental",                                     # admin can override
        "risk_level": "medium",                                     # admin can override
        "exit_availability": "none",                                # admin can override
        "total_value": submission.property_value_usd or 0,
        "token_price": 100,
        "min_investment": submission.min_investment or 100,
        "expected_yield": submission.expected_yield,
        "duration": f"{submission.duration_years} years" if submission.duration_years else "—",
        "duration_ar": f"{submission.duration_years} سنوات" if submission.duration_years else "—",
        "description": submission.description or "",
        "description_ar": submission.description or "",             # admin refines
    }


@transaction.atomic
def publish_submission(
    submission: PropertySubmission, *, model: str, overrides: dict | None = None,
    nested: dict | None = None, deploy: bool = False, reviewer=None,
) -> PropertySubmission:
    """
    APPROVE a submission → materialize a published Property (admin-reviewed).

    Steps (atomic): map submission→Property fields (+ admin overrides) with the
    admin-assigned `model`; create the Property with **is_published=False FIRST** (never
    the model's default True); full_clean() validates economics (0–100) and auto-derives
    category/token_supply; link owner (submitted_by) + back-link the submission; create
    the per-model nested record when `nested` is given; **then flip is_published=True**;
    optionally deploy the token contract. Idempotent — a submission already linked to a
    Property is returned unchanged (never double-publishes).

    Raises ValidationError (bad economics — surfaced to the admin) or
    SubmissionNotReviewable (wrong state).
    """
    from apps.properties.models import (
        FutureContract,
        InstallmentSchedule,
        OptionContract,
        Property,
        PropertyModelType,
        SharedOwnership,
    )

    submission = PropertySubmission.objects.select_for_update().get(pk=submission.pk)

    # Idempotency: never publish twice.
    if submission.published_property_id:
        return submission
    if submission.status not in (SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW):
        raise SubmissionNotReviewable(
            f"Submission {submission.id} is '{submission.status}'; only a submitted/"
            f"under_review submission can be published."
        )
    if model not in PropertyModelType.values:
        raise SubmissionNotReviewable(f"Unknown investment model '{model}'.")

    fields = _property_defaults_from(submission)
    fields.update(overrides or {})
    fields["model"] = model
    fields["slug"] = fields.get("slug") or _unique_slug(fields["name"])

    # 1) Create the Property UNPUBLISHED first (never rely on the default True).
    prop = Property(
        is_published=False,
        submitted_by=submission.submitter,
        **fields,
    )
    # Derive category/token_supply from model first so full_clean()'s field validation
    # (which runs BEFORE Model.clean()) sees the populated, required `category`.
    prop._sync_derived()
    prop.full_clean()  # validates economics ranges (0–100); raises on bad data
    prop.save()

    # 2) Create the per-model nested record when the admin supplied its data.
    if nested:
        one_to_one = {
            PropertyModelType.INSTALLMENT: InstallmentSchedule,
            PropertyModelType.FUTURE: FutureContract,
            PropertyModelType.OPTION: OptionContract,
            PropertyModelType.SHARED: SharedOwnership,
        }
        target = one_to_one.get(model)
        if target is not None:
            target.objects.create(property=prop, **nested)

    # 3) Publish.
    prop.is_published = True
    prop.save(update_fields=["is_published", "updated_at"])

    # 4) Optionally deploy the token contract (same path as admin-created properties).
    deploy_result = None
    if deploy:
        from apps.chain import service as chain_service
        deploy_result = chain_service.deploy_property_token(prop)

    # 5) Approve + back-link the submission.
    submission.status = SubmissionStatus.APPROVED
    submission.published_property = prop
    submission.review_notes = (overrides or {}).get("__review_notes__", submission.review_notes)
    submission.reviewed_at = timezone.now()
    submission.save(update_fields=["status", "published_property", "review_notes", "reviewed_at", "updated_at"])

    log.info(
        "Submission %s approved → Property %s (model=%s, deployed=%s) by reviewer %s",
        submission.id, prop.slug, model, bool(deploy_result), getattr(reviewer, "pk", None),
    )
    # Notify the submitter (owner OR developer — submitter-agnostic). The idempotency
    # guard above (already-published → early return) prevents a duplicate.
    notify(
        submission.submitter, NotificationType.SUBMISSION_PUBLISHED,
        params={"property": submission.name, "slug": prop.slug}, action_url="/my-assets",
    )
    return submission


@transaction.atomic
def reject_submission(submission: PropertySubmission, *, review_notes: str = "", reviewer=None) -> PropertySubmission:
    """REJECT a submission → record review_notes; create NO Property. Idempotent-safe."""
    submission = PropertySubmission.objects.select_for_update().get(pk=submission.pk)
    if submission.published_property_id:
        raise SubmissionNotReviewable("A published submission cannot be rejected.")
    if submission.status not in (SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW):
        raise SubmissionNotReviewable(
            f"Submission {submission.id} is '{submission.status}'; only a submitted/"
            f"under_review submission can be rejected."
        )
    submission.status = SubmissionStatus.REJECTED
    submission.review_notes = review_notes or "Rejected during review."
    submission.reviewed_at = timezone.now()
    submission.save(update_fields=["status", "review_notes", "reviewed_at", "updated_at"])
    log.info("Submission %s rejected by reviewer %s", submission.id, getattr(reviewer, "pk", None))
    notify(
        submission.submitter, NotificationType.SUBMISSION_REJECTED,
        params={"property": submission.name}, action_url="/my-assets",
    )
    return submission
