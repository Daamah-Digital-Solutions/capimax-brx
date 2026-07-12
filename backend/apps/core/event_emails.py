"""
Per-event transactional email (client notes 5 & 21): every platform event that already
creates an in-app Notification ALSO sends a branded email, so registration, KYC/KYB,
purchases, payouts, listings, secondary-market and liquidity operations reach the user's
inbox like a global platform. Wired into apps.notifications.services.notify() (post-
commit) — a single chokepoint covers every event, so no host service needs to change.

Copy is Ecosystem-aligned per note 22 (no "investment" wording in user-facing text). A
notification type with no entry here simply sends no email.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

from .email_templates import render_branded_email

log = logging.getLogger(__name__)


class _SafeDict(dict):
    """format_map helper — a missing param renders as '' instead of raising KeyError."""

    def __missing__(self, key):  # noqa: D401
        return ""


def _fmt(template: str, params: dict) -> str:
    try:
        return (template or "").format_map(_SafeDict(params or {}))
    except Exception:  # noqa: BLE001 — copy must never break a send
        return template or ""


def _abs_url(path: str) -> str:
    base = getattr(settings, "FRONTEND_URL", "") or ""
    return f"{base.rstrip('/')}{path}" if base else path


# type -> {subject, heading, intro, cta_label, cta_path, outro}. `intro`/`heading`/
# `subject` are format strings over the notification `params`. Any type NOT listed here
# sends no email (e.g. partner_deliverable_submitted, which targets the admin).
EVENT_EMAIL_COPY: dict[str, dict] = {
    "kyc_approved": {
        "subject": "Your identity verification is approved",
        "heading": "You're verified",
        "intro": "Your identity verification (KYC) has been approved. You now have full access to the CapiMax BRX ecosystem — you can fund your wallet and start acquiring tokenized real-estate ownership.",
        "cta_label": "Go to your dashboard",
        "cta_path": "/dashboard",
        "outro": "Welcome aboard.",
    },
    "kyc_rejected": {
        "subject": "Action needed on your identity verification",
        "heading": "Your verification needs attention",
        "intro": "We couldn't approve your identity verification (KYC) this time. Please review your details and resubmit — our team is happy to help if you have questions.",
        "cta_label": "Review verification",
        "cta_path": "/dashboard",
        "outro": "",
    },
    "kyb_approved": {
        "subject": "Your business account is approved",
        "heading": "Your {role} account is approved",
        "intro": "Your business verification (KYB) has been approved. Your {role} account is now active on CapiMax BRX.",
        "cta_label": "Open your dashboard",
        "cta_path": "/dashboard",
        "outro": "",
    },
    "kyb_rejected": {
        "subject": "Action needed on your business verification",
        "heading": "Your business verification needs attention",
        "intro": "We couldn't approve your business verification (KYB) this time. Please review your submission and try again.",
        "cta_label": "Review verification",
        "cta_path": "/dashboard",
        "outro": "",
    },
    "wallet_created": {
        "subject": "Your CapiMax BRX wallet is ready",
        "heading": "Your wallet is ready",
        "intro": "Your secure custodial wallet has been created. You can now fund it and take part in the CapiMax BRX ecosystem.",
        "cta_label": "Open your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "investment_minted": {
        "subject": "Your ownership tokens are confirmed",
        "heading": "Ownership confirmed",
        "intro": "Your acquisition of {tokens} ownership tokens in {property} is confirmed, and the tokens are now in your wallet.",
        "cta_label": "View your portfolio",
        "cta_path": "/portfolio",
        "outro": "",
    },
    "earnings_credited": {
        "subject": "Funds credited to your wallet",
        "heading": "Proceeds credited",
        "intro": "${amount} in primary-sale proceeds for {property} has been credited to your wallet balance.",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "distribution_credited": {
        "subject": "A distribution was credited to your wallet",
        "heading": "Distribution received",
        "intro": "A distribution of ${amount} from {property} has been credited to your wallet balance.",
        "cta_label": "View distributions",
        "cta_path": "/distributions",
        "outro": "",
    },
    "secondary_sale_buyer": {
        "subject": "Your secondary-market purchase settled",
        "heading": "Purchase settled",
        "intro": "Your secondary-market purchase of tokens in {property} for ${amount} has settled, and the tokens are in your wallet.",
        "cta_label": "View your portfolio",
        "cta_path": "/portfolio",
        "outro": "",
    },
    "secondary_sale_seller": {
        "subject": "Your secondary-market sale settled",
        "heading": "Sale settled",
        "intro": "Your secondary-market sale of tokens in {property} settled for ${amount}, credited to your wallet balance.",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "withdrawal_requested": {
        "subject": "We received your withdrawal request",
        "heading": "Withdrawal requested",
        "intro": "We've received your withdrawal request for ${amount}. It's being processed and typically completes within 1-3 business days.",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "submission_published": {
        "subject": "Your property is live on the marketplace",
        "heading": "Your property is live",
        "intro": "Your property submission {property} has been reviewed and is now published on the CapiMax BRX marketplace.",
        "cta_label": "View your assets",
        "cta_path": "/my-assets",
        "outro": "",
    },
    "submission_rejected": {
        "subject": "Update on your property submission",
        "heading": "Your submission needs attention",
        "intro": "Your property submission {property} wasn't approved this time. Please review the feedback and resubmit.",
        "cta_label": "View your assets",
        "cta_path": "/my-assets",
        "outro": "",
    },
    "broker_license_approved": {
        "subject": "Your broker licence is approved",
        "heading": "You're an approved broker",
        "intro": "Your broker licence has been approved. Your broker tools, referrals and commissions are now active.",
        "cta_label": "Open broker tools",
        "cta_path": "/listings",
        "outro": "",
    },
    "broker_license_rejected": {
        "subject": "Action needed on your broker licence",
        "heading": "Your broker licence needs attention",
        "intro": "We couldn't approve your broker licence this time. Please review your details and resubmit.",
        "cta_label": "Review licence",
        "cta_path": "/listings",
        "outro": "",
    },
    "broker_commission_credited": {
        "subject": "You earned a commission",
        "heading": "Commission credited",
        "intro": "A commission of ${amount} from your referral on {property} has been credited to your balance.",
        "cta_label": "View commissions",
        "cta_path": "/commissions",
        "outro": "",
    },
    "installment_paid": {
        "subject": "Your installment payment cleared",
        "heading": "Installment {sequence} of {total} cleared",
        "intro": "Your installment payment for {property} cleared. Your released ownership grows with each payment.",
        "cta_label": "View your plan",
        "cta_path": "/installments",
        "outro": "",
    },
    "installment_defaulted": {
        "subject": "Update on your installment plan",
        "heading": "Your installment plan defaulted",
        "intro": "Your installment plan for {property} has defaulted after a missed payment. You keep the ownership you've already paid for; the unpaid portion is released back.",
        "cta_label": "View your plan",
        "cta_path": "/installments",
        "outro": "",
    },
    "sukuk_rejected": {
        "subject": "Update on your Nova certificate",
        "heading": "Your Nova certificate wasn't approved",
        "intro": "The Nova certificate you submitted for {property} wasn't approved. {reason} You can upload a valid certificate to try again.",
        "cta_label": "Try again",
        "cta_path": "/portfolio",
        "outro": "",
    },
    "partner_assigned": {
        "subject": "You have a new assignment",
        "heading": "New assignment received",
        "intro": "You've been assigned to {property}. Open your partner portal to review the details and deliverables.",
        "cta_label": "Open partner portal",
        "cta_path": "/strategic-partners",
        "outro": "",
    },
    "partner_deliverable_approved": {
        "subject": "Your deliverable was approved",
        "heading": "Deliverable approved",
        "intro": "Your deliverable for {property} has been approved.",
        "cta_label": "Open partner portal",
        "cta_path": "/strategic-partners",
        "outro": "",
    },
    "partner_revision_requested": {
        "subject": "A revision was requested",
        "heading": "Revision requested",
        "intro": "A revision has been requested on your deliverable for {property}. Please review and resubmit.",
        "cta_label": "Open partner portal",
        "cta_path": "/strategic-partners",
        "outro": "",
    },
    "partner_assignment_completed": {
        "subject": "Your assignment is complete",
        "heading": "Assignment completed",
        "intro": "Your assignment for {property} is now complete. Thank you for your work.",
        "cta_label": "Open partner portal",
        "cta_path": "/strategic-partners",
        "outro": "",
    },
}


def send_event_email(user, notif_type, params: dict | None = None) -> bool:
    """
    Send the branded email for a notification event. Returns True if an email was sent,
    False when the type has no email copy / the user has no email. Never raises — an
    email failure is informational and must not affect the caller.
    """
    email = getattr(user, "email", "") or ""
    copy = EVENT_EMAIL_COPY.get(str(notif_type))
    if not email or not copy:
        return False
    params = params or {}
    try:
        has_cta = bool(copy.get("cta_label"))
        html_body, text_body = render_branded_email(
            preheader=_fmt(copy.get("intro", ""), params)[:140],
            heading=_fmt(copy.get("heading", ""), params),
            intro=_fmt(copy.get("intro", ""), params),
            cta_label=copy.get("cta_label", "") if has_cta else "",
            cta_url=_abs_url(copy.get("cta_path", "/dashboard")) if has_cta else "",
            outro=_fmt(copy.get("outro", ""), params),
        )
        send_mail(
            subject=_fmt(copy.get("subject", "CapiMax BRX"), params),
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_body,
            fail_silently=getattr(settings, "EMAIL_FAIL_SILENTLY", True),
        )
        return True
    except Exception:  # noqa: BLE001 — an email failure must never affect the caller
        log.exception("event email failed (type=%s user=%s)", notif_type, getattr(user, "pk", None))
        return False
