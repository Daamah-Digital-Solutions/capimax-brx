"""
KYC serializers — Phase 4.

`KYCStatusSerializer` mirrors the frontend `KycStatus` shape
(src/hooks/useUserWallet.ts): status + submitted_at + approved_at, plus the
rejection fields the UI can surface. No PII / no Sumsub ids are exposed.
"""
from rest_framework import serializers

from .models import UserKYC


class KYCStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserKYC
        fields = (
            "status",
            "submitted_at",
            "approved_at",
            "rejected_at",
            "rejection_reason",
        )
        read_only_fields = fields


class KYCSubmitSerializer(serializers.Serializer):
    """
    Personal info the frontend onboarding/wallet KYC form may send. All optional —
    the authoritative identity verification happens in Sumsub (WebSDK). Never sets
    status directly; the service does that.
    """

    first_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    nationality = serializers.CharField(required=False, allow_blank=True, max_length=120)
    country = serializers.CharField(required=False, allow_blank=True, max_length=120)
    city = serializers.CharField(required=False, allow_blank=True, max_length=120)
    address = serializers.CharField(required=False, allow_blank=True, max_length=400)
