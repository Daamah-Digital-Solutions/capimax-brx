"""
Google Sign-In (GIS id_token flow) — server-side verification.

The SPA obtains a signed Google ``id_token`` in the browser and POSTs it to
``/api/auth/oauth/google/``. This module verifies that token against Google's
public keys and our client id (the token's ``aud``), then returns the trusted
claims. No client secret and no redirect URI are involved — verification is
purely cryptographic. SPEC §6.
"""
from __future__ import annotations

from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

# Google's issuer values for id_tokens.
_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


class GoogleTokenError(Exception):
    """Raised when a Google id_token is missing, malformed, or fails verification."""


def verify_google_id_token(token: str) -> dict:
    """
    Verify a Google id_token and return its claims.

    Raises GoogleTokenError on any problem (bad signature, wrong audience,
    wrong issuer, expired, unverified email, or missing server config).
    """
    if not token:
        raise GoogleTokenError("Missing id_token.")

    client_id = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
    if not client_id:
        raise GoogleTokenError("Google sign-in is not configured on the server.")

    try:
        claims = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), client_id
        )
    except ValueError as exc:  # bad signature / audience / expiry
        raise GoogleTokenError("Invalid Google token.") from exc

    if claims.get("iss") not in _ISSUERS:
        raise GoogleTokenError("Invalid Google token issuer.")

    email = claims.get("email")
    if not email:
        raise GoogleTokenError("Google account has no email.")
    if claims.get("email_verified") not in (True, "true"):
        raise GoogleTokenError("Google email is not verified.")

    return claims
