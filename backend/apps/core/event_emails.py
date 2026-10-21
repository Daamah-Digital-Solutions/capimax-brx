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
    if path.startswith(("http://", "https://")):
        return path  # already absolute (e.g. a link into the Django admin)
    base = getattr(settings, "FRONTEND_URL", "") or ""
    return f"{base.rstrip('/')}{path}" if base else path


# type -> {subject, heading, intro, cta_label, cta_path, outro}. `intro`/`heading`/
# `subject` are format strings over the notification `params`. Any type NOT listed here
# sends no email (e.g. partner_deliverable_submitted, which targets the admin).
EVENT_EMAIL_COPY: dict[str, dict] = {
    "support_reply": {
        "subject": "Support replied to your ticket {reference}",
        "heading": "We replied to your ticket",
        "intro": "Our support team replied to your ticket {reference} — “{subject}”. Open it to read the reply and answer if needed.",
        "cta_label": "Open the ticket",
        "cta_path": "/support?tab=tickets",
        "outro": "",
    },
    "support_resolved": {
        "subject": "Your ticket {reference} is resolved",
        "heading": "Ticket resolved",
        "intro": "Your ticket {reference} — “{subject}” — was marked resolved. If you still need help, reply on the ticket and it reopens.",
        "cta_label": "Open the ticket",
        "cta_path": "/support?tab=tickets",
        "outro": "",
    },
    "platform_message": {
        "subject": "{subject}",
        "heading": "{subject}",
        "intro": "{body}",
        "cta_label": "Open your inbox",
        "cta_path": "/messages",
        "outro": "This message is from the Capimax BRX team.",
    },
    "password_changed": {
        "subject": "Your Capimax BRX password was changed",
        "heading": "Password changed",
        "intro": "Your password was just changed and your other devices were signed out. If this wasn't you, reset your password now and contact support.",
        "cta_label": "Review security settings",
        "cta_path": "/settings?tab=security",
        "outro": "",
    },
    "two_factor_changed": {
        "subject": "Two-factor authentication is {state}",
        "heading": "Two-factor authentication {state}",
        "intro": "Two-factor sign-in with an authenticator app was turned {state} on your account. If this wasn't you, contact support right away.",
        "cta_label": "Review security settings",
        "cta_path": "/settings?tab=security",
        "outro": "",
    },
    "account_deactivated": {
        "subject": "Your Capimax BRX account was deactivated",
        "heading": "Account deactivated",
        "intro": "Your account was deactivated at your request and all devices were signed out. To reactivate it, contact support.",
        "cta_label": "Contact support",
        "cta_path": "/support",
        "outro": "",
    },
    "deposit_received": {
        "subject": "We received your bank transfer of ${amount}",
        "heading": "Transfer received — under review",
        "intro": "We received your bank transfer proof for ${amount} (reference {reference}). Our team is matching it with the bank statement; your wallet is credited as soon as it is approved.",
        "cta_label": "Open your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "deposit_credited": {
        "subject": "${amount} was added to your wallet",
        "heading": "Deposit credited",
        "intro": "Your {method} deposit of ${amount} (reference {reference}) is now in your Capimax BRX wallet.",
        "cta_label": "Open your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "deposit_rejected": {
        "subject": "Your bank transfer of ${amount} wasn't approved",
        "heading": "Bank transfer not approved",
        "intro": "We couldn't match your bank transfer of ${amount} (reference {reference}). Please check the transfer and upload a clear proof again, or contact support.",
        "cta_label": "Open your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "role_approved": {
        "subject": "Your {role} role is active",
        "heading": "You're now a {role}",
        "intro": "Your application for the {role} role was approved. Switch to it from the role switcher in the sidebar and get started.",
        "cta_label": "Open your {role} dashboard",
        "cta_path": "{dashboard}",
        "outro": "",
    },
    "role_rejected": {
        "subject": "Your {role} application",
        "heading": "Your {role} application wasn't approved",
        "intro": "We couldn't approve your application for the {role} role this time. {note} You can edit it and submit again.",
        "cta_label": "Review your application",
        "cta_path": "{apply_path}",
        "outro": "",
    },
    # Gifts / family transfers / inheritance (apps/transfers).
    "transfer_invite": {
        "subject": "{sender} sent you {what} on CapiMax BRX",
        "heading": "Something is waiting for you",
        "intro": "{sender} sent you {what} as a {kind}. To receive it, sign in (or create your account) with this email address, confirm your email and complete identity verification — it is handed over automatically right after.",
        "cta_label": "Receive it",
        "cta_path": "/auth",
        "outro": "",
    },
    "transfer_received": {
        "subject": "You received {what}",
        "heading": "You received a {kind}",
        "intro": "{sender} sent you {what}. It is now in your account. {message}",
        "cta_label": "View your account",
        "cta_path": "/portfolio",
        "outro": "",
    },
    "transfer_delivered": {
        "subject": "Your {kind} was delivered",
        "heading": "Delivered",
        "intro": "{what} reached {recipient}.",
        "cta_label": "View transfers",
        "cta_path": "/family-investment",
        "outro": "",
    },
    "transfer_waiting": {
        "subject": "Your {kind} is waiting for {recipient}",
        "heading": "Waiting for the recipient",
        "intro": "{recipient} needs to sign up, confirm their email and verify their identity to receive {what}. We emailed them. If they don't within {days} days, it comes back to you — you can also cancel it any time before.",
        "cta_label": "View transfers",
        "cta_path": "/family-investment",
        "outro": "",
    },
    "transfer_returned": {
        "subject": "Your {kind} came back to you",
        "heading": "Returned to you",
        "intro": "{what} to {recipient} was not delivered and is back in your account. {reason}",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "gift_reminder": {
        "subject": "Your gift goes out on {date}",
        "heading": "Gift reminder",
        "intro": "Your gift of {what} to {recipient} will be delivered on {date}. You can still cancel it before then.",
        "cta_label": "View gifts",
        "cta_path": "/family-investment",
        "outro": "",
    },
    "estate_claim_decided": {
        "subject": "Your inheritance claim was {decision}",
        "heading": "Inheritance claim {decision}",
        "intro": "Your claim on certificate {number} was {decision}. {note}",
        "cta_label": "Open your account",
        "cta_path": "/portfolio",
        "outro": "",
    },
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
        "cta_path": "{dashboard}",
        "outro": "",
    },
    "kyb_rejected": {
        "subject": "Action needed on your business verification",
        "heading": "Your business verification needs attention",
        "intro": "We couldn't approve your business verification (KYB) this time. Please review your submission and try again.",
        "cta_label": "Review verification",
        "cta_path": "{dashboard}",
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
    "installment_due_unpaid": {
        "subject": "Installment due for {property} — please top up your wallet",
        "heading": "Installment due",
        "intro": "Installment {sequence} of {total} for {property} (${amount}, due {due_date}) is collected automatically from your wallet, but your balance doesn't cover it yet. Top up your wallet and it will be collected automatically — there is no late fee.",
        "cta_label": "Top up your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "unit_price_changed": {
        "subject": "New unit price for {property}",
        "heading": "Unit price updated",
        "intro": "The unit price of {property} has been updated from ${old_price} to ${new_price} ({change_pct}%){label_suffix}. Your holding is now valued at the new price. Installment plans you already started keep their locked price.{listing_note}",
        "cta_label": "View the property",
        "cta_path": "/marketplace",
        "outro": "Prices can go down as well as up.",
    },
    "admin_review_needed": {
        "subject": "Review needed: {kind}",
        "heading": "Waiting for your review",
        "intro": "{summary}",
        "cta_label": "Open in the admin",
        "cta_path": "{admin_url}",
        "outro": "You get this because you are an administrator of Capimax BRX.",
    },
    "lp_exit_closed": {
        "subject": "Your liquidity exit request for {property} was closed",
        "heading": "Exit request closed",
        "intro": "The unit price of {property} changed, so your request to sell {tokens} unit(s) to a liquidity provider was closed and your units are free again. A request is only ever funded at the price it was quoted at.",
        "cta_label": "Request a new quote",
        "cta_path": "/lp-market",
        "outro": "Your new quote will use the current unit price.",
    },
    "purchase_refunded": {
        "subject": "Your payment was refunded to your wallet",
        "heading": "Payment refunded",
        "intro": "Your payment of ${amount} for {property} was not executed: {reason}. The full amount has been credited to your wallet balance — you can buy again at today's price.",
        "cta_label": "View the property",
        "cta_path": "/marketplace",
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
    "nova_pledge_released": {
        "subject": "Your {property} units are released by Nova Finance",
        "heading": "Nova pledge released",
        "intro": "Nova Finance issued its clearance for your {tokens} unit(s) of {property}. They are no longer pledged — you can now sell or exit them like any other units.",
        "cta_label": "View your portfolio",
        "cta_path": "/portfolio",
        "outro": "",
    },
    "crypto_underpaid": {
        "subject": "Your crypto payment was short — ${received} is in your wallet",
        "heading": "Crypto payment below the amount due",
        "intro": "We received ${received} of the ${due} due, so the purchase was cancelled and the ${received} that arrived is now in your wallet. You can use it for a new purchase.",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "Network fees can reduce what arrives — please send the full amount shown on the invoice.",
    },
    "crypto_overpaid": {
        "subject": "Your crypto payment was above the amount due",
        "heading": "Extra amount added to your wallet",
        "intro": "We received ${received} for a payment of ${due}. Your purchase is complete and the extra ${extra} is now in your wallet.",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "",
    },
    "installment_due_soon": {
        "subject": "Installment {sequence} of {property} is due on {due_date}",
        "heading": "Your installment is coming up",
        "intro": "Installment {sequence} of {total} for {property} (${amount}) is due on {due_date}. It will be debited automatically from your wallet. To have it covered, your wallet needs ${top_up} more.",
        "cta_label": "View your installments",
        "cta_path": "/installments",
        "outro": "There's no late fee — if the wallet is short on the day, it is collected as soon as you top up.",
    },
    "withdrawal_completed": {
        "subject": "Your withdrawal of ${amount} was sent",
        "heading": "Withdrawal sent",
        "intro": "Your withdrawal {reference} of ${amount} has been paid out to the account you chose.",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "Bank transfers can take a little while to appear on your statement.",
    },
    "withdrawal_failed": {
        "subject": "Your withdrawal of ${amount} could not be completed",
        "heading": "Withdrawal not completed",
        "intro": "We couldn't complete your withdrawal {reference} of ${amount}, so the full amount is back in your wallet. Reason: {reason}",
        "cta_label": "View your wallet",
        "cta_path": "/wallet",
        "outro": "You can request it again — please check the payout details first.",
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
        "cta_path": "/broker-dashboard",
        "outro": "",
    },
    "broker_license_rejected": {
        "subject": "Action needed on your broker licence",
        "heading": "Your broker licence needs attention",
        "intro": "We couldn't approve your broker licence this time. Please review your details and resubmit.",
        "cta_label": "Review licence",
        "cta_path": "/broker-verification",
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
            cta_url=_abs_url(_fmt(copy.get("cta_path", "/dashboard"), params)) if has_cta else "",
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
