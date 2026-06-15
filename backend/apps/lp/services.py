"""
LP services — Phase 6 Wave 1. The single place LP status / KYB transitions and the
"approve → activate the LP role" side effect live (mirrors apps/kyc/services.py).

`approve_kyb` is the automation hinge: it is called by the shared Sumsub webhook
(business-level GREEN), by `dev_grant_kyb`, and by the admin exception action — ALL
converge here so approval behaves identically regardless of trigger, and ALWAYS
activates the user's LP role capabilities (core.permissions.HasActivatedLP).

LP activation is tied to the existing role/role_status system: when the user's
chosen role is `lp`, KYB approval flips `profile.role_status` to ACTIVE — exactly
how investor KYC opened the wallet gate. The authoritative LP capability gate reads
the LiquidityProvider record (status == approved), since LP is a related entity, not
an auth role (SPEC §3.13).
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction

from apps.core.models import Profile

from .models import KYBStatus, LiquidityProvider, LPStatus

log = logging.getLogger(__name__)


def get_or_create_lp(user, *, defaults: dict | None = None) -> tuple[LiquidityProvider, bool]:
    """Return (lp, created). Defaults fill required fields for the dev/bootstrap path."""
    base = {"contact_name": "", "email": user.email or ""}
    base.update(defaults or {})
    return LiquidityProvider.objects.get_or_create(user=user, defaults=base)


def _activate_lp_role(user) -> None:
    """
    Flip the user's role_status to ACTIVE when their chosen role is `lp` (the
    privileged-role gate, like investor KYC activating the wallet). A user whose
    primary role is something else (e.g. investor) may still hold an approved LP
    entity; we don't disturb their primary role in that case.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        return
    if profile.role == Profile.Role.LP and profile.role_status != Profile.RoleStatus.ACTIVE:
        profile.role_status = Profile.RoleStatus.ACTIVE
        profile.save(update_fields=["role_status", "role_verified_at", "updated_at"])


@transaction.atomic
def approve_kyb(lp: LiquidityProvider, *, review_answer: str = "", source: str = "webhook") -> LiquidityProvider:
    """
    Approve an LP's KYB (idempotent) → LP approved + KYB approved, and activate the
    user's LP role. `source` is for audit/logging only ("webhook"|"dev"|"admin").
    """
    lp = LiquidityProvider.objects.select_for_update().get(pk=lp.pk)
    already = lp.status == LPStatus.APPROVED
    lp.mark_approved(review_answer=review_answer)
    lp.save()
    transaction.on_commit(lambda: _activate_lp_role(lp.user))
    if not already:
        log.info("LP KYB approved (source=%s) for user %s", source, lp.user_id)
    return lp


@transaction.atomic
def reject_kyb(lp: LiquidityProvider, *, reason: str = "", review_answer: str = "",
               source: str = "webhook") -> LiquidityProvider:
    lp = LiquidityProvider.objects.select_for_update().get(pk=lp.pk)
    lp.mark_rejected(reason=reason, review_answer=review_answer)
    lp.save()
    log.info("LP KYB rejected (source=%s) for user %s", source, lp.user_id)
    return lp


def submit_kyb(lp: LiquidityProvider, *, business_info: dict | None = None) -> LiquidityProvider:
    """
    Persist business/KYB fields and advance KYB to `under_review`. Creates the
    BUSINESS-level Sumsub applicant if the provider is configured (inert otherwise).
    """
    from apps.kyc import sumsub

    if business_info:
        allowed = {
            "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description", "annual_revenue",
            "source_of_funds",
        }
        for key, value in business_info.items():
            if key in allowed and value not in (None, ""):
                setattr(lp, key, value)

    # Create a Sumsub KYB applicant once, if configured and not already linked.
    if sumsub.is_configured() and not lp.sumsub_applicant_id:
        try:
            lp.sumsub_applicant_id = sumsub.create_applicant(
                lp.user_id, level_name=settings.SUMSUB_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Could not create Sumsub KYB applicant for user %s", lp.user_id)

    lp.mark_kyb_submitted()
    lp.save()
    return lp


def mark_documents_pending(lp: LiquidityProvider) -> None:
    """Move KYB from not_started → documents_pending when the first doc lands."""
    if lp.kyb_status == KYBStatus.NOT_STARTED:
        lp.kyb_status = KYBStatus.DOCUMENTS_PENDING
        lp.save(update_fields=["kyb_status", "updated_at"])


# --------------------------------------------------------------------------- #
# Shared Sumsub webhook routing (the automation hinge for KYB).
# --------------------------------------------------------------------------- #
def try_handle_kyb_webhook(info: dict) -> bool:
    """
    Called from the shared Sumsub webhook (apps/kyc/views.py) BEFORE the investor
    path. Returns True iff this event belongs to an LP (a business-level applicant),
    in which case it is fully handled here; False means "not an LP event — fall
    through to investor KYC".

    Resolution is by the KYB applicant id (unique per Sumsub applicant), or — when
    the event carries the configured KYB level name — by the externalUserId's LP.
    """
    lp = _resolve_lp(info)
    if lp is None:
        return False

    if info.get("type") in ("applicantReviewed", "applicantWorkflowCompleted"):
        answer = info.get("review_answer")
        if answer == "GREEN":
            approve_kyb(lp, review_answer="GREEN", source="webhook")
        elif answer == "RED":
            reject_kyb(lp, reason=info.get("reject_reason", ""), review_answer="RED",
                       source="webhook")
    return True


def _resolve_lp(info: dict) -> LiquidityProvider | None:
    applicant_id = info.get("applicant_id")
    if applicant_id:
        lp = LiquidityProvider.objects.filter(sumsub_applicant_id=applicant_id).first()
        if lp:
            return lp
    # Fall back to externalUserId, but ONLY when the event is a business-level (KYB)
    # one — otherwise an investor-KYC event for a user who also has an LP profile
    # would be wrongly claimed here.
    level = (info.get("level_name") or "").strip()
    kyb_level = getattr(settings, "SUMSUB_KYB_LEVEL_NAME", "")
    if level and kyb_level and level == kyb_level:
        external = info.get("external_user_id")
        if external:
            return LiquidityProvider.objects.filter(user_id=external).first()
    return None
