"""
Certificates follow the purchase: issued once the payment is confirmed (never for a failed
or unpaid attempt), final once fully settled — paid, minted, installments all paid, no
Nova Finance pledge left. The status is never taken from the caller.
"""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import create_investment, settle_investment
from apps.investments.tests import COMPLETING_METHOD, _make_property
from apps.wallets.services import get_or_create_custodial_wallet

from .models import Certificate
from .services import is_settled, sync_certificate


class CertificateFinalityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="pw12345!")
        get_or_create_custodial_wallet(self.user)
        self.prop = _make_property("finality", total_value=1_000_000, token_price=100)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def _buy(self, method=COMPLETING_METHOD, units=3):
        return create_investment(user=self.user, prop=self.prop, token_amount=units, payment_method=method)

    def test_a_paid_and_minted_purchase_is_final(self):
        inv = self._buy()["investment"]
        inv.refresh_from_db()
        self.assertTrue(inv.tokens_minted)
        cert = Certificate.objects.get(investment=inv)
        self.assertEqual(cert.status, "final")
        self.assertIsNotNone(cert.finalized_at)

    def test_card_payment_gets_its_certificate_on_settlement(self):
        inv = self._buy(method="card")["investment"]
        self.assertFalse(Certificate.objects.filter(investment=inv).exists())
        settle_investment(inv)
        self.assertEqual(Certificate.objects.get(investment=inv).status, "final")

    def test_unpaid_attempts_are_hidden_everywhere(self):
        inv = self._buy(method="card")["investment"]
        # A certificate left over from before this rule, for a payment that then failed.
        Investment.objects.filter(pk=inv.pk).update(payment_status=PaymentStatus.FAILED)
        from .services import create_provisional_certificate

        cert = create_provisional_certificate(inv)
        self.assertEqual(self.api.get("/api/certificates/").json(), [])
        self.assertEqual(self.api.get(f"/api/certificates/{cert.pk}/pdf/").status_code, 404)
        self.assertEqual(self.api.get(f"/api/certificates/verify/{cert.verification_code}/").status_code, 404)

    def test_installments_stay_provisional_until_the_plan_is_paid(self):
        inv = self._buy()["investment"]
        from apps.installments.models import InstallmentPlan

        plan = InstallmentPlan.objects.create(
            investor=self.user, property=self.prop, property_name=self.prop.name,
            total_amount=Decimal("300"), down_payment_amount=Decimal("75"),
            down_payment_percent=Decimal("25"), number_of_installments=3,
            installment_amount=Decimal("75"), duration_months=4, status="active",
        )
        Investment.objects.filter(pk=inv.pk).update(is_installment=True, installment_plan=plan)
        Certificate.objects.filter(investment=inv).update(status="provisional", finalized_at=None)
        inv.refresh_from_db()
        self.assertFalse(is_settled(inv))
        self.assertEqual(sync_certificate(inv).status, "provisional")
        plan.status = "completed"
        plan.save()
        inv.refresh_from_db()
        self.assertEqual(sync_certificate(inv).status, "final")

    def test_nova_pledge_keeps_it_provisional_until_released(self):
        inv = self._buy()["investment"]
        from apps.payments.models import NovaPledge
        from apps.payments.nova_pledge import release_pledge

        Investment.objects.filter(pk=inv.pk).update(payment_method="sukuk")
        Certificate.objects.filter(investment=inv).update(status="provisional", finalized_at=None)
        inv.refresh_from_db()
        pledge = NovaPledge.objects.create(
            investment=inv, wallet=inv.wallet, property_slug=self.prop.slug, units=3,
        )
        self.assertEqual(sync_certificate(inv).status, "provisional")
        release_pledge(pledge.pk, reference="NOVA-CLR-1")
        self.assertEqual(Certificate.objects.get(investment=inv).status, "final")

    def test_the_caller_cannot_set_the_status(self):
        inv = self._buy(method="card")["investment"]
        resp = self.api.post("/api/certificates/generate/", {"investment_id": str(inv.pk), "status": "final"})
        self.assertEqual(resp.status_code, 400)  # not paid yet → no certificate at all
        self.assertFalse(Certificate.objects.filter(investment=inv).exists())

    def test_a_revoked_certificate_stays_revoked(self):
        inv = self._buy()["investment"]
        cert = Certificate.objects.get(investment=inv)
        cert.revoke("test")
        self.assertEqual(sync_certificate(inv).status, "revoked")

    def test_the_holder_is_notified_once_when_it_becomes_final(self):
        from apps.notifications.models import Notification

        inv = self._buy()["investment"]
        sync_certificate(inv)  # already final → no second notice
        notices = Notification.objects.filter(user=self.user, type="certificate_final")
        self.assertEqual(notices.count(), 1)
        cert = Certificate.objects.get(investment=inv)
        self.assertEqual(notices.first().params["certificate_id"], cert.certificate_id)
        self.assertEqual(notices.first().action_url, "/portfolio?tab=certificates")
