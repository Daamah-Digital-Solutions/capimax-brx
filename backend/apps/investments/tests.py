"""
Investment + minting tests — Phase 3 Wave 2. Run against Postgres (capimax_brx).

Covers the LOCKED token-economics policy (ownership from real token_supply, NOT
/1000), the available-supply cap, per-property price, the dedup guard, real-tx
minting (mocked chain — never a fabricated hash), mint idempotency, and the
race-safe additive OwnershipToken upsert.
"""
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import OwnershipToken, WalletTransaction
from apps.wallets.services import get_or_create_custodial_wallet

from .models import Investment, PaymentStatus
from .services import (
    DuplicateInvestmentError,
    OverPurchaseError,
    available_tokens,
    create_investment,
    mint_investment,
)

# Deterministic, real-looking chain receipt for mocking the on-chain mint. Using a
# fixed hash lets tests assert we record THE CHAIN'S hash, never a random/fake one.
_FAKE_TX_HASH = "0x" + "ab" * 32
_FAKE_BLOCK = 4242

# Phase 5 Wave 1: the `card` method is now payment-gated (completes + mints only via
# the Stripe webhook). Tests that exercise method-AGNOSTIC mint/economics use a
# still-simulated method so they continue to assert completion+mint at creation.
# (Card's payment-gated behaviour is covered in apps/payments/tests.py.)
COMPLETING_METHOD = "pronova"


def _fake_mint(contract_address, to_address, amount):
    return {
        "tx_hash": _FAKE_TX_HASH,
        "block_number": _FAKE_BLOCK,
        "chain_id": 97,
        "to": to_address,
        "amount": amount,
        "token_address": contract_address,
    }


def _make_property(slug, *, total_value, token_price=Decimal("100"), deployed=False):
    """Create a published property; optionally mark a deployed contract on chain 97."""
    p = Property(**_valid_property_kwargs(
        slug=slug, total_value=Decimal(str(total_value)), token_price=Decimal(str(token_price))
    ))
    p.save()  # token_supply auto-derives = total_value / token_price
    if deployed:
        meta, _ = TokenMetadata.objects.get_or_create(property=p)
        meta.deployed_contract_address = "0x" + "11" * 20
        meta.deployment_chain_id = 97  # == settings.CHAIN_ID
        meta.deployment_network = "bsc-testnet"
        meta.save()
    return p


class TokenEconomicsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="inv@example.com", password="pw12345!")

    def test_ownership_is_derived_from_real_supply_not_1000(self):
        """A $10k buy in a $5M / $100-token property = 0.2%, NOT the old 10%."""
        prop = _make_property("p5m", total_value=5_000_000, token_price=100)
        self.assertEqual(prop.token_supply, 50_000)
        result = create_investment(
            user=self.user, prop=prop, token_amount=100, payment_method="card"
        )
        inv = result["investment"]
        self.assertEqual(inv.amount_invested, Decimal("10000.00"))  # 100 * $100
        self.assertEqual(inv.ownership_percentage, Decimal("0.200000"))  # 100/50000*100
        self.assertNotEqual(inv.ownership_percentage, Decimal("10"))  # the old bug

    def test_per_property_token_price_is_respected(self):
        prop = _make_property("p250", total_value=2_500_000, token_price=250)
        self.assertEqual(prop.token_supply, 10_000)
        inv = create_investment(
            user=self.user, prop=prop, token_amount=4, payment_method="card"
        )["investment"]
        self.assertEqual(inv.price_per_token, Decimal("250.00"))
        self.assertEqual(inv.amount_invested, Decimal("1000.00"))  # 4 * $250
        self.assertEqual(inv.ownership_percentage, Decimal("0.040000"))  # 4/10000*100

    def test_available_cap_enforced_and_overpurchase_rejected(self):
        prop = _make_property("psmall", total_value=1000, token_price=100)  # supply 10
        self.assertEqual(available_tokens(prop), 10)
        with self.assertRaises(OverPurchaseError):
            create_investment(user=self.user, prop=prop, token_amount=11,
                              payment_method=COMPLETING_METHOD)
        # Buy all 10 → now sold out (a completing method counts toward sold supply).
        create_investment(user=self.user, prop=prop, token_amount=10,
                          payment_method=COMPLETING_METHOD)
        self.assertEqual(available_tokens(prop), 0)
        other = User.objects.create_user(email="o@example.com", password="pw12345!")
        with self.assertRaises(OverPurchaseError):
            create_investment(user=other, prop=prop, token_amount=1,
                              payment_method=COMPLETING_METHOD)

    def test_dedup_guard_blocks_inflight_duplicate(self):
        prop = _make_property("pdedup", total_value=1_000_000, token_price=100)
        # Simulate an in-flight (pending) investment for this (user, property).
        Investment.objects.create(
            user=self.user, property=prop, property_name=prop.name,
            amount_invested=Decimal("100"), token_amount=1, token_symbol="BRXPDEDUP",
            price_per_token=Decimal("100"), ownership_percentage=Decimal("0.002"),
            payment_method="card", payment_status=PaymentStatus.PENDING,
        )
        with self.assertRaises(DuplicateInvestmentError):
            create_investment(user=self.user, prop=prop, token_amount=1, payment_method="card")

    def test_provisional_certificate_uses_real_location_not_hardcoded(self):
        prop = _make_property("pcert", total_value=1_000_000, token_price=100)
        create_investment(user=self.user, prop=prop, token_amount=5, payment_method="card")
        from apps.certificates.models import Certificate
        cert = Certificate.objects.get(investment__property=prop, user=self.user)
        self.assertEqual(cert.status, "provisional")
        self.assertEqual(cert.property_location, prop.location)  # real, not "Dubai, UAE"
        self.assertNotEqual(cert.platform_fee, Decimal("0"))  # real fee, not 0
        self.assertEqual(cert.units_purchased, 5)


class TokenMetadataReconcileTests(TestCase):
    def test_total_supply_forced_equal_to_token_supply(self):
        prop = _make_property("precon", total_value=3_000_000, token_price=100)  # 30,000
        meta, _ = TokenMetadata.objects.get_or_create(property=prop)
        # Even if someone sets a wrong figure, save() forces it back.
        meta.total_supply = 999
        meta.tokenized_units = 999
        meta.save()
        meta.refresh_from_db()
        self.assertEqual(meta.total_supply, 30_000)
        self.assertEqual(meta.tokenized_units, 30_000)


class MintingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="mint@example.com", password="pw12345!")
        self.wallet, _ = get_or_create_custodial_wallet(self.user)

    @mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint)
    def test_mint_records_real_chain_hash_and_upserts_token(self, _m):
        prop = _make_property("pmint", total_value=5_000_000, token_price=100, deployed=True)
        result = create_investment(
            user=self.user, prop=prop, token_amount=100, payment_method=COMPLETING_METHOD
        )
        self.assertTrue(result["tokens_minted"])  # auto-minted (wallet exists)
        inv = result["investment"]
        inv.refresh_from_db()
        self.assertTrue(inv.tokens_minted)
        self.assertIsNotNone(inv.minted_at)
        # The recorded tx is the CHAIN's hash/block — never a fabricated value.
        tx = WalletTransaction.objects.get(wallet=self.wallet, tx_type="mint")
        self.assertEqual(tx.tx_hash, _FAKE_TX_HASH)
        self.assertEqual(tx.block_number, _FAKE_BLOCK)
        # OwnershipToken position created with real-supply ownership.
        ot = OwnershipToken.objects.get(wallet=self.wallet, property_id=prop.slug)
        self.assertEqual(ot.token_amount, 100)
        self.assertEqual(ot.ownership_percentage, Decimal("0.200000"))
        self.assertEqual(ot.token_value_usd, Decimal("10000.00"))

    @mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint)
    def test_mint_is_idempotent(self, m):
        prop = _make_property("pidem", total_value=1_000_000, token_price=100, deployed=True)
        inv = create_investment(
            user=self.user, prop=prop, token_amount=10, payment_method=COMPLETING_METHOD
        )["investment"]
        self.assertEqual(m.call_count, 1)  # auto-minted once
        again = mint_investment(inv)
        self.assertTrue(again.get("already"))
        self.assertEqual(m.call_count, 1)  # NOT minted again on-chain

    @mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint)
    def test_additive_upsert_sums_positions(self, _m):
        prop = _make_property("padd", total_value=5_000_000, token_price=100, deployed=True)
        create_investment(user=self.user, prop=prop, token_amount=30,
                          payment_method=COMPLETING_METHOD)
        create_investment(user=self.user, prop=prop, token_amount=20,
                          payment_method=COMPLETING_METHOD)
        ot = OwnershipToken.objects.get(wallet=self.wallet, property_id=prop.slug)
        self.assertEqual(ot.token_amount, 50)  # 30 + 20 merged additively
        self.assertEqual(ot.ownership_percentage, Decimal("0.100000"))  # 50/50000*100

    def test_no_fake_hash_when_contract_not_deployed(self):
        """If the property has no on-chain contract, NOTHING is recorded as minted."""
        prop = _make_property("pnodeploy", total_value=1_000_000, token_price=100, deployed=False)
        result = create_investment(
            user=self.user, prop=prop, token_amount=5, payment_method=COMPLETING_METHOD
        )
        self.assertFalse(result["tokens_minted"])
        inv = result["investment"]
        inv.refresh_from_db()
        self.assertFalse(inv.tokens_minted)
        self.assertIsNone(inv.minted_at)
        # No transaction and no ownership token fabricated.
        self.assertFalse(WalletTransaction.objects.filter(wallet=self.wallet).exists())
        self.assertFalse(OwnershipToken.objects.filter(wallet=self.wallet).exists())


class InvestmentApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="api2@example.com", password="pw12345!")
        self.prop = _make_property("papi", total_value=5_000_000, token_price=100)
        # Phase 4: investing now requires approved KYC. Approve directly (no wallet
        # auto-create here) so the "no wallet → not minted yet" assertions still hold.
        from apps.kyc.services import get_or_create_kyc

        kyc = get_or_create_kyc(self.user)
        kyc.mark_approved()
        kyc.save()

    def test_create_requires_auth(self):
        resp = self.client.post(
            "/api/investments/",
            {"property_id": self.prop.slug, "token_amount": 10, "payment_method": "card"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_returns_frontend_shape(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            "/api/investments/",
            {"property_id": self.prop.slug, "token_amount": 100, "payment_method": "card"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertTrue(body["success"])
        self.assertIn("investment_id", body)
        self.assertIn("tokens_minted", body)
        self.assertIn("certificate_generated", body)
        # No wallet → not minted yet (pending), but never faked.
        self.assertFalse(body["tokens_minted"])
        inv = Investment.objects.get(id=body["investment_id"])
        self.assertEqual(inv.ownership_percentage, Decimal("0.200000"))

    def test_overpurchase_returns_422(self):
        small = _make_property("papismall", total_value=500, token_price=100)  # supply 5
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            "/api/investments/",
            {"property_id": small.slug, "token_amount": 6, "payment_method": "card"},
            format="json",
        )
        self.assertEqual(resp.status_code, 422)

    def test_wallet_tokens_endpoint_owner_only(self):
        wallet, _ = get_or_create_custodial_wallet(self.user)
        OwnershipToken.objects.create(
            wallet=wallet, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol="BRXPAPI", token_amount=100, token_value_usd=Decimal("10000"),
            ownership_percentage=Decimal("0.2"),
        )
        # Owner sees their tokens.
        self.client.force_authenticate(self.user)
        resp = self.client.get(f"/api/wallets/{wallet.id}/tokens/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(
            set(body[0].keys()),
            {
                "id", "wallet_id", "property_id", "property_name", "token_symbol",
                "token_amount", "locked_amount", "available_amount",
                "token_value_usd", "ownership_percentage",
                "acquisition_date", "last_distribution_date", "total_distributions",
                "status", "created_at", "updated_at",
            },
        )
        # A different user cannot read this wallet's tokens.
        other = User.objects.create_user(email="other2@example.com", password="pw12345!")
        self.client.force_authenticate(other)
        resp2 = self.client.get(f"/api/wallets/{wallet.id}/tokens/")
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)
