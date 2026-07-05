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

# Phase 5 Wave 1: the `card` method is payment-gated (completes + mints only via the Stripe
# webhook); Pronova is now the SAME (a discounted rail over Stripe — see PronovaDiscountTests).
# Tests that exercise method-AGNOSTIC mint/economics use a STILL-simulated method (Apple Pay,
# which auto-completes at the service level) so they keep asserting completion+mint at creation.
# (Card/Pronova payment-gated behaviour is covered here + in apps/payments/tests.py.)
COMPLETING_METHOD = "apple_pay"


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

    def test_stale_inflight_expired_allows_retry(self):
        """An abandoned card/crypto in-flight past the threshold is expired to FAILED on the
        next create, so a retry for the same (user, property) succeeds instead of 500ing."""
        prop = _make_property("pstale", total_value=1_000_000, token_price=100)
        stale = Investment.objects.create(
            user=self.user, property=prop, property_name=prop.name,
            amount_invested=Decimal("100"), token_amount=1, token_symbol="BRXPSTALE",
            price_per_token=Decimal("100"), ownership_percentage=Decimal("0.002"),
            payment_method="card", payment_status=PaymentStatus.PENDING,
        )
        # Backdate past the 30-minute threshold (created_at is auto_now_add).
        Investment.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timezone.timedelta(minutes=45)
        )
        res = create_investment(user=self.user, prop=prop, token_amount=1, payment_method="card")
        self.assertEqual(res["investment"].payment_status, PaymentStatus.PENDING)  # the new one
        stale.refresh_from_db()
        self.assertEqual(stale.payment_status, PaymentStatus.FAILED)  # abandoned → expired

    def test_sukuk_inflight_is_never_expired(self):
        """A sukuk (admin-reviewed) PENDING is NEVER expired, even when old — its slot is
        held on purpose (one active certificate per property) → a retry cleanly 409s."""
        prop = _make_property("psukukhold", total_value=1_000_000, token_price=100)
        sk = create_investment(
            user=self.user, prop=prop, token_amount=1, payment_method="sukuk"
        )["investment"]
        Investment.objects.filter(pk=sk.pk).update(
            created_at=timezone.now() - timezone.timedelta(minutes=90)
        )
        with self.assertRaises(DuplicateInvestmentError):
            create_investment(user=self.user, prop=prop, token_amount=1, payment_method="card")
        sk.refresh_from_db()
        self.assertEqual(sk.payment_status, PaymentStatus.PENDING)  # not clobbered

    def test_settle_refuses_failed_investment(self):
        """Webhook-safety: settle_investment never completes/mints a FAILED (expired) one —
        a late/duplicate success callback can't resurrect an abandoned attempt."""
        from .services import settle_investment

        prop = _make_property("pfailedsettle", total_value=1_000_000, token_price=100, deployed=True)
        inv = create_investment(
            user=self.user, prop=prop, token_amount=1, payment_method="card"
        )["investment"]
        Investment.objects.filter(pk=inv.pk).update(payment_status=PaymentStatus.FAILED)
        inv.refresh_from_db()

        result = settle_investment(inv)
        self.assertFalse(result["minted"])
        self.assertEqual(result["reason"], "failed")
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.FAILED)  # not resurrected
        self.assertFalse(inv.tokens_minted)

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

    def test_ledger_only_mint_creates_holding_without_wallet_tx(self):
        """A property not deployed on-chain settles in the LEDGER: the OwnershipToken
        (holding) is created and tokens_minted=True, but NO WalletTransaction is recorded
        (its tx_hash must be a real chain value — never fabricated)."""
        prop = _make_property("pnodeploy", total_value=1_000_000, token_price=100, deployed=False)
        result = create_investment(
            user=self.user, prop=prop, token_amount=5, payment_method=COMPLETING_METHOD
        )
        self.assertTrue(result["tokens_minted"])  # ledger-settled (wallet exists)
        inv = result["investment"]
        inv.refresh_from_db()
        self.assertTrue(inv.tokens_minted)
        self.assertIsNotNone(inv.minted_at)
        # Holding created — the portfolio reads OwnershipTokens, so this is what appears.
        ot = OwnershipToken.objects.get(wallet=self.wallet, property_id=prop.slug)
        self.assertEqual(ot.token_amount, 5)
        self.assertEqual(ot.token_value_usd, Decimal("500.00"))
        # NO on-chain tx fabricated — a ledger settlement records no WalletTransaction.
        self.assertFalse(WalletTransaction.objects.filter(wallet=self.wallet).exists())

    def test_ledger_only_mint_credits_owner_and_broker(self):
        """Ledger settlement runs the SAME owner + broker credits as an on-chain mint."""
        from apps.broker.models import BrokerProfile, BrokerStatus
        from apps.wallets.models import BalanceTransaction

        owner = User.objects.create_user(email="own-l@example.com", password="pw12345!")
        broker_user = User.objects.create_user(email="brk-l@example.com", password="pw12345!")
        broker = BrokerProfile.objects.create(
            user=broker_user, contact_name="Brk", email="brk-l@example.com",
            status=BrokerStatus.APPROVED, commission_rate=Decimal("5"),
        )
        self.user.profile.referred_by_broker = broker
        self.user.profile.save(update_fields=["referred_by_broker"])

        prop = _make_property("pledgercred", total_value=1_000_000, token_price=100, deployed=False)
        prop.submitted_by = owner
        prop.save(update_fields=["submitted_by"])

        res = create_investment(
            user=self.user, prop=prop, token_amount=5, payment_method=COMPLETING_METHOD
        )
        self.assertTrue(res["tokens_minted"])
        inv_id = str(res["investment"].id)
        # Owner net credited (gross $500 − fees > 0), keyed on the investment id.
        owner_credit = BalanceTransaction.objects.get(
            balance__user=owner, source="primary_sale", reference=inv_id
        )
        self.assertGreater(owner_credit.amount, Decimal("0"))
        # Broker commission = 5% of $500 gross = $25.
        broker_credit = BalanceTransaction.objects.get(
            balance__user=broker_user, source="broker_commission", reference=inv_id
        )
        self.assertEqual(broker_credit.amount, Decimal("25.00"))
        # Still no on-chain tx for a ledger settlement.
        self.assertFalse(WalletTransaction.objects.filter(wallet=self.wallet).exists())


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

    def test_unsupported_payment_method_rejected(self):
        """Only card / crypto / balance / sukuk / pronova are accepted; the unwired methods
        (Apple/Google Pay) 400 (they would otherwise mark an investment completed with no
        real charge)."""
        self.client.force_authenticate(self.user)
        for method in ("apple_pay", "google_pay"):
            resp = self.client.post(
                "/api/investments/",
                {"property_id": self.prop.slug, "token_amount": 10, "payment_method": method},
                format="json",
            )
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, method)
        # Nothing was created for any of the rejected methods.
        self.assertFalse(Investment.objects.filter(user=self.user).exists())

    def test_sukuk_method_accepted_and_deferred(self):
        """The Nova certificate (sukuk) method IS accepted: it creates a PENDING investment
        (awaiting the uploaded certificate + admin review) and never mints at creation."""
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            "/api/investments/",
            {"property_id": self.prop.slug, "token_amount": 10, "payment_method": "sukuk"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(resp.data["tokens_minted"])
        inv = Investment.objects.get(user=self.user, property=self.prop)
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)
        self.assertEqual(inv.payment_method, "sukuk")

    def test_pronova_method_accepted_and_deferred(self):
        """Pronova IS accepted: it creates a PENDING investment (settled later by the Stripe
        webhook for the DISCOUNTED total) and never mints at creation."""
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            "/api/investments/",
            {"property_id": self.prop.slug, "token_amount": 10, "payment_method": "pronova"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(resp.data["tokens_minted"])
        self.assertTrue(resp.data["payment_required"])
        inv = Investment.objects.get(user=self.user, property=self.prop)
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)
        self.assertEqual(inv.payment_method, "pronova")
        # The admin-set discount is applied to settlement (default 5% on this API property).
        self.assertGreater(inv.discount_amount, Decimal("0"))

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
        # Give the property a known yield so the enriched expected_yield is meaningful.
        self.prop.expected_yield = Decimal("8.25")
        self.prop.save(update_fields=["expected_yield"])
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
                # Base OwnershipToken fields.
                "id", "wallet_id", "property_id", "property_name", "token_symbol",
                "token_amount", "locked_amount", "available_amount",
                "token_value_usd", "ownership_percentage",
                "acquisition_date", "last_distribution_date", "total_distributions",
                "status", "created_at", "updated_at",
                # Portfolio enrichment: Property metadata (joined by slug) + cost basis.
                "city", "location", "location_ar", "country", "asset_type", "category",
                "expected_yield",
                "image", "images", "construction_progress", "exit_eligible",
                "avg_cost_per_token", "invested_usd",
            },
        )
        # The enriched expected_yield mirrors the Property's value (Reports avg-yield source).
        self.assertEqual(body[0]["expected_yield"], float(self.prop.expected_yield))
        # A different user cannot read this wallet's tokens.
        other = User.objects.create_user(email="other2@example.com", password="pw12345!")
        self.client.force_authenticate(other)
        resp2 = self.client.get(f"/api/wallets/{wallet.id}/tokens/")
        self.assertEqual(resp2.status_code, status.HTTP_404_NOT_FOUND)


# =====================================================================
# REINVESTMENTS — balance-funded buy (spend internal yield -> mint), no PSP, no bonus
# =====================================================================
from apps.wallets.models import BalanceTransaction, UserBalance  # noqa: E402
from apps.wallets.services import credit_user_balance  # noqa: E402


def _deployed_owned_property(slug, owner, *, total_value="1000000", token_price="100"):
    """A published, on-chain-deployed property owned by `owner` with zero fees."""
    p = Property(**_valid_property_kwargs(
        slug=slug, total_value=Decimal(str(total_value)),
        token_price=Decimal(str(token_price)), is_published=True,
    ))
    p.submitted_by = owner
    p.fee_platform = Decimal("0")
    p.fee_management = Decimal("0")
    p.save()
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "55" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


class ReinvestmentTests(TestCase):
    """payment_method='balance': debit UserBalance -> mint (real). Same price/fees as a buy."""

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-ri@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-ri@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        self.prop = _deployed_owned_property("reinv-1", self.owner)  # supply 10000 @ $100

    def _reinvest(self, tokens):
        with mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint):
            return create_investment(
                user=self.investor, prop=self.prop, token_amount=tokens,
                payment_method="balance",
            )

    def _balance(self):
        bal = UserBalance.objects.filter(user=self.investor).first()
        return bal.current_balance if bal else Decimal("0")

    def test_balance_funded_reinvest_debits_exactly_and_mints(self):
        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        res = self._reinvest(5)  # 5 x $100 = $500
        self.assertTrue(res["tokens_minted"])
        inv = res["investment"]
        self.assertEqual(inv.payment_method, "balance")
        self.assertEqual(inv.payment_status, PaymentStatus.COMPLETED)
        self.assertEqual(inv.amount_invested, Decimal("500.00"))
        # Balance debited EXACTLY $500 (1000 -> 500), with a keyed DEBIT ledger entry.
        self.assertEqual(self._balance(), Decimal("500.00"))
        debit = BalanceTransaction.objects.get(
            balance__user=self.investor, source="reinvestment", reference=str(inv.id)
        )
        self.assertEqual(debit.entry_type, BalanceTransaction.EntryType.DEBIT)
        self.assertEqual(debit.amount, Decimal("500.00"))
        # Real on-chain mint (mocked): 5 tokens, fully unlocked.
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 5)
        self.assertEqual(token.locked_amount, 0)
        # Owner credited normally (fees 0 -> net == gross $500), keyed on the investment.
        owner_credit = BalanceTransaction.objects.get(
            balance__user=self.owner, source="primary_sale", reference=str(inv.id)
        )
        self.assertEqual(owner_credit.amount, Decimal("500.00"))

    def test_insufficient_balance_rejected_nothing_moves(self):
        from rest_framework.exceptions import ValidationError

        credit_user_balance(self.investor, Decimal("100.00"), source="distribution")
        with self.assertRaises(ValidationError):
            self._reinvest(5)  # needs $500, only $100
        # Rolled back: no investment, balance untouched, no mint, no owner credit.
        self.assertEqual(Investment.objects.filter(user=self.investor).count(), 0)
        self.assertEqual(self._balance(), Decimal("100.00"))
        self.assertFalse(
            OwnershipToken.objects.filter(
                wallet__user=self.investor, property_id=self.prop.slug
            ).exists()
        )
        self.assertFalse(BalanceTransaction.objects.filter(source="reinvestment").exists())

    def test_idempotent_no_double_debit_or_mint(self):
        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        res = self._reinvest(5)
        inv = res["investment"]
        self.assertEqual(self._balance(), Decimal("500.00"))
        # Replay the mint -> already minted; NO second debit, NO second mint.
        with mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint) as m:
            res2 = mint_investment(inv)
        self.assertTrue(res2.get("already"))
        self.assertEqual(m.call_count, 0)
        self.assertEqual(self._balance(), Decimal("500.00"))
        self.assertEqual(
            BalanceTransaction.objects.filter(source="reinvestment", reference=str(inv.id)).count(), 1
        )
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 5)

    def test_no_bonus_same_price_as_normal_buy(self):
        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        inv = self._reinvest(5)["investment"]
        # 5 x $100 = exactly $500 charged - NOT a discounted $475 (no 5% reinvest bonus).
        self.assertEqual(inv.amount_invested, Decimal("500.00"))
        self.assertEqual(inv.price_per_token, Decimal("100.00"))
        self.assertEqual(self._balance(), Decimal("500.00"))

    def test_funding_is_internal_no_psp_payment_row(self):
        from apps.payments.models import Payment

        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        res = self._reinvest(5)
        # No PSP Payment row for a balance-funded buy (settled by the in-ledger debit).
        self.assertEqual(Payment.objects.filter(investment=res["investment"]).count(), 0)

    def test_broker_credited_if_referred(self):
        from apps.broker.models import BrokerProfile, BrokerStatus

        broker_user = User.objects.create_user(email="brk-ri@example.com", password="pw12345!")
        broker = BrokerProfile.objects.create(
            user=broker_user, contact_name="Brk", email="brk-ri@example.com",
            status=BrokerStatus.APPROVED, commission_rate=Decimal("5"),
        )
        self.investor.profile.referred_by_broker = broker
        self.investor.profile.save(update_fields=["referred_by_broker"])
        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        res = self._reinvest(5)  # $500 -> 5% = $25
        bt = BalanceTransaction.objects.get(
            balance__user=broker_user, source="broker_commission",
            reference=str(res["investment"].id),
        )
        self.assertEqual(bt.amount, Decimal("25.00"))

    def test_card_buy_unchanged_no_balance_touched(self):
        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=5, payment_method="card",
        )
        inv = res["investment"]
        # Card stays PENDING + not minted at creation (webhook-gated) - and NO balance debit.
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)
        self.assertFalse(res["tokens_minted"])
        self.assertEqual(self._balance(), Decimal("1000.00"))
        self.assertFalse(BalanceTransaction.objects.filter(source="reinvestment").exists())


class ReinvestmentApiTests(APITestCase):
    """The create endpoint + the reinvestment-history read are KYC-gated / self-scoped."""

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-ria@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-ria@example.com", password="pw12345!")
        self.prop = _deployed_owned_property("reinv-api", self.owner)

    def test_balance_buy_kyc_gated(self):
        # No approved KYC -> the create endpoint rejects with kyc_required (all methods).
        self.client.force_authenticate(self.investor)
        resp = self.client.post(
            "/api/investments/",
            {"property_id": self.prop.slug, "token_amount": 1, "payment_method": "balance"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.json().get("code"), "kyc_required")

    def test_reinvestment_history_self_scoped(self):
        get_or_create_custodial_wallet(self.investor)
        credit_user_balance(self.investor, Decimal("1000.00"), source="distribution")
        with mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint):
            create_investment(
                user=self.investor, prop=self.prop, token_amount=3, payment_method="balance",
            )
        self.client.force_authenticate(self.investor)
        resp = self.client.get("/api/investments/reinvestments/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        rows = resp.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["source_amount"], 300.0)
        self.assertEqual(rows[0]["discount_amount"], 0.0)
        self.assertEqual(rows[0]["status"], "completed")
        # Another user sees none.
        other = User.objects.create_user(email="other-ria@example.com", password="pw12345!")
        self.client.force_authenticate(other)
        resp2 = self.client.get("/api/investments/reinvestments/")
        self.assertEqual(resp2.json(), [])


class PronovaDiscountTests(TestCase):
    """
    Pronova (temporary rail): an ADMIN-set, PLATFORM-ABSORBED discount off the settlement
    subtotal (token value + fees). The buyer pays the discounted total; the OWNER is credited
    the FULL token value; the platform absorbs the discount (net = fee − discount, may be < 0).
    Pronova DEFERS like card/crypto (settles on the Stripe webhook) and inherits the stale-
    inflight sweep, but is NEVER an installment.
    """

    def setUp(self):
        self.owner = User.objects.create_user(email="pron-owner@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="pron-inv@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        # Ledger-only, owner-linked; DEFAULT fees (1.5%+0.5%=2%) + DEFAULT pronova discount (5%).
        self.prop = _make_property("pron-prop", total_value=1_000_000, token_price=100)
        self.prop.submitted_by = self.owner
        self.prop.save(update_fields=["submitted_by"])

    def test_pronova_discount_uses_admin_rate(self):
        from .services import pronova_discount_for

        # 5% of the 306 subtotal = 15.30 (the property's default admin rate).
        self.assertEqual(pronova_discount_for(self.prop, Decimal("306")), Decimal("15.30"))
        # Admin raises it to 10% → 30.60; a 0% property gives nothing.
        self.prop.fee_pronova_discount = Decimal("10")
        self.assertEqual(pronova_discount_for(self.prop, Decimal("306")), Decimal("30.60"))
        self.prop.fee_pronova_discount = Decimal("0")
        self.assertEqual(pronova_discount_for(self.prop, Decimal("306")), Decimal("0.00"))

    def test_pronova_charge_discounted_owner_full_platform_net(self):
        from apps.wallets.models import BalanceTransaction

        from .services import settle_investment

        # 3 tokens × $100 = $300 value; fee 2% = $6; discount 5% × $306 = $15.30.
        inv = create_investment(
            user=self.investor, prop=self.prop, token_amount=3, payment_method="pronova",
        )["investment"]
        # Deferred: PENDING + not minted at creation (settles on the confirmed Stripe webhook).
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)
        self.assertFalse(inv.tokens_minted)
        self.assertEqual(inv.amount_invested, Decimal("300.00"))
        self.assertEqual(inv.fee_amount, Decimal("6.00"))
        self.assertEqual(inv.discount_amount, Decimal("15.30"))
        # Buyer pays the DISCOUNTED total (value + fee − discount).
        self.assertEqual(inv.settlement_amount, Decimal("290.70"))
        # Platform net = fee − discount = −9.30 (an intended, VISIBLE subsidy).
        self.assertEqual(inv.fee_amount - inv.discount_amount, Decimal("-9.30"))
        # Settle (simulate the confirmed webhook) → the OWNER is credited the FULL token value.
        settle_investment(inv)
        bt = BalanceTransaction.objects.get(source="primary_sale", reference=str(inv.id))
        self.assertEqual(bt.amount, Decimal("300.00"))  # full value, NOT the discounted total

    def test_pronova_admin_rate_change_changes_discount(self):
        self.prop.fee_pronova_discount = Decimal("8")
        self.prop.save(update_fields=["fee_pronova_discount"])
        inv = create_investment(
            user=self.investor, prop=self.prop, token_amount=3, payment_method="pronova",
        )["investment"]
        # 8% of 306 = 24.48 → settlement 306 − 24.48 = 281.52.
        self.assertEqual(inv.discount_amount, Decimal("24.48"))
        self.assertEqual(inv.settlement_amount, Decimal("281.52"))

    def test_non_pronova_unaffected(self):
        # A card buy on the SAME property carries NO discount (settlement = value + fee).
        inv = create_investment(
            user=self.investor, prop=self.prop, token_amount=3, payment_method="card",
        )["investment"]
        self.assertEqual(inv.discount_amount, Decimal("0"))
        self.assertEqual(inv.settlement_amount, Decimal("306.00"))

    def test_pronova_inherits_stale_inflight_expiry(self):
        # An abandoned Pronova in-flight past the threshold is expired to FAILED on the next
        # create (Pronova joined PSP_INFLIGHT_METHODS), so a retry proceeds instead of 500ing.
        stale = create_investment(
            user=self.investor, prop=self.prop, token_amount=1, payment_method="pronova",
        )["investment"]
        self.assertEqual(stale.payment_status, PaymentStatus.PENDING)
        Investment.objects.filter(pk=stale.pk).update(
            created_at=timezone.now() - timezone.timedelta(minutes=45)
        )
        new = create_investment(
            user=self.investor, prop=self.prop, token_amount=1, payment_method="pronova",
        )["investment"]
        self.assertEqual(new.payment_status, PaymentStatus.PENDING)
        stale.refresh_from_db()
        self.assertEqual(stale.payment_status, PaymentStatus.FAILED)

    def test_pronova_installment_rejected(self):
        # Pronova is full-buy only — the installment gate (card/crypto) rejects it.
        from rest_framework.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            create_investment(
                user=self.investor, prop=self.prop, token_amount=3, payment_method="pronova",
                is_installment=True, down_payment_percent=30, n_installments=3, frequency="monthly",
            )

    def test_serializer_exposes_discount_amount(self):
        from .serializers import InvestmentSerializer

        inv = create_investment(
            user=self.investor, prop=self.prop, token_amount=3, payment_method="pronova",
        )["investment"]
        data = InvestmentSerializer(inv).data
        self.assertIn("discount_amount", data)
        self.assertEqual(Decimal(str(data["discount_amount"])), Decimal("15.30"))
        self.assertEqual(Decimal(str(data["settlement_amount"])), Decimal("290.70"))
