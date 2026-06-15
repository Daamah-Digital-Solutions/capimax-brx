"""
KeyManager — the secure-secret abstraction for custodial key material.

SAFETY CONSTRAINT (Phase 3 Wave 1, non-negotiable):
  * Private keys are NEVER stored in plaintext. They are protected with
    authenticated encryption before they ever touch the database.
  * The encryption key lives in the environment (WALLET_ENCRYPTION_KEY),
    SEPARATE from the database — a DB dump alone is useless to an attacker.
  * Callers depend ONLY on this `KeyManager` interface, never on a concrete
    backend, so the storage/crypto backend can later be swapped to AWS KMS or
    HashiCorp Vault Transit WITHOUT rewriting any caller.

Today's concrete backend is `FernetKeyManager` (cryptography's Fernet =
AES-128-CBC + HMAC-SHA256, authenticated). A future `KmsKeyManager` /
`VaultTransitKeyManager` would implement the same two methods by delegating
encrypt/decrypt to the external service — callers do not change.

Nothing in this module logs, prints, or returns plaintext key material except
the explicit `decrypt()` return value its callers ask for.
"""
from __future__ import annotations

import abc

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class KeyManager(abc.ABC):
    """
    Abstraction over secret protection. Implementations must round-trip:
    `decrypt(encrypt(x)) == x`, and `encrypt` must be authenticated (tampering
    with the ciphertext must make `decrypt` fail rather than return garbage).
    """

    #: Stable identifier persisted alongside ciphertext, so a stored secret can
    #: always be traced to the backend that produced it (needed for migrations
    #: between backends, e.g. fernet-db -> aws-kms).
    backend_id: str = "abstract"

    @abc.abstractmethod
    def encrypt(self, plaintext: str) -> str:
        """Return opaque, authenticated ciphertext (str) for `plaintext`."""

    @abc.abstractmethod
    def decrypt(self, ciphertext: str) -> str:
        """Return the original plaintext for ciphertext produced by `encrypt`."""


class FernetKeyManager(KeyManager):
    """
    DB-at-rest backend: encrypts with a Fernet key supplied via the environment
    (WALLET_ENCRYPTION_KEY). The key is NEVER read from or written to the
    database or the repo.
    """

    backend_id = "fernet-db"

    def __init__(self, key: str | bytes | None = None):
        raw = key if key is not None else getattr(settings, "WALLET_ENCRYPTION_KEY", "")
        if not raw:
            raise ImproperlyConfigured(
                "WALLET_ENCRYPTION_KEY is not set. Generate one with "
                "`python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\"` and put it in the "
                "environment (NEVER in the repo or the database)."
            )
        if isinstance(raw, str):
            raw = raw.encode()
        try:
            self._fernet = Fernet(raw)
        except (ValueError, TypeError) as exc:
            raise ImproperlyConfigured(
                "WALLET_ENCRYPTION_KEY is not a valid Fernet key (must be a "
                "url-safe base64-encoded 32-byte key)."
            ) from exc

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken as exc:
            # Wrong key or tampered ciphertext — fail loudly, never return garbage.
            raise ValueError("Could not decrypt secret (wrong key or tampered data).") from exc

    @staticmethod
    def generate_key() -> str:
        """Helper for ops: produce a fresh Fernet key string for the environment."""
        return Fernet.generate_key().decode()


# Registry of available backends. Add "aws-kms" / "vault-transit" here later.
_BACKENDS = {
    "fernet-db": FernetKeyManager,
}


def get_key_manager() -> KeyManager:
    """
    Return the configured KeyManager. Backend is env-driven (KEY_MANAGER_BACKEND)
    so swapping to KMS/Vault is a config change, not a code change. SPEC §5.2.
    """
    backend = getattr(settings, "KEY_MANAGER_BACKEND", "fernet-db")
    try:
        return _BACKENDS[backend]()
    except KeyError as exc:
        raise ImproperlyConfigured(
            f"Unknown KEY_MANAGER_BACKEND '{backend}'. "
            f"Known backends: {', '.join(sorted(_BACKENDS))}."
        ) from exc
