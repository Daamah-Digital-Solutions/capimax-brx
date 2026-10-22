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
    Amenity,
    ConstructionMilestone,
    DeveloperInfo,
    DeveloperReport,
    FutureContract,
    InstallmentSchedule,
    InsuranceInfo,
    Landmark,
    MarketData,
    OptionContract,
    PortfolioAsset,
    PostHandoverBenefit,
    Property,
    PropertyDocument,
    PropertyFAQ,
    PropertyFinancials,
    PropertyPhase,
    RiskFactor,
    SharedOwnership,
    SPVRecord,
    TokenMetadata,
    ValuationReport,
)


class ArText(serializers.Field):
    """
    An Arabic text field that falls back to its English twin when no Arabic was entered —
    Arabic is optional in the admin (client review §3), and the Arabic site then shows the
    English text instead of a blank.
    """

    def __init__(self, ar, en, **kwargs):
        self.ar_attr, self.en_attr = ar, en
        super().__init__(source="*", read_only=True, **kwargs)

    def to_representation(self, obj):
        return getattr(obj, self.ar_attr, "") or getattr(obj, self.en_attr, "") or ""


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
    nameAr = ArText("name_ar", "name")
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
    exerciseConditionsAr = ArText("exercise_conditions_ar", "exercise_conditions")

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
    transferProcessAr = ArText("transfer_process_ar", "transfer_process")

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
    nameAr = ArText("name_ar", "name")
    assetType = serializers.CharField(source="asset_type")

    class Meta:
        model = PortfolioAsset
        fields = ("id", "name", "nameAr", "city", "weight", "assetType")


class DeveloperReportSerializer(serializers.ModelSerializer):
    titleAr = ArText("title_ar", "title")

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
    complianceAr = ArText("compliance_ar", "compliance")
    custodyAr = ArText("custody_ar", "custody")

    class Meta:
        model = SPVRecord
        fields = (
            "name", "jurisdiction", "registrationNumber", "established",
            "compliance", "complianceAr", "custody", "custodyAr",
        )


class TokenMetadataSerializer(serializers.ModelSerializer):
    # The contract address / "verified" shown anywhere come ONLY from the real deployment —
    # a hand-typed address is never displayed — and the token price is the property's own.
    contractAddress = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()
    networkIcon = serializers.CharField(source="network_icon")
    totalSupply = serializers.IntegerField(source="total_supply")
    tokenizedUnits = serializers.IntegerField(source="tokenized_units")
    tokenPrice = serializers.DecimalField(
        source="property.token_price", max_digits=12, decimal_places=2
    )
    deployedDate = serializers.DateField(source="deployed_date")
    explorerUrl = serializers.CharField(source="explorer_url")
    investorAllocation = serializers.IntegerField(source="investor_allocation")
    spvReserve = serializers.IntegerField(source="spv_reserve")
    platformIncentive = serializers.IntegerField(source="platform_incentive")
    # The REAL on-chain deployment (or null). Non-null ONLY when a PropertyToken was actually
    # deployed + confirmed on-chain (apps/chain writes it post-receipt) — NEVER fabricated. This
    # is what the property page uses to show a genuine verified contract + a real explorer link;
    # the display fields above stay illustrative.
    onChain = serializers.SerializerMethodField()

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
            "investorAllocation",
            "spvReserve",
            "platformIncentive",
            "liquidity",
            "onChain",
        )

    def get_contractAddress(self, obj):
        return (obj.deployed_contract_address or "").strip()

    def get_verified(self, obj):
        return bool((obj.deployed_contract_address or "").strip())

    def get_onChain(self, obj):
        addr = (obj.deployed_contract_address or "").strip()
        if not addr:
            return None  # not deployed yet → the UI shows an honest "pending" state
        net = (obj.deployment_network or "bsc-testnet").strip()
        is_testnet = "test" in net.lower()
        base = "https://testnet.bscscan.com" if is_testnet else "https://bscscan.com"
        tx = (obj.deployment_tx or "").strip()
        return {
            "address": addr,
            "network": net,
            "networkLabel": "BSC Testnet" if is_testnet else "BSC Mainnet",
            "isTestnet": is_testnet,
            "chainId": obj.deployment_chain_id,
            "txHash": tx or None,
            "deployedAt": obj.deployed_at.isoformat() if obj.deployed_at else None,
            "explorerUrl": f"{base}/address/{addr}",
            "txExplorerUrl": f"{base}/tx/{tx}" if tx else None,
        }


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
    yieldProjection = serializers.JSONField(source="yield_projection")

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
            "yieldProjection",
        )


class PropertyDocumentSerializer(serializers.ModelSerializer):
    name = ArText("name", "name_en")  # Arabic name (optional)
    nameEn = serializers.CharField(source="name_en")
    type = serializers.CharField(source="doc_type")
    # Uploaded file (absolute API URL) if any, else the stored link.
    url = serializers.SerializerMethodField()

    class Meta:
        model = PropertyDocument
        fields = ("name", "nameEn", "date", "type", "url")

    def get_url(self, obj):
        return obj.download_url(self.context.get("request"))


# --- data-room section content (admin-managed) ---------------------------- #
class DeveloperInfoSerializer(serializers.ModelSerializer):
    nameAr = ArText("name_ar", "name")
    overviewAr = ArText("overview_ar", "overview")
    yearsExperience = serializers.IntegerField(source="years_experience")
    completedProjects = serializers.IntegerField(source="completed_projects")
    ongoingProjects = serializers.IntegerField(source="ongoing_projects")
    locationAr = ArText("location_ar", "location")
    relatedProjects = serializers.JSONField(source="related_projects")

    class Meta:
        model = DeveloperInfo
        fields = (
            "name", "nameAr", "overview", "overviewAr", "yearsExperience",
            "completedProjects", "ongoingProjects", "rating", "location",
            "locationAr", "email", "phone", "relatedProjects",
        )


class InsuranceInfoSerializer(serializers.ModelSerializer):
    policyNumber = serializers.CharField(source="policy_number")
    coverageAmount = serializers.DecimalField(source="coverage_amount", max_digits=16, decimal_places=2)
    valuationFirm = serializers.CharField(source="valuation_firm")

    class Meta:
        model = InsuranceInfo
        fields = ("provider", "policyNumber", "coverageAmount", "reinsurer", "valuationFirm")


class MarketDataSerializer(serializers.ModelSerializer):
    capRate = serializers.CharField(source="cap_rate")
    cityGrowth = serializers.CharField(source="city_growth")
    vacancyRate = serializers.CharField(source="vacancy_rate")
    rentIndex = serializers.CharField(source="rent_index")
    priceIndexHistory = serializers.JSONField(source="price_index_history")
    marketAverage = serializers.DecimalField(
        source="market_average", max_digits=16, decimal_places=2, allow_null=True
    )
    comparablesValue = serializers.DecimalField(
        source="comparables_value", max_digits=16, decimal_places=2, allow_null=True
    )
    propertyPremium = serializers.CharField(source="property_premium")

    class Meta:
        model = MarketData
        fields = (
            "capRate", "cityGrowth", "vacancyRate", "rentIndex", "priceIndexHistory",
            "marketAverage", "comparablesValue", "propertyPremium",
        )


class AmenitySerializer(serializers.ModelSerializer):
    nameEn = serializers.CharField(source="name_en")
    nameAr = ArText("name_ar", "name_en")

    class Meta:
        model = Amenity
        fields = ("nameEn", "nameAr")


class LandmarkSerializer(serializers.ModelSerializer):
    nameEn = serializers.CharField(source="name_en")
    nameAr = ArText("name_ar", "name_en")

    class Meta:
        model = Landmark
        fields = ("nameEn", "nameAr")


class RiskFactorSerializer(serializers.ModelSerializer):
    textEn = serializers.CharField(source="text_en")
    textAr = ArText("text_ar", "text_en")

    class Meta:
        model = RiskFactor
        fields = ("textEn", "textAr")


class ConstructionMilestoneSerializer(serializers.ModelSerializer):
    nameEn = serializers.CharField(source="name_en")
    nameAr = ArText("name_ar", "name_en")

    class Meta:
        model = ConstructionMilestone
        fields = ("nameEn", "nameAr", "threshold")


class PostHandoverBenefitSerializer(serializers.ModelSerializer):
    textEn = serializers.CharField(source="text_en")
    textAr = ArText("text_ar", "text_en")

    class Meta:
        model = PostHandoverBenefit
        fields = ("textEn", "textAr")


class PropertyFAQSerializer(serializers.ModelSerializer):
    questionEn = serializers.CharField(source="question_en")
    questionAr = ArText("question_ar", "question_en")
    answerEn = serializers.CharField(source="answer_en")
    answerAr = ArText("answer_ar", "answer_en")

    class Meta:
        model = PropertyFAQ
        fields = ("questionEn", "questionAr", "answerEn", "answerAr")


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
    "brokerCommissionRate",
    "openForPromotion",
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
    nameAr = ArText("name_ar", "name")
    locationAr = ArText("location_ar", "location")
    # Uploaded hero/gallery files resolve to absolute API URLs; URL/path entries pass through.
    image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
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
    brokerCommissionRate = serializers.DecimalField(
        source="broker_commission_rate", max_digits=5, decimal_places=2, allow_null=True
    )
    openForPromotion = serializers.BooleanField(source="open_for_promotion")
    durationAr = ArText("duration_ar", "duration")
    exitEligible = serializers.BooleanField(source="exit_eligible")
    exitAvailability = serializers.CharField(source="exit_availability")
    insuranceActive = serializers.BooleanField(source="insurance_active")
    descriptionAr = ArText("description_ar", "description")
    constructionProgress = serializers.IntegerField(
        source="construction_progress", allow_null=True
    )

    # Live progress (list AND detail): the HIGHER of the seeded value or the real
    # minted-investment figure — a fresh listing shows a real figure that grows as units
    # sell, while seeded showcase numbers are never reduced.
    funded = serializers.SerializerMethodField()
    investors = serializers.SerializerMethodField()

    def get_funded(self, obj):
        supply = int(obj.token_supply or 0)
        sold = 0
        if supply:
            from django.db.models import Sum
            from apps.investments.models import RESALE_PAYMENT_METHODS, Investment

            # Primary sales only — resales move already-sold tokens and must not
            # inflate the funded %.
            sold = (
                Investment.objects.filter(property=obj, tokens_minted=True)
                .exclude(payment_method__in=RESALE_PAYMENT_METHODS)
                .aggregate(s=Sum("token_amount"))["s"]
                or 0
            )
        # Two decimals, so a young offering shows e.g. 0.04% instead of rounding to 0%.
        live = max(0.0, min(100.0, round(sold / supply * 100, 2))) if supply else 0.0
        return max(float(obj.funded or 0), live)

    def get_investors(self, obj):
        from apps.investments.models import Investment

        live = (
            Investment.objects.filter(property=obj, tokens_minted=True)
            .values("user")
            .distinct()
            .count()
        )
        return max(int(obj.investors or 0), live)

    class Meta:
        model = Property
        fields = _COMMON_FIELDS

    def get_image(self, obj):
        return obj.hero_image_url(self.context.get("request"))

    def get_images(self, obj):
        return obj.gallery_urls(self.context.get("request"))


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
    developer = serializers.SerializerMethodField()
    insurance = serializers.SerializerMethodField()
    market = serializers.SerializerMethodField()
    amenities = AmenitySerializer(many=True, read_only=True)
    landmarks = LandmarkSerializer(many=True, read_only=True)
    riskFactors = RiskFactorSerializer(source="risk_factors", many=True, read_only=True)
    faqs = PropertyFAQSerializer(many=True, read_only=True)
    constructionMilestones = ConstructionMilestoneSerializer(
        source="construction_milestones", many=True, read_only=True
    )
    postHandoverBenefits = PostHandoverBenefitSerializer(
        source="post_handover_benefits", many=True, read_only=True
    )
    sitePhotosUrl = serializers.CharField(source="site_photos_url")
    # Uploaded construction-site photos (absolute URLs), in the admin's order.
    sitePhotos = serializers.SerializerMethodField()
    droneVideoUrl = serializers.CharField(source="drone_video_url")
    # Uploaded drone footage (absolute URL) — played on the page; wins over the link.
    droneVideoFile = serializers.SerializerMethodField()
    # Off-plan §4: how investors pay (installments / full / both) + the offered plans.
    offplanPayment = serializers.CharField(source="offplan_payment")
    expectedCompletion = serializers.SerializerMethodField()
    installmentTerms = serializers.SerializerMethodField()
    installmentFeeRate = serializers.DecimalField(
        source="fee_installment", max_digits=5, decimal_places=2
    )

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
            "developer",
            "insurance",
            "market",
            "amenities",
            "landmarks",
            "riskFactors",
            "faqs",
            "constructionMilestones",
            "postHandoverBenefits",
            "sitePhotosUrl",
            "sitePhotos",
            "droneVideoUrl",
            "droneVideoFile",
            "offplanPayment",
            "expectedCompletion",
            "expectedCompletionAr",
            "installmentTerms",
            "installmentFeeRate",
        )

    expectedCompletionAr = serializers.SerializerMethodField()

    def get_droneVideoFile(self, obj):
        from .models import public_media_url

        return public_media_url(obj.drone_video_file, self.context.get("request")) or None

    def get_sitePhotos(self, obj):
        from .models import public_media_url

        request = self.context.get("request")
        return [public_media_url(ph.image, request) for ph in obj.site_photos.all() if ph.image]

    def get_expectedCompletion(self, obj):
        return obj.expected_completion or None  # None → the page's own fallback

    def get_expectedCompletionAr(self, obj):
        return obj.expected_completion_ar or obj.expected_completion or None

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
            # Pronova rail: admin-set % discount off the settlement subtotal (value + fees).
            # The frontend mirrors this so the charged total equals the displayed total.
            "pronovaDiscount": float(obj.fee_pronova_discount),
        }

    def get_installmentTerms(self, obj):
        """The plans this property offers — only when it actually sells by installments."""
        if not obj.allows_installments():
            return []
        from apps.installments.terms import terms_for

        return [
            {"months": m, "downPaymentPercent": float(pct)} for m, pct in terms_for(obj)
        ]

    def get_developer(self, obj):
        return (
            DeveloperInfoSerializer(obj.developer_info).data
            if hasattr(obj, "developer_info") else None
        )

    def get_insurance(self, obj):
        return (
            InsuranceInfoSerializer(obj.insurance_info).data
            if hasattr(obj, "insurance_info") else None
        )

    def get_market(self, obj):
        return (
            MarketDataSerializer(obj.market_data).data
            if hasattr(obj, "market_data") else None
        )


class FundedPropertySerializer(serializers.ModelSerializer):
    """Exact shape FundedProperties.tsx renders (its inline `fundedProperties` item)."""

    id = serializers.CharField(source="slug")
    nameAr = ArText("name_ar", "name")
    locationAr = ArText("location_ar", "location")
    assetType = serializers.CharField(source="asset_type")
    fundedDate = serializers.DateField(source="funded_date")
    totalValue = serializers.DecimalField(source="total_value", max_digits=16, decimal_places=2)
    expectedYield = serializers.DecimalField(
        source="expected_yield", max_digits=6, decimal_places=2, allow_null=True
    )
    durationAr = ArText("duration_ar", "duration")
    image = serializers.SerializerMethodField()

    def get_image(self, obj):
        return obj.hero_image_url(self.context.get("request"))

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
