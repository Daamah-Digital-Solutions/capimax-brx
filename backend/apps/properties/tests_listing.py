"""
The admin property-listing page (client review): automatic link id, every country, optional
Arabic, uploads that survive errors, drafts, and publish / unpublish.
"""
import re
import shutil
from html.parser import HTMLParser
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from apps.core.models import User

from .models import PendingUpload, Property, PropertyImage, PropertySitePhoto
from .tests import _TMP_MEDIA, _png, _valid_property_kwargs

ADD_URL = "/admin/properties/property/add/"
UPLOAD_URL = "/admin/properties/property/upload/"


class _FormValues(HTMLParser):
    """The initial values of the property form's inputs, selects and textareas."""

    def __init__(self):
        super().__init__()
        self.values, self._select, self._textarea, self._first = {}, None, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        name = a.get("name")
        if tag == "input" and name and a.get("type") not in ("file", "submit", "button"):
            if a.get("type") in ("checkbox", "radio"):
                if "checked" in a:
                    self.values[name] = a.get("value", "on")
            else:
                self.values[name] = a.get("value", "")
        elif tag == "select" and name:
            self._select, self._first = name, None
        elif tag == "option" and self._select:
            if self._first is None:
                self._first = a.get("value", "")
                self.values.setdefault(self._select, self._first)
            if "selected" in a:
                self.values[self._select] = a.get("value", "")
        elif tag == "textarea" and name:
            self._textarea = name
            self.values[name] = ""

    def handle_endtag(self, tag):
        if tag == "select":
            self._select = None
        elif tag == "textarea":
            self._textarea = None

    def handle_data(self, data):
        if self._textarea:
            self.values[self._textarea] += data.lstrip("\n") if not self.values[self._textarea] else data


def _english_only(**overrides):
    data = _valid_property_kwargs(**overrides)
    for key in ("name_ar", "location_ar", "duration_ar", "description_ar"):
        data.pop(key)
    return data


class ListingModelTests(TestCase):
    def test_draft_saves_with_just_a_name_and_gets_its_link_id(self):
        prop = Property(name="Marina View Tower", is_published=False)
        prop.full_clean()
        prop.save()
        self.assertEqual(prop.slug, "marina-view-tower")
        twin = Property.objects.create(name="Marina View Tower", is_published=False)
        self.assertEqual(twin.slug, "marina-view-tower-2")
        self.assertEqual(prop.publication_status, "draft")

    def test_publishing_lists_every_missing_essential(self):
        prop = Property(name="Half done", is_published=True)
        with self.assertRaises(ValidationError) as ctx:
            prop.full_clean()
        self.assertEqual(
            set(ctx.exception.message_dict),
            {"location", "country", "city", "model", "description", "total_value", "image_file"},
        )

    def test_english_only_property_publishes_and_the_arabic_site_shows_english(self):
        prop = Property(**_english_only(slug="", name="Nile Gardens", country="eg", city="Cairo"))
        prop.full_clean()
        prop.save()
        self.assertEqual(prop.slug, "nile-gardens")
        body = self.client.get(f"/api/properties/{prop.slug}/").json()
        self.assertEqual(body["nameAr"], "Nile Gardens")
        self.assertEqual(body["locationAr"], prop.location)
        self.assertEqual(body["descriptionAr"], prop.description)
        self.assertEqual(body["country"], "eg")

    def test_any_country_but_not_made_up_codes(self):
        Property(**_valid_property_kwargs(country="fr")).full_clean()
        with self.assertRaises(ValidationError) as ctx:
            Property(**_valid_property_kwargs(country="zz")).full_clean()
        self.assertIn("country", ctx.exception.message_dict)

    def test_status_and_yield_type_follow_the_investment_type(self):
        ready = Property.objects.create(**_valid_property_kwargs(slug="r", status="", yield_type=""))
        self.assertEqual((ready.status, ready.yield_type), ("ready", "rental"))
        offplan = Property.objects.create(
            **_valid_property_kwargs(slug="c", model="installment", status="", yield_type="")
        )
        self.assertEqual((offplan.status, offplan.yield_type), ("construction", "appreciation"))

    def test_unpublished_is_hidden_but_kept(self):
        prop = Property.objects.create(**_valid_property_kwargs(slug="hide-me"))
        self.assertIsNotNone(prop.published_at)
        prop.is_published = False
        prop.save()
        self.assertEqual(prop.publication_status, "unpublished")
        self.assertEqual(self.client.get("/api/properties/hide-me/").status_code, 404)
        self.assertNotIn("hide-me", [p["id"] for p in self.client.get("/api/properties/").json()])
        self.assertTrue(Property.objects.filter(slug="hide-me").exists())


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class ListingAdminTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_superuser(email="lister@ex.com", password="pw-12345-strong")
        self.client.force_login(self.admin)

    def _form(self, url, **fields):
        """What a browser would post from the page as rendered, plus the given fields."""
        parser = _FormValues()
        parser.feed(self.client.get(url).content.decode())
        data = {k: v for k, v in parser.values.items() if "__prefix__" not in k}
        data.update(fields)
        return data

    def _essentials(self, **extra):
        return {
            "name": "Harbour Lofts", "location": "12 Quay St", "country": "eg", "city": "Alexandria",
            "model": "ready", "total_value": "1000000", "token_price": "100",
            "description": "English only.", "asset_type": "residential", "risk_level": "medium",
            "exit_availability": "secondary", "offplan_payment": "installments",
            "fee_platform": "1.5", "fee_management": "0.5", "fee_exit": "0.5",
            "fee_pronova_discount": "5", "fee_installment": "4", "funded": "0", "investors": "0",
            "min_investment": "100", "display_order": "0", "broker_commission_rate": "5",
            "open_for_promotion": "on", **extra,
        }

    def _upload(self, kind="image", f=None):
        resp = self.client.post(UPLOAD_URL, {"file": f or _png(), "kind": kind})
        self.assertEqual(resp.status_code, 200, resp.content)
        return resp.json()["token"]

    def test_add_page_opens(self):
        resp = self.client.get(ADD_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Save draft")
        self.assertContains(resp, "Save and publish")
        self.assertNotContains(resp, 'name="slug"')
        self.assertNotContains(resp, 'name="site_photos_url"')

    def test_draft_with_only_a_name(self):
        resp = self.client.post(ADD_URL, self._form(ADD_URL, name="Just a name", _continue="1"))
        self.assertEqual(resp.status_code, 302, resp.content[:3000])
        prop = Property.objects.get(name="Just a name")
        self.assertFalse(prop.is_published)
        self.assertEqual(prop.publication_status, "draft")
        self.assertEqual(prop.slug, "just-a-name")

    def test_uploaded_image_survives_a_refused_save_and_attaches_when_fixed(self):
        token = self._upload()
        # Publishing without a city is refused …
        data = self._form(ADD_URL, **self._essentials(city="", image_file__pending=token, _publish="1"))
        resp = self.client.post(ADD_URL, data)
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "City is required to publish.")
        self.assertContains(resp, f'value="{token}"')  # … the image is still there
        self.assertFalse(Property.objects.exists())
        # … and saves with it once the city is filled in.
        data.update(city="Alexandria")
        resp = self.client.post(ADD_URL, data)
        self.assertEqual(resp.status_code, 302, resp.content[:3000])
        prop = Property.objects.get(name="Harbour Lofts")
        self.assertTrue(prop.is_published)
        self.assertTrue(prop.image_file.name.startswith("property_images/"))
        self.assertFalse(PendingUpload.objects.filter(pk=token).exists())

    def test_gallery_and_site_photos_upload_and_editing_keeps_them(self):
        g_token, s_token = self._upload(), self._upload()
        data = self._form(ADD_URL, **self._essentials(image_file__pending=self._upload(), _publish="1"))
        data.update({
            "gallery-TOTAL_FORMS": "1", "gallery-0-image__pending": g_token, "gallery-0-order": "0",
            "site_photos-TOTAL_FORMS": "1", "site_photos-0-image__pending": s_token,
            "site_photos-0-order": "0",
        })
        resp = self.client.post(ADD_URL, data)
        self.assertEqual(resp.status_code, 302, resp.content[:3000])
        prop = Property.objects.get(name="Harbour Lofts")
        self.assertEqual(PropertyImage.objects.filter(property=prop).count(), 1)
        self.assertEqual(PropertySitePhoto.objects.filter(property=prop).count(), 1)
        self.assertEqual(len(self.client.get(f"/api/properties/{prop.slug}/").json()["sitePhotos"]), 1)
        # Editing another field keeps every image.
        url = f"/admin/properties/property/{prop.pk}/change/"
        data = self._form(url, description="Edited.", _continue="1")
        resp = self.client.post(url, data)
        self.assertEqual(resp.status_code, 302, resp.content[:3000])
        prop.refresh_from_db()
        self.assertEqual(prop.description, "Edited.")
        self.assertTrue(prop.image_file)
        self.assertEqual(prop.gallery.count(), 1)
        self.assertEqual(prop.site_photos.count(), 1)

    def test_unpublish_and_publish_again_from_the_editor(self):
        prop = Property.objects.create(**_valid_property_kwargs(slug="toggle"))
        url = f"/admin/properties/property/{prop.pk}/change/"
        resp = self.client.post(url, self._form(url, _unpublish="1"))
        self.assertEqual(resp.status_code, 302, resp.content[:3000])
        prop.refresh_from_db()
        self.assertEqual(prop.publication_status, "unpublished")
        resp = self.client.post(url, self._form(url, _publish="1"))
        self.assertEqual(resp.status_code, 302)
        prop.refresh_from_db()
        self.assertTrue(prop.is_published)

    def test_publish_action_refuses_an_incomplete_draft(self):
        draft = Property.objects.create(name="Incomplete", is_published=False)
        resp = self.client.post("/admin/properties/property/", {
            "action": "publish_selected", "_selected_action": [str(draft.pk)],
        }, follow=True)
        self.assertContains(resp, "was not published")
        draft.refresh_from_db()
        self.assertFalse(draft.is_published)

    def test_upload_view_checks_the_file(self):
        bad = self.client.post(UPLOAD_URL, {"file": _png("notes.txt"), "kind": "image"})
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.client.post(UPLOAD_URL, {"kind": "image"}).status_code, 400)
        self.client.logout()
        self.assertEqual(self.client.post(UPLOAD_URL, {"file": _png(), "kind": "image"}).status_code, 302)
        self.assertFalse(PendingUpload.objects.exists())

    def test_drone_video_uploads_and_reaches_the_page(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        video = SimpleUploadedFile("drone.mp4", b"\x00\x00\x00\x18ftypmp42" + b"0" * 64, content_type="video/mp4")
        resp = self.client.post(UPLOAD_URL, {"file": video, "kind": "video"})
        self.assertEqual(resp.status_code, 200, resp.content)
        data = self._form(ADD_URL, **self._essentials(
            image_file__pending=self._upload(), drone_video_file__pending=resp.json()["token"], _publish="1",
        ))
        resp = self.client.post(ADD_URL, data)
        self.assertEqual(resp.status_code, 302, resp.content[:3000])
        prop = Property.objects.get(name="Harbour Lofts")
        self.assertTrue(prop.drone_video_file.name.startswith("property_videos/"))
        body = self.client.get(f"/api/properties/{prop.slug}/").json()
        self.assertTrue(body["droneVideoFile"].endswith(".mp4"))

    def test_upload_limit_is_30_mb_and_video_needs_a_video_file(self):
        from unittest import mock

        from django.core.files.uploadedfile import SimpleUploadedFile

        bad = self.client.post(UPLOAD_URL, {"file": _png(), "kind": "video"})
        self.assertEqual(bad.status_code, 400)
        with mock.patch("apps.properties.admin.UPLOAD_MAX_BYTES", 10):
            big = self.client.post(UPLOAD_URL, {
                "file": SimpleUploadedFile("drone.mp4", b"0" * 64, content_type="video/mp4"), "kind": "video",
            })
        self.assertEqual(big.status_code, 400)
        self.assertIn("30 MB", big.json()["error"])
