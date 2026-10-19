"""Units bought with a Nova Sukuk certificate stay pledged to Nova Finance until its clearance."""
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.core.models import User
from apps.installments.position import holder_view
from apps.installments.services import installment_locked_tokens
from apps.installments.tests import _offer_legacy_terms
from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import create_investment
from apps.notifications.models import Notification
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.secondary_market.services import create_listing
from apps.wallets.models import OwnershipToken
from apps.wallets.services import get_or_create_custodial_wallet

from .models import NovaPledge, SukukCertificate
from .nova_pledge import PledgeError, release_pledge
from .sukuk_service import approve_certificate


def _prop(slug, **extra):
    p = Property(**_valid_property_kwargs(
        slug=slug, total_value=Decimal("10000"), token_price=Decimal("100"), is_published=True, **extra,
    ))
    p.save()
    return p


class NovaPledgeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email="ops@ex.com", password="pw-12345-strong")
        self.investor = User.objects.create_user(email="nova@ex.com", password="pw-12345-strong")
        get_or_create_custodial_wallet(self.investor)

    def _buy_with_certificate(self, prop, **kw):
        inv = create_investment(
            user=self.investor, prop=prop, token_amount=10, payment_method="sukuk", **kw,
        )["investment"]
        cert = SukukCertificate.objects.create(investment=inv, file="sukuk_certificates/x.pdf")
        approve_certificate(cert, self.admin)
        inv.refresh_from_db()
        return inv

    def _token(self, prop):
        return OwnershipToken.objects.get(wallet__user=self.investor, property_id=prop.slug)

    def test_approved_units_are_pledged_and_cannot_be_listed(self):
        prop = _prop("nova-1")
        inv = self._buy_with_certificate(prop)
        self.assertTrue(inv.tokens_minted)
        pledge = NovaPledge.objects.get(investment=inv)
        self.assertEqual((pledge.units, pledge.status), (10, NovaPledge.Status.ACTIVE))
        self.assertEqual(self._token(prop).available_amount, 0)
        with self.assertRaises(Exception):
            create_listing(user=self.investor, data={"property_id": prop.slug, "token_amount": 1})
        # Still the owner: pledged units keep earning distributions.
        self.assertEqual(installment_locked_tokens(self.investor.pk, prop.slug), 0)

    def test_release_needs_the_clearance_reference_then_unlocks(self):
        prop = _prop("nova-2")
        pledge = NovaPledge.objects.get(investment=self._buy_with_certificate(prop))
        with self.assertRaises(PledgeError):
            release_pledge(pledge.pk, reference="", by=self.admin)
        release_pledge(pledge.pk, reference="NOVA-CLR-2026-118", by=self.admin)
        release_pledge(pledge.pk, reference="NOVA-CLR-2026-118", by=self.admin)  # idempotent
        pledge.refresh_from_db()
        self.assertEqual(pledge.status, NovaPledge.Status.RELEASED)
        self.assertEqual(self._token(prop).available_amount, 10)
        self.assertTrue(Notification.objects.filter(user=self.investor, type="nova_pledge_released").exists())
        create_listing(user=self.investor, data={"property_id": prop.slug, "token_amount": 10})

    def test_installment_paid_with_a_certificate_pledges_the_paid_share_and_blocks_the_sale(self):
        prop = _prop("nova-3", model="installment", category="construction", offplan_payment="both")
        _offer_legacy_terms(prop)
        inv = self._buy_with_certificate(
            prop, is_installment=True, down_payment_percent=30, n_installments=3, frequency="monthly",
        )
        pledge = NovaPledge.objects.get(investment=inv)
        self.assertEqual(pledge.units, 3)  # the 30% the certificate paid for
        self.assertEqual(self._token(prop).locked_amount, 10)  # 7 unpaid + 3 pledged
        view = holder_view(inv.installment_plan, prop.token_price, inv)
        self.assertEqual(view["blocked"], "pledged")

    def test_other_payment_methods_are_not_pledged(self):
        from apps.wallets.services import credit_user_balance

        prop = _prop("nova-4")
        credit_user_balance(self.investor, Decimal("5000"), source="test")
        create_investment(user=self.investor, prop=prop, token_amount=5, payment_method="balance")
        self.assertFalse(NovaPledge.objects.exists())

    def test_backfill_pledges_older_purchases_once(self):
        prop = _prop("nova-5")
        inv = self._buy_with_certificate(prop)
        NovaPledge.objects.all().delete()
        tok = self._token(prop)
        tok.locked_amount = 0
        tok.save(update_fields=["locked_amount"])
        out = StringIO()
        call_command("backfill_nova_pledges", stdout=out)
        call_command("backfill_nova_pledges", stdout=StringIO())
        self.assertIn("1 pledge(s) created", out.getvalue())
        self.assertEqual(NovaPledge.objects.filter(investment=inv).count(), 1)
        self.assertEqual(self._token(prop).available_amount, 0)
