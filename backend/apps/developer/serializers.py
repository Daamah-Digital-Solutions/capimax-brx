"""
Developer serializers — Phase 8 Wave A. Mirrors the owner serializers' approach: a full
profile serializer (server-controlled status/KYB fields read-only) + thin apply /
KYB-submit input serializers. Only ever used for the caller's OWN profile.

No Sumsub ids are exposed.
"""
from rest_framework import serializers

from .models import DeveloperProfile


class DeveloperProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = DeveloperProfile
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


class DeveloperApplySerializer(serializers.Serializer):
    """Apply as a developer. Creates the pending profile (entity contact details)."""

    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)
    country = serializers.CharField(required=False, allow_blank=True, max_length=120)


class DeveloperKYBSubmitSerializer(serializers.Serializer):
    """Business info the developer KYB form sends."""

    business_type = serializers.CharField(max_length=64)
    business_registration_number = serializers.CharField(max_length=120)
    tax_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    business_address = serializers.CharField(max_length=500)
    business_description = serializers.CharField(required=False, allow_blank=True)
