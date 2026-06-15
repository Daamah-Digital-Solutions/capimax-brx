"""
LP serializers — Phase 6 Wave 1. Field names + types mirror the frontend
interfaces (src/hooks/useLiquidityProvider.ts) EXACTLY so the hook/page render
unchanged. Money fields are emitted as JSON numbers (not DRF's default decimal
strings) because the frontend does arithmetic on them (balance checks, totals).

No Sumsub ids are exposed; payout/bank details are returned to the OWNER only
(this serializer is only ever used for the caller's own profile).
"""
from decimal import Decimal

from rest_framework import serializers

from .models import (
    LiquidityProvider,
    LPDocument,
    LPHolding,
    LPMarketListing,
    LPTransaction,
)


# A money field that serializes to a JSON number, matching the frontend's `number`.
class _Money(serializers.DecimalField):
    def __init__(self, **kwargs):
        kwargs.setdefault("max_digits", 18)
        kwargs.setdefault("decimal_places", 2)
        kwargs.setdefault("coerce_to_string", False)
        super().__init__(**kwargs)


class LiquidityProviderSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)
    investment_amount = _Money()
    total_deposited = _Money(read_only=True)
    total_withdrawn = _Money(read_only=True)
    total_earnings = _Money(read_only=True)
    current_balance = _Money(read_only=True)

    class Meta:
        model = LiquidityProvider
        fields = (
            "id", "user_id",
            "company_name", "contact_name", "email", "phone", "country",
            "investment_amount", "status",
            "applied_at", "approved_at", "rejected_at", "rejection_reason",
            "bank_name", "bank_account_number", "bank_iban", "bank_swift",
            "crypto_wallet_address", "crypto_network",
            "total_deposited", "total_withdrawn", "total_earnings", "current_balance",
            "kyb_status", "business_type", "business_registration_number", "tax_id",
            "business_address", "business_description", "annual_revenue",
            "source_of_funds",
            "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
            "kyb_rejection_reason",
            "created_at", "updated_at",
        )
        # Status/approval/balances are server-controlled; only the apply/PATCH
        # serializers below may write the user-editable subsets.
        read_only_fields = (
            "id", "user_id", "status", "applied_at", "approved_at", "rejected_at",
            "rejection_reason", "kyb_status", "kyb_submitted_at", "kyb_approved_at",
            "kyb_rejected_at", "kyb_rejection_reason", "created_at", "updated_at",
        )


class LPApplySerializer(serializers.Serializer):
    """Apply as LP (frontend RegistrationData). Creates the pending profile."""

    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True, max_length=40)
    country = serializers.CharField(required=False, allow_blank=True, max_length=120)
    investment_amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0")
    )


class LPBankDetailsSerializer(serializers.Serializer):
    bank_name = serializers.CharField(allow_blank=True, max_length=255)
    bank_account_number = serializers.CharField(allow_blank=True, max_length=64)
    bank_iban = serializers.CharField(allow_blank=True, max_length=64)
    bank_swift = serializers.CharField(allow_blank=True, max_length=32)


class LPCryptoDetailsSerializer(serializers.Serializer):
    crypto_wallet_address = serializers.CharField(allow_blank=True, max_length=128)
    crypto_network = serializers.CharField(allow_blank=True, max_length=64)


class LPKYBSubmitSerializer(serializers.Serializer):
    """Business info the KYB form sends (frontend KYBData)."""

    business_type = serializers.CharField(max_length=64)
    business_registration_number = serializers.CharField(max_length=120)
    tax_id = serializers.CharField(required=False, allow_blank=True, max_length=120)
    business_address = serializers.CharField(max_length=500)
    business_description = serializers.CharField(required=False, allow_blank=True)
    annual_revenue = serializers.CharField(required=False, allow_blank=True, max_length=64)
    source_of_funds = serializers.CharField(max_length=64)


class LPWithdrawalSerializer(serializers.Serializer):
    """Create a withdrawal request (frontend WithdrawalData)."""

    amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0.01")
    )
    withdrawal_method = serializers.ChoiceField(choices=["bank", "crypto"])
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class LPTransactionSerializer(serializers.ModelSerializer):
    lp_id = serializers.UUIDField(read_only=True)
    amount = _Money(read_only=True)

    class Meta:
        model = LPTransaction
        fields = (
            "id", "lp_id", "tx_type", "amount", "currency", "status",
            "withdrawal_method", "bank_reference", "crypto_tx_hash", "notes",
            "created_at", "processed_at",
        )
        read_only_fields = fields


class LPDocumentSerializer(serializers.ModelSerializer):
    lp_id = serializers.UUIDField(read_only=True, allow_null=True)
    user_id = serializers.UUIDField(read_only=True, allow_null=True)
    # Keep the frontend's `file_path` key; expose the stored file's path (the blob
    # itself is fetched from the owner-only download endpoint).
    file_path = serializers.SerializerMethodField()

    class Meta:
        model = LPDocument
        fields = (
            "id", "lp_id", "user_id", "document_name", "document_type",
            "file_path", "file_size", "is_template", "uploaded_by", "created_at",
        )
        read_only_fields = fields

    def get_file_path(self, obj) -> str:
        return obj.file.name if obj.file else ""


# --------------------------------------------------------------------------- #
# LP secondary market (Phase 6 Wave 2) — shapes mirror src/hooks/useLPMarket.ts +
# useLPHoldings.ts EXACTLY (money as JSON numbers). `investor_id` is the seller;
# `lp_id` is the buying LiquidityProvider id (null until purchased).
# --------------------------------------------------------------------------- #
class LPMarketListingSerializer(serializers.ModelSerializer):
    investor_id = serializers.UUIDField(source="seller_id", read_only=True)
    lp_id = serializers.UUIDField(read_only=True, allow_null=True)
    unit_price = _Money(read_only=True)
    total_value = _Money(read_only=True)
    platform_fee_percent = serializers.FloatField(read_only=True)
    platform_fee_amount = _Money(read_only=True)
    net_amount = _Money(read_only=True)

    class Meta:
        model = LPMarketListing
        fields = (
            "id", "investor_id", "lp_id", "property_id", "property_name",
            "token_symbol", "token_amount", "unit_price", "total_value",
            "platform_fee_percent", "platform_fee_amount", "net_amount", "status",
            "listed_at", "purchased_at", "completed_at", "cancelled_at", "notes",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class LPListAssetSerializer(serializers.Serializer):
    """Create a listing (frontend ListAssetData)."""

    property_id = serializers.CharField(max_length=64)
    property_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    token_symbol = serializers.CharField(required=False, allow_blank=True, max_length=16)
    token_amount = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(
        required=False, max_digits=16, decimal_places=2, min_value=Decimal("0")
    )
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class LPHoldingSerializer(serializers.ModelSerializer):
    lp_id = serializers.UUIDField(read_only=True)
    listing_id = serializers.UUIDField(read_only=True, allow_null=True)
    purchase_price = _Money(read_only=True)
    current_value = _Money(read_only=True)

    class Meta:
        model = LPHolding
        fields = (
            "id", "lp_id", "listing_id", "property_id", "property_name",
            "token_symbol", "token_amount", "purchase_price", "current_value",
            "purchase_date", "status", "listed_at", "sold_at",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class LPHoldingStatusSerializer(serializers.Serializer):
    """PATCH a holding's status (frontend updateHoldingStatus)."""

    status = serializers.ChoiceField(
        choices=["held", "listed_lp", "listed_secondary", "sold"]
    )
    listed_at = serializers.DateTimeField(required=False, allow_null=True)
