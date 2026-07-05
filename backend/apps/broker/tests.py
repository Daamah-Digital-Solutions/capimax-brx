"""
Broker onboarding (HYBRID verification) + referral attribution tests — Phase 12 Wave A.
Run against Postgres (capimax_brx).

Covers the LOCKED decisions:
  * Apply creates a pending profile with an auto-generated UNIQUE referral_code; apply is
    idempotent; GET 404 when none.
  * Licence submit persists number/authority/expiry + records submission (status pending).
  * HYBRID: identity rides the EXISTING investor UserKYC (role-agnostic). KYC approved
    ALONE does NOT activate the broker role — the role stays pending until the licence is
    approved.
  * ACTIVATION HINGE: approve_license REQUIRES identity KYC approved (raises otherwise);
    once KYC is approved it flips role_status → ACTIVE + notifies. reject_license records
    notes + leaves the role inactive.
  * REFERRAL: referral_code is unique; attribute_referral is SET-ONCE (second code ignored,
    unknown/own code ignored, existing link never overwritten); the public resolve endpoint
    validates a code.
  * REGISTRATION wiring: an investor registering with ?ref=CODE is linked to the broker
    once; unknown/no ref → no link.
  * HasActivatedBroker allows an approved broker + denies others.
  * NO money is written this wave (commission accumulators stay 0); the broker app owns
    only the BrokerProfile model.
  * The Sumsub webhook is NOT modified by the broker domain (no broker resolver exists).
"""
from io import StringIO

from django.apps import apps as django_apps
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, APITestCase, force_authenticate
from rest_framework.views import APIView

from apps.core.models import Profile, User
from apps.core.permissions import HasActivatedBroker
from apps.kyc.services import approve_kyc, get_or_create_kyc
from apps.notifications.models import Notification

from .models import BrokerProfile, BrokerStatus
from .services import (
    LicenseNotApprovable,
    approve_license,
    attribute_referral,
    get_or_create_broker,
    reject_license,
    resolve_referral_code,
    submit_license,
)


def _mk_user(email="broker@example.com", *, role=Profile.Role.BROKER):
    user = User.objects.create_user(email=email, password="pw-12345-strong")
    profile = user.profile
    profile.role = role
    if role in (Profile.Role.BROKER,):
        profile.role_status = Profile.RoleStatus.PENDING_VERIFICATION
        profile.role_verified_at = None
    profile.save()
    return user


def _approve_identity(user):
    """Raise the broker's IDENTITY via the role-agnostic investor UserKYC (the reuse)."""
    return approve_kyc(get_or_create_kyc(user), review_answer="DEV", source="dev")


class ApplyTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)

    def test_get_404_when_none(self):
        res = self.client.get("/api/broker/profile/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_apply_creates_pending_with_referral_code(self):
        res = self.client.post(
            "/api/broker/profile/",
            {"contact_name": "Khalid B", "email": "khalid@brk.example.com", "phone": "+97150"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "pending")
        self.assertTrue(res.data["referral_code"].startswith("BRK"))
        self.assertEqual(res.data["referral_link"], f"/ref/{res.data['referral_code']}")
        # Identity status mirrored from the shared UserKYC (pending here).
        self.assertEqual(res.data["kyc_status"], "pending")
        # No money written.
        self.assertEqual(str(res.data["total_commission_earned"]), "0.00")

    def test_apply_idempotent(self):
        p = {"contact_name": "K", "email": "k@brk.example.com"}
        first = self.client.post("/api/broker/profile/", p, format="json")
        second = self.client.post("/api/broker/profile/", p, format="json")
        self.assertEqual(BrokerProfile.objects.filter(user=self.user).count(), 1)
        self.assertEqual(first.data["referral_code"], second.data["referral_code"])


class ReferralCodeTests(TestCase):
    def test_codes_unique_across_brokers(self):
        codes = set()
        for i in range(8):
            u = _mk_user(email=f"b{i}@brk.example.com")
            b, _ = get_or_create_broker(u, defaults={"contact_name": "x", "email": u.email})
            codes.add(b.referral_code)
        self.assertEqual(len(codes), 8)  # all distinct

    def test_resolve_referral_code(self):
        u = _mk_user()
        b, _ = get_or_create_broker(u, defaults={"contact_name": "x", "email": u.email})
        self.assertEqual(resolve_referral_code(b.referral_code.lower()), b)  # case-insensitive
        self.assertIsNone(resolve_referral_code("NOPE000"))
        self.assertIsNone(resolve_referral_code(""))


class LicenseHingeTests(TestCase):
    def setUp(self):
        self.user = _mk_user()
        self.broker, _ = get_or_create_broker(
            self.user, defaults={"contact_name": "B", "email": self.user.email}
        )

    def test_submit_license_persists(self):
        submit_license(
            self.broker,
            license_info={"license_number": "LIC-99", "license_authority": "RERA"},
        )
        self.broker.refresh_from_db()
        self.assertEqual(self.broker.license_number, "LIC-99")
        self.assertEqual(self.broker.license_authority, "RERA")
        self.assertIsNotNone(self.broker.license_submitted_at)
        self.assertEqual(self.broker.status, BrokerStatus.PENDING)  # admin still approves

    def test_approve_requires_kyc(self):
        # No identity KYC yet → the hinge refuses.
        with self.assertRaises(LicenseNotApprovable):
            approve_license(self.broker)
        self.broker.refresh_from_db()
        self.assertEqual(self.broker.status, BrokerStatus.PENDING)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.role_status, Profile.RoleStatus.PENDING_VERIFICATION)

    def test_kyc_alone_does_not_activate_role(self):
        # Identity approved, but no licence approval → broker role STILL pending.
        _approve_identity(self.user)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.role_status, Profile.RoleStatus.PENDING_VERIFICATION)
        self.broker.refresh_from_db()
        self.assertEqual(self.broker.status, BrokerStatus.PENDING)

    def test_full_hinge_activates_role_and_notifies(self):
        _approve_identity(self.user)
        with self.captureOnCommitCallbacks(execute=True):
            approve_license(self.broker)
        self.broker.refresh_from_db()
        self.assertEqual(self.broker.status, BrokerStatus.APPROVED)
        self.assertIsNotNone(self.broker.approved_at)
        self.assertIsNotNone(self.broker.license_reviewed_at)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.role_status, Profile.RoleStatus.ACTIVE)
        self.assertIsNotNone(self.user.profile.role_verified_at)
        self.assertTrue(
            Notification.objects.filter(
                user=self.user, type=Notification.Type.BROKER_LICENSE_APPROVED
            ).exists()
        )

    def test_reject_records_notes_and_leaves_inactive(self):
        _approve_identity(self.user)
        reject_license(self.broker, notes="Licence expired")
        self.broker.refresh_from_db()
        self.assertEqual(self.broker.status, BrokerStatus.REJECTED)
        self.assertEqual(self.broker.review_notes, "Licence expired")
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.role_status, Profile.RoleStatus.PENDING_VERIFICATION)
        self.assertTrue(
            Notification.objects.filter(
                user=self.user, type=Notification.Type.BROKER_LICENSE_REJECTED
            ).exists()
        )

    def test_no_money_written_through_hinge(self):
        _approve_identity(self.user)
        approve_license(self.broker)
        self.broker.refresh_from_db()
        self.assertEqual(str(self.broker.total_commission_earned), "0.00")
        self.assertEqual(str(self.broker.pending_commission), "0.00")
        self.assertEqual(str(self.broker.commission_rate), "5.00")


class AttributionTests(TestCase):
    def setUp(self):
        self.broker_user = _mk_user(email="theref@brk.example.com")
        self.broker, _ = get_or_create_broker(
            self.broker_user, defaults={"contact_name": "Ref", "email": self.broker_user.email}
        )
        self.other_user = _mk_user(email="other@brk.example.com")
        self.other_broker, _ = get_or_create_broker(
            self.other_user, defaults={"contact_name": "Other", "email": self.other_user.email}
        )

    def test_set_once_first_broker_wins(self):
        investor = _mk_user(email="inv@example.com", role=Profile.Role.INVESTOR)
        attribute_referral(investor.profile, self.broker.referral_code)
        investor.profile.refresh_from_db()
        self.assertEqual(investor.profile.referred_by_broker_id, self.broker.id)
        # A SECOND, different code is ignored — first broker wins.
        attribute_referral(investor.profile, self.other_broker.referral_code)
        investor.profile.refresh_from_db()
        self.assertEqual(investor.profile.referred_by_broker_id, self.broker.id)

    def test_unknown_code_ignored(self):
        investor = _mk_user(email="inv2@example.com", role=Profile.Role.INVESTOR)
        attribute_referral(investor.profile, "NOPE000")
        investor.profile.refresh_from_db()
        self.assertIsNone(investor.profile.referred_by_broker_id)

    def test_own_code_ignored(self):
        # A broker can't refer themselves.
        attribute_referral(self.broker_user.profile, self.broker.referral_code)
        self.broker_user.profile.refresh_from_db()
        self.assertIsNone(self.broker_user.profile.referred_by_broker_id)


class RegistrationRefTests(APITestCase):
    def setUp(self):
        self.broker_user = _mk_user(email="rbroker@brk.example.com")
        self.broker, _ = get_or_create_broker(
            self.broker_user, defaults={"contact_name": "RB", "email": self.broker_user.email}
        )

    def _register(self, email, ref=None):
        body = {"email": email, "password": "pw-12345-strong", "role": "investor"}
        if ref is not None:
            body["ref"] = ref
        return self.client.post("/api/auth/register/", body, format="json")

    def test_register_with_ref_links_once(self):
        res = self._register("ref-investor@example.com", ref=self.broker.referral_code)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        prof = User.objects.get(email="ref-investor@example.com").profile
        self.assertEqual(prof.referred_by_broker_id, self.broker.id)

    def test_register_without_ref_no_link(self):
        self._register("plain-investor@example.com")
        prof = User.objects.get(email="plain-investor@example.com").profile
        self.assertIsNone(prof.referred_by_broker_id)

    def test_register_unknown_ref_no_link(self):
        self._register("badref-investor@example.com", ref="NOPE000")
        prof = User.objects.get(email="badref-investor@example.com").profile
        self.assertIsNone(prof.referred_by_broker_id)


class ReferralResolveApiTests(APITestCase):
    def test_public_resolve(self):
        u = _mk_user()
        b, _ = get_or_create_broker(u, defaults={"contact_name": "Resolver", "email": u.email})
        ok = self.client.get(f"/api/broker/referral/resolve/?code={b.referral_code}")
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertTrue(ok.data["valid"])
        self.assertEqual(ok.data["broker_name"], "Resolver")
        bad = self.client.get("/api/broker/referral/resolve/?code=NOPE000")
        self.assertFalse(bad.data["valid"])


class _Guarded(APIView):
    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def get(self, request):
        return Response({"ok": True})


class PermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = _Guarded.as_view()

    def _call(self, user):
        req = self.factory.get("/x")
        force_authenticate(req, user=user)
        return self.view(req)

    def test_denies_without_profile(self):
        self.assertEqual(self._call(_mk_user()).status_code, status.HTTP_403_FORBIDDEN)

    def test_allows_approved(self):
        user = _mk_user()
        broker, _ = get_or_create_broker(user, defaults={"contact_name": "B", "email": user.email})
        _approve_identity(user)
        with self.captureOnCommitCallbacks(execute=True):
            approve_license(broker)
        # Re-fetch so the cached reverse `broker_profile` (pending at creation) is dropped.
        user = User.objects.get(pk=user.pk)
        self.assertEqual(self._call(user).status_code, status.HTTP_200_OK)


class LicenseUploadApiTests(APITestCase):
    def setUp(self):
        self.user = _mk_user()
        self.client.force_authenticate(self.user)
        self.client.post(
            "/api/broker/profile/",
            {"contact_name": "U", "email": "u@brk.example.com"},
            format="json",
        )

    def test_submit_then_upload(self):
        self.client.post(
            "/api/broker/license/submit/",
            {"license_number": "L-1", "license_authority": "RERA"},
            format="json",
        )
        f = SimpleUploadedFile("licence.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        res = self.client.post("/api/broker/license/upload/", {"file": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["has_license_document"])
        broker = BrokerProfile.objects.get(user=self.user)
        self.assertEqual(broker.license_number, "L-1")
        self.assertTrue(bool(broker.license_document))


class WebhookUntouchedTests(TestCase):
    def test_broker_adds_no_webhook_resolver(self):
        # The broker domain deliberately does NOT add a Sumsub webhook handler — identity
        # rides the existing investor fallback. Guard against a regression.
        from apps.broker import services as broker_services

        self.assertFalse(
            any(name.startswith("try_handle") for name in dir(broker_services)),
            "Broker must not introduce a Sumsub webhook resolver (identity uses the "
            "existing investor KYC fallback).",
        )


class NoMoneyModelTests(TestCase):
    def test_broker_app_models(self):
        # Wave A owned only BrokerProfile. Broker Listings adds BrokerCommission — a
        # STRUCTURED, append-only commission RECORD (the money still moves via the wallets
        # BalanceTransaction; this app holds no balance/escrow of its own).
        names = {m._meta.model_name for m in django_apps.get_app_config("broker").get_models()}
        self.assertEqual(names, {"brokerprofile", "brokercommission"})


class DevCommandTests(TestCase):
    def setUp(self):
        self.user = _mk_user()

    @override_settings(DEBUG=True)
    def test_dev_approve_requires_kyc_then_activates(self):
        get_or_create_broker(self.user, defaults={"contact_name": "B", "email": self.user.email})
        # Without identity KYC, the command errors (the hinge guard).
        from django.core.management.base import CommandError

        with self.assertRaises(CommandError):
            call_command("dev_approve_broker_license", "--email", self.user.email, stdout=StringIO())
        # Grant identity, then the dev approve activates the role.
        _approve_identity(self.user)
        with self.captureOnCommitCallbacks(execute=True):
            call_command("dev_approve_broker_license", "--email", self.user.email, stdout=StringIO())
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.role_status, Profile.RoleStatus.ACTIVE)

    @override_settings(DEBUG=False)
    def test_dev_command_refuses_in_production(self):
        from django.core.management.base import CommandError

        with self.assertRaises(CommandError):
            call_command("dev_approve_broker_license", "--email", self.user.email, stdout=StringIO())


# =========================================================================== #
# Wave B — broker COMMISSION: settlement-gated, idempotent, PLATFORM-BORNE ADDITIVE
# (never reduces the owner net or the investor's tokens), distinct source, reuses the
# UserBalance/Withdrawal stack. Mirrors the owner-earnings test pattern (apps/owner/tests).
# =========================================================================== #
from decimal import Decimal as _D
from unittest import mock as _mock

from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import mint_investment
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction, OwnershipToken, UserBalance
from apps.wallets.services import get_or_create_custodial_wallet, request_withdrawal

_FAKE_MINT_B = {"tx_hash": "0x" + "ef" * 32, "block_number": 777, "chain_id": 97}


def _approved_broker(email):
    user = _mk_user(email=email)
    broker, _ = get_or_create_broker(user, defaults={"contact_name": "Bk", "email": user.email})
    broker.status = BrokerStatus.APPROVED
    broker.save(update_fields=["status"])
    return broker


def _deployed_property(owner=None, *, slug, total_value=_D("5000000"),
                       fee_platform=_D("1.5"), fee_management=_D("0.5")):
    p = Property(**_valid_property_kwargs(
        slug=slug, total_value=total_value, fee_platform=fee_platform, fee_management=fee_management,
    ))
    if owner is not None:
        p.submitted_by = owner
    p.save()  # token_supply auto-derives = 50000
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "11" * 20
    meta.deployment_chain_id = 97
    meta.save()
    return p


def _completed_investment(buyer, prop, token_amount, *, broker=None):
    if broker is not None:
        prof = buyer.profile
        prof.referred_by_broker = broker
        prof.save(update_fields=["referred_by_broker"])
    wallet, _ = get_or_create_custodial_wallet(buyer)
    return Investment.objects.create(
        user=buyer, property=prop, property_name=prop.name,
        amount_invested=_D(token_amount) * prop.token_price, token_amount=token_amount,
        token_symbol="BRX1", price_per_token=prop.token_price,
        ownership_percentage=_D("0.1"), payment_method="card",
        payment_status=PaymentStatus.COMPLETED, wallet=wallet,
    )


@_mock.patch("apps.investments.services.chain_service.mint", return_value=_FAKE_MINT_B)
class BrokerCommissionTests(APITestCase):
    def test_referred_sale_credits_broker_5pct_once(self, _m):
        broker = _approved_broker("cbk1@ex.com")
        owner = _mk_user(email="cown1@ex.com", role=Profile.Role.OWNER)
        prop = _deployed_property(owner, slug="cprop1")
        buyer = User.objects.create_user(email="cbuy1@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)  # gross 10*100 = 1000
        result = mint_investment(inv)
        self.assertTrue(result["minted"])
        self.assertEqual(result["broker_credited"], "50.00")  # 5% of 1000
        self.assertEqual(UserBalance.objects.get(user=broker.user).current_balance, _D("50.00"))
        entries = BalanceTransaction.objects.filter(source="broker_commission", reference=str(inv.id))
        self.assertEqual(entries.count(), 1)
        self.assertEqual(entries.first().entry_type, "credit")
        broker.refresh_from_db()
        self.assertEqual(broker.total_commission_earned, _D("50.00"))

    def test_idempotent_on_replay(self, _m):
        broker = _approved_broker("cbk2@ex.com")
        prop = _deployed_property(_mk_user(email="cown2@ex.com", role=Profile.Role.OWNER), slug="cprop2")
        buyer = User.objects.create_user(email="cbuy2@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        mint_investment(inv)
        again = mint_investment(inv)  # mint short-circuits (already minted)
        self.assertTrue(again.get("already"))
        self.assertEqual(UserBalance.objects.get(user=broker.user).current_balance, _D("50.00"))
        self.assertEqual(
            BalanceTransaction.objects.filter(source="broker_commission", reference=str(inv.id)).count(), 1
        )

    def test_non_referred_buyer_no_commission(self, _m):
        _approved_broker("cbk3@ex.com")  # a broker exists, but this buyer wasn't referred
        prop = _deployed_property(_mk_user(email="cown3@ex.com", role=Profile.Role.OWNER), slug="cprop3")
        buyer = User.objects.create_user(email="cbuy3@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10)  # no broker=
        result = mint_investment(inv)
        self.assertIsNone(result["broker_credited"])
        self.assertEqual(BalanceTransaction.objects.filter(source="broker_commission").count(), 0)

    def test_inactive_broker_no_commission(self, _m):
        broker = _approved_broker("cbk4@ex.com")
        broker.status = BrokerStatus.REJECTED  # not active
        broker.save(update_fields=["status"])
        prop = _deployed_property(_mk_user(email="cown4@ex.com", role=Profile.Role.OWNER), slug="cprop4")
        buyer = User.objects.create_user(email="cbuy4@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        result = mint_investment(inv)
        self.assertIsNone(result["broker_credited"])
        self.assertEqual(BalanceTransaction.objects.filter(source="broker_commission").count(), 0)

    def test_additive_owner_net_and_investor_tokens_unchanged(self, _m):
        # Same property/amount, with vs without a referring broker → the owner's net is
        # IDENTICAL (commission is platform-borne, additive — it doesn't reduce owner net),
        # and the investor receives their FULL tokens in both cases.
        owner = _mk_user(email="cown5@ex.com", role=Profile.Role.OWNER)
        prop_ref = _deployed_property(owner, slug="cprop5a")
        prop_plain = _deployed_property(owner, slug="cprop5b")
        broker = _approved_broker("cbk5@ex.com")
        b_ref = User.objects.create_user(email="cbuy5a@ex.com", password="pw-12345-strong")
        b_plain = User.objects.create_user(email="cbuy5b@ex.com", password="pw-12345-strong")
        inv_ref = _completed_investment(b_ref, prop_ref, 10, broker=broker)
        inv_plain = _completed_investment(b_plain, prop_plain, 10)
        r_ref = mint_investment(inv_ref)
        r_plain = mint_investment(inv_plain)
        # Owner net identical with/without the broker; buyer-borne fees → full $1000 each.
        self.assertEqual(r_ref["owner_credited"], r_plain["owner_credited"])
        self.assertEqual(r_ref["owner_credited"], "1000.00")
        # Broker commission is EXTRA (off gross), only on the referred sale.
        self.assertEqual(r_ref["broker_credited"], "50.00")
        self.assertIsNone(r_plain["broker_credited"])
        # Investor got their full 10 tokens (commission didn't reduce them).
        wallet = b_ref.wallet
        self.assertEqual(
            OwnershipToken.objects.get(wallet=wallet, property_id=prop_ref.slug).token_amount, 10
        )

    def test_commission_source_isolated(self, _m):
        # After a referred sale only the owner (primary_sale) + broker (broker_commission)
        # credits exist — broker commission is NEVER conflated with primary_sale/distribution.
        broker = _approved_broker("cbk6@ex.com")
        prop = _deployed_property(_mk_user(email="cown6@ex.com", role=Profile.Role.OWNER), slug="cprop6")
        buyer = User.objects.create_user(email="cbuy6@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        mint_investment(inv)
        self.assertEqual(
            set(BalanceTransaction.objects.values_list("source", flat=True)),
            {"primary_sale", "broker_commission"},
        )

    def test_broker_reads_commissions_and_withdraws(self, _m):
        broker = _approved_broker("cbk7@ex.com")
        prop = _deployed_property(_mk_user(email="cown7@ex.com", role=Profile.Role.OWNER), slug="cprop7")
        buyer = User.objects.create_user(email="cbuy7@ex.com", password="pw-12345-strong")
        buyer.profile.full_name = "Referred Investor"
        buyer.profile.save(update_fields=["full_name"])
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        mint_investment(inv)

        # Read own commissions (re-fetch user so the cached pending broker_profile is dropped).
        self.client.force_authenticate(User.objects.get(pk=broker.user_id))
        res = self.client.get("/api/broker/commissions/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["stats"]["total_commission"], "50.00")
        self.assertEqual(res.data["stats"]["this_month_commission"], "50.00")
        self.assertEqual(res.data["stats"]["total_referrals"], 1)
        self.assertEqual(res.data["stats"]["converted_referrals"], 1)
        self.assertEqual(len(res.data["commissions"]), 1)
        self.assertEqual(res.data["commissions"][0]["commission"], "50.00")
        self.assertEqual(res.data["referrals"][0]["name"], "Referred Investor")

        # Withdraw via the EXISTING UserBalance/Withdrawal stack.
        wd = request_withdrawal(broker.user, _D("50.00"), method="bank")
        self.assertEqual(UserBalance.objects.get(user=broker.user).current_balance, _D("0.00"))
        self.assertEqual(wd.amount, _D("50.00"))

    def test_commissions_endpoint_denies_non_broker(self, _m):
        plain = User.objects.create_user(email="cplain@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(plain)
        self.assertEqual(
            self.client.get("/api/broker/commissions/").status_code, status.HTTP_403_FORBIDDEN
        )


# =========================================================================== #
# Broker Listings Phase 1 — per-property commission rate, the rate-STAMPED
# BrokerCommission ledger, the backfill, and the broker-scoped per-property stats.
# =========================================================================== #
@_mock.patch("apps.investments.services.chain_service.mint", return_value=_FAKE_MINT_B)
class BrokerListingsTests(APITestCase):
    def _prop(self, slug, *, rate=None):
        owner = _mk_user(email=f"lo-{slug}@ex.com", role=Profile.Role.OWNER)
        p = _deployed_property(owner, slug=slug)
        p.broker_commission_rate = rate  # None → fallback to the broker's own rate
        p.save(update_fields=["broker_commission_rate"])
        return p

    def test_per_property_rate_stamped_and_frozen(self, _m):
        from apps.broker.models import BrokerCommission

        broker = _approved_broker("lbk1@ex.com")
        prop = self._prop("lprop1", rate=_D("3"))  # per-property 3%
        buyer = User.objects.create_user(email="lbuy1@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)  # gross 1000
        res = mint_investment(inv)
        self.assertEqual(res["broker_credited"], "30.00")  # 3% of 1000, NOT the 5% default

        bc = BrokerCommission.objects.get(investment=inv)
        self.assertEqual(bc.rate_applied, _D("3.00"))
        self.assertEqual(bc.commission, _D("30.00"))
        self.assertEqual(bc.property_slug, "lprop1")
        self.assertIsNotNone(bc.balance_transaction_id)
        self.assertFalse(bc.is_legacy)

        # A later property-rate change NEVER rewrites the stamped row.
        prop.broker_commission_rate = _D("10")
        prop.save(update_fields=["broker_commission_rate"])
        bc.refresh_from_db()
        self.assertEqual(bc.rate_applied, _D("3.00"))
        self.assertEqual(bc.commission, _D("30.00"))

    def test_fallback_to_broker_rate_when_property_null(self, _m):
        from apps.broker.models import BrokerCommission

        broker = _approved_broker("lbk2@ex.com")
        self.assertEqual(broker.commission_rate, _D("5.00"))  # default
        prop = self._prop("lprop2", rate=None)  # no per-property rate
        buyer = User.objects.create_user(email="lbuy2@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        res = mint_investment(inv)
        self.assertEqual(res["broker_credited"], "50.00")  # 5% broker fallback
        bc = BrokerCommission.objects.get(investment=inv)
        self.assertEqual(bc.rate_applied, _D("5.00"))  # the fallback rate IS stamped

    def test_idempotent_via_balance_transaction(self, _m):
        from django.db import transaction

        from apps.broker.models import BrokerCommission
        from apps.investments.services import credit_broker_share

        broker = _approved_broker("lbk3@ex.com")
        prop = self._prop("lprop3", rate=_D("5"))
        buyer = User.objects.create_user(email="lbuy3@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        mint_investment(inv)
        self.assertEqual(BrokerCommission.objects.filter(investment=inv).count(), 1)

        # Re-running the credit for the SAME reference is a no-op (guarded) — no dup row.
        with transaction.atomic():
            again = credit_broker_share(inv, gross=_D("1000"), reference=str(inv.id))
        self.assertIsNone(again)
        self.assertEqual(BrokerCommission.objects.filter(investment=inv).count(), 1)

    def test_one_investment_two_credits_two_rows(self, _m):
        # An investment can earn MORE THAN ONE commission credit (e.g. down-payment + a
        # later installment), each its own BalanceTransaction → two BrokerCommission rows.
        # Proves idempotency is per-balance_transaction, NOT unique(broker, investment).
        from django.db import transaction

        from apps.broker.models import BrokerCommission
        from apps.investments.services import credit_broker_share

        broker = _approved_broker("lbk4@ex.com")
        prop = self._prop("lprop4", rate=_D("5"))
        buyer = User.objects.create_user(email="lbuy4@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        with transaction.atomic():
            credit_broker_share(inv, gross=_D("500"), reference=f"{inv.id}:inst-1")
            credit_broker_share(inv, gross=_D("500"), reference=f"{inv.id}:inst-2")
        self.assertEqual(BrokerCommission.objects.filter(investment=inv).count(), 2)
        # Decimal-exact: 5% of 500 each.
        self.assertEqual(
            sorted(str(b.commission) for b in BrokerCommission.objects.filter(investment=inv)),
            ["25.00", "25.00"],
        )

    def test_ledger_reads_structured_rows_totals_match(self, _m):
        broker = _approved_broker("lbk5@ex.com")
        prop = self._prop("lprop5", rate=_D("4"))
        buyer = User.objects.create_user(email="lbuy5@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        mint_investment(inv)

        # The money row is unchanged; the ledger reads the structured row + the stamped rate.
        tx = BalanceTransaction.objects.get(source="broker_commission", reference=str(inv.id))
        self.assertEqual(tx.amount, _D("40.00"))  # 4% of 1000 — money unchanged
        self.client.force_authenticate(User.objects.get(pk=broker.user_id))
        res = self.client.get("/api/broker/commissions/")
        self.assertEqual(res.data["stats"]["total_commission"], "40.00")
        self.assertEqual(res.data["commissions"][0]["commission"], "40.00")
        self.assertEqual(res.data["commissions"][0]["rate"], "4.00")
        self.assertFalse(res.data["commissions"][0]["is_legacy"])

    def test_backfill_parses_rate_and_legacy_null(self, _m):
        # Simulate PRE-EXISTING history: broker_commission BalanceTransactions with NO
        # BrokerCommission yet, then run the migration's backfill function directly.
        import importlib
        import uuid

        from django.apps import apps as global_apps

        from apps.broker.models import BrokerCommission
        from apps.wallets.services import credit_user_balance

        broker = _approved_broker("lbk6@ex.com")
        prop = self._prop("lprop6", rate=_D("3"))
        buyer = User.objects.create_user(email="lbuy6@ex.com", password="pw-12345-strong")
        inv = _completed_investment(buyer, prop, 10, broker=broker)
        # Parseable memo (rate 3%).
        credit_user_balance(
            broker.user, _D("30.00"), source="broker_commission", reference=str(inv.id),
            memo="Referral commission (3%): BRX1 of lprop6",
        )
        # Unparseable memo → must become legacy + null rate (never invented). (A real
        # reference is always a UUID; the rate-unparseable case is about the MEMO.)
        legacy_ref = str(uuid.uuid4())
        credit_user_balance(
            broker.user, _D("12.34"), source="broker_commission", reference=legacy_ref,
            memo="historical commission, no rate recorded",
        )
        self.assertEqual(BrokerCommission.objects.count(), 0)  # none yet

        mod = importlib.import_module("apps.broker.migrations.0003_backfill_broker_commission")
        mod.backfill(global_apps, None)

        parsed = BrokerCommission.objects.get(property_slug="lprop6")
        self.assertEqual(parsed.rate_applied, _D("3.00"))   # parsed from memo
        self.assertEqual(parsed.commission, _D("30.00"))    # money unchanged
        self.assertTrue(parsed.is_legacy)

        legacy = BrokerCommission.objects.get(balance_transaction__reference=legacy_ref)
        self.assertIsNone(legacy.rate_applied)              # NOT invented → null
        self.assertEqual(legacy.commission, _D("12.34"))
        self.assertTrue(legacy.is_legacy)

        # Re-running the backfill is idempotent (one row per balance_transaction).
        mod.backfill(global_apps, None)
        self.assertEqual(BrokerCommission.objects.count(), 2)

    def test_ledger_null_rate_shows_dash_not_zero(self, _m):
        # A legacy row with null rate must serialize rate=None (frontend "—"), never "0.00".
        import importlib
        import uuid

        from django.apps import apps as global_apps

        from apps.wallets.services import credit_user_balance

        broker = _approved_broker("lbk7@ex.com")
        credit_user_balance(
            broker.user, _D("9.99"), source="broker_commission", reference=str(uuid.uuid4()),
            memo="no rate here",
        )
        importlib.import_module(
            "apps.broker.migrations.0003_backfill_broker_commission"
        ).backfill(global_apps, None)

        self.client.force_authenticate(User.objects.get(pk=broker.user_id))
        res = self.client.get("/api/broker/commissions/")
        row = res.data["commissions"][0]
        self.assertIsNone(row["rate"])          # honest "—", NOT 0%
        self.assertTrue(row["is_legacy"])
        self.assertEqual(row["commission"], "9.99")

    def test_property_stats_broker_scoped_no_leak(self, _m):
        # Property X has THREE investors: I1 (referred by B1), I2 (NOT referred), I3
        # (referred by B2). B1's per-property stats must count ONLY I1 — never the
        # property's total base.
        b1 = _approved_broker("lb1@ex.com")
        b2 = _approved_broker("lb2@ex.com")
        prop = self._prop("lpropX", rate=_D("5"))
        i1 = User.objects.create_user(email="li1@ex.com", password="pw-12345-strong")
        i2 = User.objects.create_user(email="li2@ex.com", password="pw-12345-strong")
        i3 = User.objects.create_user(email="li3@ex.com", password="pw-12345-strong")
        mint_investment(_completed_investment(i1, prop, 10, broker=b1))  # 1000, B1
        mint_investment(_completed_investment(i2, prop, 7))              # 700, none
        mint_investment(_completed_investment(i3, prop, 5, broker=b2))   # 500, B2

        self.client.force_authenticate(User.objects.get(pk=b1.user_id))
        res = self.client.get("/api/broker/property-stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        stats = res.data["by_property"]["lpropX"]
        self.assertEqual(stats["conversions"], 1)        # only I1
        self.assertEqual(stats["investors"], 1)          # NOT 3 (no total-base leak)
        self.assertEqual(stats["raised"], 1000.0)        # only I1's amount, NOT 2200
        self.assertEqual(stats["commission"], "50.00")   # B1's stamped commission only
        self.assertIsNone(stats["leads"])                # Phase 2 → frontend "—"
        self.assertEqual(res.data["broker_rate"], "5.00")

    def test_property_stats_denies_non_broker(self, _m):
        plain = User.objects.create_user(email="lplain@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(plain)
        self.assertEqual(
            self.client.get("/api/broker/property-stats/").status_code,
            status.HTTP_403_FORBIDDEN,
        )
