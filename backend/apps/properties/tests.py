"""
Property read-API tests — Phase 2. Run against Postgres (capimax_brx).

Covers: list + filter + search, public (unauth) access, the funded/featured
endpoints, and that detail returns the correct nested block for EACH of the 8
investment models. Seeds via the real `seed_properties` command (so the seed is
tested too).
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Property


def _valid_property_kwargs(**overrides):
    """A complete, valid Property (passes full_clean). Override per test."""
    data = dict(
        slug="vtest",
        name="Validation Test",
        name_ar="اختبار",
        location="Dubai, UAE",
        location_ar="دبي، الإمارات",
        country="uae",
        city="dubai",
        image="https://example.com/i.png",
        asset_type="residential",
        model="ready",
        category="ready",
        status="ready",
        yield_type="rental",
        risk_level="low",
        total_value=Decimal("5000000"),
        token_price=Decimal("100"),
        duration="5 years",
        duration_ar="5 سنوات",
        exit_availability="both",
        description="x",
        description_ar="x",
    )
    data.update(overrides)
    return data


class PropertyApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_properties")

    # --- list / public ---------------------------------------------------- #
    def test_list_is_public_and_returns_array(self):
        resp = self.client.get("/api/properties/")  # no auth
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)  # bare array, not paginated
        # All 19 catalogue entries present (funded deals excluded from default list? no —
        # list returns all published; Marketplace filters funded client-side).
        slugs = {p["id"] for p in resp.data}
        self.assertIn("1", slugs)
        self.assertIn("62", slugs)

    def test_list_item_shape_is_camelcase(self):
        resp = self.client.get("/api/properties/")
        # Inspect the RENDERED JSON (what the frontend actually receives), not the
        # pre-render serializer .data (which still holds Decimal objects).
        body = resp.json()
        item = next(p for p in body if p["id"] == "1")
        for key in (
            "nameAr", "locationAr", "assetType", "yieldType", "riskLevel",
            "totalValue", "tokenPrice", "expectedYield", "minInvestment",
            "durationAr", "exitEligible", "exitAvailability", "model", "category",
        ):
            self.assertIn(key, item, key)
        # decimals serialize as JSON numbers, not strings (COERCE_DECIMAL_TO_STRING=False)
        self.assertIsInstance(item["totalValue"], (int, float))
        self.assertIsInstance(item["tokenPrice"], (int, float))
        self.assertNotIsInstance(item["totalValue"], str)

    def test_filter_by_country_and_model_and_category(self):
        r1 = self.client.get("/api/properties/", {"country": "ksa"})
        self.assertTrue(all(p["country"] == "ksa" for p in r1.data))
        r2 = self.client.get("/api/properties/", {"model": "phasing"})
        self.assertTrue(all(p["model"] == "phasing" for p in r2.data))
        self.assertGreaterEqual(len(r2.data), 1)
        r3 = self.client.get("/api/properties/", {"category": "construction"})
        self.assertTrue(all(p["category"] == "construction" for p in r3.data))

    def test_search_by_name(self):
        resp = self.client.get("/api/properties/", {"search": "Marina"})
        names = [p["name"] for p in resp.data]
        self.assertTrue(any("Marina" in n for n in names))

    # --- detail: nested block per each of the 8 models -------------------- #
    def test_detail_nested_block_per_model(self):
        expectations = {
            "1": ("ready", None),                 # ready: no model block; has spv/financials
            "10": ("installment", "installment"),
            "11": ("phasing", "phases"),
            "12": ("future", "future"),
            "13": ("option", "option"),
            "14": ("shared", "shared"),
            "20": ("ready_portfolio", "portfolioAssets"),
            "30": ("construction_portfolio", "portfolioAssets"),
        }
        for slug, (model, block) in expectations.items():
            resp = self.client.get(f"/api/properties/{slug}/")
            self.assertEqual(resp.status_code, status.HTTP_200_OK, slug)
            self.assertEqual(resp.data["model"], model, slug)
            if block in ("phases", "portfolioAssets"):
                self.assertTrue(len(resp.data[block]) > 0, f"{slug}:{block}")
            elif block:
                self.assertIsNotNone(resp.data[block], f"{slug}:{block}")

    def test_detail_ready_has_dataroom_extras(self):
        resp = self.client.get("/api/properties/1/")
        self.assertIsNotNone(resp.data["spv"])
        self.assertIsNotNone(resp.data["tokenMetadata"])
        self.assertIsNotNone(resp.data["financials"])
        self.assertTrue(len(resp.data["documents"]) > 0)
        self.assertTrue(len(resp.data["valuationReports"]) > 0)
        self.assertIn("platformFee", resp.data["fees"])

    def test_detail_installment_nested_values(self):
        resp = self.client.get("/api/properties/10/")
        inst = resp.data["installment"]
        self.assertEqual(inst["totalInstallments"], 24)
        self.assertEqual(inst["paidInstallments"], 11)
        self.assertEqual(len(resp.data["developerReports"]), 2)

    def test_detail_phasing_has_four_phases(self):
        resp = self.client.get("/api/properties/11/")
        self.assertEqual(len(resp.data["phases"]), 4)
        self.assertEqual(resp.data["phases"][0]["number"], 1)

    def test_detail_404_for_unknown_slug(self):
        self.assertEqual(
            self.client.get("/api/properties/does-not-exist/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    # --- featured / funded / stats --------------------------------------- #
    def test_funded_endpoint_shape(self):
        resp = self.client.get("/api/properties/funded/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 6)  # fp-1..fp-6
        item = resp.data[0]
        for key in ("id", "name", "nameAr", "fundedDate", "totalValue", "investors", "expectedYield"):
            self.assertIn(key, item, key)

    def test_featured_endpoint_public(self):
        # Mark one featured, confirm it surfaces.
        Property.objects.filter(slug="1").update(is_featured=True)
        resp = self.client.get("/api/properties/featured/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(any(p["id"] == "1" for p in resp.data))

    def test_stats_endpoint(self):
        resp = self.client.get("/api/properties/stats/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # All real aggregate keys the GlobalStats band binds to are present.
        for key in (
            "totalProperties", "ready", "construction", "funded",
            "totalInvestors", "totalValue", "avgYield", "developers", "cities",
        ):
            self.assertIn(key, resp.data, key)
        self.assertEqual(resp.data["funded"], 6)
        # developers = approved DeveloperProfile count (none seeded here) → real 0.
        self.assertEqual(resp.data["developers"], 0)
        # cities = distinct non-empty cities among published rows (real, matches the DB).
        expected_cities = (
            Property.objects.filter(is_published=True)
            .exclude(city="").values("city").distinct().count()
        )
        self.assertEqual(resp.data["cities"], expected_cities)
        self.assertGreaterEqual(resp.data["cities"], 1)

    def test_stats_zero_on_empty_catalogue(self):
        """Never-fake-a-number: with no published properties and no approved developers,
        every GlobalStats figure is a real 0 — not a marketing constant."""
        Property.objects.all().delete()
        resp = self.client.get("/api/properties/stats/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for key in (
            "totalProperties", "ready", "construction", "funded",
            "totalInvestors", "developers", "cities",
        ):
            self.assertEqual(resp.data[key], 0, key)
        self.assertEqual(resp.data["totalValue"], 0.0)
        self.assertEqual(resp.data["avgYield"], 0.0)

    def test_token_economics_supply_derived(self):
        # SPEC §7C.6: supply = total_value / token_price (100).
        p = Property.objects.get(slug="1")
        self.assertEqual(p.token_supply, 50000)  # 5,000,000 / 100


class PropertyValidationTests(TestCase):
    """
    Data-integrity guards that stop the "invisible property" bug: the admin must
    REJECT inconsistent saves with a clear error, and category/token_supply must be
    auto-derived so they can't desync. DECISIONS.md "Properties".
    """

    def test_admin_save_rejects_out_of_range_yield(self):
        """The 452% yield that triggered the bug is now rejected by full_clean()."""
        p = Property(**_valid_property_kwargs(slug="badyield", expected_yield=Decimal("452")))
        with self.assertRaises(ValidationError) as cm:
            p.full_clean()
        self.assertIn("expected_yield", cm.exception.message_dict)

    def test_admin_save_rejects_out_of_range_growth(self):
        p = Property(**_valid_property_kwargs(slug="badgrowth", expected_growth=Decimal("250")))
        with self.assertRaises(ValidationError) as cm:
            p.full_clean()
        self.assertIn("expected_growth", cm.exception.message_dict)

    def test_admin_save_rejects_out_of_range_funded(self):
        p = Property(**_valid_property_kwargs(slug="badfunded", funded=150))
        with self.assertRaises(ValidationError) as cm:
            p.full_clean()
        self.assertIn("funded", cm.exception.message_dict)

    def test_save_autoderives_category_from_model(self):
        """A portfolio model saved with the wrong category is corrected, not hidden."""
        p = Property(**_valid_property_kwargs(slug="rp", model="ready_portfolio", category="construction"))
        p.save()
        p.refresh_from_db()
        self.assertEqual(p.category, "ready_portfolio")  # derived from model, not the bad input

    def test_save_autoderives_token_supply(self):
        p = Property(**_valid_property_kwargs(slug="ts", total_value=Decimal("5000000")))
        p.save()
        p.refresh_from_db()
        self.assertEqual(p.token_supply, 50000)  # 5,000,000 / 100 (mirrors seed_properties)

    def test_construction_model_derives_construction_category(self):
        p = Property(**_valid_property_kwargs(slug="inst", model="installment", category="ready"))
        p.save()
        p.refresh_from_db()
        self.assertEqual(p.category, "construction")

    def test_valid_property_passes_and_is_listable(self):
        """A sane property passes full_clean and lands with a consistent category."""
        p = Property(**_valid_property_kwargs(slug="ok", expected_yield=Decimal("9.5"), funded=80))
        p.full_clean()  # must not raise
        p.save()
        self.assertEqual(p.category, "ready")
        self.assertEqual(p.funded, 80)

    def test_funded_100_boundary_allowed(self):
        # funded deals (fp-*) legitimately use 100 — boundary must pass.
        p = Property(**_valid_property_kwargs(slug="f100", funded=100))
        p.full_clean()  # must not raise
