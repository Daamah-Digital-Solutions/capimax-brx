"""Time-based one-time passwords (RFC 6238) for two-factor sign-in with an authenticator app."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

ISSUER = "Capimax BRX"


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _code(secret: str, counter: int) -> str:
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def verify(secret: str, code: str, *, at: float | None = None, window: int = 1) -> bool:
    """True if `code` is valid now (± `window` × 30 s for clock drift)."""
    code = (code or "").strip().replace(" ", "")
    if not secret or not code.isdigit() or len(code) != 6:
        return False
    counter = int((at if at is not None else time.time()) // 30)
    return any(hmac.compare_digest(_code(secret, counter + d), code) for d in range(-window, window + 1))


def provisioning_uri(secret: str, account: str) -> str:
    return (f"otpauth://totp/{quote(ISSUER)}:{quote(account)}?secret={secret}"
            f"&issuer={quote(ISSUER)}&algorithm=SHA1&digits=6&period=30")
