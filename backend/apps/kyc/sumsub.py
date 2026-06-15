"""
Sumsub integration layer — Phase 4 (KYC_WALLET_SURFACE.md §4; DECISIONS.md "Phase 4" #3).

DEFERRED + INERT WHEN BLANK, exactly like the OAuth keys. With no
SUMSUB_APP_TOKEN / SUMSUB_SECRET_KEY this module reports `is_configured() == False`
and the provider calls raise `SumsubNotConfigured`; the views degrade gracefully
(dev notice / dev_grant_kyc path) rather than break.

What it does when keys ARE present:
  * create_applicant(external_user_id) — POST /resources/applicants?levelName=…
    (auth = App-Token header + HMAC request signature over ts+method+path+body).
  * issue_access_token(external_user_id) — POST /resources/accessTokens (WebSDK token).
  * verify_webhook_signature(raw_body, signature, alg) — HMAC of the RAW body with
    the SEPARATE webhook secret; the automation hinge for approval.

SAFETY: secrets come only from settings (env). Nothing here logs/prints a key, a
signature, or a token. All network calls are short-timeout and lazy-import `requests`
so importing this module never requires the dependency or the network.
"""
from __future__ import annotations

import hashlib
import hmac
import time

from django.conf import settings

# Sumsub's documented digest header + the algorithms it may use for the webhook.
WEBHOOK_DIGEST_HEADER = "x-payload-digest"
WEBHOOK_ALG_HEADER = "x-payload-digest-alg"
_WEBHOOK_ALGS = {
    "HMAC_SHA1_HEX": hashlib.sha1,
    "HMAC_SHA256_HEX": hashlib.sha256,
    "HMAC_SHA512_HEX": hashlib.sha512,
}

_REQUEST_TIMEOUT = 15  # seconds


class SumsubError(Exception):
    """Provider call failed (network / non-2xx)."""


class SumsubNotConfigured(SumsubError):
    """Sumsub keys are not set — the provider is inert (deferred, like OAuth)."""


def is_configured() -> bool:
    """True only when the minimal API credentials are present (server→Sumsub calls)."""
    return bool(settings.SUMSUB_APP_TOKEN and settings.SUMSUB_SECRET_KEY)


def webhook_configured() -> bool:
    """True when the webhook secret is present (independent of the API keys)."""
    return bool(settings.SUMSUB_WEBHOOK_SECRET)


# --------------------------------------------------------------------------- #
# Request signing (App-Token auth). HMAC-SHA256 of ts + METHOD + path + body.
# --------------------------------------------------------------------------- #
def _sign(ts: str, method: str, path: str, body: bytes) -> str:
    secret = settings.SUMSUB_SECRET_KEY.encode()
    msg = ts.encode() + method.upper().encode() + path.encode() + (body or b"")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _signed_headers(method: str, path: str, body: bytes) -> dict:
    ts = str(int(time.time()))
    return {
        "X-App-Token": settings.SUMSUB_APP_TOKEN,
        "X-App-Access-Ts": ts,
        "X-App-Access-Sig": _sign(ts, method, path, body),
        "Content-Type": "application/json",
    }


def _post(path: str, body: bytes = b"") -> dict:
    if not is_configured():
        raise SumsubNotConfigured("Sumsub API keys are not configured.")
    import requests  # lazy — importing this module must not require the dep/network

    url = settings.SUMSUB_BASE_URL.rstrip("/") + path
    try:
        resp = requests.post(
            url, data=body, headers=_signed_headers("POST", path, body),
            timeout=_REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:  # pragma: no cover - network failure
        raise SumsubError("Sumsub request failed.") from exc
    if resp.status_code >= 300:
        # Never echo the body verbatim into logs/exceptions (may contain PII).
        raise SumsubError(f"Sumsub returned HTTP {resp.status_code}.")
    return resp.json()


# --------------------------------------------------------------------------- #
# Provider operations
# --------------------------------------------------------------------------- #
def create_applicant(external_user_id: str, *, level_name: str | None = None) -> str:
    """
    Create a Sumsub applicant for our user and return its applicantId. The applicant
    is keyed by `externalUserId = our user.id` so the webhook can map back to us.

    `level_name` defaults to the investor-KYC level; the LP domain passes the
    business-verification (KYB) level (Phase 6 Wave 1).
    """
    import json

    level = level_name or settings.SUMSUB_LEVEL_NAME
    path = f"/resources/applicants?levelName={level}"
    body = json.dumps({"externalUserId": str(external_user_id)}).encode()
    data = _post(path, body)
    applicant_id = data.get("id") or data.get("applicantId") or ""
    if not applicant_id:
        raise SumsubError("Sumsub applicant response missing id.")
    return applicant_id


def issue_access_token(
    external_user_id: str, *, level_name: str | None = None, ttl_secs: int = 600
) -> str:
    """Issue a short-lived WebSDK access token for the frontend to mount the SDK."""
    level = level_name or settings.SUMSUB_LEVEL_NAME
    path = (
        f"/resources/accessTokens?userId={external_user_id}"
        f"&levelName={level}&ttlInSecs={ttl_secs}"
    )
    data = _post(path, b"")
    token = data.get("token") or ""
    if not token:
        raise SumsubError("Sumsub access-token response missing token.")
    return token


# --------------------------------------------------------------------------- #
# Webhook verification (the automation hinge) + parsing
# --------------------------------------------------------------------------- #
def verify_webhook_signature(raw_body: bytes, signature: str, alg: str = "") -> bool:
    """
    Constant-time check that `signature` (hex) is HMAC of the RAW request body using
    the webhook secret. Returns False if the secret is unset or the signature is
    absent/incorrect — callers MUST refuse to act on a False result.
    """
    if not webhook_configured() or not signature:
        return False
    digestmod = _WEBHOOK_ALGS.get((alg or "").upper(), hashlib.sha256)
    expected = hmac.new(
        settings.SUMSUB_WEBHOOK_SECRET.encode(), raw_body or b"", digestmod
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip().lower())


def parse_review(payload: dict) -> dict:
    """
    Normalize a Sumsub webhook payload into the bits we act on:
      {applicant_id, external_user_id, type, review_answer, reject_reason}
    `review_answer` is "GREEN"/"RED"; `reject_reason` is a human string from labels.
    """
    review = payload.get("reviewResult") or {}
    labels = review.get("rejectLabels") or []
    return {
        "applicant_id": payload.get("applicantId") or payload.get("inspectionId") or "",
        "external_user_id": payload.get("externalUserId") or "",
        "type": payload.get("type") or "",
        # `levelName` lets the shared webhook route business (KYB) applicants to the
        # LP domain vs investor KYC (Phase 6 Wave 1).
        "level_name": payload.get("levelName") or "",
        "review_answer": (review.get("reviewAnswer") or "").upper(),
        "reject_reason": ", ".join(labels) if labels else (review.get("moderationComment") or ""),
    }
