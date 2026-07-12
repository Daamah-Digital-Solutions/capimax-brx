"""
Peer secondary-market + investor-withdrawal tests — Phase 6 Wave 3. Network-free:
the on-chain transfer is MOCKED (the real cycle is the testnet command). Mirrors the
LP-market tests.
"""
from decimal import Decimal
from unittest import mock

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.kyc.services import approve_kyc, get_or_create_kyc
from apps.lp import market_services as lp_market
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import (
    BalanceTransaction,
    OwnershipToken,
    UserBalance,
    WalletTransaction,
    Withdrawal,
)
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from .models import SecondaryMarketListing

_FAKE_TRANSFER = {
    "tx_hash": "0x" + "cd" * 32, "block_number": 222333, "chain_id": 97,
    "explorer_tx": "https://testnet.bscscan.com/tx/0x" + "cd" * 32,
}


def _deployed_property(slug="1"):
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("5000000")))
    p.save()
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "11" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _undeployed_property(slug="2"):
    """A property with NO on-chain contract → _deployed_contract raises NotDeployedError."""
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("5000000")))
    p.save()
    TokenMetadata.objects.get_or_create(property=p)  # exists, but no deployed address
    return p


def _approved_user(email):
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    kyc = get_or_create_kyc(user)
    kyc.mark_approved()
    kyc.save()
    return User.objects.get(pk=user.pk)  # fresh (reverse-cache)


def _seller_with_tokens(email, prop, amount):
    user = _approved_user(email)
    wallet, _ = get_or_create_custodial_wallet(user)
    OwnershipToken.objects.create(
        wallet=wallet, property_id=prop.slug, property_name=prop.name,
        token_symbol="BRX1", token_amount=amount, token_value_usd=amount * 100,
    )
    return user, wallet


class PeerListingTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property()
        self.seller, self.wallet = _seller_with_tokens("ps@ex.com", self.prop, 10)
        self.client.force_authenticate(self.seller)

    def test_list_escrow_locks(self):
        resp = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 3, "unit_price": "100"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "listed")
        self.assertEqual(resp.data["seller_type"], "investor")
        # 0.5% default fee on $300 = $1.50, net $298.50
        self.assertEqual(resp.data["platform_fee_amount"], 1.5)
        self.assertEqual(resp.data["net_amount"], 298.5)
        pos = OwnershipToken.objects.get(wallet=self.wallet, property_id=self.prop.slug)
        self.assertEqual(pos.locked_amount, 3)

    def test_single_market_exclusivity_with_lp_market(self):
        # Lock 8 on the LP market, then try to list 5 on the peer market (only 2 free).
        lp_market.create_listing(
            user=self.seller,
            data={"property_id": self.prop.slug, "token_amount": 8, "unit_price": 100},
        )
        resp = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 5}, format="json",
        )
        self.assertEqual(resp.status_code, 422)

    def test_cancel_unlocks(self):
        created = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 4}, format="json",
        )
        lid = created.data["id"]
        resp = self.client.post(f"/api/secondary-market/{lid}/cancel/")
        self.assertEqual(resp.data["status"], "cancelled")
        pos = OwnershipToken.objects.get(wallet=self.wallet, property_id=self.prop.slug)
        self.assertEqual(pos.locked_amount, 0)

    @override_settings(SECONDARY_MARKET_FEE_PERCENT=2.0)
    def test_fee_configurable(self):
        resp = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 5, "unit_price": "100"},
            format="json",
        )
        self.assertEqual(resp.data["platform_fee_amount"], 10.0)  # 2% of 500
        self.assertEqual(resp.data["net_amount"], 490.0)

    def test_non_kyc_cannot_list(self):
        plain = User.objects.create_user(email="nokyc@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(plain)
        resp = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 1}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


@mock.patch("apps.secondary_market.services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class PeerPurchaseTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property()
        self.seller, self.seller_wallet = _seller_with_tokens("ps2@ex.com", self.prop, 10)
        self.client.force_authenticate(self.seller)
        listing = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 4, "unit_price": "100"},
            format="json",
        )
        self.listing_id = listing.data["id"]

    def _buyer(self, email, balance):
        u = _approved_user(email)
        if balance:
            credit_user_balance(u, Decimal(str(balance)), source="test")
        return u

    def test_purchase_settles_and_moves_balances(self, m_transfer):
        buyer = self._buyer("pb@ex.com", 1000)
        self.client.force_authenticate(buyer)
        resp = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        m_transfer.assert_called_once()

        # buyer UserBalance debited 400; seller credited net (400 - 0.5% = 398)
        self.assertEqual(UserBalance.objects.get(user=buyer).current_balance, Decimal("600.00"))
        self.assertEqual(UserBalance.objects.get(user=self.seller).current_balance, Decimal("398.00"))
        # on-chain positions moved
        sp = OwnershipToken.objects.get(wallet=self.seller_wallet, property_id=self.prop.slug)
        self.assertEqual(sp.token_amount, 6)
        self.assertEqual(sp.locked_amount, 0)
        bp = OwnershipToken.objects.get(wallet=buyer.wallet, property_id=self.prop.slug)
        self.assertEqual(bp.token_amount, 4)
        # listing completed + 2 transfer rows
        listing = SecondaryMarketListing.objects.get(pk=self.listing_id)
        self.assertEqual(listing.status, "completed")
        self.assertEqual(listing.buyer_id, buyer.pk)
        self.assertEqual(
            WalletTransaction.objects.filter(tx_hash=_FAKE_TRANSFER["tx_hash"]).count(), 2
        )

    def test_idempotent_replay_transfers_once(self, m_transfer):
        buyer = self._buyer("pb2@ex.com", 1000)
        self.client.force_authenticate(buyer)
        self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        second = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        self.assertTrue(second.data.get("already"))
        m_transfer.assert_called_once()
        self.assertEqual(UserBalance.objects.get(user=buyer).current_balance, Decimal("600.00"))

    def test_insufficient_balance_no_transfer(self, m_transfer):
        buyer = self._buyer("poor@ex.com", 100)  # < 400
        self.client.force_authenticate(buyer)
        resp = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        self.assertEqual(resp.status_code, 402)
        m_transfer.assert_not_called()
        # No state change.
        self.assertEqual(SecondaryMarketListing.objects.get(pk=self.listing_id).status, "listed")
        self.assertEqual(UserBalance.objects.get(user=buyer).current_balance, Decimal("100.00"))

    def test_non_kyc_cannot_buy(self, m_transfer):
        plain = User.objects.create_user(email="nokyc2@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(plain)
        resp = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        m_transfer.assert_not_called()

    def test_cannot_buy_own_listing(self, m_transfer):
        credit_user_balance(self.seller, Decimal("1000"), source="test")
        self.client.force_authenticate(self.seller)
        resp = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        m_transfer.assert_not_called()

    def test_secondary_buy_records_cost_basis(self, m_transfer):
        """A secondary purchase records a completed Investment (cost basis) for the buyer,
        WITHOUT moving extra money, and the tokens endpoint exposes invested_usd."""
        from apps.investments.models import Investment

        buyer = self._buyer("pbcost@ex.com", 1000)
        inv_before = Investment.objects.count()
        bt_before = BalanceTransaction.objects.count()

        self.client.force_authenticate(buyer)
        # Buy 4 tokens @ 100 = $400 paid.
        resp = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Exactly ONE new Investment row (the buyer's cost record); no extra balance ledger
        # entries beyond the buy's own debit/credit (settlement already counted those — the
        # cost record adds NO money movement).
        self.assertEqual(Investment.objects.count(), inv_before + 1)
        inv = Investment.objects.filter(user=buyer).latest("created_at")
        self.assertEqual(inv.amount_invested, Decimal("400.00"))
        self.assertEqual(inv.token_amount, 4)
        self.assertEqual(inv.price_per_token, Decimal("100.00"))
        self.assertEqual(inv.payment_method, "secondary_market")
        self.assertEqual(inv.payment_status, "completed")
        self.assertTrue(inv.tokens_minted)

        # The tokens endpoint now exposes real avg-cost + invested for the holding.
        tok = self.client.get(f"/api/wallets/{buyer.wallet.id}/tokens/").json()[0]
        self.assertEqual(tok["avg_cost_per_token"], 100.0)
        self.assertEqual(tok["invested_usd"], 400.0)
        # Enrichment present (real Property metadata, not faked).
        self.assertIn("city", tok)
        self.assertIn("exit_eligible", tok)
        self.assertIn("construction_progress", tok)

    def test_weighted_avg_cost_mixes_primary_and_secondary(self, m_transfer):
        """Avg cost = Σ paid / Σ tokens across primary + secondary acquisitions."""
        from apps.investments.services import record_acquisition_cost

        buyer = self._buyer("pbmix@ex.com", 1000)
        # Simulate a prior PRIMARY buy: 6 tokens @ $120 = $720.
        record_acquisition_cost(
            user=buyer, property_slug=self.prop.slug, property_name=self.prop.name,
            token_symbol="TOK", token_amount=6, amount_paid=Decimal("720"),
            wallet=None, source="card",
        )
        self.client.force_authenticate(buyer)
        # Secondary buy: 4 tokens @ $100 = $400. Total = $1120 / 10 = $112 avg.
        self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")

        from apps.investments.models import Investment
        rows = Investment.objects.filter(user=buyer, property=self.prop)
        total_amt = sum(r.amount_invested for r in rows)
        total_tok = sum(r.token_amount for r in rows)
        self.assertEqual(total_amt, Decimal("1120"))
        self.assertEqual(total_tok, 10)
        self.assertEqual(total_amt / total_tok, Decimal("112"))


@mock.patch("apps.secondary_market.services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class PeerPurchaseOffChainTests(APITestCase):
    """
    Client note 14: a listing for a property whose token contract is NOT deployed settles
    OFF-CHAIN (custodial ledger) instead of failing with 'contract not deployed'. No
    on-chain transfer is attempted and no fake tx hash is emitted.
    """

    def setUp(self):
        self.prop = _undeployed_property(slug="2")
        self.seller, self.seller_wallet = _seller_with_tokens("psoff@ex.com", self.prop, 10)
        self.client.force_authenticate(self.seller)
        listing = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 4, "unit_price": "100"},
            format="json",
        )
        self.listing_id = listing.data["id"]

    def test_offchain_settlement_when_contract_not_deployed(self, m_transfer):
        buyer = _approved_user("pboff@ex.com")
        credit_user_balance(buyer, Decimal("1000"), source="test")
        self.client.force_authenticate(buyer)
        resp = self.client.post(f"/api/secondary-market/{self.listing_id}/purchase/")
        # Settles (no 'contract not deployed' error) — OFF-CHAIN.
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        m_transfer.assert_not_called()
        self.assertFalse(resp.data.get("on_chain"))
        self.assertTrue(str(resp.data.get("tx_hash")).startswith("offchain:"))
        # Balances settle exactly like the on-chain path (buyer −400, seller +398 net).
        self.assertEqual(UserBalance.objects.get(user=buyer).current_balance, Decimal("600.00"))
        self.assertEqual(UserBalance.objects.get(user=self.seller).current_balance, Decimal("398.00"))
        # Ledger positions move (seller 10−4=6, buyer 4).
        sp = OwnershipToken.objects.get(wallet=self.seller_wallet, property_id=self.prop.slug)
        self.assertEqual(sp.token_amount, 6)
        bp = OwnershipToken.objects.get(wallet=buyer.wallet, property_id=self.prop.slug)
        self.assertEqual(bp.token_amount, 4)
        listing = SecondaryMarketListing.objects.get(pk=self.listing_id)
        self.assertEqual(listing.status, "completed")
        self.assertTrue(listing.settlement_tx_hash.startswith("offchain:"))


class InvestorWithdrawalTests(APITestCase):
    def setUp(self):
        self.user = _approved_user("wd@ex.com")
        self.client.force_authenticate(self.user)

    def test_balance_defaults_zero(self):
        resp = self.client.get("/api/wallets/balance/")
        self.assertEqual(resp.data["current_balance"], 0.0)

    def test_withdraw_debits_balance_and_records(self):
        credit_user_balance(self.user, Decimal("500"), source="test")
        resp = self.client.post(
            "/api/wallets/withdrawals/",
            {"amount": "200", "method": "bank"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "pending")
        self.assertTrue(resp.data["reference"].startswith("WD-"))
        self.assertEqual(UserBalance.objects.get(user=self.user).current_balance, Decimal("300.00"))
        self.assertTrue(Withdrawal.objects.filter(user=self.user, amount=Decimal("200")).exists())
        self.assertTrue(
            BalanceTransaction.objects.filter(
                balance__user=self.user, entry_type="debit", source="withdrawal"
            ).exists()
        )

    def test_withdraw_insufficient_rejected(self):
        credit_user_balance(self.user, Decimal("50"), source="test")
        resp = self.client.post(
            "/api/wallets/withdrawals/",
            {"amount": "200", "method": "bank"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["code"], "insufficient_balance")
        self.assertEqual(UserBalance.objects.get(user=self.user).current_balance, Decimal("50.00"))
