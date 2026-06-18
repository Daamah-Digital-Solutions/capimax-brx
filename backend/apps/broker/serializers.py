"""
Broker serializers — Phase 12 Wave A. A full self-scoped profile serializer (status /
approval / referral_code / commission accumulators all READ-ONLY) + thin apply / licence
input serializers. Only ever used for the caller's OWN broker profile.

NO money is writable; the commission accumulators are read-only display fields (and
unwritten this wave). The referral code/link are server-generated, never client-set.
"""
from rest_framework import serializers

from .models import BrokerProfile


class BrokerProfileSerializer(serializers.ModelSerializer):
    """Full self-scoped read of the caller's broker profile (licence + referral state)."""

    user_id = serializers.UUIDField(read_only=True)
    referral_link = serializers.CharField(read_only=True)
    # `has_license_document` so the UI can show "uploaded" without exposing the file URL.
    has_license_document = serializers.SerializerMethodField()

    class Meta:
        model = BrokerProfile
        fields = (
            "id", "user_id",
            "contact_name", "email", "phone",
            "status",
            "applied_at", "approved_at", "rejected_at",
            # Licence (the broker fills number/authority/expiry + uploads the document).
            "license_number", "license_authority", "license_expiry",
            "has_license_document", "license_submitted_at", "license_reviewed_at",
            "review_notes",
            # Referral identity.
            "referral_code", "referral_link",
            # Commission accumulators (Wave B; read-only, unwritten this wave).
            "commission_rate", "total_commission_earned", "pending_commission",
            "created_at", "updated_at",
        )
        # Status / approval / referral identity / commission are server-/admin-controlled.
        # The broker only writes licence DATA fields (via the licence-submit serializer)
        # and uploads the document; never the status, referral code, or any money field.
        read_only_fields = (
            "id", "user_id", "status", "applied_at", "approved_at", "rejected_at",
            "license_submitted_at", "license_reviewed_at", "review_notes",
            "referral_code", "referral_link",
            "commission_rate", "total_commission_earned", "pending_commission",
            "created_at", "updated_at",
        )

    def get_has_license_document(self, obj) -> bool:
        return bool(obj.license_document)


class BrokerApplySerializer(serializers.Serializer):
    """Apply as a broker. Creates the pending profile (contact details)."""

    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)


class BrokerLicenseSubmitSerializer(serializers.Serializer):
    """Licence details the broker submits (the document is uploaded separately)."""

    license_number = serializers.CharField(max_length=120)
    license_authority = serializers.CharField(max_length=255)
    license_expiry = serializers.DateField(required=False, allow_null=True)
