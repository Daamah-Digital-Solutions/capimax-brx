"""
Owner-documents tests — a self-scoped personal vault (mirrors the LP document pattern,
plus the added server-side validation). Run against Postgres (capimax_brx).

Covers: self-scoped list/download/delete (a second user gets 404 and never sees another
owner's docs); upload stores the file under media/ with file_size + file_type captured;
download streams the blob behind the user filter; delete removes the row (+ the file);
validation rejects an oversize file and a disallowed type (400). No money/chain touched.
"""
import shutil
import tempfile

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.wallets.models import BalanceTransaction, OwnershipToken, Withdrawal

from .models import OwnerDocument
from .views import MAX_UPLOAD_BYTES

# Isolate file writes to a throwaway dir so tests never touch real media/.
_MEDIA = tempfile.mkdtemp(prefix="ownerdocs-test-")


def _pdf(name="deed.pdf", content=b"%PDF-1.4 fake", content_type="application/pdf"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, content, content_type=content_type)


@override_settings(MEDIA_ROOT=_MEDIA)
class OwnerDocumentTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.alice = User.objects.create_user(email="alice-od@example.com", password="pw12345!")
        self.bob = User.objects.create_user(email="bob-od@example.com", password="pw12345!")

    def _upload(self, **extra):
        payload = {
            "file": _pdf(),
            "document_type": "ownership",
            "document_name": "Title Deed",
            "property_name": "Marina Tower",
            **extra,
        }
        return self.client.post("/api/owner-documents/", payload, format="multipart")

    def test_upload_stores_file_with_metadata(self):
        self.client.force_authenticate(self.alice)
        resp = self._upload()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertEqual(body["document_name"], "Title Deed")
        self.assertEqual(body["document_type"], "ownership")
        self.assertEqual(body["property_name"], "Marina Tower")
        self.assertEqual(body["status"], "active")
        self.assertTrue(body["file_size"] > 0)
        self.assertEqual(body["file_type"], "application/pdf")
        self.assertTrue(body["file_path"].startswith("owner_documents/"))
        # The row + file really exist server-side.
        doc = OwnerDocument.objects.get(id=body["id"])
        self.assertEqual(doc.user, self.alice)
        self.assertTrue(doc.file.storage.exists(doc.file.name))

    def test_list_is_self_scoped(self):
        self.client.force_authenticate(self.alice)
        self._upload()
        self.assertEqual(len(self.client.get("/api/owner-documents/").json()), 1)
        # Bob sees NONE of Alice's documents.
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get("/api/owner-documents/").json(), [])

    def test_download_streams_blob_self_scoped(self):
        self.client.force_authenticate(self.alice)
        doc_id = self._upload().json()["id"]
        # Owner downloads their own blob.
        resp = self.client.get(f"/api/owner-documents/{doc_id}/download/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("attachment", resp.get("Content-Disposition", ""))
        self.assertEqual(b"".join(resp.streaming_content), b"%PDF-1.4 fake")
        # Bob cannot download Alice's document → 404 (self-scoped).
        self.client.force_authenticate(self.bob)
        self.assertEqual(
            self.client.get(f"/api/owner-documents/{doc_id}/download/").status_code, 404
        )

    def test_delete_self_scoped_removes_row_and_file(self):
        self.client.force_authenticate(self.alice)
        doc = OwnerDocument.objects.get(id=self._upload().json()["id"])
        file_name = doc.file.name
        # Bob cannot delete Alice's document → 404, and it survives.
        self.client.force_authenticate(self.bob)
        self.assertEqual(
            self.client.delete(f"/api/owner-documents/{doc.id}/").status_code, 404
        )
        self.assertTrue(OwnerDocument.objects.filter(id=doc.id).exists())
        # Alice deletes her own → row gone + file removed from storage.
        self.client.force_authenticate(self.alice)
        self.assertEqual(
            self.client.delete(f"/api/owner-documents/{doc.id}/").status_code, 204
        )
        self.assertFalse(OwnerDocument.objects.filter(id=doc.id).exists())
        self.assertFalse(doc.file.storage.exists(file_name))

    def test_requires_auth(self):
        self.assertIn(
            self.client.get("/api/owner-documents/").status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_validation_rejects_oversize(self):
        self.client.force_authenticate(self.alice)
        big = _pdf(name="big.pdf", content=b"x" * (MAX_UPLOAD_BYTES + 1))
        resp = self.client.post(
            "/api/owner-documents/",
            {"file": big, "document_type": "legal", "document_name": "big"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("too large", resp.json()["detail"].lower())
        self.assertEqual(OwnerDocument.objects.count(), 0)

    def test_validation_rejects_disallowed_type(self):
        self.client.force_authenticate(self.alice)
        exe = _pdf(name="malware.exe", content=b"MZ", content_type="application/octet-stream")
        resp = self.client.post(
            "/api/owner-documents/",
            {"file": exe, "document_type": "other", "document_name": "x"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("disallowed", resp.json()["detail"].lower())
        self.assertEqual(OwnerDocument.objects.count(), 0)

    def test_no_money_or_chain_touched(self):
        bt, wd, ot = (
            BalanceTransaction.objects.count(),
            Withdrawal.objects.count(),
            OwnershipToken.objects.count(),
        )
        self.client.force_authenticate(self.alice)
        self._upload()
        self.assertEqual(BalanceTransaction.objects.count(), bt)
        self.assertEqual(Withdrawal.objects.count(), wd)
        self.assertEqual(OwnershipToken.objects.count(), ot)
