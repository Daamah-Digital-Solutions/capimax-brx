"""
Property domain models — Phase 2.

Replaces the static `src/data/properties.ts` catalogue (the frontend's source of
truth) with admin-managed Postgres records. Every field, enum and nested block here
mirrors the `Property` TypeScript interface (`src/data/properties.ts:107-163`) and its
sub-shapes, so the read API can serve the EXACT shape the UI already consumes.

Modeling notes:
- UUID pk (consistent with the rest of the platform), but the frontend's string id
  (e.g. "1", "10", "p1-a") is preserved as a unique `slug` the API resolves by and
  serializes back as `id` (the UI does `/property/{id}`). SPEC §3.1 / DECISIONS.md.
- Token economics: `token_supply` + `token_price` live on Property so ownership % is
  derivable server-side instead of the frontend's hardcoded assumption
  (SPEC §7C.6: $100/token, the data-room computes supply = total_value / token_price).
- All 8 investment models are supported via per-model detail tables
  (SPEC §3.1): installment / future / option / shared (OneToOne), phases /
  portfolio_assets / developer_reports / valuation_reports / documents (FK),
  plus spv / token_metadata / financials (OneToOne) for the detail/data-room view.
"""
import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import (
    FileExtensionValidator,
    MaxValueValidator,
    MinValueValidator,
    URLValidator,
)
from django.db import models
from django.utils.translation import gettext_lazy as _


def validate_image_ref(value):
    """
    An image reference is either an absolute http(s) URL or a site-root path served by the
    frontend (e.g. "/props/kensington-residences/hero.jpg"). The old URLField rejected the
    root paths the BRX seed stores, which made those properties un-saveable in the admin.
    """
    if not value:
        return
    if value.startswith("/") and not value.startswith("//"):
        return
    URLValidator(schemes=["http", "https"])(value)


def public_media_url(field_file, request=None) -> str:
    """
    Absolute URL for an uploaded file. The frontend runs on a different origin than the API,
    so a bare "/media/..." would resolve against the frontend host — always return the API
    origin (from the request, else PUBLIC_API_ORIGIN).
    """
    if not field_file:
        return ""
    url = field_file.url
    if request is not None:
        return request.build_absolute_uri(url)
    origin = getattr(settings, "PUBLIC_API_ORIGIN", "")
    return f"{origin.rstrip('/')}{url}" if origin else url


# Uploadable data-room file types. No HTML/SVG: these are served from the API origin, where
# an uploaded page or SVG could run script.
DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "webp"]


# --------------------------------------------------------------------------- #
# Enums — values are taken verbatim from src/data/properties.ts so the API
# emits/accepts exactly what the frontend uses (filters compare these strings).
# --------------------------------------------------------------------------- #
class Country(models.TextChoices):
    UAE = "uae", _("UAE")
    KSA = "ksa", _("KSA")
    QATAR = "qatar", _("Qatar")
    BAHRAIN = "bahrain", _("Bahrain")
    OMAN = "oman", _("Oman")
    UK = "uk", _("United Kingdom")


class PropertyModelType(models.TextChoices):
    # properties.ts:5-13 (PropertyModel)
    READY = "ready", _("Ready Property")
    READY_PORTFOLIO = "ready_portfolio", _("Ready Portfolio")
    INSTALLMENT = "installment", _("Installment")
    PHASING = "phasing", _("Phasing")
    FUTURE = "future", _("Future")
    OPTION = "option", _("Option")
    SHARED = "shared", _("Shared with Owner")
    CONSTRUCTION_PORTFOLIO = "construction_portfolio", _("Construction Portfolio")


class PropertyCategory(models.TextChoices):
    # properties.ts:15-19
    READY = "ready", _("Ready")
    CONSTRUCTION = "construction", _("Construction")
    READY_PORTFOLIO = "ready_portfolio", _("Ready Portfolio")
    CONSTRUCTION_PORTFOLIO = "construction_portfolio", _("Construction Portfolio")


class AssetType(models.TextChoices):
    # properties.ts:21-27
    RESIDENTIAL = "residential", _("Residential")
    COMMERCIAL = "commercial", _("Commercial")
    INDUSTRIAL = "industrial", _("Industrial")
    MIXED = "mixed", _("Mixed")
    HOSPITALITY = "hospitality", _("Hospitality")
    LAND = "land", _("Land")


class PropertyStatus(models.TextChoices):
    # properties.ts:124 — note the hyphen in "sold-out" (frontend value).
    READY = "ready", _("Ready")
    CONSTRUCTION = "construction", _("Under Construction")
    SOLD_OUT = "sold-out", _("Sold Out")


class YieldType(models.TextChoices):
    RENTAL = "rental", _("Rental")
    APPRECIATION = "appreciation", _("Appreciation")
    HYBRID = "hybrid", _("Hybrid")


class ExitAvailability(models.TextChoices):
    LP = "lp", _("LP Market")
    SECONDARY = "secondary", _("Secondary Market")
    BOTH = "both", _("Both")
    NONE = "none", _("None")


class OffplanPayment(models.TextChoices):
    """How investors may pay for an UNDER-CONSTRUCTION property (off-plan model §4)."""

    INSTALLMENTS = "installments", _("Installments only (down payment + monthly)")
    FULL = "full", _("Full payment only (at the open phase price)")
    BOTH = "both", _("Investor chooses")


CONSTRUCTION_CATEGORIES = ("construction", "construction_portfolio")


class RiskLevel(models.TextChoices):
    LOW = "low", _("Low")
    MEDIUM = "medium", _("Medium")
    HIGH = "high", _("High")


class PhaseStatus(models.TextChoices):
    COMPLETED = "completed", _("Completed")
    CURRENT = "current", _("Current")
    UPCOMING = "upcoming", _("Upcoming")


class RevenueDistribution(models.TextChoices):
    MONTHLY = "monthly", _("Monthly")
    QUARTERLY = "quarterly", _("Quarterly")
    ANNUAL = "annual", _("Annual")


# Deterministic model -> category mapping. Mirrors `propertyModelMeta` in
# src/data/properties.ts (which the marketplace category tabs key off). Category is
# AUTO-DERIVED from model on save so the two can never desync — a mismatch is what
# made an admin-created property invisible in the marketplace. DECISIONS.md "Properties".
MODEL_CATEGORY_MAP = {
    PropertyModelType.READY: PropertyCategory.READY,
    PropertyModelType.READY_PORTFOLIO: PropertyCategory.READY_PORTFOLIO,
    PropertyModelType.INSTALLMENT: PropertyCategory.CONSTRUCTION,
    PropertyModelType.PHASING: PropertyCategory.CONSTRUCTION,
    PropertyModelType.FUTURE: PropertyCategory.CONSTRUCTION,
    PropertyModelType.OPTION: PropertyCategory.CONSTRUCTION,
    PropertyModelType.SHARED: PropertyCategory.CONSTRUCTION,
    PropertyModelType.CONSTRUCTION_PORTFOLIO: PropertyCategory.CONSTRUCTION_PORTFOLIO,
}


# --------------------------------------------------------------------------- #
# Core entity
# --------------------------------------------------------------------------- #
class Property(models.Model):
    """A marketplace opportunity. Mirrors properties.ts `Property` (lines 107-163)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Frontend string id ("1","10","p1-a"); the API resolves + serializes this as `id`.
    slug = models.SlugField(max_length=64, unique=True, db_index=True)

    # identity (bilingual)
    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200)
    location = models.CharField(max_length=200)
    location_ar = models.CharField(max_length=200)
    country = models.CharField(max_length=16, choices=Country.choices)
    city = models.CharField(max_length=80)
    # Hero image: an uploaded file wins; otherwise the URL / site path. One of the two is
    # required (enforced in clean()).
    image = models.CharField(
        max_length=500, blank=True, validators=[validate_image_ref],
        help_text="Image URL (https://…) or site path (/props/…). Not needed if you upload a file.",
    )
    image_file = models.ImageField(
        upload_to="property_images/", blank=True,
        help_text="Upload the main image. Overrides the URL above when set.",
    )
    images = models.JSONField(
        default=list, blank=True,
        help_text='Gallery as a list of URLs/paths, e.g. ["/props/x/1.jpg"]. '
                  "Uploads in the Gallery section below are added after these.",
    )  # optional gallery (string[])

    # classification
    asset_type = models.CharField(max_length=16, choices=AssetType.choices)
    model = models.CharField(max_length=24, choices=PropertyModelType.choices)
    category = models.CharField(max_length=24, choices=PropertyCategory.choices)
    status = models.CharField(max_length=16, choices=PropertyStatus.choices)
    yield_type = models.CharField(max_length=16, choices=YieldType.choices)
    risk_level = models.CharField(max_length=8, choices=RiskLevel.choices)

    # economics
    total_value = models.DecimalField(max_digits=16, decimal_places=2)
    token_price = models.DecimalField(max_digits=12, decimal_places=2, default=100)
    # SPEC §7C.6: supply makes ownership % derivable server-side (≈ total_value/token_price).
    token_supply = models.PositiveIntegerField(default=0)
    # Off-plan pricing: the price the property was first offered at. Written once, by the
    # first recorded price change (null = the price has never changed).
    launch_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, editable=False
    )
    future_token_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    expected_yield = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )  # annual % for income-producing
    expected_growth = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )  # appreciation % for under-construction
    funded = models.PositiveSmallIntegerField(default=0)  # 0..100
    investors = models.PositiveIntegerField(default=0)
    min_investment = models.DecimalField(max_digits=12, decimal_places=2, default=100)
    duration = models.CharField(max_length=40)
    duration_ar = models.CharField(max_length=40)
    # Expected completion / handover, as shown on the page (e.g. "Q4 2027", "June 2028").
    expected_completion = models.CharField(
        max_length=40, blank=True, default="",
        help_text='Shown as the handover / expected completion date, e.g. "Q4 2027". '
                  "Empty → the installment activation date, then the duration.",
    )
    expected_completion_ar = models.CharField(max_length=40, blank=True, default="")

    # Off-plan purchase mode (ignored for ready properties, which are always paid in full).
    offplan_payment = models.CharField(
        max_length=16, choices=OffplanPayment.choices, default=OffplanPayment.INSTALLMENTS,
        help_text="How investors pay for an under-construction property.",
    )

    # exit & liquidity
    exit_eligible = models.BooleanField(default=False)
    exit_availability = models.CharField(max_length=16, choices=ExitAvailability.choices)
    insurance_active = models.BooleanField(default=False)

    # narrative
    description = models.TextField()
    description_ar = models.TextField()

    # construction (any under-construction model)
    construction_progress = models.PositiveSmallIntegerField(null=True, blank=True)
    # Construction tab media tiles (link or site path; empty → the tile shows as a label).
    site_photos_url = models.CharField(
        max_length=500, blank=True, validators=[validate_image_ref],
        help_text="Link to the site photo album.",
    )
    drone_video_url = models.CharField(
        max_length=500, blank=True, validators=[validate_image_ref],
        help_text="Link to the drone footage (e.g. YouTube).",
    )

    # fees (frontend shows these on the detail financials tab; constants today)
    fee_platform = models.DecimalField(max_digits=5, decimal_places=2, default=1.5)
    fee_management = models.DecimalField(max_digits=5, decimal_places=2, default=0.5)
    fee_exit = models.DecimalField(max_digits=5, decimal_places=2, default=0.5)
    # Pronova discount rate (buyer perk, PLATFORM-ABSORBED). % off the settlement subtotal
    # (token value + platform/management fee) when paying via the Nova/Pronova rail. Admin-set
    # per property, same as the fee rates above (default 5%). The owner still receives the FULL
    # token value; this reduces ONLY the platform's net. UNCAPPED — may exceed the fee (net < 0).
    fee_pronova_discount = models.DecimalField(max_digits=5, decimal_places=2, default=5.0)
    # Off-plan §4: installment-plan fee %, charged on the down payment and on every
    # installment. Replaces the platform/management fee for purchases made by installments.
    fee_installment = models.DecimalField(
        max_digits=5, decimal_places=2, default=4.0,
        help_text="Installment fee % on the down payment and on each installment.",
    )

    # Broker affiliate program (Phase 12 / Broker Listings) — the PER-PROPERTY commission %
    # a referring broker earns on a referred investor's primary sale. Default 5% on the
    # field; at credit time the resolver uses THIS rate, falling back to the broker-level
    # BrokerProfile.commission_rate when null (see investments.services.credit_broker_share).
    # The rate ACTUALLY USED is stamped on the append-only BrokerCommission row at conversion,
    # so a later change here never alters past deals. `open_for_promotion` scopes the
    # broker-listable set (default True → no behaviour change today).
    broker_commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True, default=5,
        help_text="Per-property broker commission %. Null → fall back to the broker's own rate.",
    )
    open_for_promotion = models.BooleanField(default=True, db_index=True)

    # catalogue management
    is_published = models.BooleanField(default=True, db_index=True)  # admin unpublish
    is_featured = models.BooleanField(default=False, db_index=True)  # Index featured
    # Owner→Property link (Phase 7 Wave C). Set when this Property was materialized from
    # an owner's reviewed PropertySubmission; NULL for the existing admin-seeded catalog
    # (so seeded properties are unaffected). Wave D credits this owner on primary sales.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="owned_properties", verbose_name="Owner / developer account",
        help_text="The owner or developer credited with this property's sale proceeds and "
                  "shown it in their dashboard. Empty = a platform-owned property.",
    )
    funded_date = models.DateField(
        null=True, blank=True
    )  # set when a deal closes (FundedProperties)
    display_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("property")
        verbose_name_plural = _("properties")
        ordering = ("display_order", "-created_at")

    def __str__(self):
        return f"{self.name} ({self.slug})"

    # ----------------------------------------------------------------------- #
    # Data integrity — prevent the "invisible property" class of bug where an
    # admin saves an inconsistent model/category or an out-of-range yield and the
    # marketplace's client-side filters silently exclude it. DECISIONS.md "Properties".
    # ----------------------------------------------------------------------- #
    def _sync_derived(self):
        """
        Auto-derive the fields that must never be hand-set inconsistently:
        - `category` from `model` (MODEL_CATEGORY_MAP — mirrors propertyModelMeta).
        - `token_supply` from `total_value / token_price` (mirrors seed_properties).
        Runs on every save, so programmatic saves (seed/shell) stay consistent too.
        """
        derived_category = MODEL_CATEGORY_MAP.get(self.model)
        if derived_category:
            self.category = derived_category
        # Once tokens are sold or a price has been recorded, the supply is FIXED: a price
        # change must never rescale it (that would silently change every holder's ownership
        # %). From then on the price only moves via properties.pricing.record_price.
        if self.total_value is not None and self.token_price and not self.price_locked():
            self.token_supply = int(self.total_value / self.token_price)

    @property
    def is_under_construction(self) -> bool:
        return self.category in CONSTRUCTION_CATEGORIES

    def allows_installments(self) -> bool:
        """Off-plan §4: installment plans only on under-construction properties that offer them."""
        return self.is_under_construction and self.offplan_payment in (
            OffplanPayment.INSTALLMENTS, OffplanPayment.BOTH,
        )

    def allows_full_payment(self) -> bool:
        """Ready properties are always paid in full; off-plan ones only if the mode allows it."""
        return not self.is_under_construction or self.offplan_payment in (
            OffplanPayment.FULL, OffplanPayment.BOTH,
        )

    def price_locked(self) -> bool:
        """True once the property has primary sales or any recorded price change."""
        if self._state.adding or not self.pk:
            return False
        if self.price_history.exists():
            return True
        from apps.investments.services import sold_tokens  # avoid an import cycle

        return sold_tokens(self) > 0

    def clean(self):
        """
        Reject inconsistent saves with a clear, field-level error (shown in the admin)
        instead of silently creating a property the marketplace can't display.

        Range checks (0–100) for expected_yield / expected_growth / funded — these are
        percentages the marketplace ROI/funding filters depend on; an out-of-range value
        (e.g. the 452% that triggered this) makes the property un-listable. `category`
        and `token_supply` are auto-derived (see _sync_derived) so they can't desync.
        """
        super().clean()
        errors = {}
        for field, label in (("expected_yield", "Expected yield"), ("expected_growth", "Expected growth")):
            value = getattr(self, field)
            if value is not None and not (0 <= value <= 100):
                errors[field] = f"{label} must be between 0 and 100 (got {value})."
        if self.funded is not None and not (0 <= self.funded <= 100):
            errors["funded"] = f"Funded % must be between 0 and 100 (got {self.funded})."
        if self.broker_commission_rate is not None and not (0 <= self.broker_commission_rate <= 100):
            errors["broker_commission_rate"] = (
                f"Broker commission % must be between 0 and 100 (got {self.broker_commission_rate})."
            )
        if not self.image and not self.image_file:
            errors["image"] = "Upload a main image or enter an image URL."
        if (self.slug or "").strip() in ("1", "2"):
            errors["slug"] = 'The slugs "1" and "2" are reserved for the demo pages — choose another.'
        if self.images not in (None, "") and (
            not isinstance(self.images, list) or not all(isinstance(u, str) for u in self.images)
        ):
            errors["images"] = (
                'Gallery must be a list of image links, e.g. ["/props/x/1.jpg", "https://…/2.jpg"]. '
                "To upload files, use the Gallery section below."
            )
        if errors:
            raise ValidationError(errors)
        # Derive after validation so the (read-only) admin fields reflect the saved values.
        self._sync_derived()

    def save(self, *args, **kwargs):
        # Always keep derived fields consistent, even for non-form saves (seed/shell)
        # which bypass clean(). Validation itself runs via full_clean() in the admin.
        self._sync_derived()
        super().save(*args, **kwargs)
        # Wave 2 policy #4: the data-room display supply MUST track the authoritative
        # token_supply (fixes the 5,000-vs-50,000 mismatch). Resync any TokenMetadata.
        self._resync_token_metadata()

    def hero_image_url(self, request=None) -> str:
        """The image the UI shows: the uploaded file if any, else the URL / site path."""
        if self.image_file:
            return public_media_url(self.image_file, request)
        return self.image

    def gallery_urls(self, request=None) -> list:
        """Gallery = the JSON URL list, then the admin-uploaded images in their set order."""
        # Tolerate legacy/malformed JSON (a bare string or number) — one bad row must never
        # 500 the whole marketplace list. clean() blocks new malformed values in the admin.
        raw = self.images
        if isinstance(raw, str):
            urls = [raw] if raw else []
        elif isinstance(raw, (list, tuple)):
            urls = [u for u in raw if u]
        else:
            urls = []
        urls += [public_media_url(g.image, request) for g in self.gallery.all() if g.image]
        return urls

    def _resync_token_metadata(self):
        """Force this property's TokenMetadata display supply to equal token_supply."""
        meta = TokenMetadata.objects.filter(property=self).first()
        if meta is not None and (
            meta.total_supply != self.token_supply
            or meta.tokenized_units != self.token_supply
        ):
            meta.total_supply = self.token_supply
            meta.tokenized_units = self.token_supply
            meta.save(update_fields=["total_supply", "tokenized_units"])

    @property
    def ownership_percentage_per_token(self):
        """% of the asset one token represents (SPEC §7C.6). 0 if supply unknown."""
        if self.token_supply:
            return round(100 / self.token_supply, 6)
        return 0


# --------------------------------------------------------------------------- #
# Per-model detail tables (only the block matching `model` is populated)
# --------------------------------------------------------------------------- #
class InstallmentSchedule(models.Model):
    """model == installment. properties.ts:34-41 (InstallmentSchedule)."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="installment"
    )
    total_installments = models.PositiveIntegerField()
    paid_installments = models.PositiveIntegerField(default=0)
    monthly_amount = models.DecimalField(max_digits=12, decimal_places=2)
    next_payment_date = models.DateField()
    activation_date = models.DateField()
    completion_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    def __str__(self):
        return f"Installment · {self.property.slug}"


class FutureContract(models.Model):
    """model == future. properties.ts:54-61 (FutureContract)."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="future"
    )
    reservation_date = models.DateField()
    activation_date = models.DateField()
    settlement_date = models.DateField()
    reservation_price = models.DecimalField(max_digits=12, decimal_places=2)
    estimated_future_value = models.DecimalField(max_digits=12, decimal_places=2)
    estimated_roi = models.DecimalField(max_digits=6, decimal_places=2)

    def __str__(self):
        return f"Future · {self.property.slug}"


class OptionContract(models.Model):
    """model == option. properties.ts:63-71 (OptionContract)."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="option"
    )
    option_premium = models.DecimalField(max_digits=12, decimal_places=2)
    strike_price = models.DecimalField(max_digits=12, decimal_places=2)
    expiry_date = models.DateField()
    validity_months = models.PositiveIntegerField()
    estimated_future_value = models.DecimalField(max_digits=12, decimal_places=2)
    exercise_conditions = models.TextField()
    exercise_conditions_ar = models.TextField()

    def __str__(self):
        return f"Option · {self.property.slug}"


class SharedOwnership(models.Model):
    """model == shared. properties.ts:73-81 (SharedOwnership)."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="shared"
    )
    investor_share = models.DecimalField(max_digits=5, decimal_places=2)  # %
    owner_share = models.DecimalField(max_digits=5, decimal_places=2)  # %
    owner_name = models.CharField(max_length=200)
    profit_split = models.CharField(max_length=120)
    revenue_distribution = models.CharField(
        max_length=16, choices=RevenueDistribution.choices
    )
    transfer_process = models.TextField()
    transfer_process_ar = models.TextField()

    def __str__(self):
        return f"Shared · {self.property.slug}"


class PropertyPhase(models.Model):
    """model == phasing. properties.ts:43-52 (PhaseInfo)."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="phases"
    )
    number = models.PositiveIntegerField()
    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120)
    token_price = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=16, choices=PhaseStatus.choices)
    progress = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("number",)

    def __str__(self):
        return f"Phase {self.number} · {self.property.slug}"


class PortfolioAsset(models.Model):
    """model in (ready_portfolio, construction_portfolio). properties.ts:83-90."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="portfolio_assets"
    )
    asset_slug = models.CharField(max_length=64)  # frontend id e.g. "p1-a"
    name = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120)
    city = models.CharField(max_length=80)
    weight = models.DecimalField(max_digits=5, decimal_places=2)  # % of portfolio
    asset_type = models.CharField(max_length=16, choices=AssetType.choices)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return f"{self.name} · {self.property.slug}"


class DeveloperReport(models.Model):
    """properties.ts:93-98 (DeveloperReport) — construction progress updates."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="developer_reports"
    )
    date = models.DateField()
    title = models.CharField(max_length=200)
    title_ar = models.CharField(max_length=200)
    progress = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("-date",)

    def __str__(self):
        return f"{self.title} · {self.property.slug}"


class ValuationReport(models.Model):
    """properties.ts:100-104 (ValuationReport)."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="valuation_reports"
    )
    date = models.DateField()
    valuation = models.DecimalField(max_digits=16, decimal_places=2)
    appraiser = models.CharField(max_length=120)

    class Meta:
        ordering = ("-date",)

    def __str__(self):
        return f"{self.appraiser} · {self.property.slug}"


# --------------------------------------------------------------------------- #
# Detail / data-room related models (SPEC §3.1: SPVRecord, TokenMetadata,
# PropertyDocument + financials). Sourced from PropertyDetail.tsx's inline
# `propertyDatabase` (ids "1","2") so the detail endpoint can serve real SPV /
# token / financial / document data; admin-managed per property.
# --------------------------------------------------------------------------- #
class SPVRecord(models.Model):
    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="spv"
    )
    name = models.CharField(max_length=200)
    jurisdiction = models.CharField(max_length=120)
    registration_number = models.CharField(max_length=120)
    established = models.DateField(null=True, blank=True)
    # Structure tab (empty → the page keeps its default wording).
    compliance = models.CharField(max_length=120, blank=True, help_text='e.g. "Reg D 506(c) / Reg S"')
    compliance_ar = models.CharField(max_length=120, blank=True)
    custody = models.CharField(max_length=120, blank=True, help_text='e.g. "Licensed Custodian"')
    custody_ar = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return self.name


class TokenMetadata(models.Model):
    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="token_metadata"
    )
    # --- Data-room DISPLAY fields (frontend-facing; unchanged by Wave 1) -------- #
    # These drive the PropertyDetail data room (illustrative for the catalogue).
    # Wave 1 deliberately does NOT overwrite them so the displayed UX never changes
    # silently; surfacing live on-chain data here is a product-owner-approved step.
    contract_address = models.CharField(max_length=120, blank=True)
    network = models.CharField(max_length=40, default="Ethereum")
    network_icon = models.CharField(max_length=8, blank=True)
    standard = models.CharField(max_length=40, default="ERC-1155")
    total_supply = models.PositiveIntegerField(default=0)
    tokenized_units = models.PositiveIntegerField(default=0)
    token_price = models.DecimalField(max_digits=12, decimal_places=2, default=100)
    verified = models.BooleanField(default=True)
    deployed_date = models.DateField(null=True, blank=True)
    explorer_url = models.URLField(max_length=500, blank=True)

    # --- On-chain DEPLOYMENT truth (Phase 3 Wave 1) ---------------------------- #
    # The REAL deployed PropertyToken for this property on BSC Testnet. Recorded by
    # the chain layer (apps/chain) after on-chain confirmation; nullable until
    # deployed. Kept SEPARATE from the display fields above and NOT exposed by the
    # current serializer (TokenMetadataSerializer uses an explicit field list).
    deployed_contract_address = models.CharField(max_length=42, blank=True)
    deployment_tx = models.CharField(max_length=66, blank=True)
    deployed_at = models.DateTimeField(null=True, blank=True)
    deployment_chain_id = models.PositiveIntegerField(null=True, blank=True)
    deployment_network = models.CharField(max_length=24, blank=True)
    factory_address = models.CharField(max_length=42, blank=True)

    # Token economics allocation (data-room "Structure" tab) — admin-editable, sensible
    # defaults that sum to 100. Shown as the allocation chips.
    investor_allocation = models.PositiveSmallIntegerField(default=85)
    spv_reserve = models.PositiveSmallIntegerField(default=10)
    platform_incentive = models.PositiveSmallIntegerField(default=3)
    liquidity = models.PositiveSmallIntegerField(default=2)

    def save(self, *args, **kwargs):
        # Wave 2 policy #4: the displayed supply MUST equal the property's
        # authoritative token_supply. Forced here so admin edits / seeds can't
        # reintroduce a divergent figure (the old 5,000-vs-50,000 bug). tokenized_units
        # is kept equal too (matching the seed's "fully tokenized" display intent).
        if self.property_id:
            supply = self.property.token_supply
            self.total_supply = supply
            self.tokenized_units = supply
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Token · {self.property.slug}"


def _check_points(value, field, key, limit):
    """[{"<key>": "...", "value": number}, ...] — the shape the property page charts."""
    from django.core.exceptions import ValidationError

    if value in (None, ""):
        return
    ok = isinstance(value, list) and len(value) <= limit and all(
        isinstance(p, dict) and str(p.get(key, "")).strip() and isinstance(p.get("value"), (int, float))
        for p in value
    )
    if not ok:
        raise ValidationError({field: f'Use up to {limit} points like [{{"{key}": "2024", "value": 8.1}}] '
                                      "(value must be a number)."})


class PropertyFinancials(models.Model):
    """Detail financials tab (PropertyDetail.tsx inline `financials`)."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="financials"
    )
    purchase_price = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    current_valuation = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    gross_rental_income = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    operating_expenses = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    net_operating_income = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    cap_rate = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    occupancy_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Financial tab "5-Year Yield Projection" (empty → the page keeps its default estimate).
    yield_projection = models.JSONField(
        default=list, blank=True,
        help_text='Up to 5 points, e.g. [{"year": "Year 1", "value": 8.1}, {"year": "Year 2", "value": 8.4}]',
    )

    def clean(self):
        super().clean()
        _check_points(self.yield_projection, "yield_projection", "year", 5)

    def __str__(self):
        return f"Financials · {self.property.slug}"


class PropertyDocument(models.Model):
    """Data-room document (PropertyDetail.tsx inline `documents`). SPEC §3.1."""

    class DocType(models.TextChoices):
        VALUATION = "valuation", _("Valuation")
        LEGAL = "legal", _("Legal")
        INSURANCE = "insurance", _("Insurance")
        FINANCIAL = "financial", _("Financial")
        CONSTRUCTION = "construction", _("Construction")
        STUDIES = "studies", _("Studies")
        BROCHURE = "brochure", _("Brochure")
        TOKENIZATION = "tokenization", _("Tokenization Agreement")
        LEASE = "lease", _("Lease Agreement")
        AUDIT = "audit", _("Smart Contract Audit")
        DILIGENCE = "diligence", _("Due Diligence")
        # Drive the payment-plan card's buttons on under-construction properties.
        PAYMENT_PLAN = "payment_plan", _("Payment Plan")
        HANDOVER_TERMS = "handover_terms", _("Post-Handover Terms")

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="documents"
    )
    name = models.CharField(max_length=200)  # Arabic name (frontend `name`)
    name_en = models.CharField(max_length=200)
    date = models.DateField()
    doc_type = models.CharField(max_length=16, choices=DocType.choices)
    # Downloadable file. A real, resolvable URL (backend media on the API host, or an
    # external store) — blank keeps the legacy metadata-only rows valid. This is what
    # makes the data-room documents ACTUALLY download (was metadata-only before).
    url = models.URLField(max_length=500, blank=True)
    # Or upload the file straight from the admin (wins over `url` when set).
    file = models.FileField(
        upload_to="property_docs/uploads/", blank=True,
        validators=[FileExtensionValidator(DOCUMENT_EXTENSIONS)],
        help_text="Upload the document (PDF, Word, Excel, image). Overrides the URL when set.",
    )

    class Meta:
        ordering = ("-date",)

    def __str__(self):
        return f"{self.name_en} · {self.property.slug}"

    def download_url(self, request=None) -> str:
        if self.file:
            return public_media_url(self.file, request)
        return self.url


class PropertyPrice(models.Model):
    """
    Append-only unit-price history (off-plan model §3.1). One row per recorded change:
    previous → new price, optional phase name + investor note, who and when. Rows are never
    edited or deleted — a mistake is corrected by recording the right price.
    """

    property = models.ForeignKey(
        Property, on_delete=models.PROTECT, related_name="price_history"
    )
    previous_price = models.DecimalField(max_digits=12, decimal_places=2)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    label = models.CharField(max_length=80, blank=True, help_text="Phase name, e.g. Phase 2")
    note = models.CharField(max_length=280, blank=True, help_text="One-line note to investors")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("created_at", "id")
        verbose_name = _("price change")
        verbose_name_plural = _("price history")

    def __str__(self):
        return f"{self.property.slug}: {self.previous_price} → {self.price}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Price history is append-only; record a new price instead.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Price history is append-only and cannot be deleted.")


class PropertyUnitPrice(Property):
    """Admin entry point for recording unit prices (the 'Unit prices' page)."""

    class Meta:
        proxy = True
        verbose_name = _("unit price")
        verbose_name_plural = _("unit prices")


class PropertyImage(models.Model):
    """A gallery image uploaded from the admin (shown after the JSON `images` list)."""

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="gallery")
    image = models.ImageField(upload_to="property_gallery/")
    order = models.PositiveIntegerField(default=0, help_text="Lower numbers show first.")

    class Meta:
        ordering = ("order", "id")
        verbose_name = _("gallery image")
        verbose_name_plural = _("gallery images")

    def __str__(self):
        return f"{self.property.slug} · image {self.order}"


# --------------------------------------------------------------------------- #
# Data-room section content — admin-managed per property so every tab shows real,
# editable data instead of the frontend's old hardcoded placeholders.
# --------------------------------------------------------------------------- #
class DeveloperInfo(models.Model):
    """The 'Developer' tab (bilingual). One per property."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="developer_info"
    )
    name = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True)
    overview = models.TextField(blank=True)
    overview_ar = models.TextField(blank=True)
    years_experience = models.PositiveIntegerField(default=0)
    completed_projects = models.PositiveIntegerField(default=0)
    ongoing_projects = models.PositiveIntegerField(default=0)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)  # 0..5
    location = models.CharField(max_length=200, blank=True)
    location_ar = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    related_projects = models.JSONField(
        default=list, blank=True,
        help_text='List of projects, e.g. [{"en": "Marina Heights", "ar": "مارينا هايتس"}]',
    )  # [{"en":.., "ar":..}]

    def clean(self):
        super().clean()
        v = self.related_projects
        if v not in (None, "") and (not isinstance(v, list) or not all(isinstance(x, dict) and x.get("en") for x in v)):
            from django.core.exceptions import ValidationError

            raise ValidationError({"related_projects": 'Use a list like [{"en": "Name", "ar": "الاسم"}].'})

    def __str__(self):
        return f"Developer · {self.property.slug}"


class InsuranceInfo(models.Model):
    """Insurance details for the Insurance/Valuation + Insurance-&-Risk sections."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="insurance_info"
    )
    provider = models.CharField(max_length=200)
    policy_number = models.CharField(max_length=80, blank=True)
    coverage_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    reinsurer = models.CharField(max_length=200, blank=True)
    valuation_firm = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"Insurance · {self.property.slug}"


class MarketData(models.Model):
    """The 'Market' tab — stat chips + a price-index history series."""

    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="market_data"
    )
    cap_rate = models.CharField(max_length=16, blank=True)      # e.g. "7.8%"
    city_growth = models.CharField(max_length=16, blank=True)   # e.g. "+9.2%"
    vacancy_rate = models.CharField(max_length=16, blank=True)  # e.g. "4.1%"
    rent_index = models.CharField(max_length=16, blank=True)    # e.g. "112"
    price_index_history = models.JSONField(
        default=list, blank=True,
        help_text='Yearly index, e.g. [{"year": "2021", "value": 100}, {"year": "2022", "value": 108}]',
    )  # [{"year":"2021","value":100}]
    # Valuation section "market comparison" (empty → the page keeps its default figures).
    market_average = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True,
        help_text="Local market average value for a comparable asset (USD).",
    )
    comparables_value = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True,
        help_text="Average value of comparable properties (USD).",
    )
    property_premium = models.CharField(
        max_length=16, blank=True,
        help_text='e.g. "+6.4%". Empty → computed from the comparables value when set.',
    )

    def clean(self):
        super().clean()
        _check_points(self.price_index_history, "price_index_history", "year", 20)

    def __str__(self):
        return f"Market · {self.property.slug}"


class Amenity(models.Model):
    """An amenity chip in the Overview tab (bilingual)."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="amenities"
    )
    name_en = models.CharField(max_length=120)
    name_ar = models.CharField(max_length=120, blank=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Lower shows first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.name_en


class Landmark(models.Model):
    """A nearby landmark line in the Overview tab (bilingual, incl. distance text)."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="landmarks"
    )
    name_en = models.CharField(max_length=160)
    name_ar = models.CharField(max_length=160, blank=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Lower shows first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.name_en


class RiskFactor(models.Model):
    """A risk-disclosure bullet in the Risk tab (bilingual)."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="risk_factors"
    )
    text_en = models.CharField(max_length=300)
    text_ar = models.CharField(max_length=300, blank=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Lower shows first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.text_en


class InstallmentTerm(models.Model):
    """
    An installment plan this property offers (off-plan §4): a term in months — a down
    payment now plus (term - 1) monthly installments — and the down payment % for it.
    A property with none offers the default table (properties.installment_terms).
    """

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="installment_terms"
    )
    duration_months = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(2), MaxValueValidator(120)],
        help_text="Total term in months (down payment + monthly installments), e.g. 12.",
    )
    down_payment_percent = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01")), MaxValueValidator(Decimal("99.99"))],
        help_text="Down payment % for this term, e.g. 25.",
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("order", "duration_months")
        constraints = [
            models.UniqueConstraint(
                fields=("property", "duration_months"), name="uniq_installment_term_per_duration"
            )
        ]

    def __str__(self):
        return f"{self.duration_months} months · {self.down_payment_percent}% down"


class ConstructionMilestone(models.Model):
    """A construction-tab milestone, ticked once construction progress reaches `threshold`."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="construction_milestones"
    )
    name_en = models.CharField(max_length=80)
    name_ar = models.CharField(max_length=80, blank=True)
    threshold = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Construction progress % at which this milestone shows as done.",
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("order", "threshold", "id")

    def __str__(self):
        return f"{self.name_en} ({self.threshold}%)"


class PostHandoverBenefit(models.Model):
    """A benefit bullet on the under-construction 'Payment Plan — After Construction' card."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="post_handover_benefits"
    )
    text_en = models.CharField(max_length=160)
    text_ar = models.CharField(max_length=160, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.text_en


class PropertyFAQ(models.Model):
    """A FAQ entry in the FAQ tab (bilingual Q + A)."""

    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="faqs"
    )
    question_en = models.CharField(max_length=300)
    question_ar = models.CharField(max_length=300, blank=True)
    answer_en = models.TextField()
    answer_ar = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Lower shows first.")

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.question_en
