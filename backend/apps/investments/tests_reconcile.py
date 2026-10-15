"""Finishing paid purchases whose units never arrived (apps/investments/reconcile.py)."""
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.core.models import User
from apps.payments.models import Payment
from apps.properties.models import Property, TokenMetadata
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import OwnershipToken, UserBalance, UserWallet
from apps.wallets.services import get_or_create_custodial_wallet

from .models import Investment, PaymentStatus
from .reconcile import reconcile


def _prop(slug="rec-1"):
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("100000")))
    p.save()
    return p


def _inv(user, prop, *, status=PaymentStatus.COMPLETED, minted=False, age_minutes=60, **extra):
    inv = Investment.objects.create(
        user=user, property=prop, property_name=prop.name, amount_invested=Decimal("500"),
        token_amount=5, token_symbol="BRX", price_per_token=prop.token_price,
        ownership_percentage=Decimal("0"), payment_method=extra.pop("payment_method", "card"),
        payment_status=status, tokens_minted=minted, **extra,
    )
    Investment.objects.filter(pk=inv.pk).update(
        updated_at=timezone.now() - timedelta(minutes=age_minutes)
    )
    return Investment.objects.get(pk=inv.pk)


def _holding(user, prop):
    return OwnershipToken.objects.filter(wallet__user=user, property_id=prop.slug).first()


class ReconcileTests(TestCase):
    def setUp(self):
        self.prop = _prop()
        self.user = User.objects.create_user(email="rec@ex.com", password="pw-12345-strong")
        get_or_create_custodial_wallet(self.user)

    def test_completed_but_unminted_gets_its_units(self):
        inv = _inv(self.user, self.prop)
        out = reconcile()
        self.assertEqual(out, {"minted": 1})
        inv.refresh_from_db()
        self.assertTrue(inv.tokens_minted)
        self.assertEqual(_holding(self.user, self.prop).token_amount, 5)
        self.assertEqual(reconcile(), {})  # idempotent

    def test_a_missing_wallet_is_created_first(self):
        other = User.objects.create_user(email="nowallet@ex.com", password="pw-12345-strong")
        inv = _inv(other, self.prop)
        self.assertEqual(reconcile(), {"minted": 1})
        self.assertTrue(UserWallet.objects.filter(user=other).exists())
        inv.refresh_from_db()
        self.assertTrue(inv.tokens_minted)

    def test_young_refunded_and_resale_rows_are_left_alone(self):
        _inv(self.user, self.prop, age_minutes=1)  # a webhook may still be on it
        _inv(self.user, self.prop, refunded_at=timezone.now(), refund_reason="expired")
        _inv(self.user, self.prop, payment_method="secondary_market")
        self.assertEqual(reconcile(), {})

    def test_succeeded_payment_on_an_unsettled_investment_is_settled(self):
        inv = _inv(self.user, self.prop, status=PaymentStatus.PROCESSING)
        Payment.objects.create(investment=inv, provider="stripe", amount=Decimal("500"),
                               currency="usd", status="succeeded")
        self.assertEqual(reconcile(), {"minted": 1})
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.COMPLETED)
        self.assertTrue(inv.tokens_minted)

    def test_paid_too_late_at_a_changed_price_is_refunded_not_minted(self):
        inv = _inv(self.user, self.prop, status=PaymentStatus.PROCESSING,
                   reserved_until=timezone.now() - timedelta(hours=2))
        Payment.objects.create(investment=inv, provider="stripe", amount=Decimal("500"),
                               currency="usd", status="succeeded")
        Property.objects.filter(pk=self.prop.pk).update(token_price=Decimal("110"))
        out = reconcile()
        self.assertEqual(list(out), ["refunded_price_changed"])
        inv.refresh_from_db()
        self.assertFalse(inv.tokens_minted)
        self.assertIsNotNone(inv.refunded_at)
        self.assertGreater(UserBalance.objects.get(user=self.user).current_balance, 0)

    def test_a_pending_investment_without_money_is_not_touched(self):
        _inv(self.user, self.prop, status=PaymentStatus.PENDING)
        self.assertEqual(reconcile(), {})

    def test_never_mints_twice_when_the_chain_already_has_the_units(self):
        meta, _ = TokenMetadata.objects.get_or_create(property=self.prop)
        meta.deployed_contract_address = "0x" + "11" * 20
        meta.deployment_chain_id = 97
        meta.save()
        inv = _inv(self.user, self.prop)
        with mock.patch("apps.investments.reconcile.chain_service.read_balance", return_value=5), \
                mock.patch("apps.investments.services.chain_service.mint") as m_mint, \
                self.settings(CHAIN_ID=97):
            out = reconcile()
        self.assertEqual(out, {"needs_review": 1})
        m_mint.assert_not_called()
        inv.refresh_from_db()
        self.assertFalse(inv.tokens_minted)

    def test_one_failure_does_not_stop_the_rest(self):
        first = _inv(self.user, self.prop, age_minutes=120)
        second = _inv(self.user, self.prop, age_minutes=90)
        real = __import__("apps.investments.reconcile", fromlist=["mint_investment"]).mint_investment

        def flaky(inv):
            if inv.pk == first.pk:
                raise RuntimeError("chain down")
            return real(inv)

        with mock.patch("apps.investments.reconcile.mint_investment", side_effect=flaky):
            out = reconcile()
        self.assertEqual(out, {"error": 1, "minted": 1})
        second.refresh_from_db()
        self.assertTrue(second.tokens_minted)

    def test_dry_run_changes_nothing(self):
        inv = _inv(self.user, self.prop)
        out = StringIO()
        call_command("reconcile_investments", "--dry-run", stdout=out)
        self.assertIn("would_mint=1", out.getvalue())
        inv.refresh_from_db()
        self.assertFalse(inv.tokens_minted)
