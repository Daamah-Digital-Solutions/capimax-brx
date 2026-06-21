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
    """Input for POST /api/investments/. Resolves the frontend string id → Property.

    Installments (Wave B): an installment purchase additionally sends
    `is_installment` + the terms (`down_payment_percent`, `n_installments`,
    `frequency`). The server charges only the DOWN-PAYMENT (computed cent-exact) and
    mints the full position LOCKED on the confirmed webhook. Normal buys omit these.
    """

    property_id = serializers.CharField()  # Property.slug (frontend string id)
    token_amount = serializers.IntegerField(min_value=1)
    payment_method = serializers.ChoiceField(choices=PAYMENT_METHODS)
    # Installment terms (only required when is_installment).
    is_installment = serializers.BooleanField(required=False, default=False)
    down_payment_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )
    n_installments = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    frequency = serializers.ChoiceField(
        choices=["monthly", "quarterly"], required=False, default="monthly"
    )

    def validate(self, attrs):
        try:
            prop = Property.objects.get(slug=attrs["property_id"], is_published=True)
        except Property.DoesNotExist:
            raise serializers.ValidationError(
                {"property_id": "No published property with this id."}
            )
        attrs["property"] = prop
        if attrs.get("is_installment"):
            if attrs.get("down_payment_percent") is None or attrs.get("n_installments") is None:
                raise serializers.ValidationError(
                    {"installment": "down_payment_percent and n_installments are required for an installment."}
                )
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
            # Installments (Wave B): so the checkout poll / portfolio can show the
            # installment context + the down-payment that was actually charged.
            "is_installment",
            "down_payment_amount",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
