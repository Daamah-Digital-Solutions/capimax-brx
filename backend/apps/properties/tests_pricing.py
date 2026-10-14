"""
Off-plan unit pricing (Phase 1 of the off-plan exit model, OFFPLAN_EXIT_MODEL_AR.md §3).

Covers: one price feeds everything; recording a price moves the offering total on unsold
units only, keeps the supply and the min-investment units, revalues holders, stamps the
launch price, and is append-only; every guard; the supply freeze; resales no longer counted
as primary sales; the public /prices endpoint; and the superuser-only admin page.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.admin.models import LogEntry
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus
from apps.investments.services import sold_tokens
from apps.wallets.models import OwnershipToken
from apps.wallets.services import get_or_create_custodial_wallet

from .models import Property, PropertyPrice, TokenMetadata
from .pricing import PriceError, is_price_due, record_price
from .tests import _valid_property_kwargs


def _offplan(slug="offplan", **overrides):
    """$1M under-construction offering at $100 → 10,000 units, min investment 5 units."""
    data = dict(
        slug=slug, model="installment", total_value=Decimal("1000000"),
        token_price=Decimal("100"), min_investment=Decimal("500"),
    )
    data.update(overrides)
    p = Property(**_valid_property_kwargs(**data))
    p.save()
    return p


def _sale(prop, user, qty, method="card"):
    return Investment.objects.create(
        user=user, property=prop, property_name=prop.name,
        amount_invested=Decimal(qty) * prop.token_price, token_amount=qty,
        token_symbol="BRX", price_per_token=prop.token_price,
        ownership_percentage=Decimal("0"), payment_method=method,
        payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
    )


def _admin(email="root@ex.com"):
    return User.objects.create_superuser(email=email, password="pw-12345-strong")


class RecordPriceTests(TestCase):
    def setUp(self):
        self.admin = _admin()
        self.prop = _offplan()
        self.investor = User.objects.create_user(email="inv@ex.com", password="pw-12345-strong")
        _sale(self.prop, self.investor, 2000)
        wallet, _ = get_or_create_custodial_wallet(self.investor)
        self.token = OwnershipToken.objects.create(
            wallet=wallet, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol="BRX", token_amount=2000, token_value_usd=Decimal("200000"),
        )
        TokenMetadata.objects.get_or_create(property=self.prop)

    def test_price_change_updates_everything_in_one_step(self):
        entry = record_price(self.prop, "110", by=self.admin, label="Phase 2", note="Phase 2 opened")
        p = Property.objects.get(pk=self.prop.pk)
        self.assertEqual(p.token_price, Decimal("110.00"))
        self.assertEqual(p.token_supply, 10000)  # fixed — never rescaled by a price change
        # +$10 on the 8,000 UNSOLD units only: 1,000,000 + 80,000.
        self.assertEqual(p.total_value, Decimal("1080000.00"))
        self.assertEqual(p.min_investment, Decimal("550.00"))  # still 5 units
        self.assertEqual(p.launch_price, Decimal("100.00"))
        self.assertEqual(
            (entry.previous_price, entry.price, entry.label, entry.note, entry.created_by),
            (Decimal("100.00"), Decimal("110.00"), "Phase 2", "Phase 2 opened", self.admin),
        )
        self.token.refresh_from_db()
        self.assertEqual(self.token.token_value_usd, Decimal("220000.00"))  # 2,000 × 110
        self.assertEqual(TokenMetadata.objects.get(property=p).token_price, Decimal("110.00"))
        self.assertEqual(sold_tokens(p), 2000)  # funding unaffected by the price
        self.assertTrue(
            LogEntry.objects.filter(object_id=str(p.pk), change_message__contains="100.00 → 110.00").exists()
        )

    def test_second_change_keeps_launch_price_and_chains_history(self):
        record_price(self.prop, "110", by=self.admin)
        record_price(self.prop, "105", by=self.admin)
        p = Property.objects.get(pk=self.prop.pk)
        self.assertEqual(p.launch_price, Decimal("100.00"))
        self.assertEqual(p.total_value, Decimal("1040000.00"))  # 1,080,000 − 5 × 8,000
        rows = list(p.price_history.values_list("previous_price", "price"))
        self.assertEqual(rows, [(Decimal("100.00"), Decimal("110.00")), (Decimal("110.00"), Decimal("105.00"))])

    def test_guards(self):
        cases = [("100", "same_price"), ("0", "invalid"), ("-5", "invalid"), ("abc", "invalid"), ("130", "large_change")]
        for value, code in cases:
            with self.subTest(value=value), self.assertRaises(PriceError) as ctx:
                record_price(self.prop, value, by=self.admin)
            self.assertEqual(ctx.exception.code, code)
        self.assertFalse(PropertyPrice.objects.exists())
        # A >25% step goes through once explicitly confirmed.
        record_price(self.prop, "130", by=self.admin, confirm_large=True)
        self.assertEqual(Property.objects.get(pk=self.prop.pk).token_price, Decimal("130.00"))

    def test_only_full_admins(self):
        staff = User.objects.create_user(email="staff@ex.com", password="pw-12345-strong", is_staff=True)
        with self.assertRaises(PriceError) as ctx:
            record_price(self.prop, "110", by=staff)
        self.assertEqual(ctx.exception.code, "forbidden")

    def test_unpublished_property_is_priced_in_the_editor_not_here(self):
        Property.objects.filter(pk=self.prop.pk).update(is_published=False)
        self.prop.refresh_from_db()
        with self.assertRaises(PriceError) as ctx:
            record_price(self.prop, "110", by=self.admin)
        self.assertEqual(ctx.exception.code, "unpublished")

    def test_history_is_append_only(self):
        entry = record_price(self.prop, "110", by=self.admin)
        entry.label = "edited"
        with self.assertRaises(ValueError):
            entry.save()
        with self.assertRaises(ValueError):
            entry.delete()
        self.assertEqual(PropertyPrice.objects.get(pk=entry.pk).label, "")


class SupplyFreezeTests(TestCase):
    def test_supply_still_derived_before_any_sale_or_price(self):
        p = _offplan()
        p.token_price = Decimal("50")
        p.save()
        self.assertEqual(p.token_supply, 20000)

    def test_supply_frozen_once_sold_even_on_a_direct_save(self):
        p = _offplan()
        _sale(p, User.objects.create_user(email="a@ex.com", password="pw-12345-strong"), 10)
        p.token_price = Decimal("50")  # e.g. an old admin form / shell save
        p.save()
        self.assertEqual(Property.objects.get(pk=p.pk).token_supply, 10000)

    def test_supply_frozen_once_a_price_was_recorded(self):
        p = _offplan()
        record_price(p, "110", by=_admin())
        p.refresh_from_db()
        p.total_value = Decimal("2000000")
        p.save()
        self.assertEqual(Property.objects.get(pk=p.pk).token_supply, 10000)


class ResalesAreNotPrimarySalesTests(APITestCase):
    def test_secondary_and_lp_rows_do_not_count_as_sold_or_funded(self):
        p = _offplan(funded=0)
        u = User.objects.create_user(email="b@ex.com", password="pw-12345-strong")
        _sale(p, u, 1000)
        _sale(p, u, 300, method="secondary_market")
        _sale(p, u, 200, method="lp_market")
        self.assertEqual(sold_tokens(p), 1000)
        self.assertEqual(self.client.get(f"/api/properties/{p.slug}/").data["funded"], 10)


class PriceDueTests(TestCase):
    def test_under_construction_property_without_a_price_for_31_days_is_due(self):
        p = _offplan()
        Property.objects.filter(pk=p.pk).update(created_at=timezone.now() - timedelta(days=32))
        p.refresh_from_db()
        self.assertTrue(is_price_due(p))
        record_price(p, "110", by=_admin())
        self.assertFalse(is_price_due(p))

    def test_ready_property_is_never_due(self):
        p = _offplan(slug="ready-one", model="ready")
        Property.objects.filter(pk=p.pk).update(created_at=timezone.now() - timedelta(days=90))
        p.refresh_from_db()
        self.assertFalse(is_price_due(p))


class PublicPricesEndpointTests(APITestCase):
    def test_before_and_after_a_change(self):
        p = _offplan()
        data = self.client.get(f"/api/properties/{p.slug}/prices/").data
        self.assertEqual((data["launchPrice"], data["currentPrice"], data["changePct"]), ("100.00", "100.00", "0.00"))
        self.assertEqual(len(data["points"]), 1)
        self.assertIsNone(data["updatedAt"])

        record_price(p, "110", by=_admin(), label="Phase 2")
        data = self.client.get(f"/api/properties/{p.slug}/prices/").data
        self.assertEqual((data["launchPrice"], data["currentPrice"], data["changePct"]), ("100.00", "110.00", "10.00"))
        self.assertEqual(data["label"], "Phase 2")
        self.assertEqual([pt["price"] for pt in data["points"]], ["100.00", "110.00"])


class UnitPricesAdminTests(TestCase):
    def setUp(self):
        self.prop = _offplan()
        self.url = f"/admin/properties/propertyunitprice/{self.prop.pk}/change/"

    def _post(self, **fields):
        data = {
            "price_history-TOTAL_FORMS": "0", "price_history-INITIAL_FORMS": "0",
            "price_history-MIN_NUM_FORMS": "0", "price_history-MAX_NUM_FORMS": "1000",
        }
        data.update(fields)
        return self.client.post(self.url, data)

    def test_superuser_records_a_price_from_the_admin(self):
        self.client.force_login(_admin())
        self.assertEqual(self.client.get(self.url).status_code, 200)
        resp = self._post(new_price="110", phase_label="Phase 2", investor_note="Opened")
        self.assertEqual(resp.status_code, 302)
        entry = PropertyPrice.objects.get(property=self.prop)
        self.assertEqual((entry.price, entry.label, entry.note), (Decimal("110.00"), "Phase 2", "Opened"))

    def test_large_change_needs_the_confirmation_box(self):
        self.client.force_login(_admin())
        resp = self._post(new_price="200")
        self.assertEqual(resp.status_code, 200)  # form re-shown with the error
        self.assertContains(resp, "limit 25%")
        self.assertFalse(PropertyPrice.objects.exists())
        self.assertEqual(self._post(new_price="200", confirm_large_change="on").status_code, 302)
        self.assertEqual(PropertyPrice.objects.get().price, Decimal("200.00"))

    def test_staff_who_are_not_full_admins_cannot_open_it(self):
        staff = User.objects.create_user(email="ed@ex.com", password="pw-12345-strong", is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get("/admin/properties/propertyunitprice/").status_code, 403)
        self.assertEqual(self._post(new_price="110").status_code, 403)
        self.assertFalse(PropertyPrice.objects.exists())

    def test_regular_editor_locks_the_price_once_priced(self):
        self.client.force_login(_admin())
        record_price(self.prop, "110", by=User.objects.get(email="root@ex.com"))
        page = self.client.get(f"/admin/properties/property/{self.prop.pk}/change/")
        self.assertContains(page, "Locked — change it from Properties › Unit prices")
        self.assertNotContains(page, 'name="token_price"')


class PriceChangeNotificationTests(TestCase):
    """§3.3.4: holders, active installment payers and open-listing sellers are notified, once."""

    def setUp(self):
        from apps.installments.models import InstallmentPlan, InstallmentPlanStatus
        from apps.secondary_market.models import SecondaryMarketListing

        self.prop = _offplan()
        mk = lambda e: User.objects.create_user(email=e, password="pw-12345-strong")  # noqa: E731
        self.holder, self.payer, self.seller, self.stranger = (
            mk("holder@ex.com"), mk("payer@ex.com"), mk("seller@ex.com"), mk("stranger@ex.com"),
        )
        wallet, _ = get_or_create_custodial_wallet(self.holder)
        OwnershipToken.objects.create(
            wallet=wallet, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol="BRX", token_amount=5, token_value_usd=Decimal("500"),
        )
        # The seller also holds units (an open listing escrows them) → still ONE notification.
        swallet, _ = get_or_create_custodial_wallet(self.seller)
        OwnershipToken.objects.create(
            wallet=swallet, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol="BRX", token_amount=3, token_value_usd=Decimal("300"),
        )
        SecondaryMarketListing.objects.create(
            seller=self.seller, property_id=self.prop.slug, property_name=self.prop.name,
            token_symbol="BRX", token_amount=3, unit_price=Decimal("120"), total_value=Decimal("360"),
        )
        InstallmentPlan.objects.create(
            investor=self.payer, property=self.prop, property_name=self.prop.name,
            total_amount=Decimal("1000"), down_payment_amount=Decimal("200"),
            down_payment_percent=Decimal("20"), number_of_installments=8,
            installment_amount=Decimal("100"), frequency="monthly", duration_months=8,
            status=InstallmentPlanStatus.ACTIVE,
        )

    def _notified(self):
        from apps.notifications.models import Notification

        return Notification.objects.filter(type=Notification.Type.UNIT_PRICE_CHANGED)

    def test_the_right_people_are_notified_once_after_commit(self):
        with self.captureOnCommitCallbacks(execute=True):
            record_price(self.prop, "110", by=_admin(), label="Phase 2")
        rows = self._notified()
        self.assertEqual(
            sorted(rows.values_list("user__email", flat=True)),
            ["holder@ex.com", "payer@ex.com", "seller@ex.com"],
        )
        seller_params = rows.get(user=self.seller).params
        self.assertEqual(
            (seller_params["old_price"], seller_params["new_price"], seller_params["change_pct"]),
            ("100.00", "110.00", "+10.00"),
        )
        self.assertIn("listing keeps the price you set", seller_params["listing_note"])
        self.assertEqual(rows.get(user=self.holder).params["listing_note"], "")
        self.assertEqual(rows.get(user=self.holder).params["label_suffix"], " — Phase 2")

    def test_a_rejected_price_notifies_nobody(self):
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(PriceError):
                record_price(self.prop, "100", by=_admin())  # same price
        self.assertFalse(self._notified().exists())
