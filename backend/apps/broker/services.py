"""
Broker services — Phase 12 Wave A. The single place broker LICENCE transitions, the
"approve licence → activate the broker role" hinge, and the referral-attribution logic
live. NO MONEY: there is no commission/balance/withdrawal logic in this wave (the
accumulator fields on BrokerProfile are defined but never written here).

`approve_license` is the activation hinge — the sanctioned ADMIN step (mirrors the
owner-publish / partner directory-approval pattern, layered on personal KYC):
  * It REQUIRES the broker's identity to already be verified — `user.kyc.status ==
    'approved'` (the role-agnostic investor UserKYC, raised via the existing webhook
    fallback or dev_grant_kyc). The admin can only approve a licence on a KYC-verified
    broker; otherwise it raises LicenseNotApprovable.
  * On approval it activates the broker role (Profile.role_status → ACTIVE when role ==
    broker) so HasActivatedBroker opens the broker portal (Wave B).

IDENTITY itself is NOT handled here — it rides the shared Sumsub webhook's investor
FALLBACK (apps/kyc). This module deliberately adds NO webhook resolver.
"""
from __future__ import annotations

import logging

from django.db import transaction

from apps.core.models import Profile
from apps.notifications.services import NotificationType, notify

from .models import BrokerProfile, BrokerStatus

log = logging.getLogger(__name__)


class LicenseNotApprovable(Exception):
    """A broker licence can't be approved yet (identity KYC not approved)."""


def get_or_create_broker(user, *, defaults: dict | None = None) -> tuple[BrokerProfile, bool]:
    """Return (broker, created). Defaults fill required fields for the dev/bootstrap path."""
    base = {"contact_name": "", "email": user.email or ""}
    base.update(defaults or {})
    return BrokerProfile.objects.get_or_create(user=user, defaults=base)


def _kyc_approved(user) -> bool:
    """True iff the user's (role-agnostic) identity KYC is approved."""
    kyc = getattr(user, "kyc", None)
    return bool(kyc and kyc.status == "approved")


def _activate_broker_role(user) -> None:
    """
    Flip the user's role_status to ACTIVE when their chosen role is `broker` (the
    privileged-role gate, like owner/partner activation). A user whose primary role is
    something else may still hold an approved broker entity; we don't disturb their
    primary role in that case.
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        return
    if profile.role == Profile.Role.BROKER and profile.role_status != Profile.RoleStatus.ACTIVE:
        profile.role_status = Profile.RoleStatus.ACTIVE
        profile.save(update_fields=["role_status", "role_verified_at", "updated_at"])


def submit_license(broker: BrokerProfile, *, license_info: dict | None = None) -> BrokerProfile:
    """
    Persist licence fields and record submission. Status stays PENDING — the ADMIN
    approves the licence (the hinge). Idempotent; safe to re-submit (e.g. after a reject).
    """
    if license_info:
        allowed = {"license_number", "license_authority", "license_expiry"}
        for key, value in license_info.items():
            if key in allowed and value not in (None, ""):
                setattr(broker, key, value)
    broker.mark_license_submitted()
    broker.save()
    return broker


@transaction.atomic
def approve_license(broker: BrokerProfile, *, admin=None, source: str = "admin") -> BrokerProfile:
    """
    APPROVE a broker's licence → broker approved + broker role ACTIVATED. The ACTIVATION
    HINGE: requires the broker's identity KYC to already be approved (locked decision #3).
    Idempotent. `source` is for audit/logging only ("admin"|"dev").

    Raises LicenseNotApprovable when the broker's UserKYC is not yet approved — the admin
    must wait for identity verification before approving the licence.
    """
    broker = BrokerProfile.objects.select_for_update().get(pk=broker.pk)
    if not _kyc_approved(broker.user):
        raise LicenseNotApprovable(
            "Broker identity KYC is not approved yet; cannot approve the licence. "
            "Identity verification (personal KYC) must complete first."
        )
    already = broker.status == BrokerStatus.APPROVED
    broker.mark_approved()
    broker.save()
    transaction.on_commit(lambda: _activate_broker_role(broker.user))
    if not already:
        log.info("Broker licence approved (source=%s) for user %s", source, broker.user_id)
        notify(broker.user, NotificationType.BROKER_LICENSE_APPROVED, action_url="/broker-dashboard")
    return broker


@transaction.atomic
def reject_license(broker: BrokerProfile, *, admin=None, notes: str = "", source: str = "admin") -> BrokerProfile:
    """REJECT a broker's licence → rejected + notes recorded. Does NOT activate the role."""
    broker = BrokerProfile.objects.select_for_update().get(pk=broker.pk)
    already = broker.status == BrokerStatus.REJECTED
    broker.mark_rejected(notes=notes)
    broker.save()
    log.info("Broker licence rejected (source=%s) for user %s", source, broker.user_id)
    if not already:
        notify(broker.user, NotificationType.BROKER_LICENSE_REJECTED,
               params={"notes": notes or ""}, action_url="/broker-dashboard")
    return broker


# --------------------------------------------------------------------------- #
# Referral attribution — the durable broker↔referred-investor link (set ONCE).
# --------------------------------------------------------------------------- #
def resolve_referral_code(code: str) -> BrokerProfile | None:
    """Resolve a referral code → its broker, or None. Case-insensitive, trimmed."""
    code = (code or "").strip().upper()
    if not code:
        return None
    return BrokerProfile.objects.filter(referral_code=code).first()


def attribute_referral(profile: Profile, code: str) -> BrokerProfile | None:
    """
    Link a (newly-registered) user's profile to the broker behind `code`. SET-ONCE:
      * ignores an unknown code,
      * ignores the broker's OWN code (a user cannot refer themselves),
      * NEVER overwrites an existing link (first broker wins).
    Returns the linked broker, or None if nothing was set. Caller persists nothing else.
    """
    if profile is None:
        return None
    if profile.referred_by_broker_id:  # already linked — first broker wins, never reassign
        return None
    broker = resolve_referral_code(code)
    if broker is None:
        return None
    if broker.user_id == profile.user_id:  # can't refer yourself
        return None
    profile.referred_by_broker = broker
    profile.save(update_fields=["referred_by_broker", "updated_at"])
    log.info("Referral attributed: profile %s → broker %s", profile.pk, broker.pk)
    return broker
