"""
Owner serializers — Phase 7 Wave A. Mirrors the LP serializers' approach: a full
profile serializer (server-controlled status/KYB fields read-only) + thin apply /
KYB-submit input serializers. Only ever used for the caller's OWN profile.

No Sumsub ids are exposed.
"""
from decimal import Decimal

from rest_framework import serializers

from .models import OwnerProfile, PropertySubmission, SubmissionDocument


class OwnerProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = OwnerProfile
        fields = (
            "id", "user_id",
            "company_name", "contact_name", "email", "phone", "country",
            "status",
            "applied_at", "approved_at", "rejected_at", "rejection_reason",
            "kyb_status", "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description",
            "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
            "kyb_rejection_reason",
            "created_at", "updated_at",
        )
        # Status/approval/KYB-state are server-controlled; only the apply / KYB-submit
        # serializers below may write the user-editable subsets.
        read_only_fields = (
            "id", "user_id", "status", "applied_at", "approved_at", "rejected_at",
            "rejection_reason", "kyb_status", "kyb_submitted_at", "kyb_approved_at",
            "kyb_rejected_at", "kyb_rejection_reason", "created_at", "updated_at",
        )


class OwnerApplySerializer(serializers.Serializer):
    """Apply as an owner. Creates the pending profile (entity contact details)."""

    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)
    country = serializers.CharField(required=False, allow_blank=True, max_length=120)


class OwnerKYBSubmitSerializer(serializers.Serializer):
    """Business info the owner KYB form sends."""

    business_type = serializers.CharField(max_length=64)
    business_registration_number = serializers.CharField(max_length=120)
    tax_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    business_address = serializers.CharField(max_length=500)
    business_description = serializers.CharField(required=False, allow_blank=True)


# --------------------------------------------------------------------------- #
# Property submission intake — Phase 7 Wave B. Field names mirror SubmitProperty.tsx.
# --------------------------------------------------------------------------- #
class SubmissionDocumentSerializer(serializers.ModelSerializer):
    submission_id = serializers.UUIDField(read_only=True)
    file_path = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionDocument
        fields = (
            "id", "submission_id", "document_type", "document_name",
            "file_path", "file_size", "uploaded_at",
        )
        read_only_fields = fields

    def get_file_path(self, obj) -> str:
        return obj.file.name if obj.file else ""


class PropertySubmissionSerializer(serializers.ModelSerializer):
    submitter_id = serializers.UUIDField(read_only=True)
    documents = SubmissionDocumentSerializer(many=True, read_only=True)
    # The published catalog property's slug (frontend `id` → /property/{slug}) once
    # approved; null otherwise. Lets the owner jump to their now-live listing (Wave C).
    published_property_slug = serializers.SerializerMethodField()
    # Money/percent as JSON numbers to match the frontend's number fields.
    property_value_usd = serializers.DecimalField(
        max_digits=18, decimal_places=2, coerce_to_string=False, allow_null=True, required=False
    )
    min_investment = serializers.DecimalField(
        max_digits=18, decimal_places=2, coerce_to_string=False, allow_null=True, required=False
    )
    expected_yield = serializers.DecimalField(
        max_digits=6, decimal_places=2, coerce_to_string=False, allow_null=True, required=False
    )
    # Coordinates as JSON numbers (match the frontend's number inputs).
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, coerce_to_string=False, allow_null=True, required=False
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, coerce_to_string=False, allow_null=True, required=False
    )

    class Meta:
        model = PropertySubmission
        fields = (
            "id", "submitter_id",
            "name", "property_type", "construction_status", "description",
            "country", "city", "district", "address", "latitude", "longitude",
            "property_value_usd", "min_investment", "expected_yield",
            "duration_years", "distribution_model", "virtual_tour_url",
            "status", "review_notes", "submitted_at", "reviewed_at",
            "published_property_slug",
            "documents", "created_at", "updated_at",
        )
        # status / review_notes / submitted_at / reviewed_at / published_property are
        # server-controlled (Wave-C review sets under_review/approved/rejected + notes).
        # The intake never writes them.
        read_only_fields = (
            "id", "submitter_id", "status", "review_notes", "submitted_at",
            "reviewed_at", "published_property_slug", "documents", "created_at", "updated_at",
        )

    def get_published_property_slug(self, obj) -> str | None:
        return obj.published_property.slug if obj.published_property_id else None


class PropertySubmissionWriteSerializer(serializers.ModelSerializer):
    """Create/edit the content fields (draft). All optional so a partial draft saves."""

    property_value_usd = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0"),
        allow_null=True, required=False,
    )
    min_investment = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0"),
        allow_null=True, required=False,
    )
    expected_yield = serializers.DecimalField(
        max_digits=6, decimal_places=2, min_value=Decimal("0"),
        allow_null=True, required=False,
    )
    # Geographic coordinates (manual entry → real persistence). Range-validated so a bad
    # value is rejected, never silently stored. Optional + nullable (draft-friendly).
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6,
        min_value=Decimal("-90"), max_value=Decimal("90"),
        allow_null=True, required=False,
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6,
        min_value=Decimal("-180"), max_value=Decimal("180"),
        allow_null=True, required=False,
    )
    virtual_tour_url = serializers.URLField(
        max_length=500, allow_blank=True, required=False,
    )

    class Meta:
        model = PropertySubmission
        fields = (
            "name", "property_type", "construction_status", "description",
            "country", "city", "district", "address", "latitude", "longitude",
            "property_value_usd", "min_investment", "expected_yield",
            "duration_years", "distribution_model", "virtual_tour_url",
        )
        extra_kwargs = {f: {"required": False} for f in fields}
