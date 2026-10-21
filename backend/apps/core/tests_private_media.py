"""Private uploads: random names, served to signed-in admins only (apps/core/private_media.py)."""
import os
import shutil
import tempfile

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings

from apps.core.models import User
from apps.core.private_media import PRIVATE_PREFIXES, PrivateUpload

_MEDIA = tempfile.mkdtemp(prefix="capimax-media-")


@override_settings(MEDIA_ROOT=_MEDIA)
class PrivateMediaTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)

    def setUp(self):
        os.makedirs(os.path.join(_MEDIA, "kyc_documents", "2026", "10"), exist_ok=True)
        with open(os.path.join(_MEDIA, "kyc_documents", "2026", "10", "abc.pdf"), "wb") as f:
            f.write(b"%PDF-1.4 secret")
        self.url = "/media/kyc_documents/2026/10/abc.pdf"

    def test_names_are_random_and_keep_the_extension(self):
        a = PrivateUpload("deposit_proofs")(None, "My Bank Receipt.PDF")
        b = PrivateUpload("deposit_proofs")(None, "My Bank Receipt.PDF")
        self.assertNotEqual(a, b)
        self.assertTrue(a.startswith("deposit_proofs/") and a.endswith(".pdf"))
        self.assertNotIn("Receipt", a)

    def test_anonymous_and_investors_get_404(self):
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_login(User.objects.create_user(email="inv@ex.com", password="pw-12345-strong"))
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_admin_gets_the_file(self):
        self.client.force_login(User.objects.create_user(email="adm@ex.com", password="pw-12345-strong",
                                                         is_staff=True))
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b"".join(resp.streaming_content), b"%PDF-1.4 secret")
        self.assertEqual(resp["Cache-Control"], "private, no-store")

    def test_no_escape_from_the_folder(self):
        self.client.force_login(User.objects.create_user(email="adm2@ex.com", password="pw-12345-strong",
                                                         is_staff=True))
        self.assertEqual(self.client.get("/media/kyc_documents/../../settings.py").status_code, 404)

    def test_every_private_field_uses_private_upload(self):
        from django.apps import apps
        from django.db.models import FileField

        for model in apps.get_models():
            for f in model._meta.fields:
                public = model._meta.app_label == "properties" or (model.__name__, f.name) == ("Profile", "avatar")
                if isinstance(f, FileField) and not public:
                    self.assertIsInstance(f.upload_to, PrivateUpload, f"{model.__name__}.{f.name}")
                    self.assertIn(f.upload_to.prefix, PRIVATE_PREFIXES)

    def test_saving_a_file_uses_the_random_name(self):
        from apps.owner_documents.models import OwnerDocument

        f = OwnerDocument._meta.get_field("file")
        name = f.generate_filename(None, "contract.pdf").replace("\\", "/")
        self.assertRegex(name, r"^owner_documents/\d{4}/\d{2}/[0-9a-f]{64}\.pdf$")
        self.assertIsInstance(ContentFile(b""), ContentFile)
