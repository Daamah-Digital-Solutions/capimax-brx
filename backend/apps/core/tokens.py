"""
Token generators for email verification and password reset.

These reuse Django's signed, time-limited token machinery (no extra table).
The actual email delivery is a stub in Phase 1 (see emails.py). SPEC §5.2 / §6.
"""
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Token whose hash also depends on is_email_verified, so it invalidates on use."""

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{timestamp}{user.is_email_verified}{user.email}"


email_verification_token = EmailVerificationTokenGenerator()
# Django's built-in generator is sufficient for password reset scaffolding.
password_reset_token = PasswordResetTokenGenerator()


def encode_uid(user) -> str:
    return urlsafe_base64_encode(force_bytes(user.pk))
