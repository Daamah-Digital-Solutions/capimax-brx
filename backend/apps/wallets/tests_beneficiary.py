"""
Manual bank withdrawals can be paid (client letter 2026-11): a saved bank account keeps its full
number and IBAN encrypted, each withdrawal snapshots the full beneficiary details, staff with the
payout-details permission can open them on the admin page (each look is logged), an account saved
before full details were kept is refused with a clear code, and withdrawing needs a verified
identity.
"""
from decimal import Decimal

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.kyc.services import approve_kyc, get_or_create_kyc

from .models import InvestorBankAccount, Withdrawal
from .services import credit_user_balance, open_destination


def _investor(email, *, kyc=True):
    u = User.objects.create_user(email=email, password="pw-12345-strong")
    u.is_email_verified = True
    u.save()
    if kyc:
        approve_kyc(get_or_create_kyc(u), source="dev")
    credit_user_balance(u, Decimal("1000"), source="test")
    return u


class BeneficiaryDetailsTests(APITestCase):
    def setUp(self):
        self.user = _investor("benef@ex.com")
        self.client.force_authenticate(self.user)

    def _save_account(self):
        resp = self.client.post("/api/wallets/payment-methods/bank-accounts/", {
            "bank_name": "Emirates NBD", "account_holder_name": "Sara Ali",
            "account_number": "1012 3456 7890 4321", "iban": "AE07 0331 2345 6789 0123 456",
            "swift_code": "EBILAEAD", "country": "AE", "currency": "USD",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(resp.json()["has_full_details"])
        self.assertNotIn("1012345678904321", str(resp.json()))  # the API never returns it
        return InvestorBankAccount.objects.get(pk=resp.json()["id"])

    def test_full_details_are_encrypted_and_snapshotted(self):
        ba = self._save_account()
        self.assertTrue(ba.account_number_encrypted)
        self.assertNotIn("4321", ba.account_number_encrypted)
        resp = self.client.post("/api/wallets/withdrawals/", {
            "amount": "250", "method": "bank", "bank_account_id": str(ba.pk),
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        wd = Withdrawal.objects.get(pk=resp.json()["id"])
        details = open_destination(wd)
        self.assertEqual(
            (details["account_number"], details["iban"], details["account_holder_name"], details["swift_code"]),
            ("1012345678904321", "AE070331234567890123456", "Sara Ali", "EBILAEAD"),
        )
        # deleting the saved account later does not lose where the payout goes
        ba.delete()
        wd.refresh_from_db()
        self.assertEqual(open_destination(wd)["account_number"], "1012345678904321")

    def test_an_account_without_its_full_number_is_refused(self):
        ba = InvestorBankAccount.objects.create(
            user=self.user, bank_name="CIB", account_holder_name="A B",
            account_number_masked="****1111", country="EG", currency="USD",
        )
        resp = self.client.post("/api/wallets/withdrawals/", {
            "amount": "100", "method": "bank", "bank_account_id": str(ba.pk),
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "bank_details_incomplete")
        self.assertFalse(Withdrawal.objects.filter(user=self.user).exists())

    def test_withdrawing_needs_a_verified_identity(self):
        u = _investor("no-kyc@ex.com", kyc=False)
        self.client.force_authenticate(u)
        resp = self.client.post("/api/wallets/withdrawals/", {"amount": "10", "method": "bank"}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["code"], "kyc_required")

    def test_admin_page_needs_the_permission_and_logs_each_view(self):
        ba = self._save_account()
        wd_id = self.client.post("/api/wallets/withdrawals/", {
            "amount": "100", "method": "bank", "bank_account_id": str(ba.pk),
        }, format="json").json()["id"]
        url = f"/admin/wallets/withdrawal/{wd_id}/beneficiary/"

        staff = User.objects.create_user(email="ops@ex.com", password="pw-12345-strong")
        staff.is_staff = True
        staff.save()
        staff.user_permissions.add(Permission.objects.get(codename="view_withdrawal"))
        self.client.force_authenticate(None)
        self.client.force_login(staff)
        self.assertEqual(self.client.get(url).status_code, 403)

        staff.user_permissions.add(Permission.objects.get(codename="view_payout_details"))
        staff = User.objects.get(pk=staff.pk)
        self.client.force_login(staff)
        page = self.client.get(url)
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, "1012345678904321")
        self.assertTrue(LogEntry.objects.filter(
            object_id=str(wd_id), change_message__icontains="Viewed the full beneficiary details",
        ).exists())
