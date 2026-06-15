"""
Certificate serializers — Phase 3 Wave 3.

Two strictly separate shapes:
  * `CertificateSerializer` — the OWNER's view (GET /api/certificates/, generate).
  * `CertificatePublicSerializer` — the CURATED public projection for the public
    verify endpoint (SPEC §4.2). It exposes ONLY non-sensitive fields and
    deliberately omits the internal id, user/email, pdf paths, and qr payload.
"""
from rest_framework import serializers

from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    """Owner view — matches the frontend `Certificate` shape (useCertificates.ts)."""

    class Meta:
        model = Certificate
        fields = (
            "id",
            "certificate_id",
            "status",
            "issue_date",
            "subscription_date",
            "finalized_at",
            "investor_name",
            "investor_id_masked",
            "spv_name",
            "spv_registration_ref",
            "property_name",
            "property_location",
            "listing_id",
            "investment_amount",
            "units_purchased",
            "unit_price",
            "ownership_percentage",
            "platform_fee",
            "authorized_signatory",
            "digital_signature_hash",
            "verification_code",
            "verification_url",
            "pdf_url",
            "pdf_path",
            "created_at",
        )
        read_only_fields = fields


class CertificatePublicSerializer(serializers.ModelSerializer):
    """
    CURATED public projection (SPEC §4.2 verify_certificate). PUBLIC — must NEVER
    leak the internal id, the owning user / email, pdf storage paths, the QR payload,
    or any other PII. Exactly the fields the public /verify page renders.
    """

    class Meta:
        model = Certificate
        fields = (
            "certificate_id",
            "status",
            "issue_date",
            "subscription_date",
            "finalized_at",
            "investor_name",
            "investor_id_masked",
            "spv_name",
            "spv_registration_ref",
            "property_name",
            "property_location",
            "listing_id",
            "investment_amount",
            "units_purchased",
            "unit_price",
            "ownership_percentage",
            "platform_fee",
            "authorized_signatory",
            "digital_signature_hash",
            "verification_code",
            "verification_url",
            "revocation_reason",
        )
        read_only_fields = fields
