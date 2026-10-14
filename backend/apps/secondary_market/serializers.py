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
    # The buyer pays the price + the resale fee (decision 5); legacy seller-paid rows: price.
    buyer_total = _Money(read_only=True)
    plan_id = serializers.UUIDField(read_only=True, allow_null=True)
    is_position = serializers.BooleanField(read_only=True)
    position_value = _Money(read_only=True, allow_null=True)
    paid_principal = _Money(read_only=True, allow_null=True)
    assumed_principal = _Money(read_only=True, allow_null=True)
    position = serializers.SerializerMethodField()

    class Meta:
        model = SecondaryMarketListing
        fields = (
            "id", "seller_id", "seller_type", "buyer_id", "buyer_type",
            "property_id", "property_name", "token_symbol", "token_amount",
            "unit_price", "total_value", "platform_fee_percent",
            "platform_fee_amount", "net_amount", "fee_payer", "buyer_total",
            "plan_id", "is_position", "position_value", "paid_principal",
            "assumed_principal", "position", "status",
            "listed_at", "purchased_at", "completed_at", "cancelled_at", "notes",
            "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_position(self, obj):
        """
        What the buyer of an OPEN position takes over: the plan's figures (never the seller's
        personal cost/gain) and every remaining installment with its date and amount.
        """
        if obj.plan_id is None or obj.status != SecondaryMarketListing.Status.LISTED:
            return None
        plan = obj.plan
        rows = [
            p for p in sorted(plan.payments.all(), key=lambda p: p.sequence)
            if p.status in ("pending", "missed")
        ]
        plan_price = plan.unit_price
        if plan_price is None and obj.token_amount:
            plan_price = (Decimal(plan.total_amount) / Decimal(obj.token_amount)).quantize(
                Decimal("0.01")
            )
        change_pct = (
            float((Decimal(obj.unit_price) / Decimal(plan_price) - 1) * 100)
            if plan_price else None
        )
        return {
            "plan_unit_price": float(plan_price) if plan_price is not None else None,
            "price_change_pct": round(change_pct, 2) if change_pct is not None else None,
            "fee_rate": float(plan.fee_rate or 0),
            "remaining_installments": len(rows),
            "remaining_charge": float(sum((p.charge_amount for p in rows), Decimal("0"))),
            "first_due_date": rows[0].due_date.isoformat() if rows else None,
            "overdue_installments": sum(1 for p in rows if p.status == "missed"),
            "frequency": plan.frequency,
            "rows": [
                {
                    "sequence": p.sequence,
                    "due_date": p.due_date.isoformat(),
                    "amount": float(p.amount),
                    "fee": float(p.fee_amount),
                    "charge": float(p.charge_amount),
                    "overdue": p.status == "missed",
                }
                for p in rows
            ],
        }


class SecondaryListAssetSerializer(serializers.Serializer):
    property_id = serializers.CharField(max_length=64)
    property_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    token_symbol = serializers.CharField(required=False, allow_blank=True, max_length=16)
    token_amount = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(
        required=False, max_digits=16, decimal_places=2, min_value=Decimal("0")
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class PositionListSerializer(serializers.Serializer):
    plan_id = serializers.UUIDField()
    price_per_unit = serializers.DecimalField(
        required=False, max_digits=16, decimal_places=2, min_value=Decimal("0.01")
    )


class PurchaseSerializer(serializers.Serializer):
    # Position purchases: the cash and fee the buyer saw (refused with POSITION_CHANGED if
    # they moved). Ignored for unit listings, whose price is fixed.
    expected_cash = serializers.DecimalField(required=False, max_digits=18, decimal_places=2)
    expected_fee = serializers.DecimalField(required=False, max_digits=18, decimal_places=2)
