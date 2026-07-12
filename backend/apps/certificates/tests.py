"""
Certificate tests — Phase 3 Wave 3. Run against Postgres (capimax_brx).

Covers: PDF generation + idempotency, QR encodes the correct verify URL, the public
verify endpoint exposes ONLY the curated projection (PII/internal ids ABSENT), owner-
only PDF download, revoked status, and certificate ownership = corrected token math.
"""
import shutil
import tempfile
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus
from apps.properties.models import Property, SPVRecord

from .models import Certificate
from .services import generate_certificate

# Isolate generated PDFs to a temp dir so the suite never writes into media/.
_TMP_MEDIA = tempfile.mkdtemp(prefix="cert-test-media-")


def tearDownModule():
    shutil.rmtree(_TMP_MEDIA, ignore_errors=True)


def _property(slug="cert1", total_value=5_000_000, token_price=100):
    p = Property(
        slug=slug, name="Cert Tower", name_ar="x", location="Riyadh, KSA",
        location_ar="x", country="ksa", city="riyadh", image="https://e.com/i.png",
        asset_type="residential", model="ready", category="ready", status="ready",
        yield_type="rental", risk_level="low", total_value=Decimal(str(total_value)),
        token_price=Decimal(str(token_price)), duration="5y", duration_ar="x",
        exit_availability="both", description="x", description_ar="x",
    )
    p.save()
    SPVRecord.objects.create(
        property=p, name="Cert SPV Ltd", jurisdiction="DIFC", registration_number="SPV-9"
    )
    return p


def _investment(user, prop, tokens=100):
    return Investment.objects.create(
        user=user, property=prop, property_name=prop.name,
        amount_invested=Decimal(tokens) * prop.token_price, token_amount=tokens,
        token_symbol="BRXCERT1", price_per_token=prop.token_price,
        ownership_percentage=(Decimal(tokens) / Decimal(prop.token_supply) * 100),
        payment_method="card", payment_status=PaymentStatus.COMPLETED,
    )


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class CertificateGenerationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="c@example.com", password="pw12345!")
        self.prop = _property()
        self.investment = _investment(self.user, self.prop, tokens=100)

    def test_pdf_generates_and_is_a_real_pdf(self):
        cert = generate_certificate(self.investment)
        self.assertTrue(cert.pdf_file)
        data = cert.pdf_file.open("rb").read()
        self.assertEqual(data[:5], b"%PDF-")
        self.assertGreater(len(data), 1000)

    def test_generation_is_idempotent(self):
        c1 = generate_certificate(self.investment)
        path1 = c1.pdf_path
        c2 = generate_certificate(self.investment)
        self.assertEqual(c1.id, c2.id)
        self.assertEqual(c2.pdf_path, path1)  # not regenerated
        self.assertEqual(Certificate.objects.filter(investment=self.investment).count(), 1)

    @override_settings(FRONTEND_URL="http://localhost:8080")
    def test_qr_encodes_the_verify_url(self):
        cert = generate_certificate(self.investment)
        expected = f"http://localhost:8080/verify/{cert.verification_code}"
        self.assertEqual(cert.verification_url, expected)
        self.assertEqual(cert.qr_code_data, expected)  # QR payload == verify URL

    def test_certificate_uses_real_data_not_hardcoded(self):
        cert = generate_certificate(self.investment)
        self.assertEqual(cert.property_location, "Riyadh, KSA")  # not "Dubai, UAE"
        self.assertEqual(cert.spv_name, "Cert SPV Ltd")
        self.assertEqual(cert.platform_fee, Decimal("150.00"))  # 1.5% of 10,000, not 0

    def test_ownership_matches_corrected_token_math(self):
        cert = generate_certificate(self.investment)
        # 100 tokens / 50,000 supply = 0.2% (NOT the old 10%).
        self.assertEqual(cert.ownership_percentage, Decimal("0.200000"))

    def test_signature_hash_present(self):
        cert = generate_certificate(self.investment)
        self.assertEqual(len(cert.digital_signature_hash), 64)


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class CertificateApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="pw12345!")
        self.other = User.objects.create_user(email="other@example.com", password="pw12345!")
        self.prop = _property()
        self.investment = _investment(self.user, self.prop, tokens=100)

    def test_generate_requires_auth(self):
        resp = self.client.post("/api/certificates/generate/", {"investment_id": str(self.investment.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_generate_rejects_non_owner_investment(self):
        self.client.force_authenticate(self.other)
        resp = self.client.post("/api/certificates/generate/", {"investment_id": str(self.investment.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_generate_and_list(self):
        self.client.force_authenticate(self.user)
        gen = self.client.post("/api/certificates/generate/", {"investment_id": str(self.investment.id)}, format="json")
        self.assertEqual(gen.status_code, status.HTTP_200_OK)
        self.assertTrue(gen.json()["success"])
        lst = self.client.get("/api/certificates/")
        self.assertEqual(lst.status_code, status.HTTP_200_OK)
        self.assertEqual(len(lst.json()), 1)

    def test_pdf_download_owner_only(self):
        cert = generate_certificate(self.investment)
        # Owner downloads OK.
        self.client.force_authenticate(self.user)
        ok = self.client.get(f"/api/certificates/{cert.id}/pdf/")
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(ok["Content-Type"], "application/pdf")
        # A different user cannot.
        self.client.force_authenticate(self.other)
        denied = self.client.get(f"/api/certificates/{cert.id}/pdf/")
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_pdf_download_generates_lazily_when_not_yet_rendered(self):
        # Client note 12: a provisional certificate exists but its PDF was never rendered
        # (pdf_file empty) → the old download 404'd and the button was disabled. It now
        # generates on demand and serves a real PDF.
        from .services import create_provisional_certificate

        cert = create_provisional_certificate(self.investment)
        self.assertFalse(cert.pdf_file)  # nothing rendered yet
        self.client.force_authenticate(self.user)
        resp = self.client.get(f"/api/certificates/{cert.id}/pdf/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        cert.refresh_from_db()
        self.assertTrue(cert.pdf_file)


@override_settings(MEDIA_ROOT=_TMP_MEDIA)
class CertificateVerifyPublicTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="v@example.com", password="pw12345!")
        self.prop = _property()
        self.investment = _investment(self.user, self.prop, tokens=100)
        self.cert = generate_certificate(self.investment)

    def test_verify_is_public_and_curated(self):
        # No auth needed.
        resp = self.client.get(f"/api/certificates/verify/{self.cert.verification_code}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.json()
        # Exactly the curated public fields.
        self.assertEqual(
            set(body.keys()),
            {
                "certificate_id", "status", "issue_date", "subscription_date",
                "finalized_at", "investor_name", "investor_id_masked", "spv_name",
                "spv_registration_ref", "property_name", "property_location",
                "listing_id", "investment_amount", "units_purchased", "unit_price",
                "ownership_percentage", "platform_fee", "authorized_signatory",
                "digital_signature_hash", "verification_code", "verification_url",
                "revocation_reason",
            },
        )

    def test_verify_omits_pii_and_internal_fields(self):
        resp = self.client.get(f"/api/certificates/verify/{self.cert.verification_code}/")
        body = resp.json()
        for forbidden in ("id", "user", "user_id", "email", "pdf_path", "pdf_url",
                          "pdf_file", "qr_code_data", "investment", "created_at",
                          "updated_at", "revoked_at"):
            self.assertNotIn(forbidden, body, forbidden)
        # The owner's email must not appear anywhere in the payload.
        self.assertNotIn("v@example.com", str(body))
        # Ownership shown is the corrected figure (0.2%, serialized as a JSON number).
        self.assertEqual(float(body["ownership_percentage"]), 0.2)

    def test_verify_unknown_code_404(self):
        self.assertEqual(
            self.client.get("/api/certificates/verify/does-not-exist/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_revoked_certificate_shows_revoked(self):
        self.cert.revoke(reason="Test revocation")
        resp = self.client.get(f"/api/certificates/verify/{self.cert.verification_code}/")
        body = resp.json()
        self.assertEqual(body["status"], "revoked")
        self.assertEqual(body["revocation_reason"], "Test revocation")
