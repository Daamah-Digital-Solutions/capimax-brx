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


# --------------------------------------------------------------------------- #
# Commission ledger (read) — Phase 12 Wave B. Derived from the broker's
# `broker_commission` BalanceTransactions (the source of truth) + the broker's referred
# investors. Shaped to BrokerDashboard/Referrals/Commissions. NO money is moved here.
# --------------------------------------------------------------------------- #
def commission_ledger(broker) -> dict:
    """
    Build the broker's commission view: stats (totals + referral conversion) + the
    per-investment commission rows + the referred-investor list. Read-only; computed from
    the ledger so it can never drift from the credited balance.
    """
    from decimal import Decimal

    from django.utils import timezone

    from apps.core.models import Profile
    from apps.investments.models import Investment, PaymentStatus
    from apps.investments.services import BROKER_COMMISSION_SOURCE
    from apps.wallets.models import BalanceTransaction

    # The broker's commission ledger entries (one per referred completed sale).
    txs = list(
        BalanceTransaction.objects.filter(
            balance__user=broker.user, source=BROKER_COMMISSION_SOURCE
        ).order_by("-created_at")
    )
    # Resolve the referenced investments in one query (property + investor + gross amount).
    inv_ids = [t.reference for t in txs if t.reference]
    inv_map = {
        str(i.id): i
        for i in Investment.objects.filter(id__in=inv_ids).select_related("user")
    }

    now = timezone.now()
    total_commission = Decimal(broker.total_commission_earned or 0)
    this_month = sum(
        (t.amount for t in txs if t.created_at.year == now.year and t.created_at.month == now.month),
        Decimal("0"),
    )

    commissions = []
    commission_by_user = {}  # user_id → Decimal (for the referrals roll-up)
    for t in txs:
        inv = inv_map.get(t.reference)
        investor = inv.user if inv else None
        if investor is not None:
            commission_by_user[investor.id] = (
                commission_by_user.get(investor.id, Decimal("0")) + t.amount
            )
        commissions.append({
            "id": str(t.id),
            "referral": _display_name(investor) if investor else "—",
            "investor_email": getattr(investor, "email", "") if investor else "",
            "property": inv.property_name if inv else "",
            "amount": str(inv.amount_invested) if inv else "0.00",   # the investor's purchase
            "commission": str(t.amount),                              # the broker's commission
            "status": "paid",  # credited to the broker's balance at settlement (immediate)
            "date": t.created_at.date().isoformat(),
        })

    # The referred-investor roster (a referral is "invested" once they have a COMPLETED sale).
    referred = (
        Profile.objects.filter(referred_by_broker=broker).select_related("user")
    )
    referrals = []
    converted = 0
    for prof in referred:
        completed = list(
            Investment.objects.filter(
                user=prof.user, payment_status=PaymentStatus.COMPLETED
            ).order_by("-created_at")
        )
        invested = len(completed) > 0
        if invested:
            converted += 1
        total_invested = sum((i.amount_invested for i in completed), Decimal("0"))
        last_property = completed[0].property_name if completed else ""
        last_date = (
            (completed[0].created_at if completed else prof.created_at).date().isoformat()
        )
        referrals.append({
            "id": str(prof.user_id),
            "name": _display_name(prof.user),
            "email": prof.user.email,
            "status": "invested" if invested else "registered",
            "property": last_property,
            "amount": str(total_invested),
            "commission": str(commission_by_user.get(prof.user_id, Decimal("0"))),
            "date": last_date,
        })

    total_referrals = len(referrals)
    conversion_rate = int(round(converted / total_referrals * 100)) if total_referrals else 0

    return {
        "stats": {
            "total_referrals": total_referrals,
            "converted_referrals": converted,
            "conversion_rate": conversion_rate,
            "total_commission": str(total_commission),
            "pending_commission": "0.00",  # commission credits immediately at settlement
            "this_month_commission": str(this_month),
        },
        "referrals": referrals,
        "commissions": commissions,
    }


def _display_name(user) -> str:
    """A referred investor's display name for the broker's roster (full_name or email)."""
    if user is None:
        return "—"
    profile = getattr(user, "profile", None)
    return (getattr(profile, "full_name", None) or (user.email or "").split("@")[0]) or "Investor"
