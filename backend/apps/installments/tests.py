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


# =====================================================================
# WAVE C — per-installment gated payment + progressive locked→released
# =====================================================================
from apps.wallets.models import WalletTransaction  # noqa: E402

from .services import installment_locked_tokens, settle_installment_payment  # noqa: E402


class WaveCInstallmentSettlementTests(TestCase):
    """
    $1000 @ 30% down, 3 monthly installments (233.33 / 233.33 / 233.34), 10 tokens, fees 0.
    Down (Wave B) → 3 released / 7 locked; then each installment progressively releases.
    """

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-c@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-c@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        self.prop = _deployed_installment_property("inst-c", self.owner)
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=10, payment_method="card",
            is_installment=True, down_payment_percent=30, n_installments=3, frequency="monthly",
        )
        self.inv = res["investment"]
        _confirm_and_mint(self.inv)  # down → 3 released / 7 locked, plan active
        self.plan = self.inv.installment_plan
        self.rows = list(
            InstallmentPayment.objects.filter(plan=self.plan).order_by("sequence")
        )

    def _token(self):
        return OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)

    def test_progressive_release_floor_correct(self):
        # Start: 3 released / 7 locked (down).
        self.assertEqual(self._token().locked_amount, 7)

        settle_installment_payment(self.rows[0].id)  # +233.33 → paid 533.33 → floor 5.33 = 5
        self.assertEqual(self._token().locked_amount, 5)
        self.rows[0].refresh_from_db()
        self.assertEqual(self.rows[0].status, InstallmentPaymentStatus.PAID)
        self.assertIsNotNone(self.rows[0].paid_at)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.ACTIVE)  # not done yet

        settle_installment_payment(self.rows[1].id)  # paid 766.66 → floor 7.66 = 7
        self.assertEqual(self._token().locked_amount, 3)

        settle_installment_payment(self.rows[2].id)  # final → paid 1000 → 10 released
        token = self._token()
        self.assertEqual(token.locked_amount, 0)
        self.assertEqual(token.available_amount, 10)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.COMPLETED)

    def test_no_new_mint_on_installment(self):
        # The position was minted ONCE on the down-payment. Settling installments moves
        # locked→released only — NO new on-chain mint (no extra WalletTransaction).
        mint_txs_before = WalletTransaction.objects.filter(tx_type="mint").count()
        for r in self.rows:
            settle_installment_payment(r.id)
        self.assertEqual(
            WalletTransaction.objects.filter(tx_type="mint").count(), mint_txs_before
        )
        self.inv.refresh_from_db()
        self.assertEqual(self.inv.token_amount, 10)  # unchanged

    def test_owner_credited_per_installment_totals_full(self):
        for r in self.rows:
            settle_installment_payment(r.id)
        credits = BalanceTransaction.objects.filter(
            balance__user=self.owner, source="primary_sale"
        )
        # 4 tranches: down + 3 installments, each keyed to its own reference.
        self.assertEqual(credits.count(), 4)
        total = sum((c.amount for c in credits), Decimal("0"))
        # fees 0 → net == gross; down + Σ installments == the full $1000, cent-exact.
        self.assertEqual(total, Decimal("1000.00"))
        # each installment credit keyed on the InstallmentPayment id
        for r in self.rows:
            self.assertTrue(
                BalanceTransaction.objects.filter(
                    source="primary_sale", reference=str(r.id)
                ).exists()
            )

    def test_broker_credited_per_installment(self):
        from apps.broker.models import BrokerProfile, BrokerStatus

        broker_user = User.objects.create_user(email="brk-c@example.com", password="pw12345!")
        broker = BrokerProfile.objects.create(
            user=broker_user, contact_name="Brk", email="brk-c@example.com",
            status=BrokerStatus.APPROVED, commission_rate=Decimal("5"),
        )
        # Re-run the whole plan with a referred investor so commission accrues per tranche.
        investor2 = User.objects.create_user(email="inv-c2@example.com", password="pw12345!")
        get_or_create_custodial_wallet(investor2)
        investor2.profile.referred_by_broker = broker
        investor2.profile.save(update_fields=["referred_by_broker"])
        prop2 = _deployed_installment_property("inst-c2", self.owner)
        res = create_investment(
            user=investor2, prop=prop2, token_amount=10, payment_method="card",
            is_installment=True, down_payment_percent=30, n_installments=3, frequency="monthly",
        )
        inv2 = res["investment"]
        _confirm_and_mint(inv2)  # down → 5% of 300 = 15.00
        rows2 = list(InstallmentPayment.objects.filter(plan=inv2.installment_plan).order_by("sequence"))
        for r in rows2:
            settle_installment_payment(r.id)
        commissions = BalanceTransaction.objects.filter(
            balance__user=broker_user, source="broker_commission"
        )
        self.assertEqual(commissions.count(), 4)  # down + 3 installments
        # 5% of 300 + 5% of 233.33 + 5% of 233.33 + 5% of 233.34
        # = 15.00 + 11.67 + 11.67 + 11.67 = 50.01 (per-tranche rounding; ≈ 5% of $1000).
        total = sum((c.amount for c in commissions), Decimal("0"))
        self.assertEqual(total, Decimal("50.01"))

    def test_replayed_installment_settles_once(self):
        settle_installment_payment(self.rows[0].id)
        self.assertEqual(self._token().locked_amount, 5)
        # Replay (e.g. a re-delivered webhook) — must be a no-op.
        res = settle_installment_payment(self.rows[0].id)
        self.assertTrue(res.get("already"))
        self.assertEqual(self._token().locked_amount, 5)  # not released again
        self.assertEqual(
            BalanceTransaction.objects.filter(
                source="primary_sale", reference=str(self.rows[0].id)
            ).count(),
            1,
        )

    def test_gated_core_routes_installment_to_settle_not_mint(self):
        # A Payment carrying installment_payment → _complete_payment settles (no mint).
        from apps.payments.models import Payment, PaymentState
        from apps.payments.services import _complete_payment

        payment = Payment.objects.create(
            investment=self.inv, provider="stripe", amount=self.rows[0].amount,
            currency="usd", installment_payment=self.rows[0],
            stripe_payment_intent_id="pi_inst_test_1",
        )
        mint_before = WalletTransaction.objects.filter(tx_type="mint").count()
        out = _complete_payment(payment)
        self.assertTrue(out["settled"])
        self.assertFalse(out["minted"])
        payment.refresh_from_db()
        self.assertEqual(payment.status, PaymentState.SUCCEEDED)
        self.assertEqual(self._token().locked_amount, 5)  # released grew 3→5
        self.assertEqual(
            WalletTransaction.objects.filter(tx_type="mint").count(), mint_before
        )

    def test_locked_tokens_unsellable_until_released(self):
        from apps.secondary_market.services import create_listing

        settle_installment_payment(self.rows[0].id)  # 5 released / 5 locked
        with self.assertRaises(Exception):
            create_listing(
                user=self.investor,
                data={"property_id": self.prop.slug, "token_amount": 6, "unit_price": 100},
            )
        listing = create_listing(
            user=self.investor,
            data={"property_id": self.prop.slug, "token_amount": 5, "unit_price": 100},
        )
        self.assertEqual(listing.token_amount, 5)


class WaveCDistributionsOnReleasedTests(TestCase):
    """Decision #4: distributions accrue on RELEASED (paid) tokens; unpaid-locked earn nothing."""

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-d@example.com", password="pw12345!")
        self.a = User.objects.create_user(email="a-d@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.a)
        self.prop = _deployed_installment_property("inst-d", self.owner)
        res = create_investment(
            user=self.a, prop=self.prop, token_amount=10, payment_method="card",
            is_installment=True, down_payment_percent=30, n_installments=3, frequency="monthly",
        )
        self.inv = res["investment"]
        _confirm_and_mint(self.inv)  # A: 3 released / 7 locked
        # A normal full holder of the SAME property (no installment plan) → earns on full.
        self.b = User.objects.create_user(email="b-d@example.com", password="pw12345!")
        wb, _ = get_or_create_custodial_wallet(self.b)
        OwnershipToken.objects.create(
            wallet=wb, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol=self.inv.token_symbol, token_amount=7, locked_amount=0,
            token_value_usd=Decimal("700"),
        )

    def _balance(self, user):
        from apps.wallets.models import UserBalance
        bal = UserBalance.objects.filter(user=user).first()
        return bal.current_balance if bal else Decimal("0")

    def test_mid_plan_holder_earns_on_released_only(self):
        from apps.distributions.services import declare_distribution

        # earning: A=3 (released), B=7 (full). total 10. Pool $100 → A $30, B $70.
        self.assertEqual(installment_locked_tokens(self.a.id, self.prop.slug), 7)
        declare_distribution(self.prop.slug, Decimal("100.00"))
        self.assertEqual(self._balance(self.a), Decimal("30.00"))
        self.assertEqual(self._balance(self.b), Decimal("70.00"))

    def test_fully_paid_holder_earns_on_full_no_regression(self):
        from apps.distributions.services import declare_distribution

        # Pay A's plan in full → A released 10, lock 0 → earns on the full position.
        for r in InstallmentPayment.objects.filter(plan=self.inv.installment_plan).order_by("sequence"):
            settle_installment_payment(r.id)
        self.assertEqual(installment_locked_tokens(self.a.id, self.prop.slug), 0)
        # earning: A=10, B=7. total 17. Pool $170 → A $100, B $70.
        declare_distribution(self.prop.slug, Decimal("170.00"))
        self.assertEqual(self._balance(self.a), Decimal("100.00"))
        self.assertEqual(self._balance(self.b), Decimal("70.00"))


# =====================================================================
# WAVE D — missed-payment DEFAULT + forfeiture (keep released / forfeit locked)
# =====================================================================
from datetime import timedelta  # noqa: E402

from django.core.management import call_command  # noqa: E402
from django.utils import timezone as _tz  # noqa: E402

from apps.investments.services import available_tokens  # noqa: E402

from .models import InstallmentPlanStatus  # noqa: E402
from .services import default_plan  # noqa: E402


class WaveDDefaultForfeitureTests(TestCase):
    """$1000 @ 30%, 3×, 10 tokens. Down → 3 released / 7 locked. Default forfeits the 7."""

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-wd@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-wd@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        self.prop = _deployed_installment_property("inst-wd", self.owner)
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=10, payment_method="card",
            is_installment=True, down_payment_percent=30, n_installments=3, frequency="monthly",
        )
        self.inv = res["investment"]
        _confirm_and_mint(self.inv)  # 3 released / 7 locked, plan active
        self.plan = self.inv.installment_plan
        self.today = _tz.now().date()

    def _token(self):
        return OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)

    def _backdate(self, days):
        InstallmentPayment.objects.filter(plan=self.plan).update(
            due_date=self.today - timedelta(days=days)
        )

    def test_default_past_grace_forfeits_locked_keeps_released(self):
        self._backdate(400)  # all installments long overdue (past the 30-day grace)
        before_avail = available_tokens(self.prop)
        call_command("check_installment_defaults")

        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.DEFAULTED)
        self.assertIsNotNone(self.plan.defaulted_at)
        self.assertEqual(self.plan.forfeited_tokens, 7)

        # KEEP released (3), FORFEIT locked (7): position reduced to 3, fully unlocked.
        token = self._token()
        self.assertEqual(token.token_amount, 3)
        self.assertEqual(token.locked_amount, 0)
        self.assertEqual(token.available_amount, 3)

        # Supply freed: the linked investment now reflects only the kept tokens, so 7 return
        # to the property's available pool.
        self.inv.refresh_from_db()
        self.assertEqual(self.inv.token_amount, 3)
        self.assertEqual(available_tokens(self.prop), before_avail + 7)

        # NO money refund — the investor (the payer) is never credited internally.
        self.assertEqual(BalanceTransaction.objects.filter(balance__user=self.investor).count(), 0)

        # Remaining schedule voided.
        statuses = set(
            InstallmentPayment.objects.filter(plan=self.plan).values_list("status", flat=True)
        )
        self.assertEqual(statuses, {InstallmentPaymentStatus.CANCELLED})

    def test_within_grace_not_defaulted(self):
        self._backdate(5)  # overdue (missed) but inside the 30-day grace
        call_command("check_installment_defaults")
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.ACTIVE)
        self.assertEqual(self._token().locked_amount, 7)  # nothing forfeited
        # ...but the overdue rows ARE marked missed (lifecycle bookkeeping).
        self.assertTrue(
            InstallmentPayment.objects.filter(
                plan=self.plan, status=InstallmentPaymentStatus.MISSED
            ).exists()
        )

    def test_idempotent_rerun_no_double_forfeit(self):
        self._backdate(400)
        call_command("check_installment_defaults")
        token_after_first = self._token()
        self.assertEqual(token_after_first.token_amount, 3)
        avail_after_first = available_tokens(self.prop)

        # Re-run → already defaulted → no-op (no double-forfeit, no extra supply freed).
        call_command("check_installment_defaults")
        res = default_plan(self.plan.id)  # direct re-call too
        self.assertTrue(res.get("already"))
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.forfeited_tokens, 7)
        self.assertEqual(self._token().token_amount, 3)
        self.assertEqual(available_tokens(self.prop), avail_after_first)

    def test_on_time_plan_untouched(self):
        # Default schedule due-dates are in the FUTURE → nothing is overdue.
        call_command("check_installment_defaults")
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.ACTIVE)
        self.assertEqual(self._token().locked_amount, 7)
        self.assertFalse(
            InstallmentPayment.objects.filter(
                plan=self.plan, status=InstallmentPaymentStatus.MISSED
            ).exists()
        )

    def test_completed_plan_never_defaulted(self):
        for r in InstallmentPayment.objects.filter(plan=self.plan).order_by("sequence"):
            settle_installment_payment(r.id)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.COMPLETED)
        # Even with backdated due-dates, a completed plan is out of scope (only ACTIVE scanned).
        InstallmentPayment.objects.filter(plan=self.plan).update(
            due_date=self.today - timedelta(days=400)
        )
        call_command("check_installment_defaults")
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.status, InstallmentPlanStatus.COMPLETED)
        self.assertEqual(self._token().token_amount, 10)  # fully owned, nothing forfeited

    def test_defaulted_holder_earns_distributions_on_kept_only(self):
        from apps.distributions.services import declare_distribution
        from apps.wallets.models import UserBalance

        self._backdate(400)
        call_command("check_installment_defaults")  # kept 3, forfeited 7

        # A normal full holder (7 tokens) of the same property.
        b = User.objects.create_user(email="b-wd@example.com", password="pw12345!")
        wb, _ = get_or_create_custodial_wallet(b)
        OwnershipToken.objects.create(
            wallet=wb, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol=self.inv.token_symbol, token_amount=7, locked_amount=0,
            token_value_usd=Decimal("700"),
        )
        # earning: defaulted holder 3 (kept) + B 7 = 10. Pool $100 → 30 / 70.
        declare_distribution(self.prop.slug, Decimal("100.00"))
        bal = UserBalance.objects.get(user=self.investor)
        self.assertEqual(bal.current_balance, Decimal("30.00"))
        self.assertEqual(UserBalance.objects.get(user=b).current_balance, Decimal("70.00"))


class WaveDFullPurchaseUnaffectedTests(TestCase):
    """A non-installment full purchase has no plan → the default sweep never touches it."""

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-wdf@example.com", password="pw12345!")
        self.investor = User.objects.create_user(email="inv-wdf@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.investor)
        p = Property(**_valid_property_kwargs(
            slug="ready-wd", model="ready", category="ready",
            total_value=Decimal("10000"), token_price=Decimal("100"), is_published=True,
        ))
        p.submitted_by = self.owner
        p.fee_platform = Decimal("0")
        p.fee_management = Decimal("0")
        p.save()
        meta, _ = TokenMetadata.objects.get_or_create(property=p)
        meta.deployed_contract_address = "0x" + "44" * 20
        meta.deployment_chain_id = 97
        meta.deployment_network = "bsc-testnet"
        meta.save()
        self.prop = p

    def test_full_purchase_position_untouched_by_default_sweep(self):
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=10, payment_method="card",
        )
        inv = res["investment"]
        _confirm_and_mint(inv)
        call_command("check_installment_defaults")
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 10)
        self.assertEqual(token.locked_amount, 0)
        self.assertEqual(InstallmentPlan.objects.count(), 0)
