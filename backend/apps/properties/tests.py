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


# --------------------------------------------------------------------------- #
# Admin uploads: hero image, gallery and data-room documents can be uploaded from
# the admin, and the API returns them as absolute links on the API origin.
# --------------------------------------------------------------------------- #
import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image as PILImage

from .models import PropertyDocument, PropertyImage

_TMP_MEDIA = tempfile.mkdtemp(prefix="brx-media-test-")


def _png(name="x.png"):
    buf = io.BytesIO()
    PILImage.new("RGB", (4, 4), (10, 41, 40)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


class PropertyImageReferenceTests(TestCase):
    def test_site_root_path_is_a_valid_image(self):
        # The BRX seed stores "/props/<slug>/hero.jpg" — must be saveable in the admin.
        Property(**_valid_property_kwargs(image="/props/x/hero.jpg")).full_clean()

    def test_absolute_url_is_a_valid_image(self):
        Property(**_valid_property_kwargs(image="https://cdn.example.com/a.jpg")).full_clean()

    def test_garbage_image_value_is_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            Property(**_valid_property_kwargs(image="not a url")).full_clean()
        self.assertIn("image", ctx.exception.message_dict)

    def test_protocol_relative_path_is_rejected(self):
        with self.assertRaises(ValidationError):
            Property(**_valid_property_kwargs(image="//evil.example.com/a.jpg")).full_clean()

    def test_image_or_upload_is_required(self):
        with self.assertRaises(ValidationError) as ctx:
            Property(**_valid_property_kwargs(image="")).full_clean()
        self.assertIn("image", ctx.exception.message_dict)

    @override_settings(MEDIA_ROOT=_TMP_MEDIA)
    def test_upload_alone_satisfies_the_image_requirement(self):
        Property(**_valid_property_kwargs(image="", image_file=_png())).full_clean()

    def test_document_rejects_html_upload(self):
        prop = Property.objects.create(**_valid_property_kwargs(slug="doc-html"))
        doc = PropertyDocument(
            property=prop, name="x", name_en="x", date="2026-01-01", doc_type="legal",
            file=SimpleUploadedFile("page.html", b"<script>alert(1)</script>"),
        )
        with self.assertRaises(ValidationError) as ctx:
            doc.full_clean()
        self.assertIn("file", ctx.exception.message_dict)


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class PropertyUploadApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.prop = Property.objects.create(
            **_valid_property_kwargs(
                slug="uploads",
                image="",
                image_file=_png("hero.png"),
                images=["/props/uploads/1.jpg"],
            )
        )
        PropertyImage.objects.create(property=self.prop, image=_png("g2.png"), order=2)
        PropertyImage.objects.create(property=self.prop, image=_png("g1.png"), order=1)
        PropertyDocument.objects.create(
            property=self.prop, name="تقرير", name_en="Report", date="2026-01-01",
            doc_type="valuation",
            file=SimpleUploadedFile("report.pdf", b"%PDF-1.4 test", content_type="application/pdf"),
        )
        PropertyDocument.objects.create(
            property=self.prop, name="رابط", name_en="Linked", date="2025-01-01",
            doc_type="legal", url="https://api.example.com/media/x.pdf",
        )

    def test_detail_returns_absolute_upload_urls(self):
        data = self.client.get("/api/properties/uploads/").data
        self.assertTrue(data["image"].startswith("http://testserver/media/property_images/hero"))
        # JSON list first, then uploads in their admin order (order=1 before order=2).
        self.assertEqual(data["images"][0], "/props/uploads/1.jpg")
        self.assertEqual(len(data["images"]), 3)
        self.assertIn("/media/property_gallery/g1", data["images"][1])
        self.assertIn("/media/property_gallery/g2", data["images"][2])
        docs = {d["nameEn"]: d["url"] for d in data["documents"]}
        self.assertTrue(docs["Report"].startswith("http://testserver/media/property_docs/uploads/report"))
        self.assertEqual(docs["Linked"], "https://api.example.com/media/x.pdf")

    def test_list_returns_absolute_hero_url(self):
        item = next(p for p in self.client.get("/api/properties/").data if p["id"] == "uploads")
        self.assertTrue(item["image"].startswith("http://testserver/media/property_images/"))

    def test_url_only_property_is_unchanged(self):
        Property.objects.create(**_valid_property_kwargs(slug="url-only", image="/props/u/hero.jpg"))
        data = self.client.get("/api/properties/url-only/").data
        self.assertEqual(data["image"], "/props/u/hero.jpg")
        self.assertEqual(data["images"], [])

    @override_settings(PUBLIC_API_ORIGIN="https://api.capimaxbrx.com")
    def test_without_request_falls_back_to_public_origin(self):
        self.assertTrue(
            self.prop.hero_image_url().startswith("https://api.capimaxbrx.com/media/property_images/")
        )


class AdminManagedSectionsApiTests(APITestCase):
    """Every per-property block the page used to hard-code now comes from admin data."""

    def test_detail_exposes_admin_managed_sections(self):
        from .models import (
            ConstructionMilestone, MarketData, PostHandoverBenefit, PropertyFinancials,
            SPVRecord, ValuationReport,
        )

        p = Property.objects.create(**_valid_property_kwargs(
            slug="sections", model="installment",
            site_photos_url="https://photos.example.com/album", drone_video_url="https://youtu.be/x",
        ))
        SPVRecord.objects.create(
            property=p, name="SPV", jurisdiction="DE", registration_number="1",
            compliance="Reg S", compliance_ar="لائحة S", custody="Custodian X", custody_ar="حافظ X",
        )
        PropertyFinancials.objects.create(property=p, yield_projection=[{"year": "Year 1", "value": 8.1}])
        MarketData.objects.create(
            property=p, market_average=Decimal("5000000"), comparables_value=Decimal("5200000"),
            property_premium="+4.1%",
        )
        ConstructionMilestone.objects.create(property=p, name_en="Roof", name_ar="السقف", threshold=80, order=2)
        ConstructionMilestone.objects.create(property=p, name_en="Piling", name_ar="الخوازيق", threshold=20, order=1)
        PostHandoverBenefit.objects.create(property=p, text_en="No interest", text_ar="بدون فوائد")
        ValuationReport.objects.create(property=p, date="2025-03-01", valuation=Decimal("5600000"), appraiser="CIM")

        d = self.client.get("/api/properties/sections/").data
        self.assertEqual(
            (d["spv"]["compliance"], d["spv"]["complianceAr"], d["spv"]["custody"], d["spv"]["custodyAr"]),
            ("Reg S", "لائحة S", "Custodian X", "حافظ X"),
        )
        self.assertEqual(d["financials"]["yieldProjection"], [{"year": "Year 1", "value": 8.1}])
        self.assertEqual(
            (d["market"]["marketAverage"], d["market"]["comparablesValue"], d["market"]["propertyPremium"]),
            (5000000.0, 5200000.0, "+4.1%"),
        )
        self.assertEqual([m["nameEn"] for m in d["constructionMilestones"]], ["Piling", "Roof"])
        self.assertEqual(d["postHandoverBenefits"], [{"textEn": "No interest", "textAr": "بدون فوائد"}])
        self.assertEqual((d["sitePhotosUrl"], d["droneVideoUrl"]), ("https://photos.example.com/album", "https://youtu.be/x"))
        self.assertEqual(d["valuationReports"][0]["valuation"], 5600000.0)

    def test_new_document_types_are_accepted(self):
        from .models import PropertyDocument

        p = Property.objects.create(**_valid_property_kwargs(slug="doc-types"))
        for t in ("payment_plan", "handover_terms"):
            PropertyDocument(
                property=p, name="x", name_en="x", date="2026-01-01", doc_type=t,
                url="https://api.example.com/x.pdf",
            ).full_clean()


class MalformedGalleryTests(APITestCase):
    def test_bad_gallery_value_never_breaks_the_list(self):
        # A legacy row saved before validation (e.g. images=2) must not 500 the marketplace.
        p = Property.objects.create(**_valid_property_kwargs(slug="bad-gallery"))
        Property.objects.filter(pk=p.pk).update(images=2)
        self.assertEqual(self.client.get("/api/properties/").status_code, 200)
        self.assertEqual(self.client.get("/api/properties/bad-gallery/").data["images"], [])
        Property.objects.filter(pk=p.pk).update(images="/props/x/1.jpg")
        self.assertEqual(self.client.get("/api/properties/bad-gallery/").data["images"], ["/props/x/1.jpg"])

    def test_admin_rejects_a_malformed_gallery(self):
        for bad in (2, "x", [1, 2], {"a": 1}):
            with self.subTest(bad=bad), self.assertRaises(ValidationError) as ctx:
                Property(**_valid_property_kwargs(images=bad)).full_clean()
            self.assertIn("images", ctx.exception.message_dict)
        Property(**_valid_property_kwargs(images=["/a.jpg", "https://x.y/b.jpg"])).full_clean()
