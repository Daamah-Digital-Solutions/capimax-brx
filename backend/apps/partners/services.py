"""
Partner services — Phase 11 Wave A. The single place partner KYB transitions, the
"approve → activate the partner role" side effect, AND the separate directory
approve/reject live (mirrors apps/developer/services.py for the KYB half).

`approve_kyb` is the automation hinge: it is called by the shared Sumsub webhook
(partner-business-level GREEN), by `dev_grant_partner_kyb`, and by the admin exception
action — ALL converge here so approval behaves identically regardless of trigger, and
ALWAYS activates the user's partner role (core.permissions.HasActivatedPartner + the
role_status gate).

Directory visibility is a SEPARATE concern: `approve_directory` / `reject_directory`
flip ONLY `directory_status` and never touch the KYB/verification state. A partner can
be KYB-approved but directory-pending, or directory-rejected — the two are independent.

NO MONEY: there is no balance/withdrawal/earnings logic here — partners never earn.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction

from apps.core.models import Profile
from apps.notifications.services import NotificationType, notify

from .models import (
    PartnerDirectoryStatus,
    PartnerKYBStatus,
    PartnerProfile,
    PartnerStatus,
)

log = logging.getLogger(__name__)

# The directory fields the partner is allowed to fill on their own profile (decision #3).
DIRECTORY_FIELDS = (
    "company_name", "company_name_ar", "category", "description", "description_ar",
    "logo_url", "country", "country_ar", "website",
)


def get_or_create_partner(user, *, defaults: dict | None = None) -> tuple[PartnerProfile, bool]:
    """Return (partner, created). Defaults fill required fields for the dev/bootstrap path."""
    base = {"contact_name": "", "email": user.email or ""}
    base.update(defaults or {})
    return PartnerProfile.objects.get_or_create(user=user, defaults=base)


def _activate_partner_role(user) -> None:
    """
    Flip the user's role_status to ACTIVE when their chosen role is `partner` (the
    privileged-role gate, like developer KYB activating the developer role). A user
    whose primary role is something else may still hold an approved partner entity; we
    don't disturb their primary role in that case.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        return
    if profile.role == Profile.Role.PARTNER and profile.role_status != Profile.RoleStatus.ACTIVE:
        profile.role_status = Profile.RoleStatus.ACTIVE
        profile.save(update_fields=["role_status", "role_verified_at", "updated_at"])


@transaction.atomic
def approve_kyb(partner: PartnerProfile, *, review_answer: str = "", source: str = "webhook") -> PartnerProfile:
    """
    Approve a partner's KYB (idempotent) → partner approved + KYB approved, and activate
    the user's partner role. Does NOT touch directory_status (that is a separate admin
    step). `source` is for audit/logging only ("webhook"|"dev"|"admin").
    """
    partner = PartnerProfile.objects.select_for_update().get(pk=partner.pk)
    already = partner.status == PartnerStatus.APPROVED
    partner.mark_approved(review_answer=review_answer)
    partner.save()
    transaction.on_commit(lambda: _activate_partner_role(partner.user))
    if not already:
        log.info("Partner KYB approved (source=%s) for user %s", source, partner.user_id)
        notify(partner.user, NotificationType.KYB_APPROVED, params={"role": "partner"})
    return partner


@transaction.atomic
def reject_kyb(partner: PartnerProfile, *, reason: str = "", review_answer: str = "",
               source: str = "webhook") -> PartnerProfile:
    partner = PartnerProfile.objects.select_for_update().get(pk=partner.pk)
    already = partner.status == PartnerStatus.REJECTED
    partner.mark_rejected(reason=reason, review_answer=review_answer)
    partner.save()
    log.info("Partner KYB rejected (source=%s) for user %s", source, partner.user_id)
    if not already:
        notify(partner.user, NotificationType.KYB_REJECTED, params={"role": "partner"})
    return partner


def submit_kyb(partner: PartnerProfile, *, business_info: dict | None = None) -> PartnerProfile:
    """
    Persist business/KYB fields and advance KYB to `under_review`. Creates the
    PARTNER-business-level Sumsub applicant if the provider is configured (inert
    otherwise). Mirrors developer submit_kyb.
    """
    from apps.kyc import sumsub

    if business_info:
        allowed = {
            "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description",
        }
        for key, value in business_info.items():
            if key in allowed and value not in (None, ""):
                setattr(partner, key, value)

    # Create a Sumsub partner-KYB applicant once, if configured and not already linked.
    if sumsub.is_configured() and not partner.sumsub_applicant_id:
        try:
            partner.sumsub_applicant_id = sumsub.create_applicant(
                partner.user_id, level_name=settings.SUMSUB_PARTNER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Could not create Sumsub partner-KYB applicant for user %s", partner.user_id)

    partner.mark_kyb_submitted()
    partner.save()
    return partner


def update_directory_details(partner: PartnerProfile, *, details: dict) -> PartnerProfile:
    """
    The PARTNER fills/updates their own public-directory fields. Editing the directory
    details does NOT change directory_status — an already-approved listing stays
    approved; admin re-review is a separate action. (We could reset to pending on edit,
    but the locked decision keeps the admin's approve/reject as the only state driver.)
    """
    for key, value in details.items():
        if key in DIRECTORY_FIELDS:
            setattr(partner, key, value if value not in ("",) else None)
    partner.save()
    return partner


# --------------------------------------------------------------------------- #
# Directory approve/reject — the SEPARATE admin visibility step (independent of KYB).
# --------------------------------------------------------------------------- #
def approve_directory(partner: PartnerProfile, *, admin=None) -> PartnerProfile:
    """Admin approves the partner's PUBLIC-directory listing. Independent of KYB."""
    partner = PartnerProfile.objects.select_for_update().get(pk=partner.pk)
    partner.mark_directory_approved()
    partner.save()
    log.info("Partner directory APPROVED for user %s (admin=%s)", partner.user_id,
             getattr(admin, "pk", None))
    return partner


def reject_directory(partner: PartnerProfile, *, admin=None, notes: str = "") -> PartnerProfile:
    """Admin rejects the partner's PUBLIC-directory listing. Independent of KYB."""
    partner = PartnerProfile.objects.select_for_update().get(pk=partner.pk)
    partner.mark_directory_rejected(notes=notes)
    partner.save()
    log.info("Partner directory REJECTED for user %s (admin=%s)", partner.user_id,
             getattr(admin, "pk", None))
    return partner


# --------------------------------------------------------------------------- #
# Shared Sumsub webhook routing (the automation hinge for partner KYB).
# --------------------------------------------------------------------------- #
def try_handle_partner_kyb_webhook(info: dict) -> bool:
    """
    Called from the shared Sumsub webhook (apps/kyc/views.py). Returns True iff this
    event belongs to a PARTNER (a partner-business-level applicant), in which case it is
    fully handled here; False means "not a partner event — fall through to the next
    handler (developer, then owner, then LP, then investor KYC)".

    Resolution is by the partner-KYB applicant id (unique per Sumsub applicant), or —
    when the event carries the configured PARTNER KYB level name — by the
    externalUserId's partner profile.
    """
    partner = _resolve_partner(info)
    if partner is None:
        return False

    if info.get("type") in ("applicantReviewed", "applicantWorkflowCompleted"):
        answer = info.get("review_answer")
        if answer == "GREEN":
            approve_kyb(partner, review_answer="GREEN", source="webhook")
        elif answer == "RED":
            reject_kyb(partner, reason=info.get("reject_reason", ""), review_answer="RED",
                       source="webhook")
    return True


def _resolve_partner(info: dict) -> PartnerProfile | None:
    applicant_id = info.get("applicant_id")
    if applicant_id:
        partner = PartnerProfile.objects.filter(sumsub_applicant_id=applicant_id).first()
        if partner:
            return partner
    # Fall back to externalUserId, but ONLY when the event is a PARTNER-business-level
    # one — otherwise a developer/owner/LP-KYB or investor-KYC event for a user who also
    # has a partner profile would be wrongly claimed here.
    level = (info.get("level_name") or "").strip()
    partner_level = getattr(settings, "SUMSUB_PARTNER_KYB_LEVEL_NAME", "")
    if level and partner_level and level == partner_level:
        external = info.get("external_user_id")
        if external:
            return PartnerProfile.objects.filter(user_id=external).first()
    return None
