"""
Off-plan model, phase 5 — selling an installment plan as ONE position (OFFPLAN_EXIT_MODEL_AR.md
§6), and the buyer-paid resale fee on the whole secondary market (decision 5).

Client example A: 10 units at $100 = $1,000, $200 paid, the price rises to $110 →
position value $1,100, remaining $800, the buyer pays the seller $300 (+ 1% fee = $3) and
takes over the remaining $800 of installments.
"""
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.installments.models import InstallmentPaymentStatus, InstallmentPlan
from apps.installments.position import holder_view
from apps.installments.services import (
    collect_due_installments,
    settle_installment_payment,
)
from apps.installments.tests_offplan_economics import _active_plan, _balance, _investor, _prop
from apps.investments.models import Investment
from apps.investments.services import sold_tokens
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from . import services
from .models import SecondaryMarketListing


def _set_price(prop, price):
    Property.objects.filter(pk=prop.pk).update(token_price=Decimal(price))
    prop.refresh_from_db()


def _seller_with_plan(prop, email="seller@ex.com"):
    """Example A: 10 units at $100, 20% down ($200) paid, 4 × $200 left (4% fee on each)."""
    seller = _investor(email)
    wallet, _ = get_or_create_custodial_wallet(seller)
    plan = _active_plan(seller, prop, units=10, months=5, pct="20", rate="4")
    Investment.objects.filter(installment_plan=plan).update(wallet=wallet)
    OwnershipToken.objects.create(
        wallet=wallet, property_id=prop.slug, property_name=prop.name, token_symbol="BRX",
        token_amount=10, locked_amount=8, token_value_usd=Decimal("1000"),
    )
    return seller, wallet, plan


def _token(user, prop):
    return OwnershipToken.objects.get(wallet__user=user, property_id=prop.slug)


def _rows(plan):
    return list(plan.payments.order_by("sequence"))


class PositionListingTests(TestCase):
    def setUp(self):
        self.prop = _prop("pos-a")
        self.seller, self.wallet, self.plan = _seller_with_plan(self.prop)
        _set_price(self.prop, 110)

    def test_figures_match_the_client_example(self):
        listing = services.create_position_listing(
            user=self.seller, plan_id=self.plan.pk, price_per_unit=Decimal("110")
        )
        self.assertEqual(listing.token_amount, 10)
        self.assertEqual(listing.position_value, Decimal("1100.00"))
        self.assertEqual(listing.assumed_principal, Decimal("800.00"))
        self.assertEqual(listing.paid_principal, Decimal("200.00"))
        self.assertEqual(listing.total_value, Decimal("300.00"))  # 200 paid + 100 gain
        self.assertEqual(listing.net_amount, Decimal("300.00"))   # the seller gets it all
        self.assertEqual(listing.platform_fee_amount, Decimal("3.00"))
        self.assertEqual(listing.buyer_total, Decimal("303.00"))
        # The paid units join the plan's locked ones in escrow: nothing is sellable apart.
        self.assertEqual(_token(self.seller, self.prop).locked_amount, 10)

    def test_default_price_is_the_current_unit_price(self):
        listing = services.create_position_listing(user=self.seller, plan_id=self.plan.pk)
        self.assertEqual(listing.unit_price, Decimal("110.00"))

    def test_price_must_cover_the_remaining_principal(self):
        for price in ("79", "80"):  # 790 < 800; 800 leaves the seller nothing
            with self.assertRaises(ValidationError):
                services.create_position_listing(
                    user=self.seller, plan_id=self.plan.pk, price_per_unit=Decimal(price)
                )
        self.assertFalse(SecondaryMarketListing.objects.exists())

    def test_falling_price_loss_is_on_all_units(self):
        listing = services.create_position_listing(
            user=self.seller, plan_id=self.plan.pk, price_per_unit=Decimal("95")
        )
        self.assertEqual(listing.total_value, Decimal("150.00"))  # 200 − 50 (example C)

    def test_one_open_listing_per_plan(self):
        services.create_position_listing(user=self.seller, plan_id=self.plan.pk)
        with self.assertRaises(ValidationError):
            services.create_position_listing(user=self.seller, plan_id=self.plan.pk)

    def test_only_the_holder_can_list(self):
        other = _investor("other@ex.com")
        with self.assertRaises(ValidationError):
            services.create_position_listing(user=other, plan_id=self.plan.pk)

    def test_plan_units_cannot_be_sold_one_by_one(self):
        with self.assertRaises(Exception):
            services.create_listing(
                user=self.seller,
                data={"property_id": self.prop.slug, "token_amount": 2, "unit_price": 110},
            )

    def test_cancel_returns_the_escrow(self):
        listing = services.create_position_listing(user=self.seller, plan_id=self.plan.pk)
        services.cancel_listing(user=self.seller, listing_id=listing.pk)
        self.assertEqual(_token(self.seller, self.prop).locked_amount, 8)

    def test_installment_paid_while_listed_raises_the_cash(self):
        listing = services.create_position_listing(
            user=self.seller, plan_id=self.plan.pk, price_per_unit=Decimal("110")
        )
        settle_installment_payment(_rows(self.plan)[0].id)
        listing.refresh_from_db()
        self.assertEqual(listing.total_value, Decimal("500.00"))  # 1100 − 600
        self.assertEqual(listing.assumed_principal, Decimal("600.00"))
        # Escrow keeps every unit; cancelling then frees the 4 paid ones.
        self.assertEqual(_token(self.seller, self.prop).locked_amount, 10)
        services.cancel_listing(user=self.seller, listing_id=listing.pk)
        self.assertEqual(_token(self.seller, self.prop).locked_amount, 6)

    def test_plan_paid_off_while_listed_closes_the_listing(self):
        listing = services.create_position_listing(user=self.seller, plan_id=self.plan.pk)
        for row in _rows(self.plan):
            settle_installment_payment(row.id)
        listing.refresh_from_db()
        self.assertEqual(listing.status, SecondaryMarketListing.Status.CANCELLED)
        self.assertEqual(_token(self.seller, self.prop).locked_amount, 0)


class PositionPurchaseTests(TestCase):
    def setUp(self):
        self.prop = _prop("pos-b")
        self.seller, self.wallet, self.plan = _seller_with_plan(self.prop)
        _set_price(self.prop, 110)
        self.listing = services.create_position_listing(
            user=self.seller, plan_id=self.plan.pk, price_per_unit=Decimal("110")
        )
        self.buyer = _investor("buyer@ex.com")
        credit_user_balance(self.buyer, Decimal("1000"), source="test")

    def _buy(self, cash="300.00", fee="3.00", buyer=None):
        return services.purchase_listing(
            buyer_user=buyer or self.buyer, listing_id=self.listing.pk,
            expected_cash=Decimal(cash), expected_fee=Decimal(fee),
        )

    def test_buy_moves_money_units_and_plan(self):
        res = self._buy()
        self.assertTrue(res["completed"])
        self.assertTrue(res["tx_hash"].startswith("offchain:"))  # no contract → no fake tx
        # Money: buyer −303, seller +300 in full.
        self.assertEqual(_balance(self.buyer), Decimal("697.00"))
        self.assertEqual(_balance(self.seller), Decimal("300.00"))
        # Units: all 10 move; the 8 unpaid stay locked for the plan, now on the buyer.
        seller_tok = _token(self.seller, self.prop)
        self.assertEqual((seller_tok.token_amount, seller_tok.locked_amount), (0, 0))
        buyer_tok = _token(self.buyer, self.prop)
        self.assertEqual((buyer_tok.token_amount, buyer_tok.locked_amount), (10, 8))
        # The plan is the buyer's, with the same rows, dates and fees.
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.investor_id, self.buyer.pk)
        self.assertEqual(
            sum(r.amount for r in _rows(self.plan) if r.status == "pending"), Decimal("800.00")
        )
        # The buyer's cost basis = their entry price on all the units; primary sales unchanged.
        cost = Investment.objects.get(user=self.buyer, payment_method="secondary_market")
        self.assertEqual(cost.price_per_token, Decimal("110.00"))
        self.assertEqual(cost.token_amount, 10)
        self.assertEqual(sold_tokens(self.prop), 10)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, SecondaryMarketListing.Status.COMPLETED)
        self.assertEqual(self.listing.buyer_id, self.buyer.pk)

    def test_changed_figures_are_refused(self):
        with self.assertRaises(services.PositionChangedError):
            self._buy(cash="299.00")
        settle_installment_payment(_rows(self.plan)[0].id)  # the seller pays one meanwhile
        with self.assertRaises(services.PositionChangedError):
            self._buy()
        self._buy(cash="500.00", fee="5.00")
        self.assertEqual(_balance(self.buyer), Decimal("495.00"))

    def test_figures_are_required(self):
        with self.assertRaises(ValidationError):
            services.purchase_listing(buyer_user=self.buyer, listing_id=self.listing.pk)

    def test_insufficient_balance_changes_nothing(self):
        poor = _investor("poor@ex.com")
        credit_user_balance(poor, Decimal("302"), source="test")
        with self.assertRaises(services.InsufficientBalanceError):
            self._buy(buyer=poor)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.investor_id, self.seller.pk)
        self.assertEqual(_token(self.seller, self.prop).locked_amount, 10)

    def test_replay_is_the_same_purchase(self):
        self._buy()
        again = self._buy()
        self.assertTrue(again["already"])
        self.assertEqual(_balance(self.buyer), Decimal("697.00"))

    def test_cannot_buy_own_listing(self):
        credit_user_balance(self.seller, Decimal("1000"), source="test")
        with self.assertRaises(ValidationError):
            self._buy(buyer=self.seller)

    def test_buyer_pays_the_installments_after(self):
        self._buy()
        credit_user_balance(self.buyer, Decimal("208"), source="test")
        # Make the first remaining row due and let the auto-debit take it from the BUYER.
        first = _rows(self.plan)[0]
        first.due_date = timezone.now().date()
        first.save(update_fields=["due_date"])
        result = collect_due_installments()
        self.assertEqual(result["collected"], 1)
        self.assertEqual(_balance(self.buyer), Decimal("697.00"))  # 905 − (200 + 4% fee)
        self.assertEqual(_balance(self.seller), Decimal("300.00"))
        self.assertEqual(_token(self.buyer, self.prop).locked_amount, 6)  # 2 more released

    def test_overdue_row_moves_to_the_buyer(self):
        first = _rows(self.plan)[0]
        first.status = InstallmentPaymentStatus.MISSED
        first.reminder_sent_at = timezone.now()
        first.save(update_fields=["status", "reminder_sent_at"])
        self._buy()
        first.refresh_from_db()
        self.assertEqual(first.status, InstallmentPaymentStatus.MISSED)
        self.assertIsNone(first.reminder_sent_at)  # the buyer gets their own reminder

    def test_each_holder_is_measured_from_their_own_entry(self):
        self._buy()
        _set_price(self.prop, 121)
        plan = InstallmentPlan.objects.get(pk=self.plan.pk)
        view = holder_view(plan, self.prop.token_price)
        # Example D: entry 110 → cost 1100 − 800 = 300, gain 10 × 11 = 110, sells for 410.
        self.assertEqual(view["entryPrice"], 110.0)
        self.assertEqual(view["cost"], 300.0)
        self.assertEqual(view["gain"], 110.0)
        self.assertEqual(view["equity"], 410.0)


class PositionApiTests(APITestCase):
    def setUp(self):
        self.prop = _prop("pos-api")
        self.seller, self.wallet, self.plan = _seller_with_plan(self.prop)
        _set_price(self.prop, 110)
        self.buyer = _investor("api-buyer@ex.com")
        credit_user_balance(self.buyer, Decimal("1000"), source="test")

    def test_list_browse_and_buy(self):
        self.client.force_authenticate(self.seller)
        plans = self.client.get("/api/installments/plans/").data["plans"]
        position = plans[0]["position"]
        self.assertEqual(position["equity"], 300.0)
        self.assertIsNone(position["blocked"])

        created = self.client.post(
            "/api/secondary-market/positions/",
            {"plan_id": str(self.plan.pk), "price_per_unit": "110"}, format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        lid = created.data["id"]
        self.assertTrue(created.data["is_position"])

        self.client.force_authenticate(self.buyer)
        market = self.client.get("/api/secondary-market/").data
        self.assertEqual(market["fee_percent"], 1.0)
        card = market["listings"][0]
        self.assertEqual(card["buyer_total"], 303.0)
        self.assertEqual(card["position"]["remaining_installments"], 4)
        self.assertEqual(card["position"]["remaining_charge"], 832.0)  # 800 + 4% fee
        self.assertEqual(card["position"]["price_change_pct"], 10.0)

        stale = self.client.post(
            f"/api/secondary-market/{lid}/purchase/",
            {"expected_cash": "250", "expected_fee": "2.5"}, format="json",
        )
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data["code"], "POSITION_CHANGED")
        self.assertEqual(stale.data["cash"], "300.00")

        bought = self.client.post(
            f"/api/secondary-market/{lid}/purchase/",
            {"expected_cash": card["total_value"], "expected_fee": card["platform_fee_amount"]},
            format="json",
        )
        self.assertEqual(bought.status_code, 200, bought.data)
        mine = self.client.get("/api/installments/plans/").data["plans"]
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]["position"]["entryPrice"], 110.0)
