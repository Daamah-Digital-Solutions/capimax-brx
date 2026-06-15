"""Payment serializers — Phase 5 Wave 1. Exposes only non-sensitive references."""
from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    investment_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Payment
        # No card data, no client_secret — only references and status.
        fields = (
            "id",
            "investment_id",
            "provider",
            "amount",
            "currency",
            "status",
            "created_at",
        )
        read_only_fields = fields
