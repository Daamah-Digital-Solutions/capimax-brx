"""
Property admin — Phase 2. THIS is the management surface for the property domain:
an admin can create and fully manage any of the 8 investment-model types end-to-end
(SPEC §3.1; DECISIONS.md "Properties": admin-managed in Django admin).

Per-model detail is edited inline on the Property page: the OneToOne blocks
(installment/future/option/shared/spv/token/financials) as stacked inlines, and the
repeating blocks (phases/portfolio assets/reports/documents) as tabular inlines.
"""
from django.contrib import admin, messages

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
    readonly_fields = ("id", "category", "token_supply", "created_at", "updated_at")
    inlines = [
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
            "Catalogue management",
            {"fields": (("is_published", "is_featured"), ("funded_date", "display_order"))},
        ),
        ("System", {"classes": ("collapse",), "fields": ("id", "created_at", "updated_at")}),
    )
