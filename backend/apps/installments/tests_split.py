"""
Selling / transferring PART of an installment plan (apps/installments/split.py).

The plan used throughout is deliberately awkward so every rounding path is exercised:
7 units at $103.33 ($723.31), 23% down paid, 6 monthly installments with a 4% fee.
"""
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.investments.models import PLAN_SPLIT_METHOD, Investment
from apps.investments.services import sold_tokens
from apps.lp.models import LPHolding, LPMarketListing
from apps.lp.tests import _FAKE_TRANSFER, _approved_lp_buyer
from apps.properties.models import TokenMetadata
from apps.secondary_market import services as market
from apps.secondary_market.models import SecondaryMarketListing
from apps.transfers import services as transfers
from apps.transfers.models import UnitTransfer
from apps.wallets.models import BalanceTransaction, OwnershipToken
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from .models import InstallmentPaymentStatus, InstallmentPlan
from .services import settle_installment_payment
from .split import _plan_locked, check_part, part_figures, split_terms
from .tests_offplan_economics import _active_plan, _balance, _investor, _prop

D = Decimal


def _seller(prop, email="seller@ex.com"):
    seller = _investor(email)
    wallet, _ = get_or_create_custodial_wallet(seller)
    plan = _active_plan(seller, prop, units=7, months=7, pct="23", rate="4")
    Investment.objects.filter(installment_plan=plan).update(wallet=wallet)
    OwnershipToken.objects.create(
        wallet=wallet, property_id=prop.slug, property_name=prop.name, token_symbol="BRX",
        token_amount=7, locked_amount=_plan_locked(plan, 7),
    )
    return seller, plan


def _rows(plan):
    return list(plan.payments.order_by("sequence"))


def _snapshot(plan):
    return {
        "total": plan.total_amount,
        "down": plan.down_payment_amount,
        "rows": [(r.sequence, r.due_date, r.amount, r.fee_amount, r.status) for r in _rows(plan)],
    }


def _tok(user, prop):
    return OwnershipToken.objects.get(wallet__user=user, property_id=prop.slug)


def _inv(plan):
    return Investment.objects.get(installment_plan=plan)


class SplitArithmeticTests(TestCase):
    def setUp(self):
        self.prop = _prop("split-a", token_price=D("103.33"))
        self.seller, self.plan = _seller(self.prop)
        self.buyer = _investor("buyer@ex.com")
        credit_user_balance(self.buyer, D("5000"), source="test")

    def _sell(self, units, *, listed=None, price="110", buyer=None):
        listing = market.create_part_listing(
            user=self.seller, plan_id=self.plan.pk, units=listed or units, price_per_unit=D(price),
        )
        f = part_figures(self.plan, units, D(price))
        res = market.purchase_listing(
            buyer_user=buyer or self.buyer, listing_id=listing.pk, units=units,
            expected_cash=f["cash"], expected_fee=f["fee"],
        )
        return listing, f, InstallmentPlan.objects.get(pk=res["plan_id"])

    def test_the_two_plans_add_up_to_the_original_to_the_cent(self):
        before = _snapshot(self.plan)
        _listing, _f, new = self._sell(3)
        self.plan.refresh_from_db()
        self.assertEqual(new.total_amount + self.plan.total_amount, before["total"])
        self.assertEqual(new.down_payment_amount + self.plan.down_payment_amount, before["down"])
        for orig, a, b in zip(before["rows"], _rows(self.plan), _rows(new)):
            seq, due, amount, fee, status = orig
            self.assertEqual((a.sequence, a.due_date, a.status), (seq, due, status))
            self.assertEqual((b.sequence, b.due_date, b.status), (seq, due, status))
            self.assertEqual(a.amount + b.amount, amount)
            self.assertEqual(a.fee_amount + b.fee_amount, fee)
        # The buyer's share is 3/7 of everything; their total is exactly round(723.31 × 3/7).
        self.assertEqual(new.total_amount, D("309.99"))
        for orig, b in zip(before["rows"][:-1], _rows(new)[:-1]):
            self.assertEqual(b.amount, (orig[2] * 3 / 7).quantize(D("0.01"), rounding="ROUND_DOWN"))
        self.assertEqual(new.number_of_installments, self.plan.number_of_installments)
        self.assertEqual((new.split_from_id, new.investor_id, new.units_total), (self.plan.pk, self.buyer.pk, 3))
        # Units and the sold total: 4 + 3 = 7, the property's sold units unchanged.
        self.assertEqual((_inv(self.plan).token_amount, _inv(new).token_amount), (4, 3))
        self.assertEqual(_inv(new).payment_method, PLAN_SPLIT_METHOD)
        self.assertEqual(sold_tokens(self.prop), 7)
        self.assertEqual(
            _inv(self.plan).amount_invested + _inv(new).amount_invested, before["total"]
        )

    def test_money_units_and_locks(self):
        _listing, f, new = self._sell(3)
        # cash = 3 × $110 − the buyer's remaining principal; 1% fee on top for the buyer.
        terms = split_terms(new, 3)
        self.assertEqual(f["cash"], D("330.00") - terms["remaining"])
        self.assertEqual(_balance(self.buyer), D("5000") - f["cash"] - f["fee"])
        self.assertEqual(_balance(self.seller), f["cash"])
        s, b = _tok(self.seller, self.prop), _tok(self.buyer, self.prop)
        self.plan.refresh_from_db()
        self.assertEqual((s.token_amount, b.token_amount), (4, 3))
        self.assertEqual(s.locked_amount, _plan_locked(self.plan, 4))
        self.assertEqual(b.locked_amount, _plan_locked(new, 3))
        # The buyer's certificate is in their name for their 3 units; the seller's now says 4.
        from apps.certificates.models import Certificate

        self.assertEqual(Certificate.objects.get(investment=_inv(new)).units_purchased, 3)
        self.assertEqual(Certificate.objects.get(user=self.buyer).investment.installment_plan_id, new.pk)

    def test_buyer_takes_part_of_the_offer_the_rest_stays_listed(self):
        listing, _f, first = self._sell(1, listed=5)
        listing.refresh_from_db()
        self.assertEqual((listing.status, listing.token_amount), (SecondaryMarketListing.Status.LISTED, 4))
        self.assertTrue(
            SecondaryMarketListing.objects.filter(
                plan=self.plan, status="completed", token_amount=1, buyer=self.buyer,
            ).exists()
        )
        # A second buyer takes 2 more of the same listing.
        other = _investor("other@ex.com")
        credit_user_balance(other, D("5000"), source="test")
        f = part_figures(self.plan, 2, listing.unit_price)
        market.purchase_listing(
            buyer_user=other, listing_id=listing.pk, units=2,
            expected_cash=f["cash"], expected_fee=f["fee"],
        )
        listing.refresh_from_db()
        self.assertEqual(listing.token_amount, 2)
        self.plan.refresh_from_db()
        self.assertEqual(_inv(self.plan).token_amount, 4)
        self.assertEqual(sold_tokens(self.prop), 7)
        # Buying more than is offered is refused.
        with self.assertRaises(ValidationError):
            market.purchase_listing(
                buyer_user=other, listing_id=listing.pk, units=3,
                expected_cash=f["cash"], expected_fee=f["fee"],
            )

    def test_sell_part_then_another_part_then_the_buyer_resells_part(self):
        before = _snapshot(self.plan)
        _l, _f, first = self._sell(3)
        other = _investor("other@ex.com")
        credit_user_balance(other, D("5000"), source="test")
        _l, _f, second = self._sell(2, buyer=other)
        # The first buyer resells 1 of their 3 units.
        third_buyer = _investor("third@ex.com")
        credit_user_balance(third_buyer, D("5000"), source="test")
        resale = market.create_part_listing(user=self.buyer, plan_id=first.pk, units=1, price_per_unit=D("120"))
        f = part_figures(first, 1, D("120"))
        res = market.purchase_listing(
            buyer_user=third_buyer, listing_id=resale.pk, units=1,
            expected_cash=f["cash"], expected_fee=f["fee"],
        )
        third = InstallmentPlan.objects.get(pk=res["plan_id"])
        plans = [InstallmentPlan.objects.get(pk=p.pk) for p in (self.plan, first, second, third)]
        self.assertEqual(sum(p.total_amount for p in plans), before["total"])
        for i, orig in enumerate(before["rows"]):
            self.assertEqual(sum(_rows(p)[i].amount for p in plans), orig[2])
            self.assertEqual(sum(_rows(p)[i].fee_amount for p in plans), orig[3])
        self.assertEqual([_inv(p).token_amount for p in plans], [2, 2, 2, 1])
        self.assertEqual(third.split_from_id, first.pk)
        self.assertEqual(sold_tokens(self.prop), 7)

    def test_overdue_installment_blocks_a_part_sale(self):
        row = _rows(self.plan)[0]
        row.due_date = timezone.localdate() - timedelta(days=2)
        row.save(update_fields=["due_date"])
        with self.assertRaises(ValidationError) as ctx:
            market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=2)
        self.assertEqual(ctx.exception.detail["code"], "overdue_installments")
        # Paying it lifts the block.
        settle_installment_payment(row.id)
        market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=2)

    def test_a_listing_made_before_the_overdue_cannot_be_bought_until_it_is_paid(self):
        listing = market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=2)
        row = _rows(self.plan)[0]
        row.status = InstallmentPaymentStatus.MISSED
        row.save(update_fields=["status"])
        f = part_figures(self.plan, 1, listing.unit_price)
        with self.assertRaises(market.ListingUnavailableError):
            market.purchase_listing(
                buyer_user=self.buyer, listing_id=listing.pk, units=1,
                expected_cash=f["cash"], expected_fee=f["fee"],
            )
        self.assertEqual(_balance(self.buyer), D("5000"))

    def test_never_more_than_the_free_units(self):
        with self.assertRaises(ValidationError) as ctx:
            market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=8)
        self.assertEqual(ctx.exception.detail["code"], "exceeds_free_units")
        market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=5)
        # 5 offered on the market → only 2 free for a transfer; at least 1 unit always.
        with self.assertRaises(ValidationError) as ctx:
            check_part(self.plan, 3)
        self.assertEqual(str(ctx.exception.detail["free_units"]), "2")
        with self.assertRaises(ValidationError):
            check_part(self.plan, 0)
        # The whole plan can't be listed while part of it is offered.
        market.cancel_listing(user=self.seller, listing_id=SecondaryMarketListing.objects.get(plan=self.plan).pk)
        market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=1)
        with self.assertRaises(ValidationError):
            market.create_position_listing(user=self.seller, plan_id=self.plan.pk)

    def test_whole_position_sale_is_unchanged(self):
        listing = market.create_position_listing(user=self.seller, plan_id=self.plan.pk, price_per_unit=D("110"))
        self.assertFalse(listing.plan_part)
        from .position import position_figures

        f = position_figures(self.plan, D("110"))
        market.purchase_listing(
            buyer_user=self.buyer, listing_id=listing.pk,
            expected_cash=f["cash"], expected_fee=f["fee"],
        )
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.investor_id, self.buyer.pk)
        self.assertEqual(_tok(self.buyer, self.prop).token_amount, 7)

    def test_both_plans_keep_paying_after_the_split(self):
        _l, _f, new = self._sell(3)
        before_locked = _tok(self.buyer, self.prop).locked_amount
        settle_installment_payment(_rows(new)[0].id)
        settle_installment_payment(_rows(new)[1].id)
        self.assertLess(_tok(self.buyer, self.prop).locked_amount, before_locked)
        # No referral commission on a plan bought from someone else.
        self.assertFalse(BalanceTransaction.objects.filter(source="broker_commission").exists())
        for r in _rows(self.plan):
            settle_installment_payment(r.id)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, "completed")
        self.assertEqual(_tok(self.seller, self.prop).locked_amount, 0)

    def test_a_part_listing_follows_the_plan(self):
        listing = market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=3, price_per_unit=D("110"))
        cash = listing.total_value
        settle_installment_payment(_rows(self.plan)[0].id)
        listing.refresh_from_db()
        self.assertGreater(listing.total_value, cash)  # the seller paid more → more paid share
        # The released units are released (a part listing holds no escrow).
        self.assertEqual(_tok(self.seller, self.prop).locked_amount, _plan_locked(self.plan, 7))
        for r in _rows(self.plan)[1:]:
            settle_installment_payment(r.id)
        listing.refresh_from_db()
        self.assertEqual(listing.status, SecondaryMarketListing.Status.CANCELLED)


class SplitTransferTests(TestCase):
    def setUp(self):
        self.prop = _prop("split-t", token_price=D("103.33"))
        self.seller, self.plan = _seller(self.prop)
        credit_user_balance(self.seller, D("100"), source="test")  # the gift fee
        self.kid = _investor("kid@ex.com")
        self.kid.is_email_verified = True
        self.kid.save(update_fields=["is_email_verified"])

    def test_gift_part_of_a_plan(self):
        before = _snapshot(self.plan)
        with self.captureOnCommitCallbacks(execute=True):
            t = transfers.create_gift(
                self.seller, recipient_email="kid@ex.com", asset="units", units=2,
                plan_id=self.plan.pk,
            )
        t.refresh_from_db()
        self.assertEqual(t.status, UnitTransfer.Status.DELIVERED)
        got = InstallmentPlan.objects.get(investor=self.kid)
        self.plan.refresh_from_db()
        self.assertEqual(got.total_amount + self.plan.total_amount, before["total"])
        self.assertEqual((_inv(got).token_amount, _inv(self.plan).token_amount), (2, 5))
        self.assertEqual(_tok(self.kid, self.prop).token_amount, 2)
        self.assertEqual(got.acquired_price, D("103.33"))  # the giver's entry price
        self.assertEqual(sold_tokens(self.prop), 7)

    def test_pending_transfer_holds_the_units_and_overdue_fails_delivery(self):
        future = timezone.localdate() + timedelta(days=3)
        t = transfers.create_gift(
            self.seller, recipient_email="kid@ex.com", asset="units", units=6,
            plan_id=self.plan.pk, deliver_on=future,
        )
        with self.assertRaises(ValidationError):  # only 1 left free
            market.create_part_listing(user=self.seller, plan_id=self.plan.pk, units=2)
        row = _rows(self.plan)[0]
        row.status = InstallmentPaymentStatus.MISSED
        row.save(update_fields=["status"])
        UnitTransfer.objects.filter(pk=t.pk).update(deliver_on=timezone.localdate())
        fee_before = _balance(self.seller)
        transfers.deliver(t.pk)
        t.refresh_from_db()
        self.assertEqual(t.status, UnitTransfer.Status.FAILED)
        self.assertEqual(_balance(self.seller), fee_before + t.fee_amount)  # fee returned
        self.assertFalse(InstallmentPlan.objects.filter(investor=self.kid).exists())


@mock.patch("apps.lp.market_services.chain_service.transfer", return_value=_FAKE_TRANSFER)
class SplitLPTests(TestCase):
    def setUp(self):
        self.prop = _prop("split-lp", token_price=D("103.33"))
        meta, _ = TokenMetadata.objects.get_or_create(property=self.prop)
        meta.deployed_contract_address = "0x" + "11" * 20
        meta.deployment_chain_id = 97
        meta.save()
        self.seller, self.plan = _seller(self.prop)
        self.lp_user, self.lp = _approved_lp_buyer("lp@ex.com", 5000)

    def test_lp_buys_part_of_a_plan(self, _tr):
        before = _snapshot(self.plan)
        listing = __import__("apps.lp.market_services", fromlist=["x"]).create_plan_listing(
            user=self.seller, plan_id=self.plan.pk, units=3,
        )
        # Platform price: $103.33 − 3% = $100.23; cash = 3 × 100.23 − the assumed principal.
        self.assertEqual(listing.unit_price, D("100.23"))
        self.assertEqual(listing.total_value, D("300.69") - listing.assumed_principal)
        from apps.lp.market_services import purchase_listing

        res = purchase_listing(buyer_user=self.lp_user, listing_id=listing.pk)
        self.assertTrue(res["completed"])
        self.lp.refresh_from_db()
        self.assertEqual(self.lp.current_balance, D("5000") - listing.total_value)
        self.assertEqual(_balance(self.seller), listing.net_amount)  # 2% fee off the cash
        got = InstallmentPlan.objects.get(pk=res["plan_id"])
        self.plan.refresh_from_db()
        self.assertEqual(got.investor_id, self.lp_user.pk)
        self.assertEqual(got.total_amount + self.plan.total_amount, before["total"])
        self.assertEqual(LPHolding.objects.get(lp=self.lp).token_amount, 3)
        self.assertEqual(LPMarketListing.objects.get(pk=listing.pk).status, "completed")


class PlanPartPreviewApiTests(APITestCase):
    def test_preview(self):
        prop = _prop("split-api", token_price=D("103.33"))
        seller, plan = _seller(prop)
        self.client.force_authenticate(seller)
        r = self.client.get(f"/api/installments/plans/{plan.pk}/part/?units=3&price=110")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual((body["units"], body["keptUnits"], body["freeUnits"]), (3, 4, 7))
        self.assertAlmostEqual(body["taker"]["total"] + body["keeper"]["total"], 723.31, places=2)
        self.assertEqual(len(body["taker"]["schedule"]), 6)
        bad = self.client.get(f"/api/installments/plans/{plan.pk}/part/?units=9")
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.json()["code"], "exceeds_free_units")
