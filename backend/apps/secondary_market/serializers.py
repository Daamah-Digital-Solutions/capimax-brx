"""Peer secondary-market serializers — Phase 6 Wave 3. Money as JSON numbers."""
from decimal import Decimal

from rest_framework import serializers

from .models import SecondaryMarketListing


class _Money(serializers.DecimalField):
    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 18)
        kwargs.setdefault("decimal_places", 2)
        kwargs.setdefault("coerce_to_string", False)
        super().__init__(**kwargs)


class SecondaryMarketListingSerializer(serializers.ModelSerializer):
    seller_id = serializers.UUIDField(read_only=True)
    buyer_id = serializers.UUIDField(read_only=True, allow_null=True)
    unit_price = _Money(read_only=True)
    total_value = _Money(read_only=True)
    platform_fee_percent = serializers.FloatField(read_only=True)
    platform_fee_amount = _Money(read_only=True)
    net_amount = _Money(read_only=True)

    class Meta:
        model = SecondaryMarketListing
        fields = (
            "id", "seller_id", "seller_type", "buyer_id", "buyer_type",
            "property_id", "property_name", "token_symbol", "token_amount",
            "unit_price", "total_value", "platform_fee_percent",
            "platform_fee_amount", "net_amount", "status",
            "listed_at", "purchased_at", "completed_at", "cancelled_at", "notes",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class SecondaryListAssetSerializer(serializers.Serializer):
    property_id = serializers.CharField(max_length=64)
    property_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    token_symbol = serializers.CharField(required=False, allow_blank=True, max_length=16)
    token_amount = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(
        required=False, max_digits=16, decimal_places=2, min_value=Decimal("0")
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)
