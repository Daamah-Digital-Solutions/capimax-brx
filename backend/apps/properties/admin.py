"""
Property admin — Phase 2. THIS is the management surface for the property domain:
an admin can create and fully manage any of the 8 investment-model types end-to-end
(SPEC §3.1; DECISIONS.md "Properties": admin-managed in Django admin).

Per-model detail is edited inline on the Property page: the OneToOne blocks
(installment/future/option/shared/spv/token/financials) as stacked inlines, and the
repeating blocks (phases/portfolio assets/reports/documents) as tabular inlines.
"""
from django import forms
from django.contrib import admin, messages
from django.utils.html import format_html

from . import pricing

from .models import (
    Amenity,
    DeveloperInfo,
    DeveloperReport,
    FutureContract,
    InstallmentSchedule,
    InsuranceInfo,
    Landmark,
    MarketData,
    OptionContract,
    PortfolioAsset,
    Property,
    PropertyDocument,
    PropertyFAQ,
    PropertyFinancials,
    PropertyImage,
    PropertyPhase,
    PropertyPrice,
    PropertyUnitPrice,
    RiskFactor,
    SharedOwnership,
    SPVRecord,
    TokenMetadata,
    ValuationReport,
)


# --- OneToOne detail (stacked) ------------------------------------------- #
class InstallmentScheduleInline(admin.StackedInline):
    model = InstallmentSchedule
    extra = 0


class FutureContractInline(admin.StackedInline):
    model = FutureContract
    extra = 0


class OptionContractInline(admin.StackedInline):
    model = OptionContract
    extra = 0


class SharedOwnershipInline(admin.StackedInline):
    model = SharedOwnership
    extra = 0


class SPVRecordInline(admin.StackedInline):
    model = SPVRecord
    extra = 0


class TokenMetadataInline(admin.StackedInline):
    model = TokenMetadata
    extra = 0
    # total_supply / tokenized_units are forced to equal the property's authoritative
    # token_supply on save (Wave 2 policy #4) — read-only so they can't desync again.
    # The deployment_* fields are written by the chain layer after on-chain confirmation.
    readonly_fields = (
        "total_supply",
        "tokenized_units",
        "deployed_contract_address",
        "deployment_tx",
        "deployed_at",
        "deployment_chain_id",
        "deployment_network",
        "factory_address",
    )


class PropertyFinancialsInline(admin.StackedInline):
    model = PropertyFinancials
    extra = 0


# --- repeating detail (tabular) ------------------------------------------ #
class PropertyPhaseInline(admin.TabularInline):
    model = PropertyPhase
    extra = 0


class PortfolioAssetInline(admin.TabularInline):
    model = PortfolioAsset
    extra = 0


class DeveloperReportInline(admin.TabularInline):
    model = DeveloperReport
    extra = 0


class ValuationReportInline(admin.TabularInline):
    model = ValuationReport
    extra = 0


class PropertyDocumentInline(admin.TabularInline):
    model = PropertyDocument
    extra = 0
    fields = ("name_en", "name", "doc_type", "date", "file", "url")


def _thumb(url, height=70):
    if not url:
        return "—"
    return format_html(
        '<a href="{}" target="_blank" rel="noopener"><img src="{}" style="height:{}px;'
        'border-radius:6px;object-fit:cover" /></a>',
        url, url, height,
    )


class PropertyImageInline(admin.TabularInline):
    """Gallery uploads — shown on the property page after the URL list in `images`."""

    model = PropertyImage
    extra = 1
    fields = ("image", "preview", "order")
    readonly_fields = ("preview",)
    verbose_name = "Gallery image"
    verbose_name_plural = "Gallery — upload images"

    @admin.display(description="Preview")
    def preview(self, obj):
        return _thumb(obj.image.url if obj and obj.image else "")


# --- data-room section content (admin-managed per property) --------------- #
class DeveloperInfoInline(admin.StackedInline):
    model = DeveloperInfo
    extra = 0


class InsuranceInfoInline(admin.StackedInline):
    model = InsuranceInfo
    extra = 0


class MarketDataInline(admin.StackedInline):
    model = MarketData
    extra = 0


class AmenityInline(admin.TabularInline):
    model = Amenity
    extra = 0


class LandmarkInline(admin.TabularInline):
    model = Landmark
    extra = 0


class RiskFactorInline(admin.TabularInline):
    model = RiskFactor
    extra = 0


class PropertyFAQInline(admin.TabularInline):
    model = PropertyFAQ
    extra = 0


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "country",
        "model",
        "category",
        "status",
        "funded",
        "expected_yield",
        "is_published",
        "is_featured",
    )
    list_filter = (
        "country",
        "model",
        "category",
        "asset_type",
        "status",
        "risk_level",
        "is_published",
        "is_featured",
    )
    search_fields = ("name", "name_ar", "location", "location_ar", "slug")
    list_editable = ("is_published", "is_featured")
    ordering = ("display_order", "name")
    actions = ["deploy_token_contract"]

    @admin.display(description="Current main image")
    def hero_preview(self, obj):
        return _thumb(obj.hero_image_url() if obj and obj.pk else "", height=110)

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        # §3.5: once there are holders or a recorded price, the price (and the offering
        # total it drives) only change via "Unit prices", so every change is in the history.
        if obj is not None and obj.price_locked():
            fields += ["token_price", "total_value"]
        return fields

    @admin.display(description="Price")
    def price_lock_note(self, obj):
        if obj is not None and obj.pk and obj.price_locked():
            return "Locked — change it from Properties › Unit prices (keeps the price history)."
        return "Editable here until the first sale or recorded price."

    @admin.action(description="Deploy token contract to BSC Testnet (one per property)")
    def deploy_token_contract(self, request, queryset):
        """
        Exception-handler path (automation-first): deploy a published property's
        PropertyToken to BSC Testnet via the factory. Requires the chain env to be
        configured + the deployer funded; surfaces any error as an admin message.
        Records the deployment on TokenMetadata WITHOUT changing the data-room display.
        """
        # Imported lazily so the properties app never hard-depends on the chain app.
        from apps.chain import service
        from apps.chain.exceptions import ChainError

        for prop in queryset:
            if not prop.is_published:
                self.message_user(
                    request, f"'{prop.slug}' is not published — skipped.", messages.WARNING
                )
                continue
            try:
                result = service.deploy_property_token(prop)
            except ChainError as exc:
                self.message_user(request, f"'{prop.slug}': {exc}", messages.ERROR)
                continue
            self.message_user(
                request,
                f"'{prop.slug}' deployed: {result['token_address']} "
                f"(tx {result['tx_hash']}).",
                messages.SUCCESS,
            )
    # category + token_supply are AUTO-DERIVED on save (from model / total_value) so
    # they can never desync — they are read-only here. See Property._sync_derived.
    readonly_fields = (
        "id", "category", "token_supply", "created_at", "updated_at", "hero_preview",
        "price_lock_note",
    )
    inlines = [
        PropertyImageInline,
        InstallmentScheduleInline,
        FutureContractInline,
        OptionContractInline,
        SharedOwnershipInline,
        PropertyPhaseInline,
        PortfolioAssetInline,
        DeveloperReportInline,
        ValuationReportInline,
        SPVRecordInline,
        TokenMetadataInline,
        PropertyFinancialsInline,
        PropertyDocumentInline,
        DeveloperInfoInline,
        InsuranceInfoInline,
        MarketDataInline,
        AmenityInline,
        LandmarkInline,
        RiskFactorInline,
        PropertyFAQInline,
    ]
    fieldsets = (
        (
            "Identity",
            {
                "fields": (
                    "slug",
                    ("name", "name_ar"),
                    ("location", "location_ar"),
                    ("country", "city"),
                    ("image_file", "hero_preview"),
                    "image",
                    "images",
                )
            },
        ),
        (
            "Classification",
            {
                "description": "Category is auto-derived from the investment model (read-only).",
                "fields": (
                    ("asset_type", "model", "category"),
                    ("status", "yield_type", "risk_level"),
                ),
            },
        ),
        (
            "Economics",
            {
                "description": (
                    "Token supply is auto-derived as total value ÷ token price (read-only). "
                    "Expected yield/growth and funded % must be between 0 and 100."
                ),
                "fields": (
                    ("total_value", "token_price", "token_supply"),
                    "price_lock_note",
                    ("future_token_price", "min_investment"),
                    ("expected_yield", "expected_growth"),
                    ("funded", "investors"),
                    ("duration", "duration_ar"),
                ),
            },
        ),
        (
            "Exit & liquidity",
            {"fields": (("exit_eligible", "exit_availability", "insurance_active"),)},
        ),
        (
            "Narrative",
            {"fields": ("description", "description_ar", "construction_progress")},
        ),
        ("Fees", {"fields": (("fee_platform", "fee_management", "fee_exit"), ("fee_pronova_discount",))}),
        (
            "Broker program",
            {
                "description": "Commission % a referring broker earns on this property "
                               "(empty = the broker's own rate), and whether brokers can promote it.",
                "fields": (("broker_commission_rate", "open_for_promotion"),),
            },
        ),
        (
            "Catalogue management",
            {"fields": (("is_published", "is_featured"), ("funded_date", "display_order"))},
        ),
        ("System", {"classes": ("collapse",), "fields": ("id", "created_at", "updated_at")}),
    )


# --------------------------------------------------------------------------- #
# Unit prices (off-plan model §3.2) — the only way to change a live property's price.
# Full admins only. Each save appends to the immutable price history.
# --------------------------------------------------------------------------- #
class PriceHistoryInline(admin.TabularInline):
    model = PropertyPrice
    extra = 0
    can_delete = False
    fields = ("created_at", "previous_price", "price", "label", "note", "created_by")
    readonly_fields = fields
    ordering = ("-created_at", "-id")
    verbose_name = "Price change"
    verbose_name_plural = "Price history (permanent — cannot be edited or deleted)"

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class UnitPriceForm(forms.ModelForm):
    new_price = forms.DecimalField(
        max_digits=12, decimal_places=2, required=False, label="New unit price (USD)",
        help_text="Leave empty to keep the current price.",
    )
    phase_label = forms.CharField(
        max_length=80, required=False, label="Phase name (optional)",
        help_text="e.g. Phase 2 — shown to investors with the new price.",
    )
    investor_note = forms.CharField(
        max_length=280, required=False, label="Note to investors (optional)",
    )
    confirm_large_change = forms.BooleanField(
        required=False, label="I confirm a change of more than 25%",
    )

    class Meta:
        model = PropertyUnitPrice
        fields = ()

    def __init__(self, *args, **kwargs):
        self.request_user = kwargs.pop("request_user", None)
        super().__init__(*args, **kwargs)

    def clean(self):
        data = super().clean()
        if data.get("new_price") is None:
            return data
        try:
            data["new_price"] = pricing.validate_new_price(
                self.instance, data["new_price"], by=self.request_user,
                confirm_large=bool(data.get("confirm_large_change")),
            )
        except pricing.PriceError as exc:
            field = "confirm_large_change" if exc.code == "large_change" else "new_price"
            self.add_error(field, exc.message)
        return data


@admin.register(PropertyUnitPrice)
class UnitPriceAdmin(admin.ModelAdmin):
    form = UnitPriceForm
    inlines = [PriceHistoryInline]
    list_display = (
        "name", "slug", "category", "current_price", "launch_price_display",
        "change_since_launch", "last_change", "price_due",
    )
    list_filter = ("category",)
    search_fields = ("name", "name_ar", "slug")
    ordering = ("display_order", "name")
    readonly_fields = (
        "name", "slug", "current_price", "launch_price_display", "change_since_launch",
        "last_change", "token_supply", "sold_units", "unsold_units", "total_value",
        "min_investment",
    )
    fieldsets = (
        (
            "Current price",
            {
                "fields": (
                    ("name", "slug"),
                    ("current_price", "launch_price_display", "change_since_launch"),
                    ("token_supply", "sold_units", "unsold_units"),
                    ("total_value", "min_investment"),
                    "last_change",
                )
            },
        ),
        (
            "Record a new price",
            {
                "description": (
                    "Applies immediately to new buyers, every holder's position value and the "
                    "offering total (on unsold units only). Live installment plans keep their "
                    "locked price. The minimum investment stays the same number of units. "
                    "A mistake is fixed by recording the right price."
                ),
                "fields": ("new_price", "phase_label", "investor_note", "confirm_large_change"),
            },
        ),
    )

    # Only published properties are priced here; drafts use the property editor (§3.2).
    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_published=True)

    def get_form(self, request, obj=None, **kwargs):
        form_class = super().get_form(request, obj, **kwargs)

        class _Form(form_class):
            def __init__(self, *args, **kw):
                kw["request_user"] = request.user
                super().__init__(*args, **kw)

        return _Form

    # --- full admins only ------------------------------------------------- #
    def has_module_permission(self, request):
        return request.user.is_active and request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_change_permission(self, request, obj=None):
        return self.has_module_permission(request)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        new = form.cleaned_data.get("new_price")
        if new is None:
            return
        try:
            entry = pricing.record_price(
                obj, new, by=request.user,
                label=form.cleaned_data.get("phase_label", ""),
                note=form.cleaned_data.get("investor_note", ""),
                confirm_large=bool(form.cleaned_data.get("confirm_large_change")),
            )
        except pricing.PriceError as exc:  # raced with another change after validation
            self.message_user(request, exc.message, messages.ERROR)
            return
        self.message_user(
            request,
            f"New unit price recorded for {obj.name}: {entry.previous_price} → {entry.price}.",
            messages.SUCCESS,
        )

    # --- columns ----------------------------------------------------------- #
    @admin.display(description="Current price")
    def current_price(self, obj):
        return obj.token_price

    @admin.display(description="Launch price")
    def launch_price_display(self, obj):
        return obj.launch_price or obj.token_price

    @admin.display(description="Since launch")
    def change_since_launch(self, obj):
        return f"{pricing.change_since_launch_pct(obj):+}%"

    @admin.display(description="Last price change")
    def last_change(self, obj):
        last = pricing.last_price_change(obj)
        if not last:
            return "Never"
        return f"{last.created_at:%Y-%m-%d}" + (f" · {last.label}" if last.label else "")

    @admin.display(description="Price due (31+ days)", boolean=True)
    def price_due(self, obj):
        return pricing.is_price_due(obj)

    @admin.display(description="Sold units")
    def sold_units(self, obj):
        from apps.investments.services import sold_tokens

        return sold_tokens(obj)

    @admin.display(description="Unsold units")
    def unsold_units(self, obj):
        from apps.investments.services import sold_tokens

        return max(0, int(obj.token_supply or 0) - sold_tokens(obj))
