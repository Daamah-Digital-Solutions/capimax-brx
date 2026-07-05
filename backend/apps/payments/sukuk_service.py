"""
Nova certificate (sukuk) review hinges — the manual, admin-approved payment rail.

The SINGLE place a certificate's status transitions and its settlement side-effect live,
mirroring the KYC approve hinge (apps.kyc.services.approve_kyc): the Django admin
exception-approve / reject actions converge here, so a certificate settles identically
regardless of trigger.

  * approve_certificate → SETTLE the investment via the SHARED investments.settle_investment
    (mark completed + mint), so ownership, owner/broker credit, and the buyer-borne fee land
    EXACTLY like a card/crypto settlement.
  * reject_certificate  → mark the (not-yet-settled) investment FAILED — NEVER mints — and
    notify the buyer with the reason.

Both are idempotent (row-locked; replay is a no-op). An already-APPROVED (settled)
certificate is never downgraded by a later reject (no clawback).
"""
from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from apps.notifications.services import NotificationType, notify

from .models import SukukCertificate

log = logging.getLogger(__name__)


def approve_certificate(cert: SukukCertificate, admin) -> dict:
    """
    Approve a Nova certificate (idempotent) and settle its investment. Returns
    {approved, minted?, already?}. The certificate's status/reviewer are set in one atomic
    block; the settlement (mark completed + mint, which runs its own atomic + network) runs
    AFTER that commit so a slow/failed chain never rolls back the review decision.
    """
    from apps.investments.services import settle_investment

    with transaction.atomic():
        cert = (
            SukukCertificate.objects.select_for_update()
            .select_related("investment")
            .get(pk=cert.pk)
        )
        if cert.status == SukukCertificate.Status.APPROVED:
            return {"approved": True, "already": True}
        cert.status = SukukCertificate.Status.APPROVED
        cert.reviewed_by = admin
        cert.reviewed_at = timezone.now()
        cert.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        investment = cert.investment

    result = settle_investment(investment)
    log.info("Sukuk certificate %s approved → investment %s settled", cert.pk, investment.pk)
    return {
        "approved": True,
        "minted": bool(result.get("minted")),
        "reason": result.get("reason"),
    }


def reject_certificate(cert: SukukCertificate, admin, *, reason: str = "") -> dict:
    """
    Reject a Nova certificate (idempotent): mark it rejected, mark the not-yet-settled
    investment FAILED (never mints), and notify the buyer with the reason. `reason` (when
    given) overwrites `review_notes`; otherwise the admin's already-saved notes are used.
    An already-APPROVED certificate is NOT downgraded (no clawback of a settled buy).
    """
    from apps.investments.models import PaymentStatus

    with transaction.atomic():
        cert = (
            SukukCertificate.objects.select_for_update()
            .select_related("investment", "investment__property")
            .get(pk=cert.pk)
        )
        if cert.status == SukukCertificate.Status.REJECTED:
            return {"rejected": True, "already": True}
        if cert.status == SukukCertificate.Status.APPROVED:
            return {"rejected": False, "already_approved": True}
        cert.status = SukukCertificate.Status.REJECTED
        if reason:
            cert.review_notes = reason[:500]
        cert.reviewed_by = admin
        cert.reviewed_at = timezone.now()
        cert.save(update_fields=[
            "status", "review_notes", "reviewed_by", "reviewed_at", "updated_at",
        ])
        inv = cert.investment
        if inv.payment_status != PaymentStatus.COMPLETED:
            inv.payment_status = PaymentStatus.FAILED
            inv.save(update_fields=["payment_status", "updated_at"])
        prop = inv.property
        notes = cert.review_notes

    notify(
        inv.user, NotificationType.SUKUK_REJECTED,
        params={"property": prop.name, "slug": prop.slug, "reason": notes},
        action_url="/portfolio",
    )
    log.info("Sukuk certificate %s rejected → investment %s failed", cert.pk, inv.pk)
    return {"rejected": True}
