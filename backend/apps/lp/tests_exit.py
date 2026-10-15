"""
Off-plan decision 6 — the platform-priced LP exit (OFFPLAN_EXIT_MODEL_AR.md §5.2).

The seller can't set a price: the request is quoted at the current unit price minus 3%, the 2%
liquidity fee is deducted from it, and it stays open 24 hours. A unit price change closes every
open request on the property, and a request quoted at an older price is never funded.

Client example: 10 units at $105 → $1,050 − 3% = $1,018.50 − 2% fee ($20.37) = $998.13.
"""
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.notifications.models import Notification
from apps.properties.models import Property
from apps.properties.pricing import record_price
from apps.wallets.models import OwnershipToken, UserBalance

from .models import LPMarketListing
from .tests import _FAKE_TRANSFER, _approved_lp_buyer, _deployed_property, _seller_with_tokens


def _price(prop, value):
    Property.objects.filter(pk=prop.pk).update(token_price=Decimal(value))
    prop.refresh_from_db()


@mock.patch("apps.lp.market_services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class PlatformPricedExitTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property("exit-1")
        _price(self.prop, "105")
        self.seller, self.wallet = _seller_with_tokens("exit-seller@ex.com", self.prop, 10)
        self.client.force_authenticate(self.seller)

    def _request(self, units=10, **extra):
        return self.client.post(
            "/api/lp/market/",
            {"property_id": self.prop.slug, "token_amount": units, **extra}, format="json",
        )

    def _locked(self):
        return OwnershipToken.objects.get(wallet=self.wallet, property_id=self.prop.slug).locked_amount

    def test_quote_matches_the_client_example(self, m_transfer):
        resp = self._request(unit_price="200")  # the seller's own price is ignored
        self.assertEqual(resp.status_code, 201, resp.data)
        body = resp.json()
        self.assertEqual(body["pricing"], "platform")
        self.assertEqual(body["reference_price"], 105.0)
        self.assertEqual(body["discount_percent"], 3.0)
        self.assertEqual(body["unit_price"], 101.85)
        self.assertEqual(body["total_value"], 1018.5)
        self.assertEqual(body["platform_fee_amount"], 20.37)
        self.assertEqual(body["net_amount"], 998.13)
        listing = LPMarketListing.objects.get(pk=resp.data["id"])
        ttl = listing.expires_at - listing.created_at
        self.assertAlmostEqual(ttl.total_seconds(), 24 * 3600, delta=5)

    def test_terms_are_published_with_the_market(self, m_transfer):
        terms = self.client.get("/api/lp/market/").data["exit_terms"]
        self.assertEqual(terms, {"discount_percent": 3.0, "fee_percent": 2.0, "ttl_minutes": 1440})

    def test_funded_at_the_quote(self, m_transfer):
        lid = self._request().data["id"]
        buyer, lp = _approved_lp_buyer("exit-lp@ex.com", 5000)
        self.client.force_authenticate(buyer)
        resp = self.client.post(f"/api/lp/market/{lid}/purchase/")
        self.assertEqual(resp.status_code, 200, resp.data)
        lp.refresh_from_db()
        self.assertEqual(lp.current_balance, Decimal("3981.50"))  # 5000 − 1018.50
        self.assertEqual(UserBalance.objects.get(user=self.seller).current_balance, Decimal("998.13"))

    def test_price_change_closes_open_requests(self, m_transfer):
        lid = self._request().data["id"]
        self.assertEqual(self._locked(), 10)
        admin = User.objects.create_superuser(email="exit-admin@ex.com", password="pw-12345-strong")
        record_price(self.prop, Decimal("110"), by=admin, label="Phase 2")
        listing = LPMarketListing.objects.get(pk=lid)
        self.assertEqual(listing.status, LPMarketListing.Status.EXPIRED)
        self.assertEqual(self._locked(), 0)  # units free again
        self.assertTrue(
            Notification.objects.filter(user=self.seller, type="lp_exit_closed").exists()
        )

    def test_a_request_at_an_old_price_is_never_funded(self, m_transfer):
        lid = self._request().data["id"]
        _price(self.prop, "110")  # slipped past the closing (no record_price)
        buyer, lp = _approved_lp_buyer("exit-lp2@ex.com", 5000)
        self.client.force_authenticate(buyer)
        resp = self.client.post(f"/api/lp/market/{lid}/purchase/")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.data["code"], "REQUEST_CLOSED")
        self.assertEqual(resp.data["reason"], "price_changed")
        m_transfer.assert_not_called()
        lp.refresh_from_db()
        self.assertEqual(lp.current_balance, Decimal("5000"))
        self.assertEqual(LPMarketListing.objects.get(pk=lid).status, LPMarketListing.Status.EXPIRED)
        self.assertEqual(self._locked(), 0)

    def test_expired_request_is_closed_and_not_funded(self, m_transfer):
        lid = self._request().data["id"]
        LPMarketListing.objects.filter(pk=lid).update(expires_at=timezone.now() - timedelta(minutes=1))
        out = StringIO()
        call_command("close_stale_lp_requests", stdout=out)
        self.assertIn("1 closed", out.getvalue())
        self.assertEqual(LPMarketListing.objects.get(pk=lid).status, LPMarketListing.Status.EXPIRED)
        self.assertEqual(self._locked(), 0)
        buyer, _lp = _approved_lp_buyer("exit-lp3@ex.com", 5000)
        self.client.force_authenticate(buyer)
        self.assertEqual(self.client.post(f"/api/lp/market/{lid}/purchase/").status_code, 409)
        m_transfer.assert_not_called()

    def test_expired_requests_leave_the_market(self, m_transfer):
        lid = self._request().data["id"]
        LPMarketListing.objects.filter(pk=lid).update(expires_at=timezone.now() - timedelta(minutes=1))
        buyer, _lp = _approved_lp_buyer("exit-lp4@ex.com", 5000)
        self.client.force_authenticate(buyer)
        self.assertEqual(self.client.get("/api/lp/market/").data["listings"], [])
        self.assertEqual(self._locked(), 0)

    def test_legacy_seller_priced_listing_keeps_its_terms(self, m_transfer):
        legacy = LPMarketListing.objects.create(
            seller=self.seller, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol="BRX1", token_amount=2, unit_price=Decimal("100"),
            total_value=Decimal("200"), platform_fee_percent=Decimal("1"),
            platform_fee_amount=Decimal("2"), net_amount=Decimal("198"),
            pricing=LPMarketListing.Pricing.SELLER,
        )
        admin = User.objects.create_superuser(email="exit-admin2@ex.com", password="pw-12345-strong")
        record_price(self.prop, Decimal("110"), by=admin)
        legacy.refresh_from_db()
        self.assertEqual(legacy.status, LPMarketListing.Status.LISTED)
