"""Units are held for buyers whose payment is on its way (investments.services.held_tokens)."""
from datetime import timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.kyc.services import get_or_create_kyc
from apps.payments.models import SukukCertificate
from apps.payments.sukuk_service import CertificateError, approve_certificate
from apps.properties.models import Property
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.services import get_or_create_custodial_wallet

from .models import Investment
from .services import OverPurchaseError, available_tokens, create_investment


def _prop(slug):
    p = Property(**_valid_property_kwargs(slug=slug, total_value=Decimal("1000"), token_price=Decimal("100")))
    p.save()  # 10 units
    return p


def _user(email):
    u = User.objects.create_user(email=email, password="pw-12345-strong")
    k = get_or_create_kyc(u)
    k.mark_approved()
    k.save()
    get_or_create_custodial_wallet(u)
    return User.objects.get(pk=u.pk)


def _age(inv, minutes):
    """Pretend the purchase started `minutes` ago (its reservation runs from then)."""
    then = timezone.now() - timedelta(minutes=minutes)
    Investment.objects.filter(pk=inv.pk).update(
        created_at=then,
        reserved_until=(then + timedelta(minutes=30)) if inv.reserved_until else None,
    )


class HoldTests(TestCase):
    def setUp(self):
        self.prop = _prop("hold-1")
        self.a = _user("a@ex.com")
        self.b = _user("b@ex.com")

    def test_a_card_payment_on_its_way_holds_its_units(self):
        inv = create_investment(user=self.a, prop=self.prop, token_amount=8, payment_method="card")["investment"]
        self.assertEqual(available_tokens(self.prop), 2)
        with self.assertRaises(OverPurchaseError):
            create_investment(user=self.b, prop=self.prop, token_amount=5, payment_method="card")
        _age(inv, 31)  # the reservation lapsed → the units are free again
        self.assertEqual(available_tokens(self.prop), 10)
        create_investment(user=self.b, prop=self.prop, token_amount=5, payment_method="card")

    def test_a_sukuk_purchase_is_held_while_its_certificate_is_reviewed(self):
        inv = create_investment(user=self.a, prop=self.prop, token_amount=8, payment_method="sukuk")["investment"]
        self.assertEqual(available_tokens(self.prop), 2)  # 30 min to upload the certificate
        SukukCertificate.objects.create(investment=inv, file="sukuk_certificates/x.pdf")
        _age(inv, 600)  # long after: still held, the certificate is under review
        self.assertEqual(available_tokens(self.prop), 2)

    def test_without_a_certificate_the_sukuk_hold_lapses(self):
        inv = create_investment(user=self.a, prop=self.prop, token_amount=8, payment_method="sukuk")["investment"]
        _age(inv, 31)
        self.assertEqual(available_tokens(self.prop), 10)

    def test_approval_never_oversells(self):
        inv = create_investment(user=self.a, prop=self.prop, token_amount=8, payment_method="sukuk")["investment"]
        _age(inv, 31)  # hold lapsed before any certificate…
        from apps.wallets.services import credit_user_balance

        credit_user_balance(self.b, Decimal("2000"), source="test")
        create_investment(user=self.b, prop=self.prop, token_amount=5, payment_method="balance")  # sold
        cert = SukukCertificate.objects.create(investment=inv, file="sukuk_certificates/x.pdf")
        admin = User.objects.create_superuser(email="ops@ex.com", password="pw-12345-strong")
        with self.assertRaises(CertificateError):
            approve_certificate(cert, admin)
        cert.refresh_from_db()
        self.assertEqual(cert.status, SukukCertificate.Status.PENDING)


class CertificateUploadTests(APITestCase):
    def test_a_late_certificate_for_sold_out_units_is_refused(self):
        prop = _prop("hold-2")
        a, b = _user("ua@ex.com"), _user("ub@ex.com")
        inv = create_investment(user=a, prop=prop, token_amount=8, payment_method="sukuk")["investment"]
        _age(inv, 31)
        from apps.wallets.services import credit_user_balance

        credit_user_balance(b, Decimal("2000"), source="test")
        create_investment(user=b, prop=prop, token_amount=5, payment_method="balance")
        self.client.force_authenticate(a)
        pdf = SimpleUploadedFile("cert.pdf", b"%PDF-1.4 test", content_type="application/pdf")
        resp = self.client.post(f"/api/payments/sukuk/{inv.pk}/certificate/", {"file": pdf}, format="multipart")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.data["code"], "sold_out")
