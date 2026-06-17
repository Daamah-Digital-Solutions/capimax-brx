"""
KYC services — Phase 4. The single place KYC status transitions and the
approval → wallet auto-create side effect live (DECISIONS.md "Phase 4" #5/#6).

`approve_kyc` is the automation hinge: it is called by the Sumsub webhook
(GREEN), by `dev_grant_kyc`, by `KYC_AUTO_APPROVE` on submit, and by the admin
exception action — ALL converge here so approval behaves identically regardless of
trigger, and ALWAYS auto-creates the custodial wallet.
"""
from __future__ import annotations

import logging

from django.db import transaction

from apps.notifications.services import NotificationType, notify
from apps.wallets.services import get_or_create_custodial_wallet

from .models import KYCStatus, UserKYC

log = logging.getLogger(__name__)


def get_or_create_kyc(user) -> UserKYC:
    kyc, _created = UserKYC.objects.get_or_create(user=user)
    return kyc


def _auto_create_wallet(user) -> None:
    """
    Auto-create the user's custodial wallet on approval (idempotent). A wallet
    failure (e.g. WALLET_ENCRYPTION_KEY unset) must NOT roll back the approval —
    the wallet can be created later via the Create-Wallet fallback. We log and
    continue; we never leak key material.
    """
    try:
        get_or_create_custodial_wallet(user)
    except Exception:  # noqa: BLE001 - approval must not fail on wallet provisioning
        log.exception("KYC approved but wallet auto-create failed for user %s", user.pk)


@transaction.atomic
def approve_kyc(kyc: UserKYC, *, review_answer: str = "", source: str = "webhook") -> UserKYC:
    """
    Approve a KYC record (idempotent) and AUTO-CREATE the custodial wallet.
    `source` is for audit/logging only ("webhook" | "dev" | "auto" | "admin").
    """
    kyc = UserKYC.objects.select_for_update().get(pk=kyc.pk)
    already = kyc.status == KYCStatus.APPROVED
    kyc.mark_approved(review_answer=review_answer)
    kyc.save()
    # Wallet creation is idempotent, so it's safe to (re)run even if already approved.
    transaction.on_commit(lambda: _auto_create_wallet(kyc.user))
    if not already:
        log.info("KYC approved (source=%s) for user %s", source, kyc.user_id)
        # Emit only on the state-changing path → no duplicate on webhook replay.
        notify(kyc.user, NotificationType.KYC_APPROVED, action_url="/wallet")
    return kyc


@transaction.atomic
def reject_kyc(kyc: UserKYC, *, reason: str = "", review_answer: str = "",
               source: str = "webhook") -> UserKYC:
    kyc = UserKYC.objects.select_for_update().get(pk=kyc.pk)
    already = kyc.status == KYCStatus.REJECTED
    kyc.mark_rejected(reason=reason, review_answer=review_answer)
    kyc.save()
    log.info("KYC rejected (source=%s) for user %s", source, kyc.user_id)
    if not already:
        notify(kyc.user, NotificationType.KYC_REJECTED, action_url="/kyc")
    return kyc


def submit_kyc(user, *, personal_info: dict | None = None) -> UserKYC:
    """
    Create/advance the user's KYC to `submitted` and persist any personal info.
    Creates the Sumsub applicant if the provider is configured. Returns the record.

    DEBUG-only convenience: if settings.KYC_AUTO_APPROVE is on (and DEBUG), this
    auto-approves immediately so the gate can be exercised before keys exist.
    Production ignores the flag (it is only honoured under DEBUG).
    """
    from django.conf import settings

    from . import sumsub

    kyc = get_or_create_kyc(user)

    if personal_info:
        allowed = {
            "first_name", "last_name", "phone", "date_of_birth",
            "nationality", "country", "city", "address",
        }
        for key, value in personal_info.items():
            if key in allowed and value not in (None, ""):
                setattr(kyc, key, value)

    # Create a Sumsub applicant once, if configured and not already linked.
    if sumsub.is_configured() and not kyc.sumsub_applicant_id:
        try:
            kyc.sumsub_applicant_id = sumsub.create_applicant(user.pk)
        except sumsub.SumsubError:
            log.warning("Could not create Sumsub applicant for user %s", user.pk)

    kyc.mark_submitted()
    kyc.save()

    if settings.DEBUG and getattr(settings, "KYC_AUTO_APPROVE", False):
        kyc = approve_kyc(kyc, review_answer="AUTO", source="auto")

    return kyc
