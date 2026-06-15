"""
Property serializers — Phase 2.

CRITICAL: these output the EXACT camelCase shape the frontend already consumes
(the `Property` interface + sub-shapes in src/data/properties.ts), so the UI needs
NO shape change. Every key name and nesting matches properties.ts. Decimals serialize
as JSON numbers (REST_FRAMEWORK COERCE_DECIMAL_TO_STRING=False) because the frontend
uses them numerically (e.g. `totalValue.toLocaleString()`).
"""
from rest_framework import serializers

from .models import (
    DeveloperReport,
    FutureContract,
    InstallmentSchedule,
    OptionContract,
    PortfolioAsset,
    Property,
    PropertyDocument,
    PropertyFinancials,
    PropertyPhase,
    SharedOwnership,
    SPVRecord,
    TokenMetadata,
    ValuationReport,
)


# --------------------------------------------------------------------------- #
# Nested model blocks (camelCase to match properties.ts sub-interfaces)
# --------------------------------------------------------------------------- #
class InstallmentScheduleSerializer(serializers.ModelSerializer):
    totalInstallments = serializers.IntegerField(source="total_installments")
    paidInstallments = serializers.IntegerField(source="paid_installments")
    monthlyAmount = serializers.DecimalField(
        source="monthly_amount", max_digits=12, decimal_places=2
    )
    nextPaymentDate = serializers.DateField(source="next_payment_date")
    activationDate = serializers.DateField(source="activation_date")
    completionPercent = serializers.DecimalField(
        source="completion_percent", max_digits=5, decimal_places=2
    )

    class Meta:
        model = InstallmentSchedule
        fields = (
            "totalInstallments",
            "paidInstallments",
            "monthlyAmount",
            "nextPaymentDate",
            "activationDate",
            "completionPercent",
        )


class PhaseSerializer(serializers.ModelSerializer):
    nameAr = serializers.CharField(source="name_ar")
    tokenPrice = serializers.DecimalField(
        source="token_price", max_digits=12, decimal_places=2
    )
    startDate = serializers.DateField(source="start_date")
    endDate = serializers.DateField(source="end_date")

    class Meta:
        model = PropertyPhase
        fields = ("number", "name", "nameAr", "tokenPrice", "startDate", "endDate", "status", "progress")


class FutureContractSerializer(serializers.ModelSerializer):
    reservationDate = serializers.DateField(source="reservation_date")
    activationDate = serializers.DateField(source="activation_date")
    settlementDate = serializers.DateField(source="settlement_date")
    reservationPrice = serializers.DecimalField(
        source="reservation_price", max_digits=12, decimal_places=2
    )
    estimatedFutureValue = serializers.DecimalField(
        source="estimated_future_value", max_digits=12, decimal_places=2
    )
    estimatedRoi = serializers.DecimalField(
        source="estimated_roi", max_digits=6, decimal_places=2
    )

    class Meta:
        model = FutureContract
        fields = (
            "reservationDate",
            "activationDate",
            "settlementDate",
            "reservationPrice",
            "estimatedFutureValue",
            "estimatedRoi",
        )


class OptionContractSerializer(serializers.ModelSerializer):
    optionPremium = serializers.DecimalField(
        source="option_premium", max_digits=12, decimal_places=2
    )
    strikePrice = serializers.DecimalField(
        source="strike_price", max_digits=12, decimal_places=2
    )
    expiryDate = serializers.DateField(source="expiry_date")
    validityMonths = serializers.IntegerField(source="validity_months")
    estimatedFutureValue = serializers.DecimalField(
        source="estimated_future_value", max_digits=12, decimal_places=2
    )
    exerciseConditions = serializers.CharField(source="exercise_conditions")
    exerciseConditionsAr = serializers.CharField(source="exercise_conditions_ar")

    class Meta:
        model = OptionContract
        fields = (
            "optionPremium",
            "strikePrice",
            "expiryDate",
            "validityMonths",
            "estimatedFutureValue",
            "exerciseConditions",
            "exerciseConditionsAr",
        )


class SharedOwnershipSerializer(serializers.ModelSerializer):
    investorShare = serializers.DecimalField(
        source="investor_share", max_digits=5, decimal_places=2
    )
    ownerShare = serializers.DecimalField(
        source="owner_share", max_digits=5, decimal_places=2
    )
    ownerName = serializers.CharField(source="owner_name")
    profitSplit = serializers.CharField(source="profit_split")
    revenueDistribution = serializers.CharField(source="revenue_distribution")
    transferProcess = serializers.CharField(source="transfer_process")
    transferProcessAr = serializers.CharField(source="transfer_process_ar")

    class Meta:
        model = SharedOwnership
        fields = (
            "investorShare",
            "ownerShare",
            "ownerName",
            "profitSplit",
            "revenueDistribution",
            "transferProcess",
            "transferProcessAr",
        )


class PortfolioAssetSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="asset_slug")  # frontend id e.g. "p1-a"
    nameAr = serializers.CharField(source="name_ar")
    assetType = serializers.CharField(source="asset_type")

    class Meta:
        model = PortfolioAsset
        fields = ("id", "name", "nameAr", "city", "weight", "assetType")


class DeveloperReportSerializer(serializers.ModelSerializer):
    titleAr = serializers.CharField(source="title_ar")

    class Meta:
        model = DeveloperReport
        fields = ("date", "title", "titleAr", "progress")


class ValuationReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValuationReport
        fields = ("date", "valuation", "appraiser")


# --- detail / data-room extras (SPEC §3.1) -------------------------------- #
class SPVSerializer(serializers.ModelSerializer):
    registrationNumber = serializers.CharField(source="registration_number")

    class Meta:
        model = SPVRecord
        fields = ("name", "jurisdiction", "registrationNumber", "established")


class TokenMetadataSerializer(serializers.ModelSerializer):
    contractAddress = serializers.CharField(source="contract_address")
    networkIcon = serializers.CharField(source="network_icon")
    totalSupply = serializers.IntegerField(source="total_supply")
    tokenizedUnits = serializers.IntegerField(source="tokenized_units")
    tokenPrice = serializers.DecimalField(
        source="token_price", max_digits=12, decimal_places=2
    )
    deployedDate = serializers.DateField(source="deployed_date")
    explorerUrl = serializers.CharField(source="explorer_url")

    class Meta:
        model = TokenMetadata
        fields = (
            "contractAddress",
            "network",
            "networkIcon",
            "standard",
            "totalSupply",
            "tokenizedUnits",
            "tokenPrice",
            "verified",
            "deployedDate",
            "explorerUrl",
        )


class FinancialsSerializer(serializers.ModelSerializer):
    purchasePrice = serializers.DecimalField(
        source="purchase_price", max_digits=16, decimal_places=2
    )
    currentValuation = serializers.DecimalField(
        source="current_valuation", max_digits=16, decimal_places=2
    )
    grossRentalIncome = serializers.DecimalField(
        source="gross_rental_income", max_digits=16, decimal_places=2
    )
    operatingExpenses = serializers.DecimalField(
        source="operating_expenses", max_digits=16, decimal_places=2
    )
    netOperatingIncome = serializers.DecimalField(
        source="net_operating_income", max_digits=16, decimal_places=2
    )
    capRate = serializers.DecimalField(source="cap_rate", max_digits=6, decimal_places=2)
    occupancyRate = serializers.DecimalField(
        source="occupancy_rate", max_digits=5, decimal_places=2
    )

    class Meta:
        model = PropertyFinancials
        fields = (
            "purchasePrice",
            "currentValuation",
            "grossRentalIncome",
            "operatingExpenses",
            "netOperatingIncome",
            "capRate",
            "occupancyRate",
        )


class PropertyDocumentSerializer(serializers.ModelSerializer):
    nameEn = serializers.CharField(source="name_en")
    type = serializers.CharField(source="doc_type")

    class Meta:
        model = PropertyDocument
        fields = ("name", "nameEn", "date", "type")


# --------------------------------------------------------------------------- #
# Property — common fields shared by list + detail
# --------------------------------------------------------------------------- #
_COMMON_FIELDS = (
    "id",
    "name",
    "nameAr",
    "location",
    "locationAr",
    "country",
    "city",
    "image",
    "images",
    "assetType",
    "model",
    "category",
    "status",
    "yieldType",
    "riskLevel",
    "totalValue",
    "tokenPrice",
    "tokenSupply",
    "futureTokenPrice",
    "expectedYield",
    "expectedGrowth",
    "funded",
    "investors",
    "minInvestment",
    "duration",
    "durationAr",
    "exitEligible",
    "exitAvailability",
    "insuranceActive",
    "description",
    "descriptionAr",
    "constructionProgress",
)


class _PropertyBaseSerializer(serializers.ModelSerializer):
    """Common camelCase mapping for both list and detail."""

    id = serializers.CharField(source="slug")  # UI uses string ids; resolve by slug
    nameAr = serializers.CharField(source="name_ar")
    locationAr = serializers.CharField(source="location_ar")
    assetType = serializers.CharField(source="asset_type")
    yieldType = serializers.CharField(source="yield_type")
    riskLevel = serializers.CharField(source="risk_level")
    totalValue = serializers.DecimalField(source="total_value", max_digits=16, decimal_places=2)
    tokenPrice = serializers.DecimalField(source="token_price", max_digits=12, decimal_places=2)
    tokenSupply = serializers.IntegerField(source="token_supply")
    futureTokenPrice = serializers.DecimalField(
        source="future_token_price", max_digits=12, decimal_places=2, allow_null=True
    )
    expectedYield = serializers.DecimalField(
        source="expected_yield", max_digits=6, decimal_places=2, allow_null=True
    )
    expectedGrowth = serializers.DecimalField(
        source="expected_growth", max_digits=6, decimal_places=2, allow_null=True
    )
    minInvestment = serializers.DecimalField(source="min_investment", max_digits=12, decimal_places=2)
    durationAr = serializers.CharField(source="duration_ar")
    exitEligible = serializers.BooleanField(source="exit_eligible")
    exitAvailability = serializers.CharField(source="exit_availability")
    insuranceActive = serializers.BooleanField(source="insurance_active")
    descriptionAr = serializers.CharField(source="description_ar")
    constructionProgress = serializers.IntegerField(
        source="construction_progress", allow_null=True
    )

    class Meta:
        model = Property
        fields = _COMMON_FIELDS


class PropertyListSerializer(_PropertyBaseSerializer):
    """Marketplace list item — the exact `Property` shape PropertyCard/filters read."""

    class Meta(_PropertyBaseSerializer.Meta):
        fields = _COMMON_FIELDS


class PropertyDetailSerializer(_PropertyBaseSerializer):
    """Full detail: common fields + the model-specific nested block + data-room."""

    # Per-model nested blocks — only the one matching `model` is populated; the others
    # are null/[] (matches properties.ts where only the relevant key is present).
    installment = serializers.SerializerMethodField()
    future = serializers.SerializerMethodField()
    option = serializers.SerializerMethodField()
    shared = serializers.SerializerMethodField()
    phases = PhaseSerializer(many=True, read_only=True)
    portfolioAssets = PortfolioAssetSerializer(source="portfolio_assets", many=True, read_only=True)
    developerReports = DeveloperReportSerializer(
        source="developer_reports", many=True, read_only=True
    )
    valuationReports = ValuationReportSerializer(
        source="valuation_reports", many=True, read_only=True
    )

    # detail / data-room extras (SPEC §3.1)
    spv = serializers.SerializerMethodField()
    tokenMetadata = serializers.SerializerMethodField()
    financials = serializers.SerializerMethodField()
    documents = PropertyDocumentSerializer(many=True, read_only=True)
    fees = serializers.SerializerMethodField()

    class Meta(_PropertyBaseSerializer.Meta):
        fields = _COMMON_FIELDS + (
            "installment",
            "future",
            "option",
            "shared",
            "phases",
            "portfolioAssets",
            "developerReports",
            "valuationReports",
            "spv",
            "tokenMetadata",
            "financials",
            "documents",
            "fees",
        )

    def get_installment(self, obj):
        return (
            InstallmentScheduleSerializer(obj.installment).data
            if hasattr(obj, "installment")
            else None
        )

    def get_future(self, obj):
        return FutureContractSerializer(obj.future).data if hasattr(obj, "future") else None

    def get_option(self, obj):
        return OptionContractSerializer(obj.option).data if hasattr(obj, "option") else None

    def get_shared(self, obj):
        return SharedOwnershipSerializer(obj.shared).data if hasattr(obj, "shared") else None

    def get_spv(self, obj):
        return SPVSerializer(obj.spv).data if hasattr(obj, "spv") else None

    def get_tokenMetadata(self, obj):
        return (
            TokenMetadataSerializer(obj.token_metadata).data
            if hasattr(obj, "token_metadata")
            else None
        )

    def get_financials(self, obj):
        return FinancialsSerializer(obj.financials).data if hasattr(obj, "financials") else None

    def get_fees(self, obj):
        # Numbers, not strings — the UI renders `${fee}%`.
        return {
            "platformFee": float(obj.fee_platform),
            "managementFee": float(obj.fee_management),
            "exitFee": float(obj.fee_exit),
        }


class FundedPropertySerializer(serializers.ModelSerializer):
    """Exact shape FundedProperties.tsx renders (its inline `fundedProperties` item)."""

    id = serializers.CharField(source="slug")
    nameAr = serializers.CharField(source="name_ar")
    locationAr = serializers.CharField(source="location_ar")
    assetType = serializers.CharField(source="asset_type")
    fundedDate = serializers.DateField(source="funded_date")
    totalValue = serializers.DecimalField(source="total_value", max_digits=16, decimal_places=2)
    expectedYield = serializers.DecimalField(
        source="expected_yield", max_digits=6, decimal_places=2, allow_null=True
    )
    durationAr = serializers.CharField(source="duration_ar")

    class Meta:
        model = Property
        fields = (
            "id",
            "name",
            "nameAr",
            "location",
            "locationAr",
            "image",
            "assetType",
            "fundedDate",
            "totalValue",
            "investors",
            "expectedYield",
            "duration",
            "durationAr",
        )
