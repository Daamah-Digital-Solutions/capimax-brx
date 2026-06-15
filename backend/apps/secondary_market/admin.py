"""Peer secondary-market admin — Phase 6 Wave 3. Read-only (settled by the service)."""
from django.contrib import admin

from .models import SecondaryMarketListing


@admin.register(SecondaryMarketListing)
class SecondaryMarketListingAdmin(admin.ModelAdmin):
    list_display = (
        "property_name", "token_amount", "total_value", "status",
        "seller", "buyer", "settlement_tx_hash", "created_at",
    )
    list_filter = ("status", "seller_type", "buyer_type", "property_id")
    search_fields = ("property_name", "seller__email", "buyer__email", "settlement_tx_hash")
    readonly_fields = tuple(f.name for f in SecondaryMarketListing._meta.fields)

    def has_add_permission(self, request):
        # Listings are created via the API (which escrow-locks tokens), never by hand.
        return False
