"""Everything the property page shows can be entered in the Django admin."""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.core.models import User

from .models import Amenity, MarketData, Property, PropertyFinancials, TokenMetadata
from .tests import _valid_property_kwargs


class PropertyAdminCompletenessTests(TestCase):
    def setUp(self):
        self.prop = Property(**_valid_property_kwargs(slug="admin-made", total_value=Decimal("1000000")))
        self.prop.expected_completion = "Q4 2027"
        self.prop.expected_completion_ar = "الربع الرابع 2027"
        self.prop.save()

    def _detail(self):
        return self.client.get(f"/api/properties/{self.prop.slug}/").json()

    def test_expected_completion_reaches_the_page(self):
        body = self._detail()
        self.assertEqual(body["expectedCompletion"], "Q4 2027")
        self.assertEqual(body["expectedCompletionAr"], "الربع الرابع 2027")

    def test_token_details_come_only_from_the_real_deployment(self):
        tm = TokenMetadata.objects.create(property=self.prop, contract_address="0xTYPEDBYHAND", verified=True,
                                          token_price=Decimal("999"))
        token = self._detail()["tokenMetadata"]
        self.assertEqual(token["contractAddress"], "")
        self.assertFalse(token["verified"])
        self.assertEqual(Decimal(str(token["tokenPrice"])), self.prop.token_price)
        tm.deployed_contract_address = "0x" + "ab" * 20
        tm.save()
        token = self._detail()["tokenMetadata"]
        self.assertEqual(token["contractAddress"], "0x" + "ab" * 20)
        self.assertTrue(token["verified"])

    def test_amenities_follow_the_admin_order(self):
        Amenity.objects.create(property=self.prop, name_en="Pool", order=2)
        Amenity.objects.create(property=self.prop, name_en="Gym", order=1)
        names = [a.get("en") or a.get("nameEn") or a.get("name_en") for a in self._detail()["amenities"]]
        self.assertEqual(names[:2], ["Gym", "Pool"])

    def test_reserved_demo_slugs_are_refused(self):
        p = Property(**_valid_property_kwargs(slug="1", total_value=Decimal("1000000")))
        with self.assertRaises(ValidationError) as ctx:
            p.full_clean()
        self.assertIn("slug", ctx.exception.message_dict)

    def test_json_fields_are_validated(self):
        fin = PropertyFinancials(property=self.prop, yield_projection=[{"year": "Year 1", "value": "high"}])
        with self.assertRaises(ValidationError):
            fin.clean()
        PropertyFinancials(property=self.prop, yield_projection=[{"year": "Year 1", "value": 8.1}]).clean()
        with self.assertRaises(ValidationError):
            MarketData(property=self.prop, price_index_history=["2021", 100]).clean()

    def test_admin_page_has_the_checklist_and_owner_field(self):
        admin = User.objects.create_superuser(email="root@ex.com", password="pw-12345-strong")
        self.client.force_login(admin)
        html = self.client.get(f"/admin/properties/property/{self.prop.pk}/change/").content.decode()
        self.assertIn("Property page — what is filled in", html)
        self.assertIn("the page shows sample content", html)
        self.assertIn("Expected completion", html)
        self.assertIn('name="submitted_by"', html)
        self.assertEqual(self.client.get("/admin/properties/property/add/").status_code, 200)
