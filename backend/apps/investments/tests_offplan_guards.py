"""
Off-plan model, phase 2 — purchase guards (OFFPLAN_EXIT_MODEL_AR.md §3.4.1 and §4).

- The buyer confirms the price they saw (expected_unit_price) → 409 PRICE_CHANGED otherwise.
- The property's payment mode decides installments vs full payment (409 INSTALLMENTS_ONLY /
  FULL_PAYMENT_ONLY), server-enforced.
- A PSP purchase holds its price 30 minutes; a payment confirmed later at a changed price (or
  for sold-out units, or for an expired attempt) is refunded to the wallet, once.
"""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.installments.models import InstallmentPlanStatus
from apps.kyc.services import get_or_create_kyc
from apps.notifications.models import Notification
from apps.properties.models import Property
from apps.properties.pricing import record_price
from apps.properties.tests import _valid_property_kwargs
from apps.wallets.models import UserBalance

from .models import Investment, PaymentStatus
from .services import settle_investment


def _prop(slug="op", **overrides):
    data = dict(slug=slug, model="installment", total_value=Decimal("1000000"), token_price=Decimal("100"))
    data.update(overrides)
    p = Property(**_valid_property_kwargs(**data))
    p.save()
    return p


def _investor(email="buyer@ex.com"):
    u = User.objects.create_user(email=email, password="pw-12345-strong")
    kyc = get_or_create_kyc(u)
    kyc.mark_approved()
    kyc.save()
    return User.objects.get(pk=u.pk)


def _admin():
    return User.objects.create_superuser(email="root@ex.com", password="pw-12345-strong")


class _Base(APITestCase):
    def setUp(self):
        self.user = _investor()
        self.client.force_authenticate(self.user)

    def buy(self, prop, **extra):
        body = {"property_id": prop.slug, "token_amount": 10, "payment_method": "card"}
        body.update(extra)
        return self.client.post("/api/investments/", body, format="json")

    def plan(self, prop, **extra):
        return self.buy(prop, is_installment=True, term_months=12, **extra)  # 25% down + 11 monthly


class ExpectedPriceTests(_Base):
    def test_changed_price_is_refused_with_the_new_price(self):
        p = _prop(offplan_payment="both")
        record_price(p, "110", by=_admin())
        resp = self.buy(p, expected_unit_price="100.00")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.data["code"], "PRICE_CHANGED")
        self.assertEqual(resp.data["current_price"], "110.00")
        self.assertFalse(Investment.objects.exists())

    def test_matching_price_goes_through_and_old_clients_still_work(self):
        p = _prop(offplan_payment="both")
        self.assertEqual(self.buy(p, expected_unit_price="100").status_code, 201)
        other = _prop(slug="op2", offplan_payment="both")
        self.assertEqual(self.buy(other).status_code, 201)  # no expected_unit_price sent

    def test_installment_start_is_checked_too(self):
        p = _prop(offplan_payment="installments")
        record_price(p, "105", by=_admin())
        resp = self.plan(p, expected_unit_price="100")
        self.assertEqual((resp.status_code, resp.data["code"]), (409, "PRICE_CHANGED"))


class PaymentModeTests(_Base):
    def test_installments_only_property_refuses_a_full_payment(self):
        p = _prop(offplan_payment="installments")
        resp = self.buy(p)
        self.assertEqual((resp.status_code, resp.data["code"]), (409, "INSTALLMENTS_ONLY"))
        self.assertEqual(self.plan(p).status_code, 201)

    def test_full_only_property_refuses_a_plan(self):
        p = _prop(offplan_payment="full")
        resp = self.plan(p)
        self.assertEqual((resp.status_code, resp.data["code"]), (409, "FULL_PAYMENT_ONLY"))
        self.assertEqual(self.buy(p).status_code, 201)

    def test_both_allows_either(self):
        self.assertEqual(self.buy(_prop(slug="b1", offplan_payment="both")).status_code, 201)
        self.assertEqual(self.plan(_prop(slug="b2", offplan_payment="both")).status_code, 201)

    def test_ready_property_is_always_full_payment(self):
        p = _prop(slug="ready", model="ready", offplan_payment="installments")
        self.assertEqual(self.plan(p).data["code"], "FULL_PAYMENT_ONLY")
        self.assertEqual(self.buy(p).status_code, 201)

    def test_installment_preview_follows_the_mode(self):
        full_only = _prop(slug="pv", offplan_payment="full")
        resp = self.client.post(
            "/api/installments/preview/",
            {"property": full_only.slug, "units": 10, "term_months": 12},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class ReservationAndLatePaymentTests(_Base):
    def _pending(self, prop, **extra):
        resp = (self.plan if extra.pop("plan", False) else self.buy)(prop, **extra)
        self.assertEqual(resp.status_code, 201, resp.data)
        return Investment.objects.get(pk=resp.data["investment_id"])

    def _expire(self, inv):
        Investment.objects.filter(pk=inv.pk).update(reserved_until=timezone.now() - timedelta(minutes=1))
        inv.refresh_from_db()

    def _balance(self):
        b = UserBalance.objects.filter(user=self.user).first()
        return b.current_balance if b else Decimal("0")

    def test_psp_purchase_gets_a_30_minute_reservation(self):
        inv = self._pending(_prop(offplan_payment="both"))
        delta = inv.reserved_until - timezone.now()
        self.assertTrue(timedelta(minutes=29) < delta <= timedelta(minutes=30))

    def test_payment_within_the_reservation_settles_even_if_the_price_moved(self):
        p = _prop(offplan_payment="both")
        inv = self._pending(p)
        record_price(p, "110", by=_admin())
        settle_investment(inv)
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.COMPLETED)
        self.assertEqual(inv.price_per_token, Decimal("100.00"))  # the reserved price
        self.assertIsNone(inv.refunded_at)

    def test_late_payment_same_price_settles_normally(self):
        inv = self._pending(_prop(offplan_payment="both"))
        self._expire(inv)
        settle_investment(inv)
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.COMPLETED)

    def test_late_payment_after_a_price_change_is_refunded_once(self):
        p = _prop(offplan_payment="both")
        inv = self._pending(p)
        paid = inv.settlement_amount
        self._expire(inv)
        record_price(p, "110", by=_admin())
        result = settle_investment(inv)
        self.assertEqual(result["reason"], "refunded_price_changed")
        inv.refresh_from_db()
        self.assertEqual(inv.payment_status, PaymentStatus.FAILED)
        self.assertEqual(inv.refund_reason, "price_changed")
        self.assertEqual(self._balance(), paid)
        self.assertTrue(
            Notification.objects.filter(user=self.user, type=Notification.Type.PURCHASE_REFUNDED).exists()
        )
        # A duplicate webhook must not refund twice.
        self.assertEqual(settle_investment(inv)["reason"], "refunded")
        self.assertEqual(self._balance(), paid)

    def test_late_payment_for_sold_out_units_is_refunded(self):
        p = _prop(offplan_payment="both", total_value=Decimal("1500"))  # 15 units
        inv = self._pending(p)  # 10 units pending
        other = _investor("other@ex.com")
        Investment.objects.create(
            user=other, property=p, property_name=p.name, amount_invested=Decimal("1000"),
            token_amount=10, token_symbol="BRX", price_per_token=Decimal("100"),
            ownership_percentage=Decimal("0"), payment_method="card",
            payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
        )
        self._expire(inv)
        self.assertEqual(settle_investment(inv)["reason"], "refunded_sold_out")

    def test_payment_for_an_already_expired_attempt_is_refunded_not_lost(self):
        inv = self._pending(_prop(offplan_payment="both"))
        Investment.objects.filter(pk=inv.pk).update(payment_status=PaymentStatus.FAILED)
        inv.refresh_from_db()
        self.assertEqual(settle_investment(inv)["reason"], "refunded_expired")
        self.assertEqual(self._balance(), inv.settlement_amount)

    def test_late_down_payment_refund_cancels_the_plan(self):
        p = _prop(offplan_payment="installments")
        inv = self._pending(p, plan=True)
        self._expire(inv)
        record_price(p, "110", by=_admin())
        settle_investment(inv)
        inv.refresh_from_db()
        self.assertEqual(inv.installment_plan.status, InstallmentPlanStatus.CANCELLED)
        self.assertEqual(self._balance(), inv.settlement_amount)  # down-payment + fee back
