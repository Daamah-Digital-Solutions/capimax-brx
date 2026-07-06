"""
Investor KYC tests — Phase 4. Run against Postgres (capimax_brx).

Covers the LOCKED decisions:
  * KYCApprovedPermission opens for approved, denies others (gate flip).
  * POST /api/investments/ rejects non-approved (kyc_required) and allows approved.
  * Sumsub webhook: valid GREEN→approved (+wallet auto-created), RED→rejected,
    BAD/absent signature→401 (no state change), unconfigured→503.
  * dev_grant_kyc approves + auto-creates wallet; --revoke removes it.
  * KYC_AUTO_APPROVE (DEBUG) auto-approves on submit.
  * /api/kyc/me/ + /submit/ shapes; access-token degrades to 503 when unconfigured.
  * Wallet tokens/transactions endpoints return the exact frontend shapes.
"""
import hashlib
import hmac
import json
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import OwnershipToken, UserWallet, WalletTransaction
from apps.wallets.services import get_or_create_custodial_wallet

from .models import KYCStatus, UserKYC
from .services import approve_kyc, get_or_create_kyc

_FAKE_TX_HASH = "0x" + "cd" * 32
_FAKE_BLOCK = 9001


def _fake_mint(contract_address, to_address, amount):
    return {
        "tx_hash": _FAKE_TX_HASH,
        "block_number": _FAKE_BLOCK,
        "chain_id": 97,
        "to": to_address,
        "amount": amount,
        "token_address": contract_address,
    }


def _make_deployed_property(slug="1"):
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("5000000")))
    p.save()  # token_supply auto-derives = 50000
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "11" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _mk_user(email="inv@example.com"):
    return User.objects.create_user(email=email, password="pw-12345-strong")


# --------------------------------------------------------------------------- #
# The gate flip
# --------------------------------------------------------------------------- #
class KYCGateTests(APITestCase):
    def test_wallet_create_denied_without_approved_kyc(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/wallets/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_wallet_create_allowed_with_approved_kyc(self):
        user = _mk_user()
        kyc = get_or_create_kyc(user)
        kyc.mark_approved()
        kyc.save()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/wallets/")
        self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertIn("wallet_address", resp.data)


# --------------------------------------------------------------------------- #
# KYC-before-invest (Part B)
# --------------------------------------------------------------------------- #
class InvestKYCEnforcementTests(APITestCase):
    def setUp(self):
        self.prop = _make_deployed_property("1")

    def test_invest_rejected_when_not_approved(self):
        user = _mk_user("noapprove@example.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            "/api/investments/",
            {"property_id": "1", "token_amount": 2, "payment_method": "card"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data.get("code"), "kyc_required")
        # No investment leaked through.
        self.assertEqual(UserWallet.objects.filter(user=user).count(), 0)

    def test_invest_allowed_and_mints_when_approved(self):
        user = _mk_user("ok@example.com")
        # Approval auto-creates the wallet (capture the on_commit hook).
        with self.captureOnCommitCallbacks(execute=True):
            approve_kyc(get_or_create_kyc(user), source="dev")
        self.assertTrue(UserWallet.objects.filter(user=user).exists())

        # Seed internal balance so the "balance" method settles + mints IN-REQUEST. The real
        # PSP methods (card/crypto/pronova) now defer to a webhook and sukuk to admin review,
        # so "balance" is the only accepted method that completes at creation — exactly what
        # this gate+mint test needs to exercise the KYC→wallet→invest→mint happy path.
        from apps.wallets.services import credit_user_balance
        credit_user_balance(user, Decimal("1000000"), source="deposit", reference="seed-kyc")

        # Re-fetch so the reverse `.kyc` cache reflects the approval (each real
        # request loads the user fresh via JWT auth — no stale cache in prod).
        user = User.objects.get(pk=user.pk)
        self.client.force_authenticate(user)
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint):
            resp = self.client.post(
                "/api/investments/",
                {"property_id": "1", "token_amount": 2, "payment_method": "balance"},
                format="json",
            )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["tokens_minted"])
        # Real (mocked) hash recorded — never fabricated.
        tx = WalletTransaction.objects.get(wallet__user=user)
        self.assertEqual(tx.tx_hash, _FAKE_TX_HASH)
        self.assertEqual(tx.block_number, _FAKE_BLOCK)


# --------------------------------------------------------------------------- #
# Sumsub webhook (the automation hinge)
# --------------------------------------------------------------------------- #
_WEBHOOK_SECRET = "test-webhook-secret"


def _sign(raw: bytes) -> str:
    return hmac.new(_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


@override_settings(SUMSUB_WEBHOOK_SECRET=_WEBHOOK_SECRET)
class SumsubWebhookTests(APITestCase):
    url = "/api/kyc/webhook/sumsub/"

    def _post(self, payload: dict, *, sign=True, bad=False):
        raw = json.dumps(payload).encode()
        headers = {}
        if sign:
            sig = "deadbeef" if bad else _sign(raw)
            headers["HTTP_X_PAYLOAD_DIGEST"] = sig
        return self.client.post(
            self.url, data=raw, content_type="application/json", **headers
        )

    def test_green_approves_and_creates_wallet(self):
        user = _mk_user("green@example.com")
        kyc = get_or_create_kyc(user)
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "appl-1",
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, KYCStatus.APPROVED)
        self.assertTrue(UserWallet.objects.filter(user=user).exists())

    def test_red_rejects(self):
        user = _mk_user("red@example.com")
        kyc = get_or_create_kyc(user)
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "appl-2",
            "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]},
        }
        resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, KYCStatus.REJECTED)
        self.assertIn("FORGERY", kyc.rejection_reason)
        self.assertFalse(UserWallet.objects.filter(user=user).exists())

    def test_bad_signature_rejected_no_state_change(self):
        user = _mk_user("bad@example.com")
        kyc = get_or_create_kyc(user)
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        resp = self._post(payload, bad=True)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, KYCStatus.PENDING)

    @override_settings(SUMSUB_WEBHOOK_SECRET="")
    def test_unconfigured_webhook_returns_503(self):
        resp = self._post({"type": "applicantReviewed"}, sign=False)
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


# --------------------------------------------------------------------------- #
# dev_grant_kyc + KYC_AUTO_APPROVE
# --------------------------------------------------------------------------- #
class DevGrantKYCTests(APITestCase):
    @override_settings(DEBUG=True)
    def test_dev_grant_approves_and_creates_wallet(self):
        user = _mk_user("dev@example.com")
        with self.captureOnCommitCallbacks(execute=True):
            call_command("dev_grant_kyc", "--email", "dev@example.com", stdout=StringIO())
        user.kyc.refresh_from_db()
        self.assertEqual(user.kyc.status, KYCStatus.APPROVED)
        self.assertTrue(UserWallet.objects.filter(user=user).exists())

    @override_settings(DEBUG=True)
    def test_dev_grant_revoke_removes_record(self):
        user = _mk_user("dev2@example.com")
        get_or_create_kyc(user)
        call_command("dev_grant_kyc", "--email", "dev2@example.com", "--revoke", stdout=StringIO())
        self.assertFalse(UserKYC.objects.filter(user=user).exists())

    @override_settings(DEBUG=False)
    def test_dev_grant_refuses_in_production(self):
        _mk_user("prod@example.com")
        with self.assertRaises(Exception):
            call_command("dev_grant_kyc", "--email", "prod@example.com", stdout=StringIO())

    @override_settings(DEBUG=True, KYC_AUTO_APPROVE=True)
    def test_auto_approve_on_submit(self):
        user = _mk_user("auto@example.com")
        self.client.force_authenticate(user)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post("/api/kyc/submit/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "approved")
        self.assertTrue(UserWallet.objects.filter(user=user).exists())


class ResetKYCTests(APITestCase):
    """reset_kyc returns a stuck KYC to a clean pending state (prod-safe, --yes-gated)."""

    def test_reset_clears_state_back_to_pending(self):
        from django.utils import timezone

        user = _mk_user("stuck@example.com")
        kyc = get_or_create_kyc(user)
        kyc.status = KYCStatus.SUBMITTED
        kyc.sumsub_applicant_id = "app-123"
        kyc.submitted_at = timezone.now()
        kyc.approved_at = timezone.now()
        kyc.rejection_reason = "x"
        kyc.save()

        call_command("reset_kyc", "--email", "stuck@example.com", "--yes", stdout=StringIO())

        kyc.refresh_from_db()
        self.assertEqual(kyc.status, KYCStatus.PENDING)
        self.assertEqual(kyc.sumsub_applicant_id, "")
        self.assertIsNone(kyc.submitted_at)
        self.assertIsNone(kyc.approved_at)
        self.assertEqual(kyc.rejection_reason, "")

    def test_reset_requires_yes(self):
        _mk_user("noyes@example.com")
        with self.assertRaises(Exception):
            call_command("reset_kyc", "--email", "noyes@example.com", stdout=StringIO())

    def test_reset_no_record_is_noop(self):
        _mk_user("norec@example.com")
        # No KYC row created — the command reports and exits cleanly (no crash).
        call_command("reset_kyc", "--email", "norec@example.com", "--yes", stdout=StringIO())
        self.assertFalse(UserKYC.objects.filter(user__email="norec@example.com").exists())


# --------------------------------------------------------------------------- #
# KYC status/submit/access-token endpoints + provider inert default
# --------------------------------------------------------------------------- #
class KYCEndpointTests(APITestCase):
    def test_me_defaults_to_pending(self):
        user = _mk_user("me@example.com")
        self.client.force_authenticate(user)
        resp = self.client.get("/api/kyc/me/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "pending")
        # Curated: no PII / Sumsub ids leak into the status projection.
        self.assertNotIn("sumsub_applicant_id", resp.data)

    def test_submit_advances_to_submitted(self):
        user = _mk_user("sub@example.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            "/api/kyc/submit/", {"first_name": "A", "last_name": "B"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "submitted")
        self.assertIsNotNone(resp.data["submitted_at"])

    def test_access_token_unconfigured_returns_503(self):
        user = _mk_user("tok@example.com")
        self.client.force_authenticate(user)
        resp = self.client.post("/api/kyc/access-token/")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "kyc_provider_unconfigured")

    def test_access_token_configured_does_not_mark_submitted(self):
        """Opening the widget (minting the applicant + issuing a token) must NOT flip status to
        `submitted` — the user hasn't submitted anything yet, so an early exit can't strand them
        in "Under Review". Status advances to `submitted` only on the real onApplicantSubmitted
        (the frontend then POSTs /kyc/submit/)."""
        user = _mk_user("tok-ok@example.com")
        self.client.force_authenticate(user)
        with mock.patch("apps.kyc.sumsub.is_configured", return_value=True), \
             mock.patch("apps.kyc.sumsub.create_applicant", return_value="app-xyz"), \
             mock.patch("apps.kyc.sumsub.issue_access_token", return_value="tok-abc"):
            resp = self.client.post("/api/kyc/access-token/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["token"], "tok-abc")
        kyc = get_or_create_kyc(user)
        self.assertEqual(kyc.sumsub_applicant_id, "app-xyz")   # applicant linked...
        self.assertEqual(kyc.status, KYCStatus.PENDING)         # ...but NOT submitted
        self.assertIsNone(kyc.submitted_at)


# --------------------------------------------------------------------------- #
# Holdings + transactions endpoint shapes (frontend repoint targets)
# --------------------------------------------------------------------------- #
class WalletReadEndpointShapeTests(APITestCase):
    def test_tokens_and_transactions_shapes(self):
        user = _mk_user("hold@example.com")
        wallet, _ = get_or_create_custodial_wallet(user)
        OwnershipToken.objects.create(
            wallet=wallet, property_id="1", property_name="Test Tower",
            token_symbol="BRX1", token_amount=2, token_value_usd=Decimal("200"),
            ownership_percentage=Decimal("0.004000"),
        )
        WalletTransaction.objects.create(
            wallet=wallet, tx_hash=_FAKE_TX_HASH, tx_type="mint",
            amount=Decimal("200"), token_symbol="BRX1", status="confirmed",
            block_number=_FAKE_BLOCK, chain_id=97,
        )
        self.client.force_authenticate(user)

        tok = self.client.get(f"/api/wallets/{wallet.id}/tokens/")
        self.assertEqual(tok.status_code, status.HTTP_200_OK)
        self.assertEqual(set(tok.data[0]) >= {
            "id", "wallet_id", "property_id", "property_name", "token_symbol",
            "token_amount", "token_value_usd", "ownership_percentage", "status",
        }, True)

        txs = self.client.get(f"/api/wallets/{wallet.id}/transactions/")
        self.assertEqual(txs.status_code, status.HTTP_200_OK)
        self.assertEqual(txs.data[0]["tx_hash"], _FAKE_TX_HASH)
        self.assertEqual(set(txs.data[0]) >= {
            "id", "tx_hash", "tx_type", "amount", "token_symbol", "status",
            "block_number", "created_at",
        }, True)

    def test_transactions_owner_only(self):
        owner = _mk_user("owner@example.com")
        other = _mk_user("other@example.com")
        wallet, _ = get_or_create_custodial_wallet(owner)
        self.client.force_authenticate(other)
        resp = self.client.get(f"/api/wallets/{wallet.id}/transactions/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
