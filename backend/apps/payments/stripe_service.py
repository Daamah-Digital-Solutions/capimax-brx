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
def create_payment_intent(
    *, amount, currency: str, metadata: dict, customer: str = "", payment_method: str = ""
) -> dict:
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
    extra = {}
    if customer:
        extra["customer"] = customer
    if payment_method:
        # A saved card: attached here (server side) so its id never reaches the browser,
        # which only confirms the intent — and completes 3-D Secure if the bank asks.
        extra["payment_method"] = payment_method
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_minor,
            currency=(currency or settings.STRIPE_CURRENCY).lower(),
            metadata=metadata,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            **extra,
        )
    except Exception as exc:  # stripe.error.* — don't leak details into responses
        raise StripeError("Could not create the payment.") from exc
    return {"id": intent["id"], "client_secret": intent["client_secret"]}


# --------------------------------------------------------------------------- #
# Saved cards: one Stripe Customer per user, cards saved through a SetupIntent (on-session:
# the investor is always present to confirm a charge). See apps/payments/saved_cards.py.
# --------------------------------------------------------------------------- #
def _stripe():
    if not is_configured():
        raise StripeNotConfigured("Stripe API key is not configured.")
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def create_customer(*, email: str, user_id: str) -> str:
    stripe = _stripe()
    try:
        return stripe.Customer.create(email=email, metadata={"user_id": user_id})["id"]
    except Exception as exc:
        raise StripeError("Could not create the customer.") from exc


def customer_exists(customer_id: str) -> bool:
    stripe = _stripe()
    try:
        c = stripe.Customer.retrieve(customer_id)
        return not c.get("deleted")
    except Exception:
        return False


def create_setup_intent(*, customer: str) -> dict:
    stripe = _stripe()
    try:
        si = stripe.SetupIntent.create(
            customer=customer, usage="on_session", payment_method_types=["card"],
        )
    except Exception as exc:
        raise StripeError("Could not start saving the card.") from exc
    return {"id": si["id"], "client_secret": si["client_secret"]}


def retrieve_setup_intent(setup_intent_id: str) -> dict:
    stripe = _stripe()
    try:
        si = stripe.SetupIntent.retrieve(setup_intent_id)
    except Exception as exc:
        raise StripeError("Card setup not found.") from exc
    pm = si.get("payment_method")
    return {
        "customer": si.get("customer") or "",
        "status": si.get("status") or "",
        "payment_method": pm if isinstance(pm, str) else (pm or {}).get("id", ""),
    }


def retrieve_card(payment_method_id: str) -> dict:
    stripe = _stripe()
    try:
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
    except Exception as exc:
        raise StripeError("Card not found.") from exc
    card = pm.get("card") or {}
    return {
        "brand": card.get("brand") or "card",
        "last4": card.get("last4") or "",
        "exp_month": int(card.get("exp_month") or 0),
        "exp_year": int(card.get("exp_year") or 0),
        "name": ((pm.get("billing_details") or {}).get("name") or ""),
    }


def detach_payment_method(payment_method_id: str) -> None:
    stripe = _stripe()
    try:
        stripe.PaymentMethod.detach(payment_method_id)
    except Exception:  # best effort — the local card is removed regardless
        pass


# --------------------------------------------------------------------------- #
# Stripe Connect payouts (apps/wallets/auto_payouts.py): an Express account per investor,
# a Transfer from the platform balance to it, optionally an instant payout to its debit card.
# --------------------------------------------------------------------------- #
class StripeBalanceInsufficient(StripeError):
    """The platform's Stripe balance can't fund this transfer right now."""


def create_express_account(*, email: str, user_id: str, country: str) -> str:
    """An Express account in the investor's own country. Outside the platform's country it is a
    cross-border "recipient" account (it can receive transfers, which is all payouts need)."""
    from django.conf import settings

    stripe = _stripe()
    params = {
        "type": "express", "country": country, "email": email, "metadata": {"user_id": user_id},
        "capabilities": {"transfers": {"requested": True}},
    }
    if country != settings.STRIPE_PLATFORM_COUNTRY:
        params["tos_acceptance"] = {"service_agreement": "recipient"}
    try:
        acct = stripe.Account.create(**params)
    except Exception as exc:
        msg = getattr(exc, "user_message", None) or "Could not create the payout account."
        raise StripeError(msg) from exc
    return acct["id"]


def create_account_link(*, account_id: str, refresh_url: str, return_url: str) -> str:
    stripe = _stripe()
    try:
        link = stripe.AccountLink.create(
            account=account_id, refresh_url=refresh_url, return_url=return_url,
            type="account_onboarding",
        )
    except Exception as exc:
        raise StripeError("Could not start linking the bank account.") from exc
    return link["url"]


def retrieve_account(account_id: str) -> dict:
    stripe = _stripe()
    try:
        acct = stripe.Account.retrieve(account_id)
    except Exception as exc:
        raise StripeError("Payout account not found.") from exc
    return {
        "payouts_enabled": bool(acct.get("payouts_enabled")),
        "details_submitted": bool(acct.get("details_submitted")),
    }


def has_instant_destination(account_id: str) -> bool:
    """True when the connected account has a debit card eligible for instant payouts."""
    stripe = _stripe()
    try:
        ext = stripe.Account.list_external_accounts(account_id, limit=10)
    except Exception:
        return False
    for item in ext.get("data", []):
        if "instant" in (item.get("available_payout_methods") or []):
            return True
    return False


def create_transfer(*, amount, account_id: str, idempotency_key: str, metadata: dict) -> str:
    stripe = _stripe()
    try:
        tr = stripe.Transfer.create(
            amount=int((amount * 100).to_integral_value()), currency="usd",
            destination=account_id, metadata=metadata, idempotency_key=idempotency_key,
        )
    except Exception as exc:
        code = getattr(exc, "code", "") or getattr(getattr(exc, "error", None), "code", "")
        if code == "balance_insufficient":
            raise StripeBalanceInsufficient("The platform's Stripe balance is too low.") from exc
        raise StripeError("The transfer was refused.") from exc
    return tr["id"]


def create_instant_payout(*, amount, account_id: str, idempotency_key: str) -> str:
    stripe = _stripe()
    try:
        po = stripe.Payout.create(
            amount=int((amount * 100).to_integral_value()), currency="usd", method="instant",
            stripe_account=account_id, idempotency_key=idempotency_key,
        )
    except Exception as exc:
        raise StripeError("The instant payout was refused.") from exc
    return po["id"]


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
