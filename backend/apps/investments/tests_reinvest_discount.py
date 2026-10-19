"""Reinvestment discount: 5% on a full purchase paid from the wallet, 7.5% for family owners."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.core.models import User
from apps.family.models import FamilyAccount
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from .services import create_investment


def _prop(slug):
    owner = User.objects.create_user(email=f"owner-{slug}@ex.com", password="pw-12345-strong")
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("10000"), token_price=Decimal("100")))
    p.submitted_by = owner
    p.fee_platform = Decimal("0")
    p.fee_management = Decimal("0")
    p.save()
    return p, owner


class ReinvestDiscountTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="re@ex.com", password="pw-12345-strong")
        get_or_create_custodial_wallet(self.user)
        credit_user_balance(self.user, Decimal("5000"), source="test")

    def _debit(self, inv):
        return BalanceTransaction.objects.get(source="reinvestment", reference=str(inv.id)).amount

    def test_wallet_purchase_gets_five_percent_and_the_owner_still_gets_full_value(self):
        prop, owner = _prop("re-1")
        inv = create_investment(user=self.user, prop=prop, token_amount=10, payment_method="balance")["investment"]
        self.assertEqual(inv.discount_amount, Decimal("50.00"))
        self.assertEqual(self._debit(inv), Decimal("950.00"))
        self.assertEqual(
            BalanceTransaction.objects.get(balance__user=owner, source="primary_sale").amount,
            Decimal("1000.00"),
        )

    def test_family_rate_needs_an_active_family_member(self):
        prop, _ = _prop("re-2")
        with self.assertRaises(ValidationError):
            create_investment(user=self.user, prop=prop, token_amount=10,
                              payment_method="balance", reinvest_mode="family")
        FamilyAccount.objects.create(investor=self.user, member_name="Sara", member_email="s@ex.com",
                                     relationship="daughter", status="active")
        inv = create_investment(user=self.user, prop=prop, token_amount=10,
                                payment_method="balance", reinvest_mode="family")["investment"]
        self.assertEqual(inv.discount_amount, Decimal("75.00"))
        self.assertEqual(self._debit(inv), Decimal("925.00"))

    def test_card_purchases_are_not_discounted(self):
        prop, _ = _prop("re-3")
        inv = create_investment(user=self.user, prop=prop, token_amount=10, payment_method="card")["investment"]
        self.assertEqual(inv.discount_amount, Decimal("0"))
