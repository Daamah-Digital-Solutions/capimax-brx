"""
Reinvestment discount (client rules): paying from the wallet is just a payment method — full
price and fees. Only the explicit "Reinvest returns" path is discounted (5%, 7.5% for family
owners), and only on the part of the unit value the investor's own returns (distributions)
cover; the same returns are never discounted twice.
"""
from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.core.models import User
from apps.family.models import FamilyAccount
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import BalanceTransaction
from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet

from .services import available_returns, create_investment


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
        credit_user_balance(self.user, Decimal("5000"), source="deposit")

    def _debit(self, inv):
        return BalanceTransaction.objects.get(source="reinvestment", reference=str(inv.id)).amount

    def _buy(self, prop, **kw):
        return create_investment(user=self.user, prop=prop, token_amount=10, payment_method="balance", **kw)["investment"]

    def test_a_wallet_purchase_pays_full_price(self):
        prop, _ = _prop("re-1")
        credit_user_balance(self.user, Decimal("2000"), source="distribution")
        inv = self._buy(prop)  # "New acquisition" paid from the wallet — not a reinvestment
        self.assertEqual(inv.discount_amount, Decimal("0"))
        self.assertEqual(inv.reinvested_amount, Decimal("0"))
        self.assertEqual(self._debit(inv), Decimal("1000.00"))

    def test_reinvesting_returns_gets_five_percent_and_the_owner_still_gets_full_value(self):
        prop, owner = _prop("re-2")
        credit_user_balance(self.user, Decimal("2000"), source="distribution")
        inv = self._buy(prop, reinvest=True)
        self.assertEqual(inv.discount_amount, Decimal("50.00"))
        self.assertEqual(self._debit(inv), Decimal("950.00"))
        self.assertEqual(
            BalanceTransaction.objects.get(balance__user=owner, source="primary_sale").amount,
            Decimal("1000.00"),
        )

    def test_only_the_part_covered_by_returns_is_discounted_once(self):
        prop, _ = _prop("re-3")
        credit_user_balance(self.user, Decimal("400"), source="distribution")
        first = self._buy(prop, reinvest=True)
        self.assertEqual(first.reinvested_amount, Decimal("400"))
        self.assertEqual(first.discount_amount, Decimal("20.00"))  # 5% of the $400 of returns
        self.assertEqual(available_returns(self.user), Decimal("0"))
        second = self._buy(prop, reinvest=True)  # returns used up → full price
        self.assertEqual(second.discount_amount, Decimal("0"))

    def test_deposits_are_not_returns(self):
        prop, _ = _prop("re-4")
        inv = self._buy(prop, reinvest=True)  # only the $5000 deposit in the wallet
        self.assertEqual(inv.discount_amount, Decimal("0"))

    def test_family_rate_needs_an_active_family_member(self):
        prop, _ = _prop("re-5")
        credit_user_balance(self.user, Decimal("2000"), source="distribution")
        with self.assertRaises(ValidationError):
            self._buy(prop, reinvest=True, reinvest_mode="family")
        FamilyAccount.objects.create(investor=self.user, member_name="Sara", member_email="s@ex.com",
                                     relationship="daughter", status="active")
        inv = self._buy(prop, reinvest=True, reinvest_mode="family")
        self.assertEqual(inv.discount_amount, Decimal("75.00"))
        self.assertEqual(self._debit(inv), Decimal("925.00"))

    def test_card_purchases_are_not_discounted(self):
        prop, _ = _prop("re-6")
        inv = create_investment(user=self.user, prop=prop, token_amount=10, payment_method="card")["investment"]
        self.assertEqual(inv.discount_amount, Decimal("0"))
