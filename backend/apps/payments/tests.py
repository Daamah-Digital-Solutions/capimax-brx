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
from decimal import Decimal
from unittest import mock

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import create_investment
from apps.kyc.services import get_or_create_kyc
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import OwnershipToken, UserWallet, WalletTransaction
from apps.wallets.services import get_or_create_custodial_wallet

from . import nowpayments_service, stripe_service
from .models import Payment, PaymentState
from .services import (
    get_or_create_payment,
    mark_payment_failed,
    process_successful_payment,
)

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

    def test_non_card_method_still_completes_and_mints(self):
        user = _approved_user("pronova@example.com")
        get_or_create_custodial_wallet(user)
        with mock.patch("apps.chain.service.mint", side_effect=_fake_mint):
            res = create_investment(user=user, prop=self.prop, token_amount=2,
                                    payment_method="pronova")
        self.assertEqual(res["investment"].payment_status, PaymentStatus.COMPLETED)
        self.assertTrue(res["tokens_minted"])
        self.assertFalse(res["payment_required"])


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
