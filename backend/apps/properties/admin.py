"""
Property admin — Phase 2. THIS is the management surface for the property domain:
an admin can create and fully manage any of the 8 investment-model types end-to-end
(SPEC §3.1; DECISIONS.md "Properties": admin-managed in Django admin).

Per-model detail is edited inline on the Property page: the OneToOne blocks
(installment/future/option/shared/spv/token/financials) as stacked inlines, and the
repeating blocks (phases/portfolio assets/reports/documents) as tabular inlines.
"""
import os
from datetime import timedelta

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.db import models as db_models
from django.http import JsonResponse
from django.urls import path
from django.utils import timezone
from django.utils.html import format_html

from . import pricing
from .admin_widgets import (
    DatalistTextInput,
    StickyFileInput,
    StickyFormFileField,
    StickyFormImageField,
    StickyImageInput,
)

from .models import (
    Amenity,
    ConstructionMilestone,
    DeveloperInfo,
    DeveloperReport,
    FutureContract,
    InstallmentSchedule,
    InstallmentTerm,
    InsuranceInfo,
    Landmark,
    MarketData,
    OptionContract,
    PendingUpload,
    PortfolioAsset,
    PostHandoverBenefit,
    Property,
    PropertyDocument,
    PropertyFAQ,
    PropertyFinancials,
    PropertyImage,
    PropertyPhase,
    PropertyPrice,
    PropertySitePhoto,
    PropertyUnitPrice,
    RiskFactor,
    SharedOwnership,
    SPVRecord,
    TokenMetadata,
    ValuationReport,
)


# Every image / document on the property page is uploaded the moment it is picked and kept
# across errors and edits (admin_widgets.StickyFileInput; client review §4-8).
STICKY_UPLOADS = {
    db_models.ImageField: {"widget": StickyImageInput, "form_class": StickyFormImageField},
    db_models.FileField: {"widget": StickyFileInput, "form_class": StickyFormFileField},
}
UPLOAD_MAX_BYTES = 20 * 1024 * 1024  # nginx client_max_body_size
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")


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
        "contract_address",
        "verified",
        "explorer_url",
        "deployed_date",
        "token_price",
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
    formfield_overrides = STICKY_UPLOADS
    verbose_name = "Document"
    verbose_name_plural = "Documents — upload from your device"

    def get_fields(self, request, obj=None):
        # Upload only; the old link column shows just for properties that already use links.
        if obj is not None and obj.documents.exclude(url="").exists():
            return ("name_en", "name", "doc_type", "date", "file", "url")
        return ("name_en", "name", "doc_type", "date", "file")


def _thumb(url, height=70):
    if not url:
        return "—"
    return format_html(
        '<a href="{}" target="_blank" rel="noopener"><img src="{}" style="height:{}px;'
        'border-radius:6px;object-fit:cover" /></a>',
        url, url, height,
    )


class PropertyImageInline(admin.TabularInline):
    """Gallery uploads — shown on the property page after any older image links."""

    model = PropertyImage
    extra = 0
    fields = ("image", "preview", "order")
    readonly_fields = ("preview",)
    formfield_overrides = STICKY_UPLOADS
    verbose_name = "Gallery image"
    verbose_name_plural = "Gallery — upload images"

    @admin.display(description="Preview")
    def preview(self, obj):
        return _thumb(obj.image.url if obj and obj.image else "")


class PropertySitePhotoInline(admin.TabularInline):
    """Construction-site photos (the Construction tab's "Site Photos")."""

    model = PropertySitePhoto
    extra = 0
    fields = ("image", "preview", "order")
    readonly_fields = ("preview",)
    formfield_overrides = STICKY_UPLOADS
    verbose_name = "Site photo"
    verbose_name_plural = "Site photos — upload from your device (Construction tab)"

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


class InstallmentTermInline(admin.TabularInline):
    """Installment plans offered (off-plan §4). Empty → 6/12/18/24 months at 30/25/20/15% down."""

    model = InstallmentTerm
    extra = 0
    fields = ("duration_months", "down_payment_percent", "order")
    verbose_name = "Installment term"
    verbose_name_plural = (
        "Installment terms — empty uses the default: 6 months 30% · 12 months 25% · "
        "18 months 20% · 24 months 15%"
    )


class ConstructionMilestoneInline(admin.TabularInline):
    """Construction tab milestones (empty → the page shows its 5 default milestones)."""

    model = ConstructionMilestone
    extra = 0
    fields = ("name_en", "name_ar", "threshold", "order")


class PostHandoverBenefitInline(admin.TabularInline):
    """Under-construction payment-plan benefits (empty → the page shows its defaults)."""

    model = PostHandoverBenefit
    extra = 0
    fields = ("text_en", "text_ar", "order")


class PublicationFilter(admin.SimpleListFilter):
    title = "publication"
    parameter_name = "publication"

    def lookups(self, request, model_admin):
        return (("draft", "Draft"), ("published", "Published"), ("unpublished", "Unpublished"))

    def queryset(self, request, queryset):
        if self.value() == "published":
            return queryset.filter(is_published=True)
        if self.value() == "draft":
            return queryset.filter(is_published=False, published_at__isnull=True)
        if self.value() == "unpublished":
            return queryset.filter(is_published=False, published_at__isnull=False)
        return queryset


PUBLICATION_COLORS = {"published": "#1a7f37", "unpublished": "#9a6700", "draft": "#57606a"}


def _publish_intent(post) -> bool | None:
    """True / False when the editor pressed Publish / Unpublish, else None."""
    if "_publish" in post:
        return True
    if "_unpublish" in post:
        return False
    return None


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "publication_badge",
        "country",
        "city",
        "model",
        "status",
        "funded",
        "expected_yield",
        "is_featured",
        "updated_at",
    )
    list_filter = (
        PublicationFilter,
        "country",
        "model",
        "category",
        "asset_type",
        "status",
        "risk_level",
        "is_featured",
    )
    search_fields = ("name", "name_ar", "location", "location_ar", "city", "slug")
    list_editable = ("is_featured",)
    ordering = ("display_order", "name")
    actions = ["publish_selected", "unpublish_selected", "deploy_token_contract"]
    save_on_top = True
    formfield_overrides = STICKY_UPLOADS

    class Media:
        css = {"all": ("properties/admin_property.css",)}
        js = ("properties/admin_property.js",)

    # --- publication ------------------------------------------------------- #
    @admin.display(description="Status", ordering="is_published")
    def publication_badge(self, obj):
        status = obj.publication_status
        return format_html(
            '<span style="color:#fff;background:{};padding:2px 8px;border-radius:10px;'
            'font-size:11px;font-weight:600">{}</span>',
            PUBLICATION_COLORS[status], status.capitalize(),
        )

    @admin.action(description="Publish selected properties")
    def publish_selected(self, request, queryset):
        done = 0
        for prop in queryset.filter(is_published=False):
            missing = prop.missing_to_publish()
            if missing:
                self.message_user(
                    request,
                    f"'{prop.name}' was not published — still needed: "
                    + " ".join(missing.values()),
                    messages.ERROR,
                )
                continue
            prop.is_published = True
            prop.save(update_fields=["is_published", "updated_at"])
            done += 1
        if done:
            self.message_user(request, f"{done} propert{'y' if done == 1 else 'ies'} published — now visible on the platform.", messages.SUCCESS)

    @admin.action(description="Unpublish selected properties (hide, keep everything)")
    def unpublish_selected(self, request, queryset):
        done = queryset.filter(is_published=True).update(is_published=False, updated_at=timezone.now())
        self.message_user(
            request,
            f"{done} propert{'y' if done == 1 else 'ies'} unpublished — hidden from the platform; "
            "all data, images and documents are kept and can be published again.",
            messages.SUCCESS,
        )

    @admin.display(description="Property link")
    def property_link(self, obj):
        if obj is None or not obj.pk or not obj.slug:
            return "Created automatically from the name when you save."
        url = f"{settings.FRONTEND_URL.rstrip('/')}/property/{obj.slug}"
        if obj.is_published:
            return format_html('<a href="{}" target="_blank" rel="noopener">{}</a>', url, url)
        return format_html("{} <span style=\"color:#57606a\">(live once published)</span>", url)

    def get_form(self, request, obj=None, change=False, **kwargs):
        form_class = super().get_form(request, obj, change=change, **kwargs)
        intent = _publish_intent(request.POST) if request.method == "POST" else None

        class PropertyForm(form_class):
            def clean(self):
                data = super().clean()
                # Applied before the model validates, so publishing checks the essentials
                # and a draft saves with whatever is filled in.
                if intent is not None:
                    self.instance.is_published = intent
                elif self.instance._state.adding:
                    self.instance.is_published = False  # a new property starts as a draft
                return data

        # Mark what publishing needs (everything else is optional).
        for name in [f for f, _ in Property.PUBLISH_REQUIRED] + ["total_value", "image_file"]:
            field = PropertyForm.base_fields.get(name)
            if field is not None:
                field.label = f"{field.label} *"
        return PropertyForm

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "city":
            kwargs["widget"] = DatalistTextInput(
                lambda: Property.objects.exclude(city="").order_by("city")
                .values_list("city", flat=True).distinct()[:300],
                attrs={"autocomplete": "off", "placeholder": "Type any city"},
            )
        return super().formfield_for_dbfield(db_field, request, **kwargs)

    def save_model(self, request, obj, form, change):
        intent = _publish_intent(request.POST)
        super().save_model(request, obj, form, change)
        if intent is True:
            self.message_user(request, "Published — the property is now visible on the platform.", messages.SUCCESS)
        elif intent is False:
            self.message_user(
                request,
                "Unpublished — hidden from the platform. All data, images and documents are kept.",
                messages.SUCCESS,
            )
        elif not obj.is_published:
            self.message_user(request, "Saved as a draft — not visible on the platform until you publish it.", messages.INFO)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # The picked files are now copied onto the property — drop the temporary copies.
        tokens = [v for k, v in request.POST.items() if k.endswith("__pending") and v]
        for pending in PendingUpload.objects.filter(pk__in=[t for t in tokens if _is_uuid(t)]):
            pending.delete()

    def _stay_on_page(self, request):
        # Publish / Unpublish keep the editor open like "Save draft".
        if _publish_intent(request.POST) is not None and "_continue" not in request.POST:
            request.POST = request.POST.copy()
            request.POST["_continue"] = "1"

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        if request.method == "POST":
            self._stay_on_page(request)
        return super().changeform_view(request, object_id, form_url, extra_context)

    # --- upload on pick ---------------------------------------------------- #
    def get_urls(self):
        return [
            path("upload/", self.admin_site.admin_view(self.upload_view), name="properties_property_upload"),
        ] + super().get_urls()

    def upload_view(self, request):
        """Store one picked file right away; the form then only carries its id."""
        if request.method != "POST":
            return JsonResponse({"error": "POST a file."}, status=405)
        if not (self.has_add_permission(request) or self.has_change_permission(request)):
            return JsonResponse({"error": "You are not allowed to edit properties."}, status=403)
        upload = request.FILES.get("file")
        kind = request.POST.get("kind", "document")
        if upload is None:
            return JsonResponse({"error": "No file was received."}, status=400)
        if upload.size > UPLOAD_MAX_BYTES:
            return JsonResponse({"error": "The file is larger than 20 MB."}, status=400)
        ext = os.path.splitext(upload.name)[1].lower()
        from .models import DOCUMENT_EXTENSIONS

        is_image = ext in IMAGE_EXTENSIONS
        if kind == "image":
            if not is_image:
                return JsonResponse({"error": "Choose an image (JPG, PNG, WebP or GIF)."}, status=400)
            try:
                forms.ImageField().clean(upload)
            except forms.ValidationError:
                return JsonResponse({"error": "This file is not a valid image."}, status=400)
            upload.seek(0)
        elif ext.lstrip(".") not in DOCUMENT_EXTENSIONS:
            return JsonResponse(
                {"error": "Choose a PDF, Word, Excel, CSV or image file."}, status=400
            )
        # Tidy up copies that were never saved with a property.
        for stale in PendingUpload.objects.filter(created_at__lt=timezone.now() - timedelta(days=14))[:50]:
            stale.delete()
        pending = PendingUpload.objects.create(
            file=upload, original_name=os.path.basename(upload.name)[:255],
            is_image=is_image, uploaded_by=request.user,
        )
        return JsonResponse({
            "token": str(pending.pk), "name": pending.original_name,
            "url": pending.file.url, "isImage": is_image,
        })

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
        "id", "slug", "category", "token_supply", "created_at", "updated_at", "hero_preview",
        "price_lock_note", "page_checklist", "property_link", "publication_badge",
    )
    raw_id_fields = ("submitted_by",)

    @admin.display(description="Property page — what is filled in")
    def page_checklist(self, obj):
        """Which data-room sections have real content; an empty one shows the page's sample text."""
        from django.utils.html import format_html, format_html_join

        if obj is None or not obj.pk:
            return "Save the property first, then fill in the sections below."
        rel = lambda name: getattr(obj, name, None)  # noqa: E731

        def one(name):
            try:
                return rel(name) is not None
            except Exception:
                return False

        checks = [
            ("Main image", bool(obj.image or obj.image_file)),
            ("Gallery", bool(obj.images) or obj.gallery.exists()),
            ("Description", bool(obj.description)),
            ("Expected completion", bool(obj.expected_completion), "the page uses the installment activation date or the duration"),
            ("Financials", one("financials")),
            ("Developer", one("developer_info")),
            ("Insurance", one("insurance_info")),
            ("Market data", one("market_data")),
            ("SPV / legal", one("spv")),
            ("Documents (with a file or link)", obj.documents.exclude(file="", url="").exists()),
            ("Valuation reports", obj.valuation_reports.exists()),
            ("Amenities", obj.amenities.exists()),
            ("Landmarks", obj.landmarks.exists()),
            ("Risk factors", obj.risk_factors.exists()),
            ("FAQs", obj.faqs.exists()),
            ("Construction milestones (under-construction properties)", obj.construction_milestones.exists()),
            ("Site photos (under-construction properties)", obj.site_photos.exists() or bool(obj.site_photos_url)),
            ("Post-handover benefits (off-plan properties)", obj.post_handover_benefits.exists()),
            ("On-chain token (\"Deploy token contract\" action)", bool(getattr(rel("token_metadata"), "deployed_contract_address", "") if one("token_metadata") else ""), "not deployed yet — the page shows \"tokenization pending\""),
        ]
        rows = format_html_join(
            "", "<li>{} {}</li>",
            (("✅" if c[1] else "⚠️", c[0] + ("" if c[1] else " — " + (c[2] if len(c) > 2 else "empty: the page shows sample content")))
             for c in checks),
        )
        return format_html('<ul style="margin:0;padding-left:1.2em;line-height:1.7">{}</ul>', rows)
    inlines = [
        PropertyImageInline,
        PropertySitePhotoInline,
        PropertyDocumentInline,
        InstallmentTermInline,
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
        DeveloperInfoInline,
        InsuranceInfoInline,
        MarketDataInline,
        AmenityInline,
        LandmarkInline,
        RiskFactorInline,
        PropertyFAQInline,
        ConstructionMilestoneInline,
        PostHandoverBenefitInline,
    ]
    def get_fieldsets(self, request, obj=None):
        """
        Essentials first (only they are needed to publish), Arabic optional and collapsed,
        everything else optional with defaults (client review §3, §10). The older link
        fields appear only on properties that already use them.
        """
        sets = []
        if obj is not None and obj.pk:
            sets.append(("Property page checklist", {"fields": ("page_checklist",)}))
        sets += [
            (
                "Essentials — needed to publish",
                {
                    "description": (
                        "Fields marked * are needed to publish — nothing else is. Everything "
                        "below is optional or filled in automatically. Save a draft any time "
                        "and finish later."
                    ),
                    "fields": (
                        "name",
                        "property_link",
                        "location",
                        ("country", "city"),
                        "model",
                        ("total_value", "token_price", "token_supply"),
                        "price_lock_note",
                        ("image_file", "hero_preview"),
                        "description",
                    ),
                },
            ),
            (
                "Arabic (optional)",
                {
                    "classes": ("collapse",),
                    "description": "Leave empty to show the English text on the Arabic site.",
                    "fields": (
                        "name_ar", "location_ar", "description_ar", "duration_ar",
                        "expected_completion_ar",
                    ),
                },
            ),
            (
                "Classification",
                {
                    "description": (
                        "Category is set from the investment type. Status and yield type are "
                        "set automatically when left empty."
                    ),
                    "fields": (
                        ("asset_type", "category"),
                        ("status", "yield_type", "risk_level"),
                    ),
                },
            ),
            (
                "Economics",
                {
                    "description": (
                        "Token supply = total value ÷ token price (automatic). "
                        "Expected yield/growth and funded % must be between 0 and 100."
                    ),
                    "fields": (
                        ("future_token_price", "min_investment"),
                        ("expected_yield", "expected_growth"),
                        ("funded", "investors"),
                        "duration",
                        "expected_completion",
                        "offplan_payment",
                    ),
                },
            ),
            ("Exit & liquidity", {"fields": (("exit_eligible", "exit_availability", "insurance_active"),)}),
            (
                "Construction",
                {
                    "description": "Upload the site photos in the \"Site photos\" section below.",
                    "fields": ("construction_progress", "drone_video_url"),
                },
            ),
        ]
        legacy = []
        if obj is not None and obj.image and not obj.image_file:
            legacy.append("image")
        if obj is not None and obj.images:
            legacy.append("images")
        if obj is not None and obj.site_photos_url:
            legacy.append("site_photos_url")
        if legacy:
            sets.append((
                "Older image links (this property was added with links)",
                {
                    "classes": ("collapse",),
                    "description": "Kept so the current images stay. Uploads above replace them.",
                    "fields": tuple(legacy),
                },
            ))
        sets += [
            ("Fees", {"fields": (("fee_platform", "fee_management", "fee_exit"), ("fee_pronova_discount", "fee_installment"))}),
            (
                "Broker program",
                {
                    "description": "Commission % a referring broker earns on this property "
                                   "(empty = the broker's own rate), and whether brokers can promote it.",
                    "fields": (("broker_commission_rate", "open_for_promotion"),),
                },
            ),
            (
                "Owner",
                {
                    "description": "Link the owner/developer account that is credited with this "
                                   "property's sales (leave empty for a platform-owned property).",
                    "fields": ("submitted_by",),
                },
            ),
            (
                "Catalogue management",
                {
                    "description": "Publish / unpublish with the buttons at the top or bottom of the page.",
                    "fields": (("is_featured", "display_order"), "funded_date"),
                },
            ),
            ("System", {"classes": ("collapse",), "fields": ("slug", "id", "created_at", "updated_at")}),
        ]
        return sets


# --------------------------------------------------------------------------- #
# Unit prices (off-plan model §3.2) — the only way to change a live property's price.
# Full admins only. Each save appends to the immutable price history.
# --------------------------------------------------------------------------- #
def _is_uuid(value) -> bool:
    import uuid

    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


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
                    "Holders, installment payers and listing sellers are notified (in-app + email). "
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
