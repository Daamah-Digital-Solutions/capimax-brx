"""
NOW Payments integration layer — Phase 5 Wave 2 (crypto). Mirrors the Wave-1 Stripe
layer. SPEC §6; DECISIONS.md "Payments".

DEFERRED + INERT WHEN BLANK, exactly like Stripe/Sumsub/OAuth. With no
NOWPAYMENTS_API_KEY this reports `is_configured() == False` and `create_payment`
raises `NowPaymentsNotConfigured`; the views degrade gracefully (503).

SAFETY (real money):
  * We never custody funds — NOW gives a deposit address; the buyer pays it directly.
  * IPN signature verification is MANDATORY and implemented HERE against NOW's
    documented scheme (HMAC-SHA512 over the KEY-SORTED JSON body with the IPN secret,
    header `x-nowpayments-sig`), so it is verifiable in tests WITHOUT the network or
    live keys. Minting is gated on this verification.

Nothing here logs the API key or the IPN secret.
"""
from __future__ import annotations

import hashlib
import hmac
import json

from django.conf import settings

# NOW Payments sends the IPN HMAC in this header.
IPN_SIGNATURE_HEADER = "x-nowpayments-sig"

# NOW payment_status lifecycle. Terminal success → mint; terminal failure → no mint.
SUCCESS_STATES = {"finished", "confirmed"}
FAILURE_STATES = {"failed", "expired", "refunded"}
# waiting / confirming / sending / partially_paid → in-flight: acknowledge, no mint.

_REQUEST_TIMEOUT = 20  # seconds


class NowPaymentsError(Exception):
    """A NOW Payments API call failed."""


class NowPaymentsNotConfigured(NowPaymentsError):
    """NOW Payments keys are not set — the provider is inert (deferred)."""


def is_configured() -> bool:
    """True only when the API key is present (server→NOW calls)."""
    return bool(settings.NOWPAYMENTS_API_KEY)


def ipn_configured() -> bool:
    """True when the IPN secret is present (independent of the API key)."""
    return bool(settings.NOWPAYMENTS_IPN_SECRET)


# --------------------------------------------------------------------------- #
# Payment creation (server→NOW). Lazy-imports `requests`.
# --------------------------------------------------------------------------- #
def create_payment(
    *, price_amount, price_currency: str, pay_currency: str, order_id: str,
    ipn_callback_url: str = "", order_description: str = "",
) -> dict:
    """
    Create a NOW Payments payment for `price_amount` (USD) to be paid in `pay_currency`.
    Returns {payment_id, pay_address, pay_amount, pay_currency, payment_status}.
    NOW handles the fiat→crypto conversion and supplies the deposit address.
    """
    if not is_configured():
        raise NowPaymentsNotConfigured("NOW Payments API key is not configured.")
    import requests  # lazy — importing this module must not require the dep/network

    url = settings.NOWPAYMENTS_BASE_URL.rstrip("/") + "/payment"
    body = {
        "price_amount": float(price_amount),
        "price_currency": (price_currency or settings.NOWPAYMENTS_PRICE_CURRENCY).lower(),
        "pay_currency": pay_currency.lower(),
        "order_id": str(order_id),
        "order_description": order_description or f"Capimax BRX investment {order_id}",
    }
    if ipn_callback_url:
        body["ipn_callback_url"] = ipn_callback_url
    try:
        resp = requests.post(
            url, json=body,
            headers={"x-api-key": settings.NOWPAYMENTS_API_KEY,
                     "Content-Type": "application/json"},
            timeout=_REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:  # pragma: no cover - network failure
        raise NowPaymentsError("NOW Payments request failed.") from exc
    if resp.status_code >= 300:
        # Keep NOW's reason in the exception so the caller can log it (the view still
        # returns a safe, generic message to the client).
        raise NowPaymentsError(f"NOW Payments returned HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    payment_id = str(data.get("payment_id") or "")
    if not payment_id:
        raise NowPaymentsError("NOW Payments response missing payment_id.")
    return {
        "payment_id": payment_id,
        "pay_address": data.get("pay_address") or "",
        "pay_amount": data.get("pay_amount"),
        "pay_currency": data.get("pay_currency") or pay_currency,
        "payment_status": data.get("payment_status") or "waiting",
    }


def get_min_amount(pay_currency: str, *, price_currency: str = "usd") -> float | None:
    """
    The minimum payable amount (expressed in `price_currency`, e.g. USD) for `pay_currency`,
    from NOW Payments' /min-amount. NOW enforces a per-currency floor (network fees make
    BTC/ETH higher than a stablecoin), and a below-minimum /payment create is rejected — so we
    check this UP FRONT to give the buyer the exact figure instead of a generic failure.

    Returns None when the minimum is unknown (keys deferred, network error, or an unexpected
    body). Callers MUST treat None as "unknown" and NOT block the payment on it — the create
    call stays the real gate.
    """
    if not is_configured():
        return None
    import requests  # lazy — importing this module must not require the dep/network

    url = settings.NOWPAYMENTS_BASE_URL.rstrip("/") + "/min-amount"
    try:
        resp = requests.get(
            url,
            params={"currency_from": (price_currency or "usd").lower(),
                    "currency_to": pay_currency.lower()},
            headers={"x-api-key": settings.NOWPAYMENTS_API_KEY},
            timeout=_REQUEST_TIMEOUT,
        )
        if resp.status_code >= 300:
            return None
        val = resp.json().get("min_amount")
        return float(val) if val is not None else None
    except (requests.RequestException, ValueError, TypeError):
        return None


def create_invoice(
    *, price_amount, price_currency: str, order_id: str,
    ipn_callback_url: str = "", success_url: str = "", cancel_url: str = "",
    order_description: str = "",
) -> dict:
    """
    Create a NOW Payments HOSTED INVOICE for `price_amount` (USD). Returns
    {invoice_id, invoice_url}. Unlike `create_payment` (which returns a bare address we render
    ourselves), the customer opens `invoice_url` — NOW's branded page — picks the coin, sees
    the address/QR + countdown + live status, and completes there. NOW then fires the IPN
    carrying our `order_id`, which the receiver matches back to the Payment.
    """
    if not is_configured():
        raise NowPaymentsNotConfigured("NOW Payments API key is not configured.")
    import requests  # lazy — importing this module must not require the dep/network

    url = settings.NOWPAYMENTS_BASE_URL.rstrip("/") + "/invoice"
    body = {
        "price_amount": float(price_amount),
        "price_currency": (price_currency or settings.NOWPAYMENTS_PRICE_CURRENCY).lower(),
        "order_id": str(order_id),
        "order_description": order_description or f"Capimax BRX {order_id}",
    }
    if ipn_callback_url:
        body["ipn_callback_url"] = ipn_callback_url
    if success_url:
        body["success_url"] = success_url
    if cancel_url:
        body["cancel_url"] = cancel_url
    try:
        resp = requests.post(
            url, json=body,
            headers={"x-api-key": settings.NOWPAYMENTS_API_KEY,
                     "Content-Type": "application/json"},
            timeout=_REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:  # pragma: no cover - network failure
        raise NowPaymentsError("NOW Payments request failed.") from exc
    if resp.status_code >= 300:
        raise NowPaymentsError(f"NOW Payments returned HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    invoice_url = data.get("invoice_url") or ""
    if not invoice_url:
        raise NowPaymentsError("NOW Payments response missing invoice_url.")
    return {"invoice_id": str(data.get("id") or ""), "invoice_url": invoice_url}


# --------------------------------------------------------------------------- #
# IPN verification (the automation hinge) — manual, dependency-free.
# --------------------------------------------------------------------------- #
def _sorted_json(payload: dict) -> bytes:
    """NOW signs the KEY-SORTED, compact JSON of the body (recursively sorted)."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def verify_ipn(raw_body: bytes, signature_header: str) -> dict | None:
    """
    Verify the `x-nowpayments-sig` header (HMAC-SHA512 of the key-sorted JSON body
    with the IPN secret) and return the parsed payload. Returns None when the secret
    is unset or the signature is absent/invalid — callers MUST refuse to act (no mint).
    """
    if not ipn_configured() or not signature_header:
        return None
    try:
        payload = json.loads((raw_body or b"").decode() or "{}")
    except (ValueError, UnicodeDecodeError):
        return None
    if not isinstance(payload, dict):
        return None

    expected = hmac.new(
        settings.NOWPAYMENTS_IPN_SECRET.encode(), _sorted_json(payload), hashlib.sha512
    ).hexdigest()
    if not hmac.compare_digest(expected, signature_header.strip()):
        return None
    return payload


def sign_ipn(payload: dict, secret: str | None = None) -> str:
    """
    Produce a valid `x-nowpayments-sig` value for `payload` — used ONLY by tests and
    the DEBUG IPN-simulate command to forge a correctly-signed callback.
    """
    secret = secret or settings.NOWPAYMENTS_IPN_SECRET
    return hmac.new(secret.encode(), _sorted_json(payload), hashlib.sha512).hexdigest()


def parse_ipn(payload: dict) -> dict:
    """Normalize the bits we act on: {payment_id, payment_status, order_id}."""
    return {
        "payment_id": str(payload.get("payment_id") or ""),
        "payment_status": (payload.get("payment_status") or "").lower(),
        "order_id": str(payload.get("order_id") or ""),
    }
