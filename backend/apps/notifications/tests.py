"""
In-app notifications tests — Phase 10.

Covers: a notification is emitted at each user-facing event point for the right user
with the right type/params (KYC/KYB, wallet, mint + owner earnings, distribution,
secondary sale BOTH parties, withdrawal, submission publish/reject); replay emits no
duplicate; a notify failure NEVER breaks the host event; and the self-scoped read API
(list / unread-count / mark-read / mark-all / soft-delete).
"""
from datetime import date
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.kyc.services import approve_kyc, get_or_create_kyc, reject_kyc
from apps.owner.models import OwnerProfile, PropertySubmission, SubmissionStatus
from apps.owner.services import approve_kyb, publish_submission, reject_kyb, reject_submission
from apps.owner.tests import _submitted
from apps.wallets.models import OwnershipToken
from apps.wallets.services import get_or_create_custodial_wallet, request_withdrawal
from apps.distributions.services import declare_distribution
from apps.investments.services import create_investment
from apps.investments.tests import _fake_mint, _make_property

from .models import Notification


def _user(email):
    return User.objects.create_user(email=email, password="pw-12345-strong")


def _types(user):
    return list(Notification.objects.filter(user=user).values_list("type", flat=True))


def _one(user, ntype):
    return Notification.objects.get(user=user, type=ntype)


class EmitPointTests(TestCase):
    # --- KYC / KYB ----------------------------------------------------------- #
    def test_kyc_approved_and_rejected(self):
        u = _user("kyc@ex.com")
        approve_kyc(get_or_create_kyc(u))
        self.assertIn(Notification.Type.KYC_APPROVED, _types(u))

        u2 = _user("kycr@ex.com")
        reject_kyc(get_or_create_kyc(u2), reason="blurry")
        self.assertIn(Notification.Type.KYC_REJECTED, _types(u2))

    def test_kyc_approve_no_duplicate_on_replay(self):
        u = _user("kycdup@ex.com")
        kyc = get_or_create_kyc(u)
        approve_kyc(kyc)
        approve_kyc(kyc)  # webhook replay
        self.assertEqual(
            Notification.objects.filter(user=u, type=Notification.Type.KYC_APPROVED).count(), 1
        )

    def test_kyb_approved_carries_role_param(self):
        u = _user("kyb@ex.com")
        profile = OwnerProfile.objects.create(user=u, contact_name="C", email="kyb@ex.com")
        approve_kyb(profile)
        n = _one(u, Notification.Type.KYB_APPROVED)
        self.assertEqual(n.params.get("role"), "owner")
        approve_kyb(profile)  # replay → no duplicate
        self.assertEqual(
            Notification.objects.filter(user=u, type=Notification.Type.KYB_APPROVED).count(), 1
        )

    def test_kyb_rejected(self):
        u = _user("kybr@ex.com")
        profile = OwnerProfile.objects.create(user=u, contact_name="C", email="kybr@ex.com")
        reject_kyb(profile, reason="docs")
        self.assertIn(Notification.Type.KYB_REJECTED, _types(u))

    # --- Wallet -------------------------------------------------------------- #
    def test_wallet_created(self):
        u = _user("wallet@ex.com")
        get_or_create_custodial_wallet(u)
        self.assertEqual(
            Notification.objects.filter(user=u, type=Notification.Type.WALLET_CREATED).count(), 1
        )
        # Idempotent get → no second notification.
        get_or_create_custodial_wallet(u)
        self.assertEqual(
            Notification.objects.filter(user=u, type=Notification.Type.WALLET_CREATED).count(), 1
        )

    # --- Mint + owner earnings ---------------------------------------------- #
    def test_mint_notifies_investor_and_owner_earnings(self):
        owner = _user("mowner@ex.com")
        investor = _user("minvestor@ex.com")
        get_or_create_custodial_wallet(investor)
        prop = _make_property("pmintnotif", total_value=5_000_000, token_price=100, deployed=True)
        prop.submitted_by = owner
        prop.save(update_fields=["submitted_by"])

        with mock.patch("apps.investments.services.chain_service.mint", side_effect=_fake_mint):
            create_investment(user=investor, prop=prop, token_amount=10, payment_method="pronova")

        self.assertIn(Notification.Type.INVESTMENT_MINTED, _types(investor))
        earn = _one(owner, Notification.Type.EARNINGS_CREDITED)
        self.assertEqual(earn.params.get("slug"), prop.slug)
        # Investor's mint notification names the property.
        mint = _one(investor, Notification.Type.INVESTMENT_MINTED)
        self.assertEqual(mint.params.get("tokens"), 10)

    # --- Distribution -------------------------------------------------------- #
    def test_distribution_notifies_each_holder(self):
        prop = _make_property("pdistnotif", total_value=1_000_000, token_price=100)
        holders = []
        for email, amt in (("h1@ex.com", 60), ("h2@ex.com", 40)):
            u = _user(email)
            wallet, _ = get_or_create_custodial_wallet(u)
            OwnershipToken.objects.create(
                wallet=wallet, property_id=prop.slug, property_name=prop.name,
                token_symbol="BRX1", token_amount=amt, token_value_usd=Decimal(amt) * 100,
            )
            holders.append(u)

        declare_distribution(prop.slug, Decimal("1000.00"), period_label="Q1 2026",
                             pay_date=date(2026, 3, 31))

        for u in holders:
            self.assertIn(Notification.Type.DISTRIBUTION_CREDITED, _types(u))
        # The 60-token holder's share is recorded in the params.
        n = _one(holders[0], Notification.Type.DISTRIBUTION_CREDITED)
        self.assertEqual(n.params.get("amount"), "600.00")

    # --- Withdrawal ---------------------------------------------------------- #
    def test_withdrawal_requested(self):
        from apps.wallets.services import credit_user_balance
        u = _user("wd@ex.com")
        credit_user_balance(u, Decimal("500"), source="test")
        request_withdrawal(u, Decimal("200"), method="bank")
        n = _one(u, Notification.Type.WITHDRAWAL_REQUESTED)
        self.assertEqual(n.params.get("amount"), "200")
        self.assertTrue(n.params.get("reference", "").startswith("WD-"))

    # --- Submission publish / reject ---------------------------------------- #
    def test_submission_published(self):
        owner, sub = _submitted({"name": "NotifTower"})
        publish_submission(sub, model="ready")
        n = _one(owner, Notification.Type.SUBMISSION_PUBLISHED)
        self.assertEqual(n.params.get("property"), "NotifTower")

    def test_submission_rejected(self):
        owner, sub = _submitted({"name": "RejectTower"})
        reject_submission(sub, review_notes="incomplete")
        self.assertIn(Notification.Type.SUBMISSION_REJECTED, _types(owner))

    # --- Failure isolation --------------------------------------------------- #
    def test_notify_failure_never_breaks_host(self):
        u = _user("safe@ex.com")
        kyc = get_or_create_kyc(u)
        with mock.patch(
            "apps.notifications.services.Notification.objects.create",
            side_effect=Exception("boom"),
        ):
            kyc = approve_kyc(kyc)  # must NOT raise
        kyc.refresh_from_db()
        self.assertEqual(kyc.status, "approved")            # host event committed
        self.assertEqual(Notification.objects.filter(user=u).count(), 0)  # notify swallowed


@mock.patch("apps.secondary_market.services.chain_service.transfer")
class SecondarySaleNotifyTests(APITestCase):
    """A peer settlement notifies BOTH the buyer and the seller."""

    def setUp(self):
        from apps.secondary_market.tests import _deployed_property, _seller_with_tokens
        from apps.wallets.services import credit_user_balance
        self._deployed_property = _deployed_property
        self._seller_with_tokens = _seller_with_tokens
        self._credit = credit_user_balance

    def test_both_parties_notified(self, m_transfer):
        from apps.secondary_market.tests import _approved_user, _FAKE_TRANSFER
        m_transfer.return_value = _FAKE_TRANSFER

        prop = self._deployed_property()
        seller, _ = self._seller_with_tokens("sell@ex.com", prop, 10)
        self.client.force_authenticate(seller)
        listing = self.client.post(
            "/api/secondary-market/",
            {"property_id": prop.slug, "token_amount": 4, "unit_price": "100"},
            format="json",
        )
        listing_id = listing.data["id"]

        buyer = _approved_user("buy@ex.com")
        self._credit(buyer, Decimal("1000"), source="test")
        self.client.force_authenticate(buyer)
        resp = self.client.post(f"/api/secondary-market/{listing_id}/purchase/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.assertIn(Notification.Type.SECONDARY_SALE_SELLER, _types(seller))
        self.assertIn(Notification.Type.SECONDARY_SALE_BUYER, _types(buyer))


class NotificationsApiTests(APITestCase):
    def setUp(self):
        self.user = _user("api@ex.com")
        self.other = _user("apiother@ex.com")
        # Three for the caller (one read, one deleted) + one for someone else.
        self.n1 = Notification.objects.create(user=self.user, type=Notification.Type.KYC_APPROVED)
        self.n2 = Notification.objects.create(user=self.user, type=Notification.Type.WALLET_CREATED, read=True)
        self.n3 = Notification.objects.create(user=self.user, type=Notification.Type.KYC_REJECTED, deleted=True)
        Notification.objects.create(user=self.other, type=Notification.Type.KYC_APPROVED)

    def test_requires_auth(self):
        self.assertIn(
            self.client.get("/api/notifications/").status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_list_is_self_scoped_and_excludes_deleted(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get("/api/notifications/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in resp.data}
        self.assertEqual(ids, {str(self.n1.id), str(self.n2.id)})  # not the deleted, not other's

    def test_unread_count(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(resp.data["unread"], 1)  # n1 only (n2 read, n3 deleted)

    def test_mark_one_read(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(f"/api/notifications/{self.n1.id}/read/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.n1.refresh_from_db()
        self.assertTrue(self.n1.read)

    def test_mark_all_read(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post("/api/notifications/mark-all-read/")
        self.assertEqual(resp.data["updated"], 1)
        self.assertEqual(
            Notification.objects.filter(user=self.user, read=False, deleted=False).count(), 0
        )

    def test_soft_delete_hides(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post(f"/api/notifications/{self.n1.id}/delete/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.n1.refresh_from_db()
        self.assertTrue(self.n1.deleted)               # soft — row still exists
        self.assertTrue(Notification.objects.filter(pk=self.n1.id).exists())
        # Hidden from the list.
        ids = {r["id"] for r in self.client.get("/api/notifications/").data}
        self.assertNotIn(str(self.n1.id), ids)

    def test_cannot_touch_others_notification(self):
        self.client.force_authenticate(self.user)
        other_notif = Notification.objects.filter(user=self.other).first()
        resp = self.client.post(f"/api/notifications/{other_notif.id}/read/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
