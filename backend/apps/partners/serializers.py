"""
Partner serializers — Phase 11 Wave A. Mirrors the developer serializers' approach: a
full profile serializer (server-controlled status/KYB/directory-status fields read-only)
+ thin apply / directory-update / KYB-submit input serializers. Only ever used for the
caller's OWN profile.

The public directory uses its own lean serializer (PublicPartnerSerializer) shaped to
Partners.tsx — it never exposes KYB/contact/Sumsub internals.

No Sumsub ids are exposed.
"""
from rest_framework import serializers

from .models import PartnerCategory, PartnerProfile

# Directory fields the partner may write (decision #3).
_DIRECTORY_INPUT = (
    "company_name", "company_name_ar", "category", "description", "description_ar",
    "logo_url", "country", "country_ar", "website",
)


class PartnerProfileSerializer(serializers.ModelSerializer):
    """Full self-scoped read of the caller's partner profile (KYB + directory state)."""

    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = PartnerProfile
        fields = (
            "id", "user_id",
            "contact_name", "email", "phone",
            "status",
            "applied_at", "approved_at", "rejected_at", "rejection_reason",
            "kyb_status", "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description",
            "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
            "kyb_rejection_reason",
            # Partner-entered directory fields + the INDEPENDENT directory state.
            "company_name", "company_name_ar", "category", "description",
            "description_ar", "logo_url", "country", "country_ar", "website",
            "directory_status", "directory_reviewed_at", "directory_review_notes",
            "created_at", "updated_at",
        )
        # Status/approval/KYB-state AND directory_status are server-/admin-controlled.
        # The partner edits the directory DATA fields (via the update serializer), never
        # the directory STATUS — that is the admin's separate approve/reject decision.
        read_only_fields = (
            "id", "user_id", "status", "applied_at", "approved_at", "rejected_at",
            "rejection_reason", "kyb_status", "kyb_submitted_at", "kyb_approved_at",
            "kyb_rejected_at", "kyb_rejection_reason",
            "directory_status", "directory_reviewed_at", "directory_review_notes",
            "created_at", "updated_at",
        )


class _DirectoryFieldsMixin(serializers.Serializer):
    """The partner-entered public-directory fields (all optional)."""

    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    company_name_ar = serializers.CharField(required=False, allow_blank=True, max_length=255)
    category = serializers.ChoiceField(
        choices=PartnerCategory.choices, required=False, allow_blank=True
    )
    description = serializers.CharField(required=False, allow_blank=True)
    description_ar = serializers.CharField(required=False, allow_blank=True)
    logo_url = serializers.URLField(required=False, allow_blank=True, max_length=500)
    country = serializers.CharField(required=False, allow_blank=True, max_length=120)
    country_ar = serializers.CharField(required=False, allow_blank=True, max_length=120)
    website = serializers.URLField(required=False, allow_blank=True, max_length=500)


class PartnerApplySerializer(_DirectoryFieldsMixin):
    """
    Apply as a partner. Creates the pending profile (entity contact details), and may
    carry the directory fields in the same payload (all optional).
    """

    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)


class PartnerDirectorySerializer(_DirectoryFieldsMixin):
    """The partner updates their own public-directory fields (no status change)."""


class PartnerKYBSubmitSerializer(serializers.Serializer):
    """Business info the partner KYB form sends (mirrors developer KYB submit)."""

    business_type = serializers.CharField(max_length=64)
    business_registration_number = serializers.CharField(max_length=120)
    tax_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    business_address = serializers.CharField(max_length=500)
    business_description = serializers.CharField(required=False, allow_blank=True)


class PublicPartnerSerializer(serializers.ModelSerializer):
    """
    The PUBLIC directory shape (Partners.tsx). Lists only directory-approved partners;
    exposes ONLY display data + a `verified` badge (KYB-approved). No contact, no KYB
    internals, no Sumsub ids.
    """

    name = serializers.CharField(source="company_name")
    nameAr = serializers.CharField(source="company_name_ar")
    descriptionAr = serializers.CharField(source="description_ar")
    countryAr = serializers.CharField(source="country_ar")
    verified = serializers.SerializerMethodField()

    class Meta:
        model = PartnerProfile
        fields = (
            "id", "name", "nameAr", "category", "description", "descriptionAr",
            "logo_url", "country", "countryAr", "website", "verified",
        )

    def get_verified(self, obj) -> bool:
        # The "verified" badge reflects entity verification (KYB approved).
        return obj.status == "approved"
