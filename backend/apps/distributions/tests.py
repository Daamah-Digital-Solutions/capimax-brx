"""
Investor distributions engine tests — Phase 9. Network-free (distributions are an
INTERNAL-BALANCE cash credit — there is NO on-chain movement to mock).

Covers: pro-rata cent-exact split by full token_amount, source="distribution" credit,
OwnershipToken.total_distributions/last_distribution_date bump, idempotency (no
double-credit), locked_amount NOT subtracted, frozen snapshot, self-scoped read,
no token transfer, and primary-sale isolation.
"""
from datetime import date
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import (
    BalanceTransaction,
    OwnershipToken,
    UserBalance,
    WalletTransaction,
)
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from .models import Distribution, DistributionPayout
from .services import (
    DISTRIBUTION_SOURCE,
    NoEligibleHolders,
    _build_and_credit_payouts,
    declare_distribution,
)

PAY_DATE = date(2026, 3, 31)


def _property(slug="dprop", **overrides):
    p = Property(**_valid_property_kwargs(slug=slug, name=f"Prop {slug}", **overrides))
    p.save()
    return p


def _holder(email, prop, amount, *, locked=0, status_value=OwnershipToken.Status.ACTIVE):
    """A KYC-less holder is fine here — distributions read the holding, not KYC."""
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    wallet, _ = get_or_create_custodial_wallet(user)
    holding = OwnershipToken.objects.create(
        wallet=wallet, property_id=prop.slug, property_name=prop.name,
        token_symbol="BRX1", token_amount=amount, locked_amount=locked,
        token_value_usd=Decimal(amount) * 100, status=status_value,
    )
    return user, wallet, holding


def _balance(user):
    bal = UserBalance.objects.filter(user=user).first()
    return bal.current_balance if bal else Decimal("0")


class DeclareDistributionTests(APITestCase):
    def setUp(self):
        self.prop = _property(slug="marina", expected_yield=Decimal("9.50"))

    # --- pro-rata, cent-exact ------------------------------------------------ #
    def test_clean_pro_rata_split(self):
        ua, _, ha = _holder("a@ex.com", self.prop, 50)
        ub, _, hb = _holder("b@ex.com", self.prop, 30)
        uc, _, hc = _holder("c@ex.com", self.prop, 20)

        dist = declare_distribution(
            self.prop.slug, Decimal("1000.00"),
            dist_type="quarterly", period_label="Q1 2026", pay_date=PAY_DATE,
        )

        self.assertEqual(dist.status, Distribution.Status.PAID)
        self.assertEqual(_balance(ua), Decimal("500.00"))
        self.assertEqual(_balance(ub), Decimal("300.00"))
        self.assertEqual(_balance(uc), Decimal("200.00"))
        # Sum of payouts is cent-exact to the pool.
        total = sum(p.share_amount_usd for p in dist.payouts.all())
        self.assertEqual(total, Decimal("1000.00"))

    def test_cent_exact_remainder_to_largest(self):
        # Three EQUAL holders, an indivisible pool: $100 / 3 = 33.33 each, the spare
        # cent goes to one holder so the sum is exactly the pool.
        _holder("a@ex.com", self.prop, 100)
        _holder("b@ex.com", self.prop, 100)
        _holder("c@ex.com", self.prop, 100)

        dist = declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)

        shares = sorted((p.share_amount_usd for p in dist.payouts.all()), reverse=True)
        self.assertEqual(shares, [Decimal("33.34"), Decimal("33.33"), Decimal("33.33")])
        self.assertEqual(sum(shares), Decimal("100.00"))

    # --- credit semantics ---------------------------------------------------- #
    def test_credit_uses_distribution_source(self):
        ua, _, _ = _holder("a@ex.com", self.prop, 10)
        declare_distribution(self.prop.slug, Decimal("250.00"), pay_date=PAY_DATE)

        tx = BalanceTransaction.objects.get(balance__user=ua, source=DISTRIBUTION_SOURCE)
        self.assertEqual(tx.entry_type, BalanceTransaction.EntryType.CREDIT)
        self.assertEqual(tx.amount, Decimal("250.00"))

    def test_holding_distribution_fields_bumped(self):
        ua, _, ha = _holder("a@ex.com", self.prop, 10)
        declare_distribution(self.prop.slug, Decimal("80.00"), pay_date=PAY_DATE)
        ha.refresh_from_db()
        self.assertEqual(ha.total_distributions, Decimal("80.00"))
        self.assertIsNotNone(ha.last_distribution_date)

        # A second distribution accumulates (does not overwrite).
        declare_distribution(self.prop.slug, Decimal("20.00"), pay_date=PAY_DATE)
        ha.refresh_from_db()
        self.assertEqual(ha.total_distributions, Decimal("100.00"))

    # --- idempotency --------------------------------------------------------- #
    def test_idempotent_no_double_credit(self):
        ua, _, _ = _holder("a@ex.com", self.prop, 10)
        dist = declare_distribution(self.prop.slug, Decimal("500.00"), pay_date=PAY_DATE)
        self.assertEqual(_balance(ua), Decimal("500.00"))

        # Re-run the credit step on the SAME distribution — must be a no-op.
        _build_and_credit_payouts(dist)

        self.assertEqual(_balance(ua), Decimal("500.00"))
        self.assertEqual(
            BalanceTransaction.objects.filter(source=DISTRIBUTION_SOURCE).count(), 1
        )
        self.assertEqual(DistributionPayout.objects.filter(distribution=dist).count(), 1)

    # --- full token_amount, NOT net of locked ------------------------------- #
    def test_locked_amount_not_subtracted(self):
        # Holder A has 40 of 100 tokens escrow-locked; the split still uses the FULL
        # 100 (escrow is about tradability, not ownership).
        ua, _, _ = _holder("a@ex.com", self.prop, 100, locked=40)
        ub, _, _ = _holder("b@ex.com", self.prop, 100, locked=0)

        declare_distribution(self.prop.slug, Decimal("400.00"), pay_date=PAY_DATE)

        self.assertEqual(_balance(ua), Decimal("200.00"))  # full 100, not available 60
        self.assertEqual(_balance(ub), Decimal("200.00"))

    # --- snapshot frozen at declaration ------------------------------------- #
    def test_snapshot_frozen(self):
        ua, _, ha = _holder("a@ex.com", self.prop, 10)
        dist = declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)
        payout = dist.payouts.get(user=ua)
        self.assertEqual(payout.tokens_at_snapshot, 10)

        # Holdings change later → the payout's frozen snapshot does NOT.
        ha.token_amount = 999
        ha.save(update_fields=["token_amount"])
        payout.refresh_from_db()
        self.assertEqual(payout.tokens_at_snapshot, 10)

    # --- eligibility --------------------------------------------------------- #
    def test_only_active_holders(self):
        ua, _, _ = _holder("a@ex.com", self.prop, 50)
        _holder("sold@ex.com", self.prop, 50, status_value=OwnershipToken.Status.SOLD)

        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)
        # Active holder gets the WHOLE pool (the SOLD position is excluded).
        self.assertEqual(_balance(ua), Decimal("100.00"))

    def test_no_eligible_holders_raises_and_writes_nothing(self):
        with self.assertRaises(NoEligibleHolders):
            declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)
        self.assertEqual(Distribution.objects.count(), 0)  # rolled back
        self.assertEqual(DistributionPayout.objects.count(), 0)

    # --- no on-chain movement ------------------------------------------------ #
    def test_no_token_transfer(self):
        ua, _, ha = _holder("a@ex.com", self.prop, 10)
        before = WalletTransaction.objects.count()
        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)
        # Holding token_amount is untouched (cash yield, not a token move) and NO
        # on-chain WalletTransaction was written.
        ha.refresh_from_db()
        self.assertEqual(ha.token_amount, 10)
        self.assertEqual(WalletTransaction.objects.count(), before)

    # --- primary-sale isolation --------------------------------------------- #
    def test_primary_sale_unaffected(self):
        ua, _, _ = _holder("a@ex.com", self.prop, 10)
        # Pre-existing primary-sale credit (owner earnings) must survive untouched.
        credit_user_balance(ua, Decimal("980.00"), source="primary_sale", reference="inv-1")

        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)

        self.assertTrue(
            BalanceTransaction.objects.filter(source="primary_sale", reference="inv-1").exists()
        )
        # The two sources are distinct and both present.
        self.assertEqual(
            BalanceTransaction.objects.filter(balance__user=ua, source="primary_sale").count(), 1
        )
        self.assertEqual(
            BalanceTransaction.objects.filter(balance__user=ua, source=DISTRIBUTION_SOURCE).count(), 1
        )
        self.assertEqual(_balance(ua), Decimal("1080.00"))  # 980 + 100


class DistributionsReadApiTests(APITestCase):
    def setUp(self):
        self.prop = _property(slug="marina", expected_yield=Decimal("9.50"))
        self.ua, _, _ = _holder("a@ex.com", self.prop, 60)
        self.ub, _, _ = _holder("b@ex.com", self.prop, 40)
        declare_distribution(
            self.prop.slug, Decimal("1000.00"),
            dist_type="quarterly", period_label="Q1 2026", pay_date=PAY_DATE,
        )

    def test_requires_auth(self):
        resp = self.client.get("/api/distributions/")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_self_scoped_rows(self):
        self.client.force_authenticate(self.ua)
        resp = self.client.get("/api/distributions/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        rows = resp.data["distributions"]
        self.assertEqual(len(rows), 1)  # only A's payout
        row = rows[0]
        self.assertEqual(row["amount"], 600.0)          # 60% of 1000
        self.assertEqual(row["propertyId"], "marina")
        self.assertEqual(row["propertyEn"], "Prop marina")
        self.assertEqual(row["period"], "Q1 2026")
        self.assertEqual(row["type"], "quarterly")
        self.assertEqual(row["status"], "paid")
        self.assertEqual(row["yield"], 9.5)
        # Stats + rollup reflect only the caller.
        self.assertEqual(resp.data["stats"]["totalReceived"], 600.0)
        self.assertEqual(resp.data["stats"]["propertiesDistributing"], 1)
        self.assertEqual(resp.data["by_property"][0]["totalDistributed"], 600.0)

    def test_other_holder_sees_only_their_own(self):
        self.client.force_authenticate(self.ub)
        resp = self.client.get("/api/distributions/")
        rows = resp.data["distributions"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["amount"], 400.0)  # 40% of 1000

    def test_non_holder_sees_empty(self):
        outsider = User.objects.create_user(email="out@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(outsider)
        resp = self.client.get("/api/distributions/")
        self.assertEqual(resp.data["distributions"], [])
        self.assertEqual(resp.data["stats"]["totalReceived"], 0.0)
        self.assertIsNone(resp.data["stats"]["vsLastYear"])  # no prior year → honest no-delta


class DistributionsStatsApiTests(APITestCase):
    """Real YoY delta + real per-property monthly sparkline series."""

    def setUp(self):
        from django.utils import timezone
        self.this_year = timezone.now().year
        self.prop = _property(slug="marina", expected_yield=Decimal("9.50"))
        self.ua, _, _ = _holder("a@ex.com", self.prop, 100)  # sole holder → whole pool each time

    def _stats(self):
        self.client.force_authenticate(self.ua)
        return self.client.get("/api/distributions/").data["stats"]

    # --- vsLastYear computed across two years -------------------------------- #
    def test_vs_last_year_computed(self):
        declare_distribution(self.prop.slug, Decimal("1000.00"), pay_date=date(self.this_year - 1, 6, 30))
        declare_distribution(self.prop.slug, Decimal("1500.00"), pay_date=date(self.this_year, 3, 31))
        stats = self._stats()
        self.assertEqual(stats["yearToDate"], 1500.0)
        self.assertEqual(stats["vsLastYear"], 50.0)  # (1500 - 1000) / 1000 = +50.0%

    def test_vs_last_year_negative(self):
        declare_distribution(self.prop.slug, Decimal("1000.00"), pay_date=date(self.this_year - 1, 6, 30))
        declare_distribution(self.prop.slug, Decimal("750.00"), pay_date=date(self.this_year, 3, 31))
        self.assertEqual(self._stats()["vsLastYear"], -25.0)  # (750 - 1000) / 1000 = -25.0%

    # --- last-year zero → honest no-delta (null, never a fake %) -------------- #
    def test_vs_last_year_null_when_no_prior(self):
        declare_distribution(self.prop.slug, Decimal("1500.00"), pay_date=date(self.this_year, 3, 31))
        self.assertIsNone(self._stats()["vsLastYear"])

    # --- real per-property monthly series ------------------------------------ #
    def test_property_series_reflects_monthly_payouts(self):
        declare_distribution(self.prop.slug, Decimal("400.00"), pay_date=date(self.this_year, 1, 31))
        declare_distribution(self.prop.slug, Decimal("600.00"), pay_date=date(self.this_year, 4, 30))
        self.client.force_authenticate(self.ua)
        rollup = self.client.get("/api/distributions/").data["by_property"][0]
        # Two distinct payout months → two real bars, chronological, reflecting the amounts.
        self.assertEqual(rollup["series"], [400.0, 600.0])
