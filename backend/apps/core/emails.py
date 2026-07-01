"""
Email send hooks — STUBS for Phase 1.

These build the verification / password-reset links and send via Django's
configured EMAIL_BACKEND (console in dev). A real transactional provider
(SES/SendGrid) is wired in a later phase; the call sites here will not change.
SPEC §6.
"""
from django.conf import settings
from django.core.mail import send_mail

from .email_templates import render_branded_email
from .tokens import email_verification_token, encode_uid, password_reset_token


def _frontend_link(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def send_verification_email(user) -> str:
    """Send the email-verification link (branded HTML + text). Returns the link."""
    uid = encode_uid(user)
    token = email_verification_token.make_token(user)
    link = _frontend_link(f"/verify-email?uid={uid}&token={token}")
    html_body, text_body = render_branded_email(
        preheader="Confirm your email to activate your Capimax BRX account.",
        heading="Verify your email",
        intro=(
            "Welcome to Capimax BRX. Confirm your email address to activate your "
            "account and start investing in fractional real estate."
        ),
        cta_label="Verify email",
        cta_url=link,
        outro="If you didn't create a Capimax BRX account, you can safely ignore this email.",
    )
    send_mail(
        subject="Verify your Capimax BRX account",
        message=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_body,
        fail_silently=settings.EMAIL_FAIL_SILENTLY,
    )
    return link


def send_password_reset_email(user) -> str:
    """Send the password-reset link (branded HTML + text). Returns the link."""
    uid = encode_uid(user)
    token = password_reset_token.make_token(user)
    link = _frontend_link(f"/reset-password?uid={uid}&token={token}")
    html_body, text_body = render_branded_email(
        preheader="Reset your Capimax BRX password.",
        heading="Reset your password",
        intro=(
            "We received a request to reset the password for your Capimax BRX "
            "account. Click the button below to choose a new password."
        ),
        cta_label="Reset password",
        cta_url=link,
        outro=(
            "If you didn't request a password reset, you can safely ignore this "
            "email — your password won't change."
        ),
    )
    send_mail(
        subject="Reset your Capimax BRX password",
        message=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_body,
        fail_silently=settings.EMAIL_FAIL_SILENTLY,
    )
    return link
