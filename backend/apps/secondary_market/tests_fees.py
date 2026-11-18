"""
The 2026-11 fee schedule (apps/secondary_market/fees.py, client document Capimax_Market_Fees_AR):
the three deals, settled for real, with the money in every wallet and LP balance checked against
the figures shown before confirming — including the client's worked example (an LP buys $10,000
of units, resells them for $11,000).
"""
from decimal import Decimal
from unittest import mock

from rest_framework.test import APITestCase

from apps.lp import market_services as lp_market
from apps.lp.models import LPHolding, LPTransaction
from apps.lp.tests import _FAKE_TRANSFER, _approved_lp_buyer, _deployed_property
from apps.wallets.models import UserBalance
from apps.wallets.services import credit_user_balance

from . import fees, services
from .models import SecondaryMarketListing
from .tests import _seller_with_tokens

D = Decimal


def _wallet(user):
    b = UserBalance.objects.filter(user=user).first()
    return b.current_balance if b else D("0")


class FeeArithmeticTests(APITestCase):
    def test_ordinary_secondary_sale(self):
        f = fees.secondary(D("10000"), 100, 0)
        self.assertEqual((f["seller_fee"], f["buyer_fee"], f["platform"], f["lp_share"]),
                         (D("50.00"), D("150.00"), D("200.00"), D("0.00")))
        self.assertEqual((f["seller_net"], f["buyer_total"]), (D("9950.00"), D("10150.00")))

    def test_lp_buys_on_the_lp_market(self):
        f = fees.lp_market(D("10000"))
        self.assertEqual(
            (f["seller_fee"], f["seller_net"], f["buyer_total"], f["lp_share"], f["platform"]),
            (D("150.00"), D("9850.00"), D("10000.00"), D("50.00"), D("100.00")),
        )

    def test_lp_resells_its_units(self):
        f = fees.secondary(D("11000"), 100, 100)
        self.assertEqual(
            (f["seller_fee"], f["buyer_fee"], f["buyer_total"], f["lp_share"], f["platform"]),
            (D("0.00"), D("165.00"), D("11165.00"), D("55.00"), D("110.00")),
        )

    def test_mixed_units_are_split_by_units(self):
        f = fees.secondary(D("1000"), 10, 4)  # 4 LP units + 6 own units
        self.assertEqual((f["lp_value"], f["seller_fee"], f["lp_share"], f["buyer_fee"]),
                         (D("400.00"), D("3.00"), D("2.00"), D("15.00")))


@mock.patch("apps.secondary_market.services.chain_service.transfer", return_value=_FAKE_TRANSFER)
@mock.patch("apps.lp.market_services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class ClientExampleTests(APITestCase):
    """LP buys 100 units ($10,000) from an investor, then resells them at $110 on the secondary market."""

    def setUp(self):
        self.prop = _deployed_property("fees-example")  # unit price 100
        self.seller, _ = _seller_with_tokens("fees-seller@ex.com", self.prop, 100)
        self.lp_user, self.lp = _approved_lp_buyer("fees-lp@ex.com", 20000)

    def _lp_buys(self):
        listing = lp_market.create_listing(
            user=self.seller, data={"property_id": self.prop.slug, "token_amount": 100},
        )
        # Shown before confirming: units value, the seller's fee and net, the LP's share.
        self.assertEqual(
            (listing.total_value, listing.platform_fee_amount, listing.net_amount,
             listing.lp_fee_share_amount),
            (D("10000.00"), D("150.00"), D("9850.00"), D("50.00")),
        )
        lp_market.purchase_listing(buyer_user=self.lp_user, listing_id=listing.pk)
        return listing

    def test_lp_purchase_matches_the_example(self, *_m):
        self._lp_buys()
        self.lp.refresh_from_db()
        self.assertEqual(_wallet(self.seller), D("9850.00"))
        # 20,000 − 10,000 paid + 50 share of the seller's fee.
        self.assertEqual(self.lp.current_balance, D("10050.00"))
        share = LPTransaction.objects.get(lp=self.lp, tx_type="fee_share")
        self.assertEqual(share.amount, D("50.00"))

    def test_resale_matches_the_example(self, *_m):
        self._lp_buys()
        listing = services.create_listing(
            user=self.lp_user,
            data={"property_id": self.prop.slug, "token_amount": 100, "unit_price": "110"},
        )
        self.assertEqual(
            (listing.total_value, listing.platform_fee_amount, listing.buyer_total,
             listing.seller_fee_amount, listing.net_amount, listing.lp_units,
             listing.lp_fee_share_amount),
            (D("11000.00"), D("165.00"), D("11165.00"), D("0.00"), D("11000.00"), 100, D("55.00")),
        )
        buyer, _ = _seller_with_tokens("fees-buyer@ex.com", self.prop, 0)
        credit_user_balance(buyer, D("12000"), source="test")
        services.purchase_listing(buyer_user=buyer, listing_id=listing.pk)

        self.lp.refresh_from_db()
        self.assertEqual(_wallet(buyer), D("12000") - D("11165.00"))
        # 10,050 after buying + 11,000 sale + 55 share = 21,105 → the LP gained 1,105 in all.
        self.assertEqual(self.lp.current_balance, D("21105.00"))
        self.assertEqual(self.lp.current_balance - D("20000"), D("1105.00"))
        self.assertEqual(_wallet(self.lp_user), D("0"))  # LP units pay the LP balance only
        self.assertFalse(
            LPHolding.objects.filter(lp=self.lp).exclude(status=LPHolding.Status.SOLD).exists()
        )
        self.assertEqual(
            list(LPTransaction.objects.filter(lp=self.lp, tx_type="fee_share")
                 .order_by("created_at").values_list("amount", flat=True)),
            [D("50.00"), D("55.00")],
        )
        done = SecondaryMarketListing.objects.get(pk=listing.pk)
        self.assertEqual((done.status, done.lp_fee_share_amount), ("completed", D("55.00")))


@mock.patch("apps.secondary_market.services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class OrdinarySecondarySaleTests(APITestCase):
    def test_seller_and_buyer_fees(self, *_m):
        prop = _deployed_property("fees-ordinary")
        seller, _ = _seller_with_tokens("fees-o-seller@ex.com", prop, 10)
        listing = services.create_listing(
            user=seller, data={"property_id": prop.slug, "token_amount": 10, "unit_price": "100"},
        )
        self.assertEqual(
            (listing.platform_fee_amount, listing.seller_fee_amount, listing.net_amount,
             listing.buyer_total),
            (D("15.00"), D("5.00"), D("995.00"), D("1015.00")),
        )
        buyer, _ = _seller_with_tokens("fees-o-buyer@ex.com", prop, 0)
        credit_user_balance(buyer, D("2000"), source="test")
        services.purchase_listing(buyer_user=buyer, listing_id=listing.pk)
        self.assertEqual(_wallet(seller), D("995.00"))
        self.assertEqual(_wallet(buyer), D("985.00"))

    def test_a_failed_settlement_books_nothing(self, m_transfer):
        """The settlement is one atomic block: if it fails, no fee or LP share is booked."""
        from apps.chain.exceptions import ChainError

        prop = _deployed_property("fees-fail")
        seller, _ = _seller_with_tokens("fees-f-seller@ex.com", prop, 10)
        listing = services.create_listing(
            user=seller, data={"property_id": prop.slug, "token_amount": 10, "unit_price": "100"},
        )
        buyer, _ = _seller_with_tokens("fees-f-buyer@ex.com", prop, 0)
        credit_user_balance(buyer, D("2000"), source="test")
        m_transfer.side_effect = ChainError("boom")
        with self.assertRaises(ChainError):
            services.purchase_listing(buyer_user=buyer, listing_id=listing.pk)
        self.assertEqual((_wallet(seller), _wallet(buyer)), (D("0"), D("2000")))
        self.assertEqual(SecondaryMarketListing.objects.get(pk=listing.pk).status, "listed")
        self.assertFalse(LPTransaction.objects.filter(tx_type="fee_share").exists())
