"""Hand-written property text in Arabic and French: the API, the fallback, and the admin boxes."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework.test import APITestCase

from apps.reports.doc_lang import doc_language, tr

from . import pricing
from .models import Amenity, DeveloperInfo, Property, PropertyFAQ, SPVRecord
from .tests import _valid_property_kwargs


class PropertyTranslationTests(APITestCase):
    def setUp(self):
        self.prop = Property.objects.create(**_valid_property_kwargs(
            slug="lang-tower", name="Lang Tower", name_ar="برج اللغة", name_fr="Tour Langue",
            description="English text", description_ar="نص عربي", description_fr="Texte français",
            location="Dubai", location_fr="Dubaï", is_published=True,
        ))
        DeveloperInfo.objects.create(
            property=self.prop, name="Dev Co", name_fr="Dev SA", overview="We build", overview_ar="نبني",
            overview_fr="Nous construisons",
            related_projects=[{"en": "Heights", "ar": "المرتفعات", "fr": "Les Hauteurs"}, {"en": "Plaza"}],
        )
        SPVRecord.objects.create(
            property=self.prop, name="Lang SPV LLC", jurisdiction="Wyoming, USA", jurisdiction_ar="وايومنغ",
            jurisdiction_fr="Wyoming, États-Unis", registration_number="1", established="2024-01-01",
        )
        PropertyFAQ.objects.create(property=self.prop, question_en="Why?", question_fr="Pourquoi ?",
                                   answer_en="Because", answer_ar="لأن")
        Amenity.objects.create(property=self.prop, name_en="Gym", name_fr="Salle de sport")

    def _detail(self, query=""):
        resp = self.client.get(f"/api/properties/lang-tower/{query}")
        self.assertEqual(resp.status_code, 200)
        return resp.json()

    def test_french_request_carries_the_french_under_the_english_keys(self):
        d = self._detail("?lang=fr")
        self.assertEqual(d["name"], "Tour Langue")
        self.assertEqual(d["description"], "Texte français")
        self.assertEqual(d["developer"]["overview"], "Nous construisons")
        self.assertEqual(d["developer"]["name"], "Dev SA")
        self.assertEqual(d["spv"]["jurisdiction"], "Wyoming, États-Unis")
        self.assertEqual(d["spv"]["name"], "Lang SPV LLC")  # the legal name is never translated
        self.assertEqual(d["faqs"][0]["questionEn"], "Pourquoi ?")
        self.assertEqual(d["amenities"][0]["nameEn"], "Salle de sport")
        self.assertEqual(d["developer"]["relatedProjects"][0]["en"], "Les Hauteurs")

    def test_what_has_no_french_stays_in_english(self):
        d = self._detail("?lang=fr")
        self.assertEqual(d["faqs"][0]["answerEn"], "Because")
        self.assertEqual(d["developer"]["relatedProjects"][1]["en"], "Plaza")

    def test_english_and_arabic_are_unchanged(self):
        d = self._detail()
        self.assertEqual(d["name"], "Lang Tower")
        self.assertEqual(d["description"], "English text")
        self.assertEqual(d["descriptionAr"], "نص عربي")
        self.assertEqual(d["developer"]["overviewAr"], "نبني")
        self.assertEqual(d["spv"]["jurisdiction"], "Wyoming, USA")
        self.assertEqual(d["spv"]["jurisdictionAr"], "وايومنغ")
        self.assertEqual(d["faqs"][0]["answerAr"], "لأن")

    def test_french_in_the_list_and_featured(self):
        rows = self.client.get("/api/properties/?lang=fr").json()
        self.assertIn("Tour Langue", [r["name"] for r in rows])
        self.assertIn("Lang Tower", [r["name"] for r in self.client.get("/api/properties/").json()])

    def test_price_note_in_each_language(self):
        admin = get_user_model().objects.create_superuser(email="price@ex.com", password="pw-12345-strong")
        pricing.record_price(
            self.prop, self.prop.token_price + Decimal("1"), by=admin, label="Phase 2", note="New phase",
            translations={"label_ar": "المرحلة الثانية", "label_fr": "Phase deux",
                          "note_ar": "مرحلة جديدة", "note_fr": "Nouvelle phase"},
        )
        fr = self.client.get("/api/properties/lang-tower/prices/?lang=fr").json()
        self.assertEqual(fr["label"], "Phase deux")
        self.assertEqual(fr["points"][-1]["note"], "Nouvelle phase")
        en = self.client.get("/api/properties/lang-tower/prices/").json()
        self.assertEqual(en["label"], "Phase 2")
        self.assertEqual(en["labelAr"], "المرحلة الثانية")
        self.assertEqual(en["points"][-1]["noteAr"], "مرحلة جديدة")

    def test_documents_use_the_translated_property_name(self):
        with doc_language("fr"):
            self.assertEqual(tr("Lang Tower"), "Tour Langue")
            self.assertEqual(tr("Dubai"), "Dubaï")
        with doc_language("ar"):
            self.assertEqual(tr("Lang Tower"), "برج اللغة")

    def test_the_editor_has_arabic_and_french_boxes(self):
        admin = get_user_model().objects.create_superuser(email="ed@ex.com", password="pw-12345-strong")
        client = Client()
        client.force_login(admin)
        html = client.get(f"/admin/properties/property/{self.prop.pk}/change/").content.decode()
        for box in ("description_ar", "description_fr", "developer_info-0-overview_ar", "developer_info-0-overview_fr",
                    "faqs-0-answer_fr", "amenities-0-name_fr", "spv-0-jurisdiction_fr"):
            self.assertIn(f'name="{box}"', html, box)
