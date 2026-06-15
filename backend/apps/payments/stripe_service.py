"""
Stripe integration layer — Phase 5 Wave 1 (KYC_WALLET_SURFACE pattern; DECISIONS "Payments").

DEFERRED + INERT WHEN BLANK, exactly like Sumsub/OAuth. With no STRIPE_SECRET_KEY
this module reports `is_configured() == False` and `create_payment_intent` raises
`StripeNotConfigured`; the views degrade gracefully (503) instead of breaking.

SAFETY (real money):
  * RAW CARD DATA NEVER passes through here — we only create a PaymentIntent for an
    amount and read back its id/client_secret. The card is entered via Stripe
    Elements in the browser and tokenised by Stripe.
  * Webhook signature verification is MANDATORY and implemented HERE against Stripe's
    documented scheme (HMAC-SHA256 over `${t}.${raw_body}`), so it is verifiable in
    tests WITHOUT the `stripe` package, the network, or live keys. Minting is gated
    on this verification.

Nothing here logs a key, a client_secret, or a signature.
"""
from __future__ import annotations

import hashlib
import hmac
import json

from django.conf import settings

# Stripe sends "Stripe-Signature: t=<ts>,v1=<sig>[,v1=<sig2>...]".
SIGNATURE_HEADER = "stripe-signature"


class StripeError(Exception):
    """A Stripe API call failed."""


class StripeNotConfigured(StripeError):
    """Stripe keys are not set — the provider is inert (deferred, like OAuth)."""


def is_configured() -> bool:
    """True only when the secret key is present (server→Stripe calls)."""
    return bool(settings.STRIPE_SECRET_KEY)


def webhook_configured() -> bool:
    """True when the webhook signing secret is present (independent of the API key)."""
    return bool(settings.STRIPE_WEBHOOK_SECRET)


def publishable_key() -> str:
    """The browser-safe publishable key (empty when deferred)."""
    return settings.STRIPE_PUBLISHABLE_KEY or ""


# --------------------------------------------------------------------------- #
# PaymentIntent creation (server→Stripe). Lazy-imports `stripe`.
# --------------------------------------------------------------------------- #
def create_payment_intent(*, amount, currency: str, metadata: dict) -> dict:
    """
    Create a Stripe PaymentIntent for `amount` (a Decimal of major units, e.g. USD)
    and return {id, client_secret}. The client_secret is returned to the browser to
    confirm the card directly with Stripe; it is never persisted.

    `metadata` carries our investment/payment ids so the webhook can correlate.
    """
    if not is_configured():
        raise StripeNotConfigured("Stripe API key is not configured.")
    import stripe  # lazy — importing this module must not require the dep/network

    stripe.api_key = settings.STRIPE_SECRET_KEY
    # Stripe expects the smallest currency unit (cents for USD).
    amount_minor = int((amount * 100).to_integral_value())
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_minor,
            currency=(currency or settings.STRIPE_CURRENCY).lower(),
            metadata=metadata,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
        )
    except Exception as exc:  # stripe.error.* — don't leak details into responses
        raise StripeError("Could not create the payment.") from exc
    return {"id": intent["id"], "client_secret": intent["client_secret"]}


# --------------------------------------------------------------------------- #
# Webhook verification (the automation hinge) — manual, dependency-free.
# --------------------------------------------------------------------------- #
def verify_and_parse_webhook(raw_body: bytes, signature_header: str) -> dict | None:
    """
    Verify the Stripe-Signature header against the webhook secret and return the
    parsed event dict. Returns None if the secret is unset or the signature is
    absent/invalid — callers MUST refuse to act (no mint) on a None result.

    Scheme (Stripe docs): signed_payload = `${t}.${raw_body}`; expected =
    HMAC-SHA256(secret, signed_payload); compare (constant-time) to any `v1=` value.
    """
    if not webhook_configured() or not signature_header:
        return None

    parts = {}
    for item in signature_header.split(","):
        if "=" in item:
            k, v = item.split("=", 1)
            parts.setdefault(k.strip(), []).append(v.strip())

    timestamps = parts.get("t") or []
    v1_sigs = parts.get("v1") or []
    if not timestamps or not v1_sigs:
        return None

    ts = timestamps[0]
    signed_payload = ts.encode() + b"." + (raw_body or b"")
    expected = hmac.new(
        settings.STRIPE_WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, sig) for sig in v1_sigs):
        return None

    try:
        return json.loads((raw_body or b"").decode() or "{}")
    except (ValueError, UnicodeDecodeError):
        return None


def sign_payload(raw_body: bytes, timestamp: str, secret: str | None = None) -> str:
    """
    Produce a valid `Stripe-Signature` header value for `raw_body` — used ONLY by
    tests and the DEBUG webhook-simulate command to forge a correctly-signed event.
    """
    secret = secret or settings.STRIPE_WEBHOOK_SECRET
    signed_payload = timestamp.encode() + b"." + (raw_body or b"")
    sig = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={sig}"
