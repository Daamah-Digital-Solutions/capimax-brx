"""Payment admin — Phase 5 Wave 1. Read-only financial records (no card data exists)."""
from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "provider",
        "stripe_payment_intent_id",
        "nowpayments_payment_id",
        "investment",
        "amount",
        "currency",
        "status",
        "created_at",
    )
    list_filter = ("provider", "status", "currency")
    search_fields = (
        "stripe_payment_intent_id",
        "nowpayments_payment_id",
        "investment__id",
        "investment__user__email",
    )
    readonly_fields = tuple(f.name for f in Payment._meta.fields)

    def has_add_permission(self, request):
        # Payments are created by the create-intent flow + webhook, never by hand.
        return False

    def has_change_permission(self, request, obj=None):
        return False
