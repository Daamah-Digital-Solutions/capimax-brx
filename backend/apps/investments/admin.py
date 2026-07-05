"""Investment admin — Phase 3 Wave 2. SPEC §3.2 (read-mostly back-office view)."""
from django.contrib import admin

from .models import Investment


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "property_name",
        "amount_invested",
        "token_amount",
        "payment_method",
        "payment_status",
        "tokens_minted",
        "discount_amount",
        "platform_net",
        "created_at",
    )
    list_filter = ("payment_status", "tokens_minted", "payment_method")
    search_fields = ("user__email", "property_name", "property__slug", "token_symbol")
    readonly_fields = (
        "id",
        "user",
        "property",
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
        "wallet",
        "fee_amount",
        "discount_amount",
        "platform_net",
        "created_at",
        "updated_at",
    )

    @admin.display(description="Platform net")
    def platform_net(self, obj):
        # The platform's take for this sale = buyer-borne fee − platform-absorbed discount.
        # NEGATIVE when a Pronova discount exceeds the fee (an intended, VISIBLE subsidy).
        return (obj.fee_amount or 0) - (obj.discount_amount or 0)

    def has_add_permission(self, request):
        # Investments are created via the API (with payment + mint orchestration).
        return False
