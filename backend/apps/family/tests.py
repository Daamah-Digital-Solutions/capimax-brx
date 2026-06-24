"""
Family Wave A tests — records + allocation ONLY. Run against Postgres (capimax_brx).

Covers: self-scoped CRUD (no cross-investor access), allocation persistence + the ≤100% rule,
bank stored MASKED (no full number), and the RECORD-ONLY transfer (creates a FamilyTransaction
but moves NO money — asserts no BalanceTransaction, no Withdrawal, no OwnershipToken/token move).
"""
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.wallets.models import BalanceTransaction, OwnershipToken, Withdrawal

from .models import FamilyAccount, FamilyBankAccount, FamilyTransaction


class FamilyAccountCrudTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alice-f@example.com", password="pw12345!")
        self.bob = User.objects.create_user(email="bob-f@example.com", password="pw12345!")

    def _add_member(self, name="Ahmed", email="ahmed@ex.com", rel="son"):
        return self.client.post(
            "/api/family/accounts/",
            {"member_name": name, "member_email": email, "relationship": rel},
            format="json",
        )

    def test_create_and_list_self_scoped(self):
        self.client.force_authenticate(self.alice)
        resp = self._add_member()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["member_name"], "Ahmed")

        # Alice sees her member.
        listed = self.client.get("/api/family/accounts/")
        self.assertEqual(len(listed.json()), 1)

        # Bob sees NONE of Alice's records.
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get("/api/family/accounts/").json(), [])

    def test_other_investor_cannot_access_detail(self):
        self.client.force_authenticate(self.alice)
        acc_id = self._add_member().json()["id"]
        # Bob can't read or edit Alice's member → 404 (self-scoped).
        self.client.force_authenticate(self.bob)
        self.assertEqual(
            self.client.get(f"/api/family/accounts/{acc_id}/").status_code, 404
        )
        self.assertEqual(
            self.client.patch(
                f"/api/family/accounts/{acc_id}/",
                {"allocated_returns_percent": "10"}, format="json",
            ).status_code,
            404,
        )

    def test_requires_auth(self):
        self.assertIn(
            self.client.get("/api/family/accounts/").status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class FamilyAllocationTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="alloc@example.com", password="pw12345!")
        self.client.force_authenticate(self.alice)
        self.a = self.client.post(
            "/api/family/accounts/",
            {"member_name": "A", "member_email": "a@ex.com", "relationship": "son"},
            format="json",
        ).json()["id"]
        self.b = self.client.post(
            "/api/family/accounts/",
            {"member_name": "B", "member_email": "b@ex.com", "relationship": "daughter"},
            format="json",
        ).json()["id"]

    def _set_alloc(self, acc_id, pct):
        return self.client.patch(
            f"/api/family/accounts/{acc_id}/",
            {"allocated_returns_percent": str(pct)}, format="json",
        )

    def test_allocation_persists(self):
        resp = self._set_alloc(self.a, 60)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["allocated_returns_percent"], 60.0)
        FamilyAccount.objects.get(id=self.a).refresh_from_db()
        self.assertEqual(
            FamilyAccount.objects.get(id=self.a).allocated_returns_percent, Decimal("60.00")
        )

    def test_allocation_sum_capped_at_100(self):
        self.assertEqual(self._set_alloc(self.a, 60).status_code, 200)
        # 60 + 50 = 110 → rejected.
        bad = self._set_alloc(self.b, 50)
        self.assertEqual(bad.status_code, 400)
        # 60 + 40 = 100 → allowed.
        self.assertEqual(self._set_alloc(self.b, 40).status_code, 200)
        # Re-setting A to 60 (its own slice excluded) still fits with B's 40.
        self.assertEqual(self._set_alloc(self.a, 60).status_code, 200)

    def test_allocation_rejects_out_of_range(self):
        self.assertEqual(self._set_alloc(self.a, 150).status_code, 400)


class FamilyBankMaskingTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(email="bank@example.com", password="pw12345!")
        self.client.force_authenticate(self.alice)
        self.acc = self.client.post(
            "/api/family/accounts/",
            {"member_name": "A", "member_email": "a@ex.com", "relationship": "son"},
            format="json",
        ).json()["id"]

    def test_bank_stored_masked_only(self):
        resp = self.client.post(
            "/api/family/banks/",
            {
                "family_account_id": self.acc,
                "bank_name": "Emirates NBD",
                "account_holder_name": "Ahmed",
                "account_number": "1234567890123456",
                "iban": "AE070331234567890123456",
                "currency": "AED",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["account_number_masked"], "****3456")
        self.assertEqual(body["iban_masked"], "****3456")
        # The FULL number is NOT in the response anywhere.
        self.assertNotIn("1234567890123456", str(body))

        # ...and NOT in the DB (only the mask is persisted).
        bank = FamilyBankAccount.objects.get(id=body["id"])
        self.assertEqual(bank.account_number_masked, "****3456")
        for v in vars(bank).values():
            self.assertNotIn("1234567890123456", str(v))


class FamilyRecordOnlyTransferTests(APITestCase):
    """A 'transfer' writes a FamilyTransaction record ONLY — no money/token/Withdrawal."""

    def setUp(self):
        self.alice = User.objects.create_user(email="xfer@example.com", password="pw12345!")
        self.client.force_authenticate(self.alice)
        self.acc = self.client.post(
            "/api/family/accounts/",
            {"member_name": "A", "member_email": "a@ex.com", "relationship": "son"},
            format="json",
        ).json()["id"]

    def test_transfer_records_only_no_money_moves(self):
        # Baselines BEFORE.
        bt_before = BalanceTransaction.objects.count()
        wd_before = Withdrawal.objects.count()
        ot_before = OwnershipToken.objects.count()

        resp = self.client.post(
            "/api/family/transactions/",
            {"family_account_id": self.acc, "amount": "500.00", "transfer_type": "returns"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["transaction_type"], "transfer_initiated")
        self.assertEqual(body["status"], "pending")  # recorded, never executed
        self.assertEqual(body["amount"], 500.0)
        self.assertTrue(body["reference_number"].startswith("FT-"))

        # A FamilyTransaction row exists...
        self.assertTrue(
            FamilyTransaction.objects.filter(
                family_account_id=self.acc, transaction_type="transfer_initiated"
            ).exists()
        )
        # ...but NOTHING else moved: no balance ledger entry, no withdrawal, no token row.
        self.assertEqual(BalanceTransaction.objects.count(), bt_before)
        self.assertEqual(Withdrawal.objects.count(), wd_before)
        self.assertEqual(OwnershipToken.objects.count(), ot_before)
        # The member's total_transferred stays 0 (nothing executed).
        self.assertEqual(
            FamilyAccount.objects.get(id=self.acc).total_transferred, Decimal("0")
        )

    def test_transfer_to_other_investors_member_rejected(self):
        bob = User.objects.create_user(email="bob-x@example.com", password="pw12345!")
        self.client.force_authenticate(bob)
        # Bob can't record a transfer against Alice's member (self-scoped → 404).
        resp = self.client.post(
            "/api/family/transactions/",
            {"family_account_id": self.acc, "amount": "100", "transfer_type": "returns"},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)


# =========================================================================== #
# Wave B — the auto-allocation engine + internal accrual ledger + owner withdrawal.
# =========================================================================== #
from apps.distributions.services import _build_and_credit_payouts, declare_distribution
from apps.distributions.tests import PAY_DATE, _balance, _holder, _property
from apps.wallets.models import WalletTransaction

from .models import FamilyAccrual
from .services import accrual_summary


def _member(owner, name, pct):
    """Create an ACTIVE family member under `owner` with an allocation % (test setup)."""
    return FamilyAccount.objects.create(
        investor=owner, member_name=name, member_email=f"{name.lower()}@ex.com",
        relationship="child", allocated_returns_percent=Decimal(str(pct)),
    )


class FamilyAutoAllocationEngineTests(APITestCase):
    """The carve: a distribution credited to an owner auto-splits to family members."""

    def setUp(self):
        self.prop = _property(slug="fam-prop")
        # The OWNER is the SOLE holder → they receive the WHOLE pool each distribution.
        self.owner, _, _ = _holder("owner@ex.com", self.prop, 100)

    # --- the carve: 30% / 20% → 300 / 200, owner keeps 500 ------------------- #
    def test_carve_splits_and_owner_keeps_remainder(self):
        a = _member(self.owner, "A", 30)
        b = _member(self.owner, "B", 20)

        declare_distribution(self.prop.slug, Decimal("1000.00"), pay_date=PAY_DATE)

        self.assertEqual(accrual_summary(a)["accrued_balance"], Decimal("300.00"))
        self.assertEqual(accrual_summary(b)["accrued_balance"], Decimal("200.00"))
        # The owner effectively receives the remainder (1000 credited − 500 carved).
        self.assertEqual(_balance(self.owner), Decimal("500.00"))
        # Conservation: members' accruals + owner balance == the full distribution.
        self.assertEqual(
            accrual_summary(a)["accrued_total"]
            + accrual_summary(b)["accrued_total"]
            + _balance(self.owner),
            Decimal("1000.00"),
        )
        # Two append-only ACCRUAL rows, tied to the distribution + frozen %.
        rows = FamilyAccrual.objects.filter(entry_type=FamilyAccrual.EntryType.ACCRUAL)
        self.assertEqual(rows.count(), 2)
        self.assertEqual(rows.get(family_account=a).allocation_percent, Decimal("30.00"))
        self.assertEqual(rows.get(family_account=a).owner_share_usd, Decimal("1000.00"))

    # --- idempotent: re-crediting the SAME distribution does NOT double-carve - #
    def test_idempotent_no_double_carve(self):
        a = _member(self.owner, "A", 30)
        dist = declare_distribution(self.prop.slug, Decimal("1000.00"), pay_date=PAY_DATE)
        self.assertEqual(_balance(self.owner), Decimal("700.00"))

        # Replay the credit step on the SAME distribution — must be a complete no-op.
        _build_and_credit_payouts(dist)

        self.assertEqual(_balance(self.owner), Decimal("700.00"))
        self.assertEqual(accrual_summary(a)["accrued_balance"], Decimal("300.00"))
        self.assertEqual(
            FamilyAccrual.objects.filter(
                entry_type=FamilyAccrual.EntryType.ACCRUAL
            ).count(),
            1,
        )

    # --- Decimal-exact: flooring leaves crumbs with the owner (residual) ----- #
    def test_decimal_exact_owner_is_residual_claimant(self):
        # Three members at 33.33% each (= 99.99% ≤ 100). $100 pool → 33.33 each (floored),
        # owner keeps the 0.01 crumb. Everything reconciles to the cent.
        members = [_member(self.owner, n, "33.33") for n in ("A", "B", "C")]
        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)

        for m in members:
            self.assertEqual(accrual_summary(m)["accrued_balance"], Decimal("33.33"))
        self.assertEqual(_balance(self.owner), Decimal("0.01"))
        carved = sum((accrual_summary(m)["accrued_total"] for m in members), Decimal("0"))
        self.assertEqual(carved + _balance(self.owner), Decimal("100.00"))

    # --- a 0% member accrues nothing (no row) -------------------------------- #
    def test_zero_percent_member_accrues_nothing(self):
        active = _member(self.owner, "A", 50)
        zero = _member(self.owner, "Z", 0)
        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)

        self.assertEqual(accrual_summary(active)["accrued_balance"], Decimal("50.00"))
        self.assertEqual(accrual_summary(zero)["accrued_balance"], Decimal("0.00"))
        self.assertFalse(FamilyAccrual.objects.filter(family_account=zero).exists())
        self.assertEqual(_balance(self.owner), Decimal("50.00"))

    # --- no members → the distribution credits normally (NO regression) ------ #
    def test_owner_with_no_members_credits_normally(self):
        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)
        self.assertEqual(_balance(self.owner), Decimal("100.00"))
        self.assertEqual(FamilyAccrual.objects.count(), 0)

    # --- the carve never moves tokens / writes on-chain ---------------------- #
    def test_no_token_or_chain_movement(self):
        _member(self.owner, "A", 40)
        before = WalletTransaction.objects.count()
        declare_distribution(self.prop.slug, Decimal("100.00"), pay_date=PAY_DATE)
        self.assertEqual(WalletTransaction.objects.count(), before)


class FamilyAccrualWithdrawalTests(APITestCase):
    """The owner withdraws a member's accrued cash himself, via the EXISTING path."""

    def setUp(self):
        self.prop = _property(slug="fam-wd")
        self.owner, _, _ = _holder("wd-owner@ex.com", self.prop, 100)
        self.outsider, _, _ = _holder("wd-out@ex.com", _property(slug="other-prop"), 10)
        self.a = _member(self.owner, "A", 30)
        declare_distribution(self.prop.slug, Decimal("1000.00"), pay_date=PAY_DATE)
        # After carve: A accrued 300, owner balance 700.

    def test_owner_withdraws_full_accrual_via_existing_path(self):
        from apps.wallets.models import Withdrawal

        wd_before = Withdrawal.objects.count()
        ft_before = FamilyTransaction.objects.count()

        self.client.force_authenticate(self.owner)
        resp = self.client.post(f"/api/family/accounts/{self.a.id}/withdraw/", {}, format="json")
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertEqual(body["withdrawal"]["amount"], 300.0)
        self.assertEqual(body["withdrawal"]["status"], "pending")
        self.assertEqual(body["member"]["accrued_balance"], 0.0)
        self.assertEqual(body["member"]["withdrawn_total"], 300.0)

        # A REAL Withdrawal was created via the existing path (mirrors a normal withdrawal).
        self.assertEqual(Withdrawal.objects.count(), wd_before + 1)
        wd = Withdrawal.objects.latest("created_at")
        self.assertEqual(wd.user_id, self.owner.id)
        self.assertEqual(wd.amount, Decimal("300.00"))
        self.assertEqual(wd.status, Withdrawal.Status.PENDING)

        # Append-only WITHDRAWAL ledger row + real total_transferred.
        self.assertTrue(
            FamilyAccrual.objects.filter(
                family_account=self.a, entry_type=FamilyAccrual.EntryType.WITHDRAWAL,
                amount_usd=Decimal("300.00"), withdrawal=wd,
            ).exists()
        )
        self.a.refresh_from_db()
        self.assertEqual(self.a.total_transferred, Decimal("300.00"))

        # The owner's spendable balance is unchanged (the 300 was the member's, not the
        # owner's own — it left via the Withdrawal). And NO external/family bank transfer.
        self.assertEqual(_balance(self.owner), Decimal("700.00"))
        self.assertEqual(FamilyTransaction.objects.count(), ft_before)  # no record-transfer

    def test_partial_then_over_withdraw(self):
        self.client.force_authenticate(self.owner)
        ok = self.client.post(
            f"/api/family/accounts/{self.a.id}/withdraw/", {"amount": "100.00"}, format="json"
        )
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(ok.json()["member"]["accrued_balance"], 200.0)
        # Over-withdrawing the remaining balance is rejected (400) and writes nothing.
        over = self.client.post(
            f"/api/family/accounts/{self.a.id}/withdraw/", {"amount": "999.00"}, format="json"
        )
        self.assertEqual(over.status_code, 400)
        self.assertEqual(accrual_summary(self.a)["accrued_balance"], Decimal("200.00"))

    def test_withdraw_is_self_scoped(self):
        # The outsider (different investor) cannot withdraw A's accrual → 404.
        self.client.force_authenticate(self.outsider)
        resp = self.client.post(f"/api/family/accounts/{self.a.id}/withdraw/", {}, format="json")
        self.assertEqual(resp.status_code, 404)

    def test_accruals_endpoint_self_scoped(self):
        self.client.force_authenticate(self.owner)
        ok = self.client.get(f"/api/family/accounts/{self.a.id}/accruals/")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["accrued_balance"], 300.0)
        self.assertEqual(len(ok.json()["entries"]), 1)  # one ACCRUAL row so far

        self.client.force_authenticate(self.outsider)
        self.assertEqual(
            self.client.get(f"/api/family/accounts/{self.a.id}/accruals/").status_code, 404
        )
