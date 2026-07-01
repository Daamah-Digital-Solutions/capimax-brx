"""
Email send hooks — STUBS for Phase 1.

These build the verification / password-reset links and send via Django's
configured EMAIL_BACKEND (console in dev). A real transactional provider
(SES/SendGrid) is wired in a later phase; the call sites here will not change.
SPEC §6.
"""
from django.conf import settings
from django.core.mail import send_mail

from .tokens import email_verification_token, encode_uid, password_reset_token


def _frontend_link(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def send_verification_email(user) -> str:
    """Send (stub) the email-verification link. Returns the link for tests/logs."""
    uid = encode_uid(user)
    token = email_verification_token.make_token(user)
    link = _frontend_link(f"/verify-email?uid={uid}&token={token}")
    # TODO(later phase): replace console backend with real provider templates.
    send_mail(
        subject="Verify your Capimax BRX account",
        message=f"Confirm your email to activate your account: {link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=settings.EMAIL_FAIL_SILENTLY,
    )
    return link


def send_password_reset_email(user) -> str:
    """Send (stub) the password-reset link. Returns the link for tests/logs."""
    uid = encode_uid(user)
    token = password_reset_token.make_token(user)
    link = _frontend_link(f"/reset-password?uid={uid}&token={token}")
    send_mail(
        subject="Reset your Capimax BRX password",
        message=f"Reset your password: {link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=settings.EMAIL_FAIL_SILENTLY,
    )
    return link
