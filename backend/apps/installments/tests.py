"""
Installments — Wave A tests. Run against Postgres (capimax_brx).

Covers: cent-exact schedule (down + Σ installments == total, with a rounding remainder
absorbed by the final row); installment-model eligibility (others rejected); rows created
in draft/pending; self-scoped read; and the WAVE-A INVARIANT that NO money/mint/token
logic is touched (no BalanceTransaction, no OwnershipToken, no Investment, no chain call).
"""
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import create_investment, mint_investment
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction, OwnershipToken
from apps.wallets.services import get_or_create_custodial_wallet

from .models import (
    InstallmentFrequency,
    InstallmentPayment,
    InstallmentPaymentStatus,
    InstallmentPlan,
    InstallmentPlanStatus,
)
from .services import build_installment_plan, compute_schedule


def _make_property(slug, *, model="installment", category="construction",
                   total_value="5000000", token_price="100"):
    p = Property(**_valid_property_kwargs(
        slug=slug, model=model, category=category,
        total_value=Decimal(str(total_value)), token_price=Decimal(str(token_price)),
    ))
    p.save()
    return p


class ScheduleMathTests(TestCase):
    """Pure cent-exactness — the heart of Wave A."""

    def test_schedule_with_rounding_remainder_is_cent_exact(self):
        # 1000 @ 30% down, 3 monthly: down=300, financed=700, 700/3 = 233.33 floor,
        # final row absorbs the 0.01 leftover → 233.33, 233.33, 233.34.
        s = compute_schedule(
            total_amount="1000", down_payment_percent=30, n_installments=3,
            frequency=InstallmentFrequency.MONTHLY,
        )
        self.assertEqual(s["down_payment"], Decimal("300.00"))
        self.assertEqual(s["installment_amount"], Decimal("233.33"))
        amounts = [r["amount"] for r in s["rows"]]
        self.assertEqual(amounts, [Decimal("233.33"), Decimal("233.33"), Decimal("233.34")])
        # down + Σ installments == total, to the cent.
        self.assertEqual(s["down_payment"] + sum(amounts), Decimal("1000.00"))

    def test_schedule_clean_division_no_remainder(self):
        # 5000 @ 25% down, 24 monthly: down=1250, financed=3750, /24 = 156.25 exactly.
        s = compute_schedule(
            total_amount="5000", down_payment_percent=25, n_installments=24,
            frequency=InstallmentFrequency.MONTHLY,
        )
        self.assertEqual(s["down_payment"], Decimal("1250.00"))
        self.assertTrue(all(r["amount"] == Decimal("156.25") for r in s["rows"]))
        self.assertEqual(
            s["down_payment"] + sum(r["amount"] for r in s["rows"]), Decimal("5000.00")
        )

    def test_quarterly_steps_three_months(self):
        s = compute_schedule(
            total_amount="1200", down_payment_percent=40, n_installments=4,
            frequency=InstallmentFrequency.QUARTERLY,
        )
        self.assertEqual(s["duration_months"], 12)  # 4 × 3
        # due dates step by 3 months
        d0, d1 = s["rows"][0]["due_date"], s["rows"][1]["due_date"]
        months_apart = (d1.year - d0.year) * 12 + (d1.month - d0.month)
        self.assertEqual(months_apart, 3)


class BuildPlanTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="inv@example.com", password="pw12345!")
        self.prop = _make_property("inst-build")

    def test_builds_draft_plan_with_pending_rows_cent_exact(self):
        plan = build_installment_plan(
            self.user, self.prop, total_amount="1000",
            down_payment_percent=30, n_installments=3,
            frequency=InstallmentFrequency.MONTHLY,
        )
        self.assertEqual(plan.status, InstallmentPlanStatus.DRAFT)
        self.assertEqual(plan.down_payment_amount, Decimal("300.00"))
        self.assertEqual(plan.number_of_installments, 3)
        self.assertEqual(plan.duration_months, 3)

        rows = list(InstallmentPayment.objects.filter(plan=plan).order_by("sequence"))
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(r.status == InstallmentPaymentStatus.PENDING for r in rows))
        self.assertTrue(all(r.paid_at is None for r in rows))
        self.assertEqual(
            plan.down_payment_amount + sum(r.amount for r in rows), plan.total_amount
        )

    def test_non_installment_property_rejected(self):
        ready = _make_property("ready-x", model="ready", category="ready")
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            build_installment_plan(
                self.user, ready, total_amount="1000",
                down_payment_percent=30, n_installments=3,
            )
        # nothing was written
        self.assertEqual(InstallmentPlan.objects.count(), 0)
        self.assertEqual(InstallmentPayment.objects.count(), 0)

    def test_no_money_or_mint_touched(self):
        """WAVE-A INVARIANT: building a plan moves no money and mints no tokens."""
        build_installment_plan(
            self.user, self.prop, total_amount="1000",
            down_payment_percent=30, n_installments=3,
        )
        self.assertEqual(BalanceTransaction.objects.count(), 0)
        self.assertEqual(OwnershipToken.objects.count(), 0)
        self.assertEqual(Investment.objects.count(), 0)


class ReadEndpointTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice@example.com", password="pw12345!")
        self.bob = User.objects.create_user(email="bob@example.com", password="pw12345!")
        self.prop = _make_property("inst-read")
        self.plan = build_installment_plan(
            self.alice, self.prop, total_amount="1000",
            down_payment_percent=30, n_installments=3,
        )

    def test_self_scoped_read_returns_own_plan(self):
        self.client.force_authenticate(self.alice)
        resp = self.client.get("/api/installments/plans/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["plans"]), 1)
        row = resp.data["plans"][0]
        self.assertEqual(row["totalInstallments"], 3)
        self.assertEqual(row["downPayment"], 300.0)
        self.assertEqual(row["status"], "draft")
        # display schedule = synthesized down row + 3 installment rows
        self.assertEqual(len(row["payments"]), 4)
        self.assertEqual(row["payments"][0]["type"], "down_payment")
        self.assertEqual(resp.data["stats"]["totalCommitment"], 1000.0)
        self.assertEqual(resp.data["stats"]["totalPaid"], 0.0)

    def test_other_user_sees_no_plans(self):
        self.client.force_authenticate(self.bob)
        resp = self.client.get("/api/installments/plans/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["plans"], [])

    def test_requires_auth(self):
        resp = self.client.get("/api/installments/plans/")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


# =====================================================================
# WAVE B — down-payment charge + full-mint-then-lock + proportional credit
# =====================================================================
_FAKE_TX = {"tx_hash": "0x" + "cd" * 32, "block_number": 7777, "chain_id": 97}


def _fake_mint(contract_address, to_address, amount):
    return {**_FAKE_TX, "to": to_address, "amount": amount, "token_address": contract_address}


def _deployed_installment_property(slug, owner, *, total_value="10000", token_price="100", fees0=True):
    """A published, on-chain-deployed installment property owned by `owner`."""
    p = Property(**_valid_property_kwargs(
        slug=slug, model="installment", category="construction",
        total_value=Decimal(str(total_value)), token_price=Decimal(str(token_price)),
        is_published=True,
    ))
    p.submitted_by = owner
    if fees0:
        p.fee_platform = Decimal("0")
        p.fee_management = Decimal("0")
    p.save()  # token_supply auto-derives = total_value / token_price
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "22" * 20
    meta.deployment_chain_id = 97  # == settings.CHAIN_ID
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _confirm_and_mint(inv):
    """Simulate the gated webhook: mark the down-payment COMPLETED, then mint (mocked chain)."""
    inv.payment_status = PaymentStatus.COMPLETED
    inv.save(update_fields=["payment_status", "updated_at"])
    with mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint):
        return mint_investment(inv)


class WaveBDownPaymentTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner-inst@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-b@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        # 10000 value / 100 price → supply 100. Buy 10 tokens → total $1000.
        self.prop = _deployed_installment_property("inst-b", self.owner)

    def _make_installment(self, *, down=30, n=3, tokens=10, method="card"):
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=tokens, payment_method=method,
            is_installment=True, down_payment_percent=down, n_installments=n, frequency="monthly",
        )
        return res["investment"]

    def test_create_records_full_position_but_charges_down(self):
        inv = self._make_installment()
        self.assertTrue(inv.is_installment)
        self.assertEqual(inv.amount_invested, Decimal("1000.00"))     # FULL position
        self.assertEqual(inv.token_amount, 10)                        # FULL tokens
        self.assertEqual(inv.down_payment_amount, Decimal("300.00"))  # 30% of 1000
        self.assertEqual(inv.charge_amount, Decimal("300.00"))        # charge/credit basis
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)   # gated — no auto-mint
        self.assertEqual(inv.installment_plan.status, "draft")

    def test_full_mint_then_lock_releases_down_share(self):
        inv = self._make_installment()
        res = _confirm_and_mint(inv)
        self.assertTrue(res["minted"])
        inv.refresh_from_db()
        self.assertTrue(inv.tokens_minted)
        plan = inv.installment_plan
        plan.refresh_from_db()
        self.assertEqual(plan.status, "active")
        self.assertIsNotNone(plan.down_paid_at)
        # FULL 10 tokens minted ONCE; 30% released (3), 70% locked (7).
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 10)
        self.assertEqual(token.locked_amount, 7)
        self.assertEqual(token.available_amount, 3)

    def test_owner_credited_on_down_payment_only(self):
        inv = self._make_installment()
        _confirm_and_mint(inv)
        bts = BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id))
        self.assertEqual(bts.count(), 1)
        # fees 0 → owner net == the DOWN-PAYMENT ($300), NOT $1000.
        self.assertEqual(bts.first().amount, Decimal("300.00"))

    def test_broker_credited_on_down_payment_only(self):
        from apps.broker.models import BrokerProfile, BrokerStatus

        broker_user = User.objects.create_user(email="brk-b@example.com", password="pw12345!")
        broker = BrokerProfile.objects.create(
            user=broker_user, contact_name="Brk", email="brk-b@example.com",
            status=BrokerStatus.APPROVED, commission_rate=Decimal("5"),
        )
        profile = self.investor.profile
        profile.referred_by_broker = broker
        profile.save(update_fields=["referred_by_broker"])

        inv = self._make_installment()
        _confirm_and_mint(inv)
        bt = BalanceTransaction.objects.get(source="broker_commission", reference=str(inv.id))
        # 5% of the DOWN-PAYMENT ($300) = $15, NOT 5% of $1000.
        self.assertEqual(bt.amount, Decimal("15.00"))

    def test_replayed_webhook_does_not_double(self):
        inv = self._make_installment()
        _confirm_and_mint(inv)
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.locked_amount, 7)
        with mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint) as m:
            res2 = mint_investment(inv)
        self.assertTrue(res2.get("already"))
        self.assertEqual(m.call_count, 0)  # no second on-chain mint
        token.refresh_from_db()
        self.assertEqual(token.locked_amount, 7)  # not doubled
        self.assertEqual(
            BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id)).count(), 1
        )

    def test_locked_tokens_cannot_be_listed_on_secondary_market(self):
        from apps.secondary_market.services import create_listing

        inv = self._make_installment()
        _confirm_and_mint(inv)  # 3 available, 7 locked
        with self.assertRaises(Exception):
            create_listing(
                user=self.investor,
                data={"property_id": self.prop.slug, "token_amount": 5, "unit_price": 100},
            )
        listing = create_listing(
            user=self.investor,
            data={"property_id": self.prop.slug, "token_amount": 3, "unit_price": 100},
        )
        self.assertEqual(listing.token_amount, 3)


class WaveBFullPurchaseUnchangedTests(TestCase):
    """Regression guard: a NORMAL buy still mints FULLY UNLOCKED + credits on full gross."""

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-full@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-full@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        p = Property(**_valid_property_kwargs(
            slug="ready-full", model="ready", category="ready",
            total_value=Decimal("10000"), token_price=Decimal("100"), is_published=True,
        ))
        p.submitted_by = self.owner
        p.fee_platform = Decimal("0")
        p.fee_management = Decimal("0")
        p.save()
        meta, _ = TokenMetadata.objects.get_or_create(property=p)
        meta.deployed_contract_address = "0x" + "33" * 20
        meta.deployment_chain_id = 97
        meta.deployment_network = "bsc-testnet"
        meta.save()
        self.prop = p

    def test_full_purchase_mints_unlocked_and_credits_full(self):
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=10, payment_method="card",
        )
        inv = res["investment"]
        self.assertFalse(inv.is_installment)
        self.assertIsNone(inv.down_payment_amount)
        self.assertEqual(inv.charge_amount, Decimal("1000.00"))  # full price
        _confirm_and_mint(inv)
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 10)
        self.assertEqual(token.locked_amount, 0)        # nothing locked
        self.assertEqual(token.available_amount, 10)
        bt = BalanceTransaction.objects.get(source="primary_sale", reference=str(inv.id))
        self.assertEqual(bt.amount, Decimal("1000.00"))  # owner credited on FULL gross
