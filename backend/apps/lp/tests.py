"""
LP onboarding tests — Phase 6 Wave 1. Run against Postgres (capimax_brx).

Covers the LOCKED decisions:
  * Apply creates a pending profile; apply is idempotent; GET 404 when none.
  * KYB submit → under_review + persists business info.
  * Shared Sumsub webhook routes business-level (KYB) GREEN → LP approved + the LP
    role activated; RED → rejected; bad/absent signature → 401 (no state change);
    investor KYC path is unaffected (no regression).
  * dev_grant_kyb approves + activates the role; --revoke removes the record.
  * Withdrawal creates a transaction; insufficient balance → 400.
  * Documents upload/list/delete are owner-scoped; one LP can't touch another's data.
  * KYB access-token degrades to 503 when Sumsub is unconfigured.
"""
import hashlib
import hmac
import json
from decimal import Decimal
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Profile, User

from .models import KYBStatus, LiquidityProvider, LPDocument, LPStatus, LPTransaction
from .services import get_or_create_lp


def _mk_user(email="lp@example.com", *, role=Profile.Role.LP):
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    # The signal creates the profile as investor/active; set the LP role parked at
    # pending_verification to exercise the activation hinge.
    profile = user.profile
    profile.role = role
    if role in (Profile.Role.LP,):
        profile.role_status = Profile.RoleStatus.PENDING_VERIFICATION
        profile.role_verified_at = None
    profile.save()
    return user


_APPLY = {
    "company_name": "Acme Capital",
    "contact_name": "Jane Doe",
    "email": "jane@acme.com",
    "phone": "+971500000000",
    "country": "UAE",
    "investment_amount": "100000",
}
_KYB = {
    "business_type": "llc",
    "business_registration_number": "REG-123",
    "tax_id": "TAX-9",
    "business_address": "1 Marina, Dubai",
    "business_description": "Liquidity provision",
    "annual_revenue": "1m_10m",
    "source_of_funds": "business_profits",
}


# --------------------------------------------------------------------------- #
# Apply + profile
# --------------------------------------------------------------------------- #
class LPApplyTests(APITestCase):
    def test_get_profile_404_when_none(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.get("/api/lp/profile/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_apply_creates_pending_profile(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        resp = self.client.post("/api/lp/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], LPStatus.PENDING)
        self.assertEqual(resp.data["kyb_status"], KYBStatus.NOT_STARTED)
        # money serialized as a JSON number, not a string
        self.assertEqual(resp.data["investment_amount"], 100000.0)
        self.assertTrue(LiquidityProvider.objects.filter(user=user).exists())

    def test_apply_is_idempotent(self):
        user = _mk_user()
        self.client.force_authenticate(user)
        self.client.post("/api/lp/profile/", _APPLY, format="json")
        resp = self.client.post("/api/lp/profile/", _APPLY, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(LiquidityProvider.objects.filter(user=user).count(), 1)


# --------------------------------------------------------------------------- #
# KYB submit
# --------------------------------------------------------------------------- #
class LPKYBSubmitTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)
        self.client.post("/api/lp/profile/", _APPLY, format="json")

    def test_kyb_submit_moves_under_review(self):
        resp = self.client.post("/api/lp/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["kyb_status"], KYBStatus.UNDER_REVIEW)
        self.assertEqual(resp.data["business_type"], "llc")
        self.assertIsNotNone(resp.data["kyb_submitted_at"])

    def test_kyb_submit_requires_profile(self):
        other = _mk_user("nolp@example.com")
        self.client.force_authenticate(other)
        resp = self.client.post("/api/lp/kyb/submit/", _KYB, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# --------------------------------------------------------------------------- #
# The shared Sumsub webhook (the automation hinge for KYB)
# --------------------------------------------------------------------------- #
_WEBHOOK_SECRET = "test-webhook-secret"
_KYB_LEVEL = "basic-kyb-level"


def _sign(raw: bytes) -> str:
    return hmac.new(_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()


@override_settings(SUMSUB_WEBHOOK_SECRET=_WEBHOOK_SECRET, SUMSUB_KYB_LEVEL_NAME=_KYB_LEVEL)
class LPWebhookTests(APITestCase):
    url = "/api/kyc/webhook/sumsub/"

    def _post(self, payload: dict, *, sign=True, bad=False):
        raw = json.dumps(payload).encode()
        headers = {}
        if sign:
            headers["HTTP_X_PAYLOAD_DIGEST"] = "deadbeef" if bad else _sign(raw)
        return self.client.post(self.url, data=raw, content_type="application/json", **headers)

    def test_business_green_approves_and_activates_role(self):
        user = _mk_user("green-lp@example.com")
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        lp.sumsub_applicant_id = "kyb-appl-1"
        lp.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "kyb-appl-1",
            "levelName": _KYB_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("domain"), "lp")
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.APPROVED)
        self.assertEqual(lp.kyb_status, KYBStatus.APPROVED)
        # role activated
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    def test_business_green_resolves_by_level_and_external_id(self):
        # No applicant id on the LP record — resolve by KYB level + externalUserId.
        user = _mk_user("level-lp@example.com")
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "unknown-appl",
            "levelName": _KYB_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.APPROVED)

    def test_business_red_rejects(self):
        user = _mk_user("red-lp@example.com")
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        lp.sumsub_applicant_id = "kyb-appl-2"
        lp.save()
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "kyb-appl-2",
            "levelName": _KYB_LEVEL,
            "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]},
        }
        resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.REJECTED)
        self.assertIn("FORGERY", lp.kyb_rejection_reason)

    def test_bad_signature_rejected_no_state_change(self):
        user = _mk_user("badsig-lp@example.com")
        lp, _ = get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        lp.sumsub_applicant_id = "kyb-appl-3"
        lp.save()
        payload = {
            "type": "applicantReviewed",
            "applicantId": "kyb-appl-3",
            "levelName": _KYB_LEVEL,
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        resp = self._post(payload, bad=True)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        lp.refresh_from_db()
        self.assertEqual(lp.status, LPStatus.PENDING)

    def test_investor_kyc_unaffected_when_no_lp(self):
        # An investor-KYC event for a user with no LP must fall through to KYC.
        from apps.kyc.services import get_or_create_kyc

        user = _mk_user("inv-only@example.com", role=Profile.Role.INVESTOR)
        kyc = get_or_create_kyc(user)
        payload = {
            "type": "applicantReviewed",
            "externalUserId": str(user.pk),
            "applicantId": "kyc-appl-9",
            "levelName": "basic-kyc-level",
            "reviewResult": {"reviewAnswer": "GREEN"},
        }
        with self.captureOnCommitCallbacks(execute=True):
            resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotEqual(resp.data.get("domain"), "lp")
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, "approved")


# --------------------------------------------------------------------------- #
# dev_grant_kyb
# --------------------------------------------------------------------------- #
class DevGrantKYBTests(APITestCase):
    @override_settings(DEBUG=True)
    def test_dev_grant_approves_and_activates_role(self):
        user = _mk_user("dev-lp@example.com")
        get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        with self.captureOnCommitCallbacks(execute=True):
            call_command("dev_grant_kyb", "--email", user.email, stdout=StringIO())
        lp = LiquidityProvider.objects.get(user=user)
        self.assertEqual(lp.status, LPStatus.APPROVED)
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.role_status, Profile.RoleStatus.ACTIVE)

    @override_settings(DEBUG=True)
    def test_dev_grant_revoke_removes_record(self):
        user = _mk_user("dev-lp2@example.com")
        get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        call_command("dev_grant_kyb", "--email", user.email, "--revoke", stdout=StringIO())
        self.assertFalse(LiquidityProvider.objects.filter(user=user).exists())

    @override_settings(DEBUG=False)
    def test_dev_grant_refuses_in_production(self):
        _mk_user("prod-lp@example.com")
        with self.assertRaises(Exception):
            call_command("dev_grant_kyb", "--email", "prod-lp@example.com", stdout=StringIO())


# --------------------------------------------------------------------------- #
# Withdrawals + transactions
# --------------------------------------------------------------------------- #
class LPWithdrawalTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)
        self.lp, _ = get_or_create_lp(
            self.user, defaults={"contact_name": "J", "email": self.user.email}
        )

    def test_withdrawal_creates_transaction(self):
        self.lp.current_balance = Decimal("5000")
        self.lp.save()
        resp = self.client.post(
            "/api/lp/withdrawals/",
            {"amount": "1000", "withdrawal_method": "bank", "notes": "rent"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["tx_type"], "withdrawal")
        self.assertEqual(resp.data["amount"], 1000.0)
        self.assertTrue(LPTransaction.objects.filter(lp=self.lp).exists())

    def test_withdrawal_insufficient_balance(self):
        self.lp.current_balance = Decimal("100")
        self.lp.save()
        resp = self.client.post(
            "/api/lp/withdrawals/",
            {"amount": "1000", "withdrawal_method": "bank"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["code"], "insufficient_balance")

    def test_transactions_list_owner_scoped(self):
        LPTransaction.objects.create(
            lp=self.lp, tx_type="earnings", amount=Decimal("50"), currency="USD"
        )
        resp = self.client.get("/api/lp/transactions/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)


# --------------------------------------------------------------------------- #
# Documents (owner-scoped) + cross-LP isolation
# --------------------------------------------------------------------------- #
class LPDocumentTests(APITestCase):
    def setUp(self):
        self.user = _mk_user("doc-lp@example.com")
        self.client.force_authenticate(self.user)
        self.lp, _ = get_or_create_lp(
            self.user, defaults={"contact_name": "J", "email": self.user.email}
        )

    def _upload(self):
        f = SimpleUploadedFile("license.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        return self.client.post(
            "/api/lp/documents/",
            {"file": f, "document_type": "business_license", "document_name": "License"},
            format="multipart",
        )

    def test_upload_list_delete(self):
        up = self._upload()
        self.assertEqual(up.status_code, status.HTTP_201_CREATED)
        doc_id = up.data["id"]

        lst = self.client.get("/api/lp/documents/")
        self.assertEqual(len(lst.data), 1)

        dele = self.client.delete(f"/api/lp/documents/{doc_id}/")
        self.assertEqual(dele.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(LPDocument.objects.filter(id=doc_id).exists())

    def test_other_lp_cannot_see_or_delete(self):
        up = self._upload()
        doc_id = up.data["id"]

        other = _mk_user("other-lp@example.com")
        self.client.force_authenticate(other)
        # not in the other user's list
        lst = self.client.get("/api/lp/documents/")
        self.assertEqual(len(lst.data), 0)
        # cannot delete someone else's doc
        dele = self.client.delete(f"/api/lp/documents/{doc_id}/")
        self.assertEqual(dele.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(LPDocument.objects.filter(id=doc_id).exists())


# --------------------------------------------------------------------------- #
# KYB access-token degrade
# --------------------------------------------------------------------------- #
class LPKYBAccessTokenTests(APITestCase):
    @override_settings(SUMSUB_APP_TOKEN="", SUMSUB_SECRET_KEY="")
    def test_access_token_503_when_unconfigured(self):
        user = _mk_user("token-lp@example.com")
        self.client.force_authenticate(user)
        get_or_create_lp(user, defaults={"contact_name": "J", "email": user.email})
        resp = self.client.post("/api/lp/kyb/access-token/")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "kyb_provider_unconfigured")


# =========================================================================== #
# LP SECONDARY MARKET — Phase 6 Wave 2 (on-chain settlement; transfer MOCKED so
# the suite stays network-free, like the mint tests). The REAL on-chain cycle is
# exercised by the testnet command + the manual run (Part D).
# =========================================================================== #
from decimal import Decimal as _D
from unittest import mock

from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import OwnershipToken, UserBalance, WalletTransaction
from apps.wallets.services import get_or_create_custodial_wallet

from .models import LPHolding, LPMarketListing, LPStatus

_FAKE_TRANSFER = {
    "token_address": "0x" + "11" * 20,
    "from": "0x" + "22" * 20,
    "to": "0x" + "33" * 20,
    "amount": 0,
    "tx_hash": "0x" + "ab" * 32,
    "block_number": 123456,
    "chain_id": 97,
    "explorer_tx": "https://testnet.bscscan.com/tx/0x" + "ab" * 32,
}


def _deployed_property(slug="1"):
    p = Property(**_valid_property_kwargs(slug=slug, total_value=_D("5000000")))
    p.save()  # token_supply auto-derives = 50000
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "11" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _seller_with_tokens(email, prop, amount):
    """A user with a real custodial wallet + an OwnershipToken position."""
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    wallet, _ = get_or_create_custodial_wallet(user)
    OwnershipToken.objects.create(
        wallet=wallet, property_id=prop.slug, property_name=prop.name,
        token_symbol="BRX1", token_amount=amount, token_value_usd=amount * 100,
    )
    return user, wallet


def _approved_lp_buyer(email, balance):
    user = _mk_user(email)  # role lp
    lp = LiquidityProvider.objects.create(
        user=user, contact_name="LP", email=email, status=LPStatus.APPROVED,
        kyb_status=KYBStatus.APPROVED, current_balance=_D(str(balance)),
    )
    return user, lp


class LPMarketListingEscrowTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property()
        self.seller, self.wallet = _seller_with_tokens("seller@ex.com", self.prop, 10)
        self.client.force_authenticate(self.seller)

    def test_list_escrow_locks_tokens(self):
        resp = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 4, "unit_price": "100"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "listed")
        self.assertEqual(resp.data["total_value"], 400.0)
        pos = OwnershipToken.objects.get(wallet=self.wallet, property_id=self.prop.slug)
        self.assertEqual(pos.locked_amount, 4)
        self.assertEqual(pos.available_amount, 6)

    def test_cannot_list_more_than_unlocked(self):
        resp = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 11},
            format="json",
        )
        self.assertEqual(resp.status_code, 422)

    def test_cannot_double_list_beyond_available(self):
        ok = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 7}, format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        # 7 locked; only 3 free → listing 4 more must fail.
        again = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 4}, format="json",
        )
        self.assertEqual(again.status_code, 422)

    def test_cancel_unlocks(self):
        created = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 5}, format="json",
        )
        listing_id = created.data["id"]
        resp = self.client.post(f"/api/lp/market/{listing_id}/cancel/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "cancelled")
        pos = OwnershipToken.objects.get(wallet=self.wallet, property_id=self.prop.slug)
        self.assertEqual(pos.locked_amount, 0)

    @override_settings(LP_MARKET_FEE_PERCENT=2.0)
    def test_fee_is_backend_configurable(self):
        resp = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 5, "unit_price": "100"},
            format="json",
        )
        # total 500 → 2% fee = 10, net 490
        self.assertEqual(resp.data["platform_fee_percent"], 2.0)
        self.assertEqual(resp.data["platform_fee_amount"], 10.0)
        self.assertEqual(resp.data["net_amount"], 490.0)


@mock.patch("apps.lp.market_services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class LPMarketPurchaseTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property()
        self.seller, self.seller_wallet = _seller_with_tokens("s2@ex.com", self.prop, 10)
        # Seller lists 4 tokens (escrowed).
        self.client.force_authenticate(self.seller)
        listing = self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": 4, "unit_price": "100"},
            format="json",
        )
        self.listing_id = listing.data["id"]

    def _buy(self, lp_user):
        self.client.force_authenticate(lp_user)
        return self.client.post(f"/api/lp/market/{self.listing_id}/purchase/")

    def test_purchase_settles_on_chain_and_moves_balances(self, m_transfer):
        buyer_user, lp = _approved_lp_buyer("buyer@ex.com", 1000)
        resp = self._buy(buyer_user)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["tx_hash"], _FAKE_TRANSFER["tx_hash"])
        m_transfer.assert_called_once()

        # LP balance debited by total (400); seller credited net (400 - 1% = 396).
        lp.refresh_from_db()
        self.assertEqual(lp.current_balance, _D("600.00"))
        seller_balance = UserBalance.objects.get(user=self.seller)
        self.assertEqual(seller_balance.current_balance, _D("396.00"))

        # BUG FIX: seller's on-chain position decreases, buyer's increases.
        seller_pos = OwnershipToken.objects.get(
            wallet=self.seller_wallet, property_id=self.prop.slug
        )
        self.assertEqual(seller_pos.token_amount, 6)
        self.assertEqual(seller_pos.locked_amount, 0)  # escrow consumed
        buyer_wallet = buyer_user.wallet
        buyer_pos = OwnershipToken.objects.get(
            wallet=buyer_wallet, property_id=self.prop.slug
        )
        self.assertEqual(buyer_pos.token_amount, 4)

        # Holding + listing + WalletTransaction 'transfer' rows (real hash on both wallets).
        self.assertTrue(LPHolding.objects.filter(lp=lp, token_amount=4).exists())
        listing = LPMarketListing.objects.get(pk=self.listing_id)
        self.assertEqual(listing.status, "completed")
        self.assertEqual(listing.settlement_tx_hash, _FAKE_TRANSFER["tx_hash"])
        self.assertEqual(
            WalletTransaction.objects.filter(
                tx_hash=_FAKE_TRANSFER["tx_hash"], tx_type="transfer"
            ).count(),
            2,
        )

    def test_purchase_is_idempotent_replay_transfers_once(self, m_transfer):
        buyer_user, lp = _approved_lp_buyer("buyer2@ex.com", 1000)
        first = self._buy(buyer_user)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self._buy(buyer_user)
        # Second sees a completed listing → already, no second transfer.
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data.get("already"))
        m_transfer.assert_called_once()
        lp.refresh_from_db()
        self.assertEqual(lp.current_balance, _D("600.00"))  # debited once

    def test_insufficient_lp_balance_rejected_no_transfer(self, m_transfer):
        buyer_user, lp = _approved_lp_buyer("poor@ex.com", 100)  # < 400
        resp = self._buy(buyer_user)
        self.assertEqual(resp.status_code, 402)
        m_transfer.assert_not_called()
        # No state change: listing still listed, escrow intact.
        listing = LPMarketListing.objects.get(pk=self.listing_id)
        self.assertEqual(listing.status, "listed")
        pos = OwnershipToken.objects.get(
            wallet=self.seller_wallet, property_id=self.prop.slug
        )
        self.assertEqual(pos.locked_amount, 4)

    def test_non_lp_buyer_forbidden(self, m_transfer):
        nonlp = User.objects.create_user(email="plain@ex.com", password="pw-12345-strong")
        resp = self._buy(nonlp)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        m_transfer.assert_not_called()

    def test_cannot_buy_own_listing(self, m_transfer):
        # Make the seller an approved LP, then try to buy their own listing.
        LiquidityProvider.objects.create(
            user=self.seller, contact_name="LP", email="s2@ex.com",
            status=LPStatus.APPROVED, kyb_status=KYBStatus.APPROVED,
            current_balance=_D("1000"),
        )
        resp = self._buy(self.seller)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        m_transfer.assert_not_called()


class LPMarketVisibilityTests(APITestCase):
    def test_inventory_visible_only_to_approved_lps(self):
        prop = _deployed_property()
        seller, _ = _seller_with_tokens("vs@ex.com", prop, 5)
        self.client.force_authenticate(seller)
        self.client.post(
            "/api/lp/market/",
            {"property_id": prop.slug, "token_amount": 3}, format="json",
        )
        # A plain (non-LP) viewer sees no inventory, only their own (none).
        viewer = User.objects.create_user(email="viewer@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(viewer)
        resp = self.client.get("/api/lp/market/")
        self.assertEqual(resp.data["listings"], [])
        self.assertEqual(resp.data["my_listings"], [])
        # An approved LP sees the listed inventory.
        lp_user, _ = _approved_lp_buyer("lpv@ex.com", 1000)
        self.client.force_authenticate(lp_user)
        resp = self.client.get("/api/lp/market/")
        self.assertEqual(len(resp.data["listings"]), 1)
