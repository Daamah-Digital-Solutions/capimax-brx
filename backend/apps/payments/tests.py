"""
Stripe payments tests — Phase 5 Wave 1. Run against Postgres (capimax_brx).

Covers the real-money safety constraints:
  * create-intent requires auth + approved KYC; 503 when Stripe is deferred.
  * Webhook signature verification: valid succeeded → payment completed + mint
    triggered; failed → no mint; BAD signature → 400, no state change; unconfigured
    → 503.
  * Idempotency: a duplicate succeeded webhook mints EXACTLY once.
  * The card method no longer auto-completes/mints at creation (payment-gated).
  * RAW CARD DATA never reaches the backend (no card fields on the model/serializer).
"""
import json
import tempfile
from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import create_investment
from apps.kyc.services import get_or_create_kyc
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import (
    BalanceTransaction,
    OwnershipToken,
    UserWallet,
    WalletTransaction,
)
from apps.wallets.services import get_or_create_custodial_wallet

from . import nowpayments_service, stripe_service
from .models import Payment, PaymentState, SukukCertificate
from .services import (
    get_or_create_payment,
    mark_payment_failed,
    process_successful_payment,
)
from .sukuk_service import approve_certificate, reject_certificate

_SUKUK_MEDIA = tempfile.mkdtemp()

_WEBHOOK_SECRET = "whsec_test_secret"
_FAKE_TX = "0x" + "ef" * 32
_FAKE_BLOCK = 7777


def _fake_mint(contract_address, to_address, amount):
    return {"tx_hash": _FAKE_TX, "block_number": _FAKE_BLOCK, "chain_id": 97,
            "to": to_address, "amount": amount, "token_address": contract_address}


def _deployed_property(slug="1"):
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("5000000")))
    p.save()  # token_supply = 50000
    meta, _ = TokenMetadata.objects.get_or_create(property=p)
    meta.deployed_contract_address = "0x" + "11" * 20
    meta.deployment_chain_id = 97
    meta.deployment_network = "bsc-testnet"
    meta.save()
    return p


def _approved_user(email):
    u = User.objects.create_user(email=email, password="pw-12345-strong")
    kyc = get_or_create_kyc(u)
    kyc.mark_approved()
    kyc.save()
    return u


# --------------------------------------------------------------------------- #
# Card method no longer auto-completes; other methods unchanged
# --------------------------------------------------------------------------- #
class CardDefersPaymentTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property("1")

    def test_card_investment_stays_pending_and_does_not_mint(self):
        user = _approved_user("card@example.com")
        get_or_create_custodial_wallet(user)  # wallet exists, yet card must NOT mint
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            res = create_investment(user=user, prop=self.prop, token_amount=2,
                                    payment_method="card")
        inv = res["investment"]
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)
        self.assertFalse(res["tokens_minted"])
        self.assertTrue(res["payment_required"])
        m.assert_not_called()  # no mint at creation
        self.assertFalse(OwnershipToken.objects.filter(wallet__user=user).exists())

    def test_crypto_investment_also_defers_and_does_not_mint(self):
        user = _approved_user("crypto@example.com")
        get_or_create_custodial_wallet(user)
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            res = create_investment(user=user, prop=self.prop, token_amount=2,
                                    payment_method="crypto")
        self.assertEqual(res["investment"].payment_status, PaymentStatus.PENDING)
        self.assertTrue(res["payment_required"])
        m.assert_not_called()

    def test_pronova_defers_like_card_and_does_not_mint(self):
        # Pronova now settles over the Stripe rail (for the DISCOUNTED total), so it DEFERS
        # exactly like card/crypto — no auto-complete, no mint at creation.
        user = _approved_user("pronova@example.com")
        get_or_create_custodial_wallet(user)
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            res = create_investment(user=user, prop=self.prop, token_amount=2,
                                    payment_method="pronova")
        self.assertEqual(res["investment"].payment_status, PaymentStatus.PENDING)
        self.assertTrue(res["payment_required"])
        m.assert_not_called()


# --------------------------------------------------------------------------- #
# create-intent endpoint: auth + KYC + deferred-keys behaviour
# --------------------------------------------------------------------------- #
class CreateIntentTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property("1")

    def _card_investment(self, user):
        res = create_investment(user=user, prop=self.prop, token_amount=2,
                                payment_method="card")
        return res["investment"]

    def test_requires_auth(self):
        resp = self.client.post("/api/payments/stripe/create-intent/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_requires_kyc(self):
        user = User.objects.create_user(email="nokyc@example.com", password="pw-12345-strong")
        self.client.force_authenticate(user)
        resp = self.client.post(
            "/api/payments/stripe/create-intent/",
            {"investment_id": "00000000-0000-0000-0000-000000000000"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_unconfigured_returns_503(self):
        user = _approved_user("noconf@example.com")
        inv = self._card_investment(user)
        self.client.force_authenticate(user)
        resp = self.client.post("/api/payments/stripe/create-intent/",
                                {"investment_id": str(inv.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "stripe_unconfigured")

    @override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_PUBLISHABLE_KEY="pk_test_x")
    def test_creates_intent_when_configured(self):
        user = _approved_user("ok@example.com")
        inv = self._card_investment(user)
        self.client.force_authenticate(user)
        fake = {"id": "pi_test_123", "client_secret": "pi_test_123_secret_abc"}
        with mock.patch("apps.payments.stripe_service.create_payment_intent", return_value=fake):
            resp = self.client.post("/api/payments/stripe/create-intent/",
                                    {"investment_id": str(inv.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["client_secret"], "pi_test_123_secret_abc")
        self.assertEqual(resp.data["publishable_key"], "pk_test_x")
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.PROCESSING)
        pay = Payment.objects.get(investment=inv)
        self.assertEqual(pay.stripe_payment_intent_id, "pi_test_123")

    @override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_PUBLISHABLE_KEY="pk_test_x")
    def test_creates_intent_for_pronova_charges_discounted_settlement(self):
        # Pronova reuses the SAME Stripe intent endpoint (distinct method), charging the
        # DISCOUNTED settlement_amount — NOT value + fee.
        user = _approved_user("pron-intent@example.com")
        res = create_investment(user=user, prop=self.prop, token_amount=2,
                                payment_method="pronova")
        inv = res["investment"]
        self.client.force_authenticate(user)
        fake = {"id": "pi_pron_1", "client_secret": "pi_pron_1_secret"}
        with mock.patch("apps.payments.stripe_service.create_payment_intent",
                        return_value=fake) as pi:
            resp = self.client.post("/api/payments/stripe/create-intent/",
                                    {"investment_id": str(inv.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.PROCESSING)
        # The Payment + the Stripe charge are the DISCOUNTED settlement (discount applied).
        pay = Payment.objects.get(investment=inv)
        self.assertEqual(pay.amount, inv.settlement_amount)
        self.assertEqual(pi.call_args.kwargs["amount"], inv.settlement_amount)
        self.assertLess(inv.settlement_amount, inv.amount_invested + inv.fee_amount)


# --------------------------------------------------------------------------- #
# Webhook → completion + mint (signature-verified, idempotent)
# --------------------------------------------------------------------------- #
@override_settings(STRIPE_WEBHOOK_SECRET=_WEBHOOK_SECRET)
class StripeWebhookTests(APITestCase):
    url = "/api/payments/stripe/webhook/"

    def setUp(self):
        self.prop = _deployed_property("1")
        self.user = _approved_user("buyer@example.com")
        get_or_create_custodial_wallet(self.user)
        res = create_investment(user=self.user, prop=self.prop, token_amount=3,
                                payment_method="card")
        self.inv = res["investment"]
        self.payment = get_or_create_payment(
            self.inv, amount=self.inv.amount_invested, currency="usd")
        self.payment.stripe_payment_intent_id = "pi_hook_1"
        self.payment.save(update_fields=["stripe_payment_intent_id"])

    def _post(self, event: dict, *, sign=True, bad=False):
        raw = json.dumps(event).encode()
        headers = {}
        if sign:
            sig = "t=12345,v1=deadbeef" if bad else stripe_service.sign_payload(raw, "12345")
            headers["HTTP_STRIPE_SIGNATURE"] = sig
        return self.client.post(self.url, data=raw, content_type="application/json", **headers)

    @staticmethod
    def _succeeded(pi="pi_hook_1"):
        return {"type": "payment_intent.succeeded", "data": {"object": {"id": pi}}}

    def test_valid_succeeded_completes_and_mints(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint):
            resp = self._post(self._succeeded())
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db(); self.inv.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentState.SUCCEEDED)
        self.assertEqual(self.inv.payment_status, PaymentStatus.COMPLETED)
        self.assertTrue(self.inv.tokens_minted)
        tx = WalletTransaction.objects.get(wallet__user=self.user)
        self.assertEqual(tx.tx_hash, _FAKE_TX)  # REAL (mocked) hash, never fabricated

    def test_duplicate_webhook_mints_exactly_once(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            self._post(self._succeeded())
            self._post(self._succeeded())  # Stripe re-delivery
        # One ownership position with exactly the invested amount; mint called once.
        tok = OwnershipToken.objects.get(wallet__user=self.user)
        self.assertEqual(tok.token_amount, 3)
        self.assertEqual(m.call_count, 1)
        self.assertEqual(WalletTransaction.objects.filter(wallet__user=self.user).count(), 1)

    def test_bad_signature_rejected_no_state_change(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            resp = self._post(self._succeeded(), bad=True)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.payment.refresh_from_db(); self.inv.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentState.PENDING)
        self.assertFalse(self.inv.tokens_minted)
        m.assert_not_called()

    def test_failed_event_marks_failed_no_mint(self):
        event = {"type": "payment_intent.payment_failed",
                 "data": {"object": {"id": "pi_hook_1",
                                     "last_payment_error": {"message": "card declined"}}}}
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            resp = self._post(event)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db(); self.inv.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentState.FAILED)
        self.assertEqual(self.inv.payment_status, PaymentStatus.FAILED)
        self.assertFalse(self.inv.tokens_minted)
        m.assert_not_called()

    @override_settings(STRIPE_WEBHOOK_SECRET="")
    def test_unconfigured_webhook_returns_503(self):
        resp = self._post(self._succeeded(), sign=False)
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


# --------------------------------------------------------------------------- #
# No raw card data anywhere on the backend (PCI)
# --------------------------------------------------------------------------- #
class NoCardDataTests(APITestCase):
    def test_payment_model_has_no_card_fields(self):
        names = {f.name for f in Payment._meta.get_fields()}
        for forbidden in ("card_number", "pan", "cvv", "card_cvc", "card", "cardholder"):
            self.assertNotIn(forbidden, names)

    def test_serializer_exposes_no_card_fields(self):
        from .serializers import PaymentSerializer
        fields = set(PaymentSerializer.Meta.fields)
        self.assertTrue(fields.isdisjoint({"card_number", "pan", "cvv", "cardholder"}))


# --------------------------------------------------------------------------- #
# NOW Payments (Wave 2) — create-intent + IPN → completion + mint
# --------------------------------------------------------------------------- #
_IPN_SECRET = "now_ipn_secret_xyz"


class CreateNowPaymentsTests(APITestCase):
    def setUp(self):
        self.prop = _deployed_property("1")

    def _crypto_investment(self, user):
        return create_investment(user=user, prop=self.prop, token_amount=2,
                                 payment_method="crypto")["investment"]

    def test_requires_kyc(self):
        user = User.objects.create_user(email="nk@example.com", password="pw-12345-strong")
        self.client.force_authenticate(user)
        resp = self.client.post("/api/payments/nowpayments/create/",
                                {"investment_id": "00000000-0000-0000-0000-000000000000",
                                 "pay_currency": "btc"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_unconfigured_returns_503(self):
        user = _approved_user("nc@example.com")
        inv = self._crypto_investment(user)
        self.client.force_authenticate(user)
        resp = self.client.post("/api/payments/nowpayments/create/",
                                {"investment_id": str(inv.id), "pay_currency": "btc"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data["code"], "nowpayments_unconfigured")

    @override_settings(NOWPAYMENTS_API_KEY="np_test_key")
    def test_creates_payment_when_configured(self):
        user = _approved_user("nok@example.com")
        inv = self._crypto_investment(user)
        self.client.force_authenticate(user)
        fake = {"payment_id": "np_123", "pay_address": "bc1qtestaddr",
                "pay_amount": "0.00042000", "pay_currency": "btc",
                "payment_status": "waiting"}
        with mock.patch("apps.payments.nowpayments_service.create_payment", return_value=fake):
            resp = self.client.post("/api/payments/nowpayments/create/",
                                    {"investment_id": str(inv.id), "pay_currency": "btc"},
                                    format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["pay_address"], "bc1qtestaddr")
        self.assertEqual(resp.data["payment_id"], "np_123")
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.PROCESSING)
        pay = Payment.objects.get(investment=inv, provider="nowpayments")
        self.assertEqual(pay.nowpayments_payment_id, "np_123")
        self.assertEqual(pay.pay_address, "bc1qtestaddr")


@override_settings(NOWPAYMENTS_IPN_SECRET=_IPN_SECRET)
class NowPaymentsIpnTests(APITestCase):
    url = "/api/payments/nowpayments/ipn/"

    def setUp(self):
        self.prop = _deployed_property("1")
        self.user = _approved_user("cryptobuyer@example.com")
        get_or_create_custodial_wallet(self.user)
        res = create_investment(user=self.user, prop=self.prop, token_amount=3,
                                payment_method="crypto")
        self.inv = res["investment"]
        self.payment = get_or_create_payment(
            self.inv, amount=self.inv.amount_invested, currency="usd",
            provider="nowpayments")
        self.payment.nowpayments_payment_id = "np_ipn_1"
        self.payment.save(update_fields=["nowpayments_payment_id"])

    def _post(self, status_value, *, sign=True, bad=False):
        payload = {"payment_id": "np_ipn_1", "payment_status": status_value,
                   "order_id": str(self.payment.id), "actually_paid": 1}
        raw = json.dumps(payload).encode()
        headers = {}
        if sign:
            sig = "0" * 128 if bad else nowpayments_service.sign_ipn(payload)
            headers["HTTP_X_NOWPAYMENTS_SIG"] = sig
        return self.client.post(self.url, data=raw, content_type="application/json", **headers)

    def test_finished_completes_and_mints(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint):
            resp = self._post("finished")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db(); self.inv.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentState.SUCCEEDED)
        self.assertEqual(self.inv.payment_status, PaymentStatus.COMPLETED)
        self.assertTrue(self.inv.tokens_minted)
        self.assertEqual(WalletTransaction.objects.get(wallet__user=self.user).tx_hash, _FAKE_TX)

    def test_idempotent_across_status_sequence_mints_once(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            self._post("waiting")       # no mint
            self._post("confirming")    # no mint
            self._post("finished")      # mint
            self._post("finished")      # re-delivery — must NOT double-mint
        self.assertEqual(m.call_count, 1)
        tok = OwnershipToken.objects.get(wallet__user=self.user)
        self.assertEqual(tok.token_amount, 3)
        self.assertEqual(WalletTransaction.objects.filter(wallet__user=self.user).count(), 1)

    def test_partially_paid_does_not_mint(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            resp = self._post("partially_paid")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.inv.refresh_from_db()
        self.assertFalse(self.inv.tokens_minted)
        m.assert_not_called()

    def test_expired_marks_failed_no_mint(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            resp = self._post("expired")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db(); self.inv.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentState.FAILED)
        self.assertEqual(self.inv.payment_status, PaymentStatus.FAILED)
        m.assert_not_called()

    def test_bad_signature_rejected_no_state_change(self):
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            resp = self._post("finished", bad=True)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.payment.refresh_from_db(); self.inv.refresh_from_db()
        self.assertEqual(self.payment.status, PaymentState.PENDING)
        self.assertFalse(self.inv.tokens_minted)
        m.assert_not_called()

    @override_settings(NOWPAYMENTS_IPN_SECRET="")
    def test_unconfigured_ipn_returns_503(self):
        resp = self._post("finished", sign=False)
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


# --------------------------------------------------------------------------- #
# DEPOSIT / top-up — gated external pay-in that CREDITS the balance (no mint).
# --------------------------------------------------------------------------- #
class DepositTests(APITestCase):
    """Deposit credits UserBalance via the SAME gated completion core; never mints."""

    def setUp(self):
        from apps.wallets.models import Deposit

        self.Deposit = Deposit
        self.user = _approved_user("dep@example.com")

    def _balance(self, user):
        from apps.wallets.models import UserBalance

        bal = UserBalance.objects.filter(user=user).first()
        return bal.current_balance if bal else Decimal("0")

    def _pending_deposit_payment(self, amount="500.00", intent="pi_dep_1"):
        deposit = self.Deposit.objects.create(
            user=self.user, amount=Decimal(amount), payment_method="card"
        )
        payment = Payment.objects.create(
            deposit=deposit, provider="stripe", amount=Decimal(amount), currency="usd",
            stripe_payment_intent_id=intent,
        )
        return deposit, payment

    # --- settlement-gated: nothing credited before the webhook completes -------- #
    def test_deposit_not_credited_before_completion(self):
        self._pending_deposit_payment()
        self.assertEqual(self._balance(self.user), Decimal("0"))

    # --- confirmed deposit credits the balance exactly, source="deposit", no mint #
    def test_confirmed_deposit_credits_balance_exactly_no_mint(self):
        from apps.wallets.models import BalanceTransaction

        deposit, _payment = self._pending_deposit_payment(amount="750.00", intent="pi_dep_2")
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint) as m:
            res = process_successful_payment("pi_dep_2")

        self.assertTrue(res["processed"])
        self.assertFalse(res["minted"])
        self.assertTrue(res["credited"])
        self.assertEqual(self._balance(self.user), Decimal("750.00"))
        deposit.refresh_from_db()
        self.assertTrue(deposit.credited)
        self.assertEqual(deposit.status, self.Deposit.Status.COMPLETED)
        # The ledger row is a CREDIT tagged source="deposit".
        tx = BalanceTransaction.objects.get(source="deposit")
        self.assertEqual(tx.entry_type, BalanceTransaction.EntryType.CREDIT)
        self.assertEqual(tx.amount, Decimal("750.00"))
        # NO mint, NO tokens, NO investment created.
        m.assert_not_called()
        self.assertFalse(OwnershipToken.objects.filter(wallet__user=self.user).exists())
        self.assertFalse(Investment.objects.filter(user=self.user).exists())

    # --- idempotent: replayed webhook does NOT double-credit -------------------- #
    def test_replayed_completion_does_not_double_credit(self):
        from apps.wallets.models import BalanceTransaction

        self._pending_deposit_payment(amount="200.00", intent="pi_dep_3")
        first = process_successful_payment("pi_dep_3")
        second = process_successful_payment("pi_dep_3")  # webhook re-delivery

        self.assertTrue(first["credited"])
        self.assertFalse(second["credited"])  # second is a no-op
        self.assertEqual(self._balance(self.user), Decimal("200.00"))  # credited ONCE
        self.assertEqual(BalanceTransaction.objects.filter(source="deposit").count(), 1)

    # --- failed deposit credits nothing ---------------------------------------- #
    def test_failed_deposit_does_not_credit(self):
        deposit, _payment = self._pending_deposit_payment(amount="123.00", intent="pi_dep_4")
        mark_payment_failed("pi_dep_4", reason="card declined")
        self.assertEqual(self._balance(self.user), Decimal("0"))
        deposit.refresh_from_db()
        self.assertEqual(deposit.status, self.Deposit.Status.FAILED)

    # --- LP-targeted deposit credits the LP operating balance, NOT the wallet ---- #
    def test_lp_targeted_deposit_credits_lp_balance_not_wallet(self):
        from apps.lp.models import LiquidityProvider, LPStatus, LPTransaction

        lp = LiquidityProvider.objects.create(
            user=self.user, contact_name="LP One", email="dep@example.com",
            status=LPStatus.APPROVED, current_balance=Decimal("0"),
            total_deposited=Decimal("0"),
        )
        deposit = self.Deposit.objects.create(
            user=self.user, amount=Decimal("2500.00"), payment_method="card",
            target=self.Deposit.Target.LP,
        )
        Payment.objects.create(
            deposit=deposit, provider="stripe", amount=Decimal("2500.00"),
            currency="usd", stripe_payment_intent_id="pi_dep_lp_1",
        )
        res = process_successful_payment("pi_dep_lp_1")

        self.assertTrue(res["credited"])
        # LP operating balance + total_deposited rose by the deposit amount.
        lp.refresh_from_db()
        self.assertEqual(lp.current_balance, Decimal("2500.00"))
        self.assertEqual(lp.total_deposited, Decimal("2500.00"))
        # An LP ledger row records the deposit (visible in the LP transactions view).
        self.assertTrue(
            LPTransaction.objects.filter(
                lp=lp, tx_type="deposit", amount=Decimal("2500.00")
            ).exists()
        )
        # The ordinary wallet balance is a SEPARATE ledger and was NOT touched.
        self.assertEqual(self._balance(self.user), Decimal("0"))
        deposit.refresh_from_db()
        self.assertTrue(deposit.credited)

    # --- LP deposit endpoint rejects a user with no approved LP profile --------- #
    def test_lp_deposit_endpoint_requires_approved_lp(self):
        # self.user is KYC-approved but is NOT a Liquidity Provider → 400 (before any PSP).
        self.client.force_authenticate(self.user)
        resp = self.client.post(
            "/api/payments/deposit/stripe/",
            {"amount": "100", "target": "lp"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --- endpoint: KYC-gated, honest 503 when keys deferred (no silent success) - #
    def test_create_endpoint_requires_kyc(self):
        nokyc = User.objects.create_user(email="depnokyc@example.com", password="pw-12345-strong")
        self.client.force_authenticate(nokyc)
        resp = self.client.post("/api/payments/deposit/stripe/", {"amount": "100"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(STRIPE_SECRET_KEY="", STRIPE_PUBLISHABLE_KEY="")
    def test_create_endpoint_unconfigured_returns_503_no_deposit_row(self):
        self.client.force_authenticate(self.user)
        resp = self.client.post("/api/payments/deposit/stripe/", {"amount": "100"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.json().get("code"), "stripe_unconfigured")
        # Honest not-configured: no Deposit/Payment row leaked, no balance touched.
        self.assertFalse(self.Deposit.objects.filter(user=self.user).exists())
        self.assertEqual(self._balance(self.user), Decimal("0"))

    def test_create_endpoint_rejects_bad_amount(self):
        self.client.force_authenticate(self.user)
        for bad in ("0", "-5", "abc", ""):
            resp = self.client.post("/api/payments/deposit/stripe/", {"amount": bad}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, bad)


# --------------------------------------------------------------------------- #
# Nova certificate (sukuk) — the manual, admin-approved payment rail.
# --------------------------------------------------------------------------- #
def _ledger_owned_property(owner, slug="sukuk-prop"):
    """A published LEDGER property (no on-chain contract) owned by `owner`, default fees."""
    p = Property(**_valid_property_kwargs(
        slug=slug, model="ready", category="ready",
        total_value=Decimal("5000000"), token_price=Decimal("100"), is_published=True,
    ))
    p.submitted_by = owner
    p.save()  # default fees 1.5% + 0.5% = 2%; no TokenMetadata → ledger mint (no chain)
    return p


@override_settings(MEDIA_ROOT=_SUKUK_MEDIA)
class SukukCertificateFlowTests(APITestCase):
    """
    Nova certificate (sukuk): create defers (PENDING, no mint); the buyer uploads a PDF;
    admin approval SETTLES via the shared settle_investment (mint + owner credit + the
    buyer-borne fee); rejection FAILS it (never mints) + notifies. Ledger property → the
    mint needs no chain mock. Fees 2% → owner nets the full token value (Option A).
    """

    def setUp(self):
        self.owner = User.objects.create_user(email="owner-sk@ex.com", password="pw-12345-strong")
        self.investor = _approved_user("inv-sk@ex.com")
        get_or_create_custodial_wallet(self.investor)
        self.prop = _ledger_owned_property(self.owner)

    def _make_sukuk_investment(self, tokens=10):
        res = create_investment(
            user=self.investor, prop=self.prop, token_amount=tokens, payment_method="sukuk",
        )
        return res["investment"]

    def _pdf(self, name="cert.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4 fake certificate", content_type="application/pdf")

    def test_sukuk_create_defers_no_mint(self):
        inv = self._make_sukuk_investment()
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)  # awaiting review
        self.assertFalse(inv.tokens_minted)
        self.assertEqual(inv.fee_amount, Decimal("20.00"))           # 2% of $1000
        self.assertEqual(inv.settlement_amount, Decimal("1020.00"))  # value + fee
        self.assertFalse(OwnershipToken.objects.filter(wallet__user=self.investor).exists())

    def test_owner_uploads_certificate_stays_pending(self):
        inv = self._make_sukuk_investment()
        self.client.force_authenticate(self.investor)
        resp = self.client.post(
            f"/api/payments/sukuk/{inv.id}/certificate/",
            {"file": self._pdf(), "sukuk_id": "NOVA-1", "issuer": "Nova Digital Finance",
             "claimed_value": "1020"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        cert = SukukCertificate.objects.get(investment=inv)
        self.assertEqual(cert.status, SukukCertificate.Status.PENDING)
        self.assertEqual(cert.sukuk_id, "NOVA-1")
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.PENDING)  # upload never mints
        self.assertFalse(inv.tokens_minted)

    def test_upload_rejects_non_pdf(self):
        inv = self._make_sukuk_investment()
        self.client.force_authenticate(self.investor)
        bad = SimpleUploadedFile("cert.txt", b"nope", content_type="text/plain")
        resp = self.client.post(
            f"/api/payments/sukuk/{inv.id}/certificate/", {"file": bad}, format="multipart"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(SukukCertificate.objects.filter(investment=inv).exists())

    def test_upload_rejects_second_certificate(self):
        inv = self._make_sukuk_investment()
        SukukCertificate.objects.create(investment=inv, file=self._pdf())
        self.client.force_authenticate(self.investor)
        resp = self.client.post(
            f"/api/payments/sukuk/{inv.id}/certificate/", {"file": self._pdf()}, format="multipart"
        )
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_approve_settles_mints_and_credits_owner_full_value(self):
        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(investment=inv, file=self._pdf())
        admin = User.objects.create_superuser(email="admin-sk@ex.com", password="pw-12345-strong")

        result = approve_certificate(cert, admin)
        self.assertTrue(result["approved"])
        self.assertTrue(result["minted"])

        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.COMPLETED)
        self.assertTrue(inv.tokens_minted)
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 10)
        # Buyer-borne fee (Option A): the owner is credited the FULL token value ($1000).
        bt = BalanceTransaction.objects.get(source="primary_sale", reference=str(inv.id))
        self.assertEqual(bt.amount, Decimal("1000.00"))
        cert.refresh_from_db()
        self.assertEqual(cert.status, SukukCertificate.Status.APPROVED)
        self.assertEqual(cert.reviewed_by, admin)
        self.assertIsNotNone(cert.reviewed_at)

    def test_reject_fails_investment_no_mint_and_notifies(self):
        from apps.notifications.models import Notification

        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(
            investment=inv, file=self._pdf(), review_notes="Certificate could not be verified"
        )
        admin = User.objects.create_superuser(email="admin-sk2@ex.com", password="pw-12345-strong")

        reject_certificate(cert, admin)

        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.FAILED)
        self.assertFalse(inv.tokens_minted)
        self.assertFalse(OwnershipToken.objects.filter(wallet__user=self.investor).exists())
        cert.refresh_from_db()
        self.assertEqual(cert.status, SukukCertificate.Status.REJECTED)
        self.assertTrue(
            Notification.objects.filter(user=self.investor, type="sukuk_rejected").exists()
        )

    def test_approve_is_idempotent(self):
        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(investment=inv, file=self._pdf())
        admin = User.objects.create_superuser(email="admin-sk3@ex.com", password="pw-12345-strong")

        approve_certificate(cert, admin)
        again = approve_certificate(cert, admin)
        self.assertTrue(again.get("already"))
        # No double-credit, no double-mint.
        self.assertEqual(
            BalanceTransaction.objects.filter(source="primary_sale", reference=str(inv.id)).count(), 1
        )
        token = OwnershipToken.objects.get(wallet__user=self.investor, property_id=self.prop.slug)
        self.assertEqual(token.token_amount, 10)

    def test_reject_after_approve_does_not_downgrade(self):
        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(investment=inv, file=self._pdf())
        admin = User.objects.create_superuser(email="admin-sk5@ex.com", password="pw-12345-strong")
        approve_certificate(cert, admin)
        res = reject_certificate(cert, admin)  # a settled cert must not be un-settled
        self.assertTrue(res.get("already_approved"))
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.COMPLETED)  # still settled
        self.assertTrue(inv.tokens_minted)

    def test_non_owner_cannot_upload_or_download(self):
        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(investment=inv, file=self._pdf())
        other = _approved_user("other-sk@ex.com")

        # Upload against someone else's investment → 404 (not found for this user).
        self.client.force_authenticate(other)
        up = self.client.post(
            f"/api/payments/sukuk/{inv.id}/certificate/", {"file": self._pdf()}, format="multipart"
        )
        self.assertEqual(up.status_code, status.HTTP_404_NOT_FOUND)
        # Download someone else's certificate → 404 (don't reveal existence).
        dl = self.client.get(f"/api/payments/sukuk/{cert.id}/file/")
        self.assertEqual(dl.status_code, status.HTTP_404_NOT_FOUND)

        # The owning buyer CAN download their own certificate.
        self.client.force_authenticate(self.investor)
        self.assertEqual(
            self.client.get(f"/api/payments/sukuk/{cert.id}/file/").status_code, status.HTTP_200_OK
        )
        # A staff reviewer CAN download it.
        admin = User.objects.create_superuser(email="admin-sk4@ex.com", password="pw-12345-strong")
        self.client.force_authenticate(admin)
        self.assertEqual(
            self.client.get(f"/api/payments/sukuk/{cert.id}/file/").status_code, status.HTTP_200_OK
        )

    def test_sukuk_investments_list_reflects_state(self):
        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(investment=inv, file=self._pdf())
        self.client.force_authenticate(self.investor)

        # Under review while pending.
        rows = self.client.get("/api/investments/sukuk/").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["state"], "under_review")
        self.assertEqual(rows[0]["token_amount"], 10)
        self.assertEqual(rows[0]["settlement_amount"], 1020.0)

        # Rejected → shows with the reason.
        admin = User.objects.create_superuser(email="admin-list@ex.com", password="pw-12345-strong")
        reject_certificate(cert, admin, reason="Certificate could not be verified")
        rows = self.client.get("/api/investments/sukuk/").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["state"], "rejected")
        self.assertEqual(rows[0]["review_notes"], "Certificate could not be verified")

    def test_sukuk_investments_list_excludes_approved(self):
        inv = self._make_sukuk_investment()
        cert = SukukCertificate.objects.create(investment=inv, file=self._pdf())
        admin = User.objects.create_superuser(email="admin-list2@ex.com", password="pw-12345-strong")
        approve_certificate(cert, admin)  # settles → a real holding, not a review row
        self.client.force_authenticate(self.investor)
        self.assertEqual(self.client.get("/api/investments/sukuk/").data, [])
