"""Payment admin — Phase 5 Wave 1. Read-only financial records (no card data exists)."""
from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html

from .models import Payment, SukukCertificate
from .sukuk_service import approve_certificate, reject_certificate


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


@admin.register(SukukCertificate)
class SukukCertificateAdmin(admin.ModelAdmin):
    """
    Nova certificate (sukuk) review — the admin is the reviewer for this manual rail. View
    the private PDF, then run the approve/reject action (mirrors the KYB exception-approve
    pattern). Approve → settle the investment (mint + owner/broker credit + buyer-borne fee)
    via sukuk_service; reject → mark it FAILED (never mints). Type the reject reason into
    `review_notes` on this form BEFORE running the reject action.
    """

    list_display = (
        "investment", "buyer_email", "property_slug", "amount_due", "claimed_value",
        "status", "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("investment__id", "investment__user__email", "sukuk_id", "issuer")
    ordering = ("-created_at",)
    actions = ["approve_certificate_action", "reject_certificate_action"]

    # Everything is read-only EXCEPT `review_notes` (the admin types the reject reason here).
    readonly_fields = (
        "id", "investment", "buyer_email", "property_slug", "amount_due",
        "certificate_link", "file_size", "file_type", "sukuk_id", "issuer",
        "claimed_value", "validity_date", "status", "reviewed_by", "reviewed_at",
        "created_at", "updated_at",
    )
    fields = readonly_fields + ("review_notes",)

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related("investment", "investment__user", "investment__property")
        )

    def has_add_permission(self, request):
        # Certificates are created by the buyer's upload, never by hand.
        return False

    @admin.display(description="Buyer")
    def buyer_email(self, obj):
        return obj.investment.user.email

    @admin.display(description="Property")
    def property_slug(self, obj):
        return obj.investment.property.slug

    @admin.display(description="Amount due (value + fee)")
    def amount_due(self, obj):
        return obj.investment.settlement_amount

    @admin.display(description="Certificate PDF")
    def certificate_link(self, obj):
        if not obj.file:
            return "—"
        url = reverse("payments:sukuk-download", args=[obj.id])
        return format_html('<a href="{}" target="_blank" rel="noopener">Download PDF</a>', url)

    @admin.action(description="EXCEPTION: approve Nova certificate (settles the investment)")
    def approve_certificate_action(self, request, queryset):
        n = sum(1 for cert in queryset if approve_certificate(cert, request.user))
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} certificate(s) → investment(s) settled + minted.",
            messages.SUCCESS,
        )

    @admin.action(description="EXCEPTION: reject Nova certificate (uses review_notes as the reason)")
    def reject_certificate_action(self, request, queryset):
        n = sum(1 for cert in queryset if reject_certificate(cert, request.user))
        self.message_user(
            request,
            f"[EXCEPTION PATH] Rejected {n} certificate(s) → investment(s) failed.",
            messages.WARNING,
        )
