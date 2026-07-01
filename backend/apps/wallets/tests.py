"""
Wallet domain tests — Phase 3 Wave 1. Run against Postgres (capimax_brx).

Focus is the non-negotiable safety constraints:
  * private keys are encrypted at rest and NEVER serialized, logged, or exposed;
  * wallet creation is KYC-gated (403 today);
  * the KeyManager round-trips and ciphertext is useless without the env key.
"""
import logging

from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings
from eth_account import Account
from rest_framework import status
from rest_framework.test import APITestCase
from web3 import Web3

from apps.core.models import User

from .keys import FernetKeyManager, get_key_manager
from .models import UserWallet, WalletKeyMaterial
from .serializers import UserWalletSerializer
from .services import (
    credit_user_balance,
    debit_user_balance,
    get_or_create_custodial_wallet,
)

# A fixed, valid test keypair so we can assert the EXACT plaintext key never leaks.
_KNOWN_PRIVATE_KEY = "0x" + "11" * 32
_KNOWN_ACCOUNT = Account.from_key(_KNOWN_PRIVATE_KEY)


class _CaptureHandler(logging.Handler):
    """Collects every log message emitted while attached (to scan for leaks)."""

    def __init__(self):
        super().__init__(level=logging.DEBUG)
        self.messages = []

    def emit(self, record):
        try:
            self.messages.append(record.getMessage())
        except Exception:
            self.messages.append(str(record.msg))


class KeyManagerTests(TestCase):
    def test_round_trips_and_ciphertext_is_opaque(self):
        km = get_key_manager()
        secret = "0xabc123deadbeef"
        token = km.encrypt(secret)
        self.assertNotEqual(token, secret)
        self.assertNotIn(secret, token)  # plaintext not embedded in ciphertext
        self.assertEqual(km.decrypt(token), secret)
        self.assertEqual(km.backend_id, "fernet-db")

    def test_decrypt_fails_with_wrong_key(self):
        secret = "0xsensitive"
        token = FernetKeyManager(Fernet.generate_key()).encrypt(secret)
        other = FernetKeyManager(Fernet.generate_key())
        with self.assertRaises(ValueError):
            other.decrypt(token)  # ciphertext is useless without the right key

    def test_tampered_ciphertext_is_rejected(self):
        km = FernetKeyManager(Fernet.generate_key())
        token = km.encrypt("0xsecret")
        tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
        with self.assertRaises(ValueError):
            km.decrypt(tampered)

    @override_settings(WALLET_ENCRYPTION_KEY="")
    def test_missing_key_raises(self):
        with self.assertRaises(ImproperlyConfigured):
            FernetKeyManager()

    @override_settings(WALLET_ENCRYPTION_KEY="not-a-valid-fernet-key")
    def test_invalid_key_raises(self):
        with self.assertRaises(ImproperlyConfigured):
            FernetKeyManager()


class WalletServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="w1@example.com", password="pw12345!")

    def test_creates_wallet_with_valid_bsc_address(self):
        wallet, created = get_or_create_custodial_wallet(self.user)
        self.assertTrue(created)
        self.assertTrue(Web3.is_address(wallet.wallet_address))
        # Stored checksummed.
        self.assertEqual(
            wallet.wallet_address, Web3.to_checksum_address(wallet.wallet_address)
        )
        self.assertEqual(wallet.network, "bsc-testnet")
        self.assertEqual(wallet.wallet_type, "custodial")

    def test_private_key_is_encrypted_and_recoverable_only_with_env_key(self):
        wallet, _ = get_or_create_custodial_wallet(self.user)
        material = WalletKeyMaterial.objects.get(wallet=wallet)
        # Stored value is ciphertext, not a raw private key.
        self.assertNotIn("0x", material.encrypted_private_key[:4])
        self.assertEqual(material.key_backend, "fernet-db")
        # Decrypting with the configured key yields a key whose address matches.
        plaintext_key = get_key_manager().decrypt(material.encrypted_private_key)
        derived = Web3.to_checksum_address(Account.from_key(plaintext_key).address)
        self.assertEqual(derived, wallet.wallet_address)
        # A DB dump alone (different/blank key) cannot recover it.
        wrong = FernetKeyManager(Fernet.generate_key())
        with self.assertRaises(ValueError):
            wrong.decrypt(material.encrypted_private_key)

    def test_idempotent_single_wallet_per_user(self):
        w1, c1 = get_or_create_custodial_wallet(self.user)
        w2, c2 = get_or_create_custodial_wallet(self.user)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(w1.pk, w2.pk)
        self.assertEqual(UserWallet.objects.filter(user=self.user).count(), 1)
        self.assertEqual(WalletKeyMaterial.objects.filter(wallet=w1).count(), 1)

    def test_private_key_never_appears_in_logs_or_repr_or_db_plaintext(self):
        """Patch key generation to a KNOWN key, then assert it leaks nowhere."""
        handler = _CaptureHandler()
        root = logging.getLogger()
        root.addHandler(handler)
        old_level = root.level
        root.setLevel(logging.DEBUG)
        try:
            from unittest import mock

            with mock.patch(
                "apps.wallets.services.Account.create", return_value=_KNOWN_ACCOUNT
            ):
                wallet, created = get_or_create_custodial_wallet(self.user)
        finally:
            root.setLevel(old_level)
            root.removeHandler(handler)

        self.assertTrue(created)
        key_no_prefix = _KNOWN_PRIVATE_KEY[2:]
        # Not in any log line.
        for line in handler.messages:
            self.assertNotIn(_KNOWN_PRIVATE_KEY, line)
            self.assertNotIn(key_no_prefix, line)
        # Not in the model's string representation.
        material = WalletKeyMaterial.objects.get(wallet=wallet)
        self.assertNotIn(_KNOWN_PRIVATE_KEY, str(wallet))
        self.assertNotIn(_KNOWN_PRIVATE_KEY, str(material))
        # Not stored as plaintext in the DB.
        self.assertNotIn(_KNOWN_PRIVATE_KEY, material.encrypted_private_key)
        self.assertNotIn(key_no_prefix, material.encrypted_private_key)
        # Not in the serialized API representation.
        self.assertNotIn(
            _KNOWN_PRIVATE_KEY, str(UserWalletSerializer(wallet).data)
        )


class WalletSerializerExposureTests(TestCase):
    def test_serializer_exposes_only_public_fields(self):
        user = User.objects.create_user(email="w2@example.com", password="pw12345!")
        wallet, _ = get_or_create_custodial_wallet(user)
        data = UserWalletSerializer(wallet).data
        self.assertEqual(
            set(data.keys()),
            {"id", "wallet_address", "network", "wallet_type", "created_at"},
        )
        # No key-ish field name anywhere.
        for key in data:
            self.assertNotIn("key", key.lower())
            self.assertNotIn("private", key.lower())


class WalletApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="api@example.com", password="pw12345!")

    def test_create_requires_authentication(self):
        resp = self.client.post("/api/wallets/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_is_kyc_gated_403_today(self):
        # Authenticated but KYC not approved -> KYCApprovedPermission denies (403).
        self.client.force_authenticate(self.user)
        resp = self.client.post("/api/wallets/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # No wallet was created behind the gate.
        self.assertFalse(UserWallet.objects.filter(user=self.user).exists())

    def test_me_requires_authentication(self):
        self.assertEqual(
            self.client.get("/api/wallets/me/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_me_returns_404_without_wallet(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(
            self.client.get("/api/wallets/me/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_me_returns_only_public_fields(self):
        # Create via the service (bypassing the KYC gate, which is the API's job),
        # then read it back through the API.
        get_or_create_custodial_wallet(self.user)
        self.client.force_authenticate(self.user)
        resp = self.client.get("/api/wallets/me/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.json()
        self.assertEqual(
            set(body.keys()),
            {"id", "wallet_address", "network", "wallet_type", "created_at"},
        )
        self.assertTrue(Web3.is_address(body["wallet_address"]))


class BalanceTransactionHistoryTests(APITestCase):
    """The read-only, self-scoped internal-balance ledger history (Phase 12 finishing)."""

    def setUp(self):
        from decimal import Decimal

        self.user = User.objects.create_user(email="hist@ex.com", password="pw-12345-strong")
        self.other = User.objects.create_user(email="hist-other@ex.com", password="pw-12345-strong")
        # The caller's ledger: a distribution credit + a withdrawal debit.
        credit_user_balance(self.user, Decimal("840.00"), source="distribution", reference="D1")
        debit_user_balance(self.user, Decimal("200.00"), source="withdrawal", reference="W1")
        # Another user's entry must never appear in the caller's history.
        credit_user_balance(self.other, Decimal("999.00"), source="distribution", reference="DX")

    def test_self_scoped_history_with_sources_and_signs(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/wallets/balance/transactions/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data
        self.assertEqual(len(rows), 2)  # only the caller's two entries
        by_source = {r["source"]: r for r in rows}
        self.assertEqual(by_source["distribution"]["entry_type"], "credit")
        self.assertEqual(by_source["distribution"]["amount"], 840.0)
        self.assertEqual(by_source["withdrawal"]["entry_type"], "debit")
        self.assertEqual(by_source["withdrawal"]["amount"], 200.0)
        # The other user's row (reference "DX", amount 999) is NOT visible. Check the
        # actual fields, not a stringified blob (a timestamp's microseconds could contain
        # "999" and falsely trip a substring match).
        self.assertNotIn("DX", {r["reference"] for r in rows})
        self.assertNotIn(999.0, [r["amount"] for r in rows])

    def test_history_is_read_only(self):
        self.client.force_authenticate(self.user)
        res = self.client.post("/api/wallets/balance/transactions/", {}, format="json")
        self.assertIn(res.status_code, (405, 403))  # no write path

    def test_history_requires_auth(self):
        self.assertEqual(
            self.client.get("/api/wallets/balance/transactions/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
