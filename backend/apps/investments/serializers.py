"""
Investment serializers — Phase 3 Wave 2.

The CREATE serializer accepts ONLY what the client may choose — which property and
how many tokens — and the server computes amount, price, ownership and symbol from
the real Property (clients never dictate the economics). SPEC §4.1.
"""
from rest_framework import serializers

from apps.properties.models import Property

from .models import Investment

# Payment methods the frontend offers (src/pages/Checkout.tsx PaymentMethod).
PAYMENT_METHODS = ["card", "apple_pay", "google_pay", "crypto", "pronova", "sukuk"]


class InvestmentCreateSerializer(serializers.Serializer):
    """Input for POST /api/investments/. Resolves the frontend string id → Property."""

    property_id = serializers.CharField()  # Property.slug (frontend string id)
    token_amount = serializers.IntegerField(min_value=1)
    payment_method = serializers.ChoiceField(choices=PAYMENT_METHODS)

    def validate(self, attrs):
        try:
            prop = Property.objects.get(slug=attrs["property_id"], is_published=True)
        except Property.DoesNotExist:
            raise serializers.ValidationError(
                {"property_id": "No published property with this id."}
            )
        attrs["property"] = prop
        return attrs


class InvestmentSerializer(serializers.ModelSerializer):
    """Read representation (snake_case) — used by admin/tests and future list APIs."""

    property_id = serializers.CharField(source="property.slug", read_only=True)
    wallet_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Investment
        fields = (
            "id",
            "property_id",
            "property_name",
            "amount_invested",
            "token_amount",
            "token_symbol",
            "price_per_token",
            "ownership_percentage",
            "payment_method",
            "payment_status",
            "tokens_minted",
            "minted_at",
            "wallet_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
