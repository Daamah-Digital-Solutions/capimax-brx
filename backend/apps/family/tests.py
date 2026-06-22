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
