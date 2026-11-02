"""
The LP's own book (apps/lp/accounting.py, LP review 2026-11): resale proceeds of LP units go
back to the LP balance with the profit as earnings, the LP units' rental returns are earnings,
holdings are valued at today's unit price, "sold" is set only by a real sale, and the public
exit terms carry the real fees.
"""
from decimal import Decimal
from unittest import mock

from rest_framework.test import APITestCase

from apps.distributions.services import declare_distribution
from apps.kyc.services import get_or_create_kyc
from apps.properties.models import Property
from apps.wallets.models import BalanceTransaction, UserBalance

from .models import LPHolding, LPMarketListing, LPTransaction
from apps.secondary_market.tests import _seller_with_tokens as _kyc_holder

from .tests import _FAKE_TRANSFER, _approved_lp_buyer, _deployed_property, _seller_with_tokens


def _wallet(user):
    b = UserBalance.objects.filter(user=user).first()
    return b.current_balance if b else Decimal("0")


@mock.patch("apps.secondary_market.services.chain_service.transfer", return_value=_FAKE_TRANSFER)
@mock.patch("apps.lp.market_services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class LPBookTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property("book-1")  # unit price $100
        self.investor, _ = _seller_with_tokens("book-inv@ex.com", self.prop, 10)
        self.lp_user, self.lp = _approved_lp_buyer("book-lp@ex.com", 5000)
        kyc = get_or_create_kyc(self.lp_user)  # the secondary market asks for KYC
        kyc.mark_approved()
        kyc.save()

    def _lp_buys(self, units=10):
        """The investor exits to the LP: 10 × ($100 − 3%) = $970 from the LP balance."""
        self.client.force_authenticate(self.investor)
        lid = self.client.post(
            "/api/lp/market/", {"property_id": self.prop.slug, "token_amount": units}, format="json"
        ).data["id"]
        self.client.force_authenticate(self.lp_user)
        self.assertEqual(self.client.post(f"/api/lp/market/{lid}/purchase/").status_code, 200)
        self.lp.refresh_from_db()
        return LPHolding.objects.get(lp=self.lp)

    def _price(self, value):
        Property.objects.filter(pk=self.prop.pk).update(token_price=Decimal(value))

    def test_resale_on_the_secondary_market_pays_the_lp_balance(self, *_m):
        holding = self._lp_buys()
        self.assertEqual(self.lp.current_balance, Decimal("4030.00"))
        self.assertEqual(holding.purchase_price, Decimal("970.00"))

        self.client.force_authenticate(self.lp_user)
        sid = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 10, "unit_price": "110"}, format="json",
        ).data["id"]
        self.assertEqual(
            self.client.patch(f"/api/lp/holdings/{holding.id}/", {"status": "listed_secondary"},
                              format="json").status_code, 200,
        )
        buyer, _ = _kyc_holder("book-buyer@ex.com", self.prop, 0)
        UserBalance.objects.update_or_create(user=buyer, defaults={"current_balance": Decimal("5000")})
        self.client.force_authenticate(buyer)
        self.assertEqual(self.client.post(f"/api/secondary-market/{sid}/purchase/").status_code, 200)

        # The seller receives the full $1,100 (the buyer pays the fee): all of it to the LP.
        self.lp.refresh_from_db()
        self.assertEqual(self.lp.current_balance, Decimal("5130.00"))
        self.assertEqual(self.lp.total_earnings, Decimal("130.00"))
        self.assertEqual(_wallet(self.lp_user), Decimal("0"))
        holding.refresh_from_db()
        self.assertEqual(holding.status, LPHolding.Status.SOLD)
        self.assertEqual(holding.current_value, Decimal("1100.00"))
        ledger = dict(LPTransaction.objects.filter(lp=self.lp).values_list("tx_type", "amount"))
        self.assertEqual(ledger["sale"], Decimal("970.00"))
        self.assertEqual(ledger["earning"], Decimal("130.00"))

    def test_resale_to_another_lp_pays_back_at_a_loss(self, *_m):
        holding = self._lp_buys()
        self.client.force_authenticate(self.lp_user)
        lid = self.client.post(
            "/api/lp/market/", {"property_id": self.prop.slug, "token_amount": 10}, format="json"
        ).data["id"]
        other, other_lp = _approved_lp_buyer("book-lp2@ex.com", 5000)
        self.client.force_authenticate(other)
        self.assertEqual(self.client.post(f"/api/lp/market/{lid}/purchase/").status_code, 200)

        # $970 − 2% fee ($19.40) = $950.60 back; a $19.40 loss on the $970 cost.
        self.lp.refresh_from_db()
        self.assertEqual(self.lp.current_balance, Decimal("4980.60"))
        self.assertEqual(self.lp.total_earnings, Decimal("-19.40"))
        self.assertFalse(BalanceTransaction.objects.filter(balance__user=self.lp_user).exists())
        holding.refresh_from_db()
        self.assertEqual(holding.status, LPHolding.Status.SOLD)
        self.assertEqual(LPHolding.objects.get(lp=other_lp).status, LPHolding.Status.HELD)

    def test_a_partial_sale_splits_the_holding(self, *_m):
        holding = self._lp_buys()
        self.client.force_authenticate(self.lp_user)
        sid = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 4, "unit_price": "100"}, format="json",
        ).data["id"]
        buyer, _ = _kyc_holder("book-buyer2@ex.com", self.prop, 0)
        UserBalance.objects.update_or_create(user=buyer, defaults={"current_balance": Decimal("5000")})
        self.client.force_authenticate(buyer)
        self.client.post(f"/api/secondary-market/{sid}/purchase/")

        holding.refresh_from_db()
        self.assertEqual((holding.status, holding.token_amount, holding.purchase_price),
                         (LPHolding.Status.HELD, 6, Decimal("582.00")))
        sold = LPHolding.objects.get(lp=self.lp, status=LPHolding.Status.SOLD)
        self.assertEqual((sold.token_amount, sold.purchase_price, sold.current_value),
                         (4, Decimal("388.00"), Decimal("400.00")))
        self.lp.refresh_from_db()
        self.assertEqual(self.lp.total_earnings, Decimal("12.00"))

    def test_the_lp_users_own_units_still_pay_the_wallet(self, *_m):
        self._lp_buys(units=4)
        # The LP user also holds 6 units bought as an investor (not LP units).
        from apps.wallets.models import OwnershipToken

        OwnershipToken.objects.filter(wallet__user=self.lp_user, property_id=self.prop.slug).update(
            token_amount=10
        )
        self.client.force_authenticate(self.lp_user)
        sid = self.client.post(
            "/api/secondary-market/",
            {"property_id": self.prop.slug, "token_amount": 10, "unit_price": "100"}, format="json",
        ).data["id"]
        buyer, _ = _kyc_holder("book-buyer3@ex.com", self.prop, 0)
        UserBalance.objects.update_or_create(user=buyer, defaults={"current_balance": Decimal("5000")})
        self.client.force_authenticate(buyer)
        self.client.post(f"/api/secondary-market/{sid}/purchase/")

        self.lp.refresh_from_db()
        self.assertEqual(self.lp.current_balance, Decimal("5000") - Decimal("388.00") + Decimal("400.00"))
        self.assertEqual(_wallet(self.lp_user), Decimal("600.00"))

    def test_rental_returns_on_lp_units_are_earnings(self, *_m):
        self._lp_buys(units=4)  # investor keeps 6, the LP holds 4
        declare_distribution(self.prop.slug, Decimal("100"))
        self.lp.refresh_from_db()
        self.assertEqual(self.lp.total_earnings, Decimal("40.00"))
        self.assertEqual(self.lp.current_balance, Decimal("5000") - Decimal("388.00") + Decimal("40.00"))
        self.assertEqual(_wallet(self.lp_user), Decimal("0"))
        self.assertEqual(_wallet(self.investor), Decimal("388.00") - Decimal("7.76") + Decimal("60.00"))
        self.assertTrue(LPTransaction.objects.filter(lp=self.lp, tx_type="earning", amount=Decimal("40")).exists())

    def test_value_follows_the_unit_price(self, *_m):
        self._lp_buys()
        self._price("120")
        self.client.force_authenticate(self.lp_user)
        row = self.client.get("/api/lp/holdings/").json()[0]
        self.assertEqual(row["purchase_price"], 970.0)
        self.assertEqual(row["current_value"], 1200.0)

    def test_sold_is_never_set_by_hand(self, *_m):
        holding = self._lp_buys()
        self.client.force_authenticate(self.lp_user)
        resp = self.client.patch(f"/api/lp/holdings/{holding.id}/", {"status": "sold"}, format="json")
        self.assertEqual(resp.status_code, 400)
        holding.refresh_from_db()
        self.assertEqual(holding.status, LPHolding.Status.HELD)

    def test_a_closed_request_puts_the_holding_back_to_held(self, *_m):
        holding = self._lp_buys()
        self.client.force_authenticate(self.lp_user)
        lid = self.client.post(
            "/api/lp/market/", {"property_id": self.prop.slug, "token_amount": 10}, format="json"
        ).data["id"]
        self.client.patch(f"/api/lp/holdings/{holding.id}/", {"status": "listed_lp"}, format="json")
        self.client.post(f"/api/lp/market/{lid}/cancel/")
        holding.refresh_from_db()
        self.assertEqual((holding.status, holding.listed_at), (LPHolding.Status.HELD, None))
        self.assertEqual(LPMarketListing.objects.get(pk=lid).status, LPMarketListing.Status.CANCELLED)

    def test_public_exit_terms(self, *_m):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/lp/exit-terms/").json(), {
            "discount_percent": 3.0, "fee_percent": 2.0, "ttl_minutes": 1440,
            "secondary_fee_percent": 1.0,
        })
