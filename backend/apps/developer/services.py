"""
Developer services — Phase 8 Wave A. The single place developer status / KYB
transitions and the "approve → activate the developer role" side effect live (mirrors
apps/owner/services.py).

`approve_kyb` is the automation hinge: it is called by the shared Sumsub webhook
(developer-business-level GREEN), by `dev_grant_developer_kyb`, and by the admin
exception action — ALL converge here so approval behaves identically regardless of
trigger, and ALWAYS activates the user's developer role (core.permissions.
HasActivatedDeveloper + the role_status gate).

Developer activation is tied to the existing role/role_status system: when the user's
chosen role is `developer`, KYB approval flips `profile.role_status` to ACTIVE — exactly
how owner/LP KYB activates their roles. The authoritative developer capability gate
reads the DeveloperProfile record (status == approved), since developer verification is
a related entity, not just an auth role.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction

from apps.core.models import Profile
from apps.notifications.services import NotificationType, notify

from .models import DeveloperKYBStatus, DeveloperProfile, DeveloperStatus

log = logging.getLogger(__name__)


def get_or_create_developer(user, *, defaults: dict | None = None) -> tuple[DeveloperProfile, bool]:
    """Return (developer, created). Defaults fill required fields for the dev/bootstrap path."""
    base = {"contact_name": "", "email": user.email or ""}
    base.update(defaults or {})
    return DeveloperProfile.objects.get_or_create(user=user, defaults=base)


def _activate_developer_role(user) -> None:
    """
    Flip the user's role_status to ACTIVE when their chosen role is `developer` (the
    privileged-role gate, like owner KYB activating the owner role). A user whose
    primary role is something else may still hold an approved developer entity; we
    don't disturb their primary role in that case.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        return
    if profile.role == Profile.Role.DEVELOPER and profile.role_status != Profile.RoleStatus.ACTIVE:
        profile.role_status = Profile.RoleStatus.ACTIVE
        profile.save(update_fields=["role_status", "role_verified_at", "updated_at"])


@transaction.atomic
def approve_kyb(developer: DeveloperProfile, *, review_answer: str = "", source: str = "webhook") -> DeveloperProfile:
    """
    Approve a developer's KYB (idempotent) → developer approved + KYB approved, and
    activate the user's developer role. `source` is for audit/logging only
    ("webhook"|"dev"|"admin").
    """
    developer = DeveloperProfile.objects.select_for_update().get(pk=developer.pk)
    already = developer.status == DeveloperStatus.APPROVED
    developer.mark_approved(review_answer=review_answer)
    developer.save()
    transaction.on_commit(lambda: _activate_developer_role(developer.user))
    if not already:
        log.info("Developer KYB approved (source=%s) for user %s", source, developer.user_id)
        notify(developer.user, NotificationType.KYB_APPROVED, params={"role": "developer"})
    return developer


@transaction.atomic
def reject_kyb(developer: DeveloperProfile, *, reason: str = "", review_answer: str = "",
               source: str = "webhook") -> DeveloperProfile:
    developer = DeveloperProfile.objects.select_for_update().get(pk=developer.pk)
    already = developer.status == DeveloperStatus.REJECTED
    developer.mark_rejected(reason=reason, review_answer=review_answer)
    developer.save()
    log.info("Developer KYB rejected (source=%s) for user %s", source, developer.user_id)
    if not already:
        notify(developer.user, NotificationType.KYB_REJECTED, params={"role": "developer"})
    return developer


def submit_kyb(developer: DeveloperProfile, *, business_info: dict | None = None) -> DeveloperProfile:
    """
    Persist business/KYB fields and advance KYB to `under_review`. Creates the
    DEVELOPER-business-level Sumsub applicant if the provider is configured (inert
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
                setattr(developer, key, value)

    # Create a Sumsub developer-KYB applicant once, if configured and not already linked.
    if sumsub.is_configured() and not developer.sumsub_applicant_id:
        try:
            developer.sumsub_applicant_id = sumsub.create_applicant(
                developer.user_id, level_name=settings.SUMSUB_DEVELOPER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Could not create Sumsub developer-KYB applicant for user %s", developer.user_id)

    developer.mark_kyb_submitted()
    developer.save()
    return developer


def mark_documents_pending(developer: DeveloperProfile) -> None:
    """Move KYB from not_started → documents_pending when the first doc lands.

    Mirrors apps/lp/services.mark_documents_pending.
    """
    if developer.kyb_status == DeveloperKYBStatus.NOT_STARTED:
        developer.kyb_status = DeveloperKYBStatus.DOCUMENTS_PENDING
        developer.save(update_fields=["kyb_status", "updated_at"])


# --------------------------------------------------------------------------- #
# Shared Sumsub webhook routing (the automation hinge for developer KYB).
# --------------------------------------------------------------------------- #
def try_handle_developer_kyb_webhook(info: dict) -> bool:
    """
    Called from the shared Sumsub webhook (apps/kyc/views.py). Returns True iff this
    event belongs to a DEVELOPER (a developer-business-level applicant), in which case
    it is fully handled here; False means "not a developer event — fall through to the
    next handler (owner, then LP, then investor KYC)".

    Resolution is by the developer-KYB applicant id (unique per Sumsub applicant), or —
    when the event carries the configured DEVELOPER KYB level name — by the
    externalUserId's developer profile.
    """
    developer = _resolve_developer(info)
    if developer is None:
        return False

    if info.get("type") in ("applicantReviewed", "applicantWorkflowCompleted"):
        answer = info.get("review_answer")
        if answer == "GREEN":
            approve_kyb(developer, review_answer="GREEN", source="webhook")
        elif answer == "RED":
            reject_kyb(developer, reason=info.get("reject_reason", ""), review_answer="RED",
                       source="webhook")
    return True


def _resolve_developer(info: dict) -> DeveloperProfile | None:
    applicant_id = info.get("applicant_id")
    if applicant_id:
        developer = DeveloperProfile.objects.filter(sumsub_applicant_id=applicant_id).first()
        if developer:
            return developer
    # Fall back to externalUserId, but ONLY when the event is a DEVELOPER-business-level
    # one — otherwise an owner-KYB / LP-KYB / investor-KYC event for a user who also has
    # a developer profile would be wrongly claimed here.
    level = (info.get("level_name") or "").strip()
    developer_level = getattr(settings, "SUMSUB_DEVELOPER_KYB_LEVEL_NAME", "")
    if level and developer_level and level == developer_level:
        external = info.get("external_user_id")
        if external:
            return DeveloperProfile.objects.filter(user_id=external).first()
    return None
