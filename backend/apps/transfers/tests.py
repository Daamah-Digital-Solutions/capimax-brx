"""Gifts, family transfers and inheritance (apps/transfers). The chain transfer is mocked."""
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.family.models import FamilyAccount, FamilyTransaction
from apps.investments.models import Investment
from apps.kyc.services import approve_kyc, get_or_create_kyc
from apps.notifications.models import Notification
from apps.secondary_market.tests import _approved_user, _deployed_property, _undeployed_property
from apps.wallets.models import OwnershipToken, UserBalance
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from . import services
from .models import EstateClaim, UnitTransfer

_FAKE_TRANSFER = {"tx_hash": "0x" + "ab" * 32, "block_number": 1, "chain_id": 97}


def _verified(email):
    u = _approved_user(email)
    u.is_email_verified = True
    u.save(update_fields=["is_email_verified"])
    return u


def _holder(email, prop, units=10):
    u = _verified(email)
    wallet, _ = get_or_create_custodial_wallet(u)
    OwnershipToken.objects.create(wallet=wallet, property_id=prop.slug, property_name=prop.name,
                                  token_symbol="BRX1", token_amount=units)
    return u


def _pos(user, prop):
    return OwnershipToken.objects.filter(wallet__user=user, property_id=prop.slug).first()


def _bal(user):
    b = UserBalance.objects.filter(user=user).first()
    return b.current_balance if b else Decimal("0")


class GiftTests(TestCase):
    def setUp(self):
        self.prop = _undeployed_property("g1")
        self.sender = _holder("giver@ex.com", self.prop)
        credit_user_balance(self.sender, Decimal("1000"), source="test")

    def _gift(self, **kw):
        args = dict(recipient_email="kid@ex.com", asset="units", property_slug=self.prop.slug, units=4)
        args.update(kw)
        with self.captureOnCommitCallbacks(execute=True):
            t = services.create_gift(self.sender, **args)
        t.refresh_from_db()
        return t

    def test_units_to_a_verified_user_arrive_now(self):
        kid = _verified("kid@ex.com")
        t = self._gift()
        self.assertEqual(t.status, UnitTransfer.Status.DELIVERED)
        self.assertEqual(_pos(self.sender, self.prop).token_amount, 6)
        self.assertEqual(_pos(self.sender, self.prop).locked_amount, 0)
        self.assertEqual(_pos(kid, self.prop).token_amount, 4)
        self.assertTrue(t.tx_hash.startswith("offchain:"))
        row = Investment.objects.get(user=kid)
        self.assertEqual(row.payment_method, "gift")
        self.assertTrue(Notification.objects.filter(user=kid, type="transfer_received").exists())

    def test_on_chain_when_deployed(self):
        prop = _deployed_property("g2")
        sender = _holder("chain@ex.com", prop)
        _verified("kid@ex.com")
        with mock.patch("apps.chain.service.transfer", return_value=_FAKE_TRANSFER) as tr:
            with self.captureOnCommitCallbacks(execute=True):
                t = services.create_gift(sender, recipient_email="kid@ex.com", asset="units",
                                         property_slug=prop.slug, units=2)
        t.refresh_from_db()
        self.assertEqual(t.tx_hash, _FAKE_TRANSFER["tx_hash"])
        self.assertEqual(tr.call_args.args[3], 2)

    def test_unverified_recipient_waits_then_receives_on_kyc(self):
        t = self._gift()
        self.assertEqual(t.status, UnitTransfer.Status.WAITING)
        self.assertEqual(_pos(self.sender, self.prop).locked_amount, 4)  # held
        kid = User.objects.create_user(email="kid@ex.com", password="pw-12345-strong")
        kid.is_email_verified = True
        kid.save()
        with self.captureOnCommitCallbacks(execute=True):
            approve_kyc(get_or_create_kyc(kid), source="admin")
        t.refresh_from_db()
        self.assertEqual(t.status, UnitTransfer.Status.DELIVERED)
        self.assertEqual(_pos(kid, self.prop).token_amount, 4)

    def test_unclaimed_gift_expires_and_returns(self):
        t = self._gift(asset="cash", amount="250", property_slug="", units=0)
        self.assertEqual(_bal(self.sender), Decimal("750"))
        UnitTransfer.objects.filter(pk=t.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(services.expire_unclaimed(), 1)
        services.expire_unclaimed()  # replay → no second refund
        t.refresh_from_db()
        self.assertEqual(t.status, UnitTransfer.Status.EXPIRED)
        self.assertEqual(_bal(self.sender), Decimal("1000"))

    def test_cancel_returns_units(self):
        t = self._gift(deliver_on=timezone.localdate() + timedelta(days=10))
        self.assertEqual(t.status, UnitTransfer.Status.SCHEDULED)
        services.cancel(t.pk, self.sender)
        self.assertEqual(_pos(self.sender, self.prop).locked_amount, 0)
        with self.assertRaises(ValidationError):
            services.cancel(t.pk, self.sender)

    def test_scheduled_gift_reminds_then_delivers_on_the_day(self):
        kid = _verified("kid@ex.com")
        day = timezone.localdate() + timedelta(days=5)
        t = self._gift(deliver_on=day)
        self.assertEqual(services.remind_upcoming(), 1)
        self.assertEqual(services.remind_upcoming(), 0)
        self.assertEqual(services.deliver_due(), {"delivered": 0, "waiting": 0, "failed": 0})
        UnitTransfer.objects.filter(pk=t.pk).update(deliver_on=timezone.localdate())
        self.assertEqual(services.deliver_due()["delivered"], 1)
        self.assertEqual(_pos(kid, self.prop).token_amount, 4)

    def test_cannot_gift_more_than_free_or_to_self(self):
        pos = _pos(self.sender, self.prop)
        pos.locked_amount = 8
        pos.save()
        with self.assertRaises(ValidationError):
            self._gift(units=3)
        with self.assertRaises(ValidationError):
            self._gift(recipient_email="GIVER@ex.com", units=1)
        self.assertFalse(UnitTransfer.objects.exists())

    def test_failed_chain_transfer_returns_everything(self):
        from apps.chain.exceptions import ChainError

        prop = _deployed_property("g3")
        sender = _holder("chainfail@ex.com", prop)
        _verified("kid@ex.com")
        with mock.patch("apps.chain.service.transfer", side_effect=ChainError("rpc down")):
            with self.captureOnCommitCallbacks(execute=True):
                t = services.create_gift(sender, recipient_email="kid@ex.com", asset="units",
                                         property_slug=prop.slug, units=2)
        t.refresh_from_db()
        self.assertEqual(t.status, UnitTransfer.Status.FAILED)
        p = _pos(sender, prop)
        self.assertEqual((p.token_amount, p.locked_amount), (10, 0))
        self.assertTrue(Notification.objects.filter(user=sender, type="transfer_returned").exists())


class FamilyTransferTests(TestCase):
    def test_family_cash_transfer_delivers_and_logs(self):
        owner = _verified("owner@ex.com")
        credit_user_balance(owner, Decimal("500"), source="test")
        member = _verified("son@ex.com")
        acct = FamilyAccount.objects.create(investor=owner, member_name="Son", member_email="son@ex.com",
                                            relationship="child")
        with self.captureOnCommitCallbacks(execute=True):
            t = services.create_family_transfer(owner, family_account_id=acct.pk, asset="cash", amount="120")
        t.refresh_from_db()
        self.assertEqual(t.status, UnitTransfer.Status.DELIVERED)
        self.assertEqual(_bal(member), Decimal("120"))
        self.assertEqual(_bal(owner), Decimal("380"))
        acct.refresh_from_db()
        self.assertEqual(acct.total_transferred, Decimal("120"))
        self.assertEqual(FamilyTransaction.objects.get(reference_number=t.reference).status, "completed")


class EstateTests(TestCase):
    def setUp(self):
        self.prop = _undeployed_property("e1")
        self.holder = _holder("holder@ex.com", self.prop, units=10)
        credit_user_balance(self.holder, Decimal("100"), source="test")
        services.set_beneficiaries(self.holder, [
            {"full_name": "A", "email": "a@ex.com", "percent": "50"},
            {"full_name": "B", "email": "b@ex.com", "percent": "30"},
            {"full_name": "C", "email": "c@ex.com", "percent": "20"},
        ])
        self.number = self.holder.estate_certificate.number
        self.a = _verified("a@ex.com")
        self.b = _verified("b@ex.com")
        self.admin = User.objects.create_user(email="adm@ex.com", password="pw-12345-strong", is_staff=True)

    def _claim(self, who=None):
        return services.submit_claim(
            who or self.a, certificate_number=self.number.lower(),
            death_certificate=SimpleUploadedFile("dc.pdf", b"%PDF-1.4", content_type="application/pdf"),
        )

    def test_hamilton(self):
        self.assertEqual(services.hamilton(10, [Decimal(50), Decimal(30), Decimal(20)]), [5, 3, 2])
        self.assertEqual(sum(services.hamilton(7, [Decimal(33.33)] * 3)), 6)
        self.assertEqual(services.hamilton(7, [Decimal(50), Decimal(50)]), [4, 3])

    def test_shares_over_100_refused(self):
        with self.assertRaises(ValidationError):
            services.set_beneficiaries(self.holder, [{"full_name": "X", "email": "x@ex.com", "percent": 101}])

    def test_only_a_beneficiary_can_claim(self):
        outsider = _verified("z@ex.com")
        from rest_framework.exceptions import NotFound

        with self.assertRaises(NotFound):
            self._claim(outsider)

    def test_approved_claim_distributes_and_closes_the_account(self):
        claim = self._claim()
        with self.captureOnCommitCallbacks(execute=True):
            services.approve_claim(claim.pk, self.admin)
        self.assertEqual(_pos(self.a, self.prop).token_amount, 5)
        self.assertEqual(_pos(self.b, self.prop).token_amount, 3)
        self.assertEqual(_bal(self.a), Decimal("50"))
        self.assertEqual(_bal(self.b), Decimal("30"))
        # C isn't registered yet: their share waits, held in the estate.
        waiting = UnitTransfer.objects.filter(recipient_email="c@ex.com", status="waiting")
        self.assertEqual(waiting.count(), 2)
        self.assertIsNone(waiting.first().expires_at)
        self.holder.refresh_from_db()
        self.assertFalse(self.holder.is_active)
        c = _verified("c@ex.com")
        self.assertEqual(services.release_waiting(c), 2)
        self.assertEqual(_pos(c, self.prop).token_amount, 2)
        self.assertEqual(_bal(c), Decimal("20"))
        self.assertEqual(_pos(self.holder, self.prop).token_amount, 0)
        claim.refresh_from_db()
        self.assertEqual(claim.status, EstateClaim.Status.APPROVED)

    def test_one_open_claim_at_a_time(self):
        self._claim()
        with self.assertRaises(ValidationError):
            self._claim(self.b)


class TransferApiTests(APITestCase):
    def test_gift_endpoint_and_certificate_pdf(self):
        prop = _undeployed_property("api1")
        user = _holder("api@ex.com", prop)
        self.client.force_authenticate(user)
        giftable = self.client.get("/api/transfers/giftable/").json()
        self.assertEqual(giftable["positions"][0]["free_units"], 10)
        resp = self.client.post("/api/transfers/gifts/", {
            "recipient_email": "friend@ex.com", "asset": "units", "property_slug": prop.slug,
            "units": 3, "occasion": "birthday",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        rows = self.client.get("/api/transfers/").json()
        self.assertEqual(rows[0]["direction"], "sent")
        cancel = self.client.post(f"/api/transfers/{rows[0]['id']}/cancel/")
        self.assertEqual(cancel.json()["status"], "cancelled")

        put = self.client.put("/api/transfers/estate/beneficiaries/", {"beneficiaries": [
            {"full_name": "Kid", "email": "kid@ex.com", "relationship": "child", "percent": 100},
        ]}, format="json")
        self.assertTrue(put.json()["certificate_number"].startswith("CPB-"))
        pdf = self.client.get("/api/transfers/estate/certificate/pdf/")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf["Content-Type"], "application/pdf")
