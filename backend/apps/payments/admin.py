"""Payment admin — Phase 5 Wave 1. Read-only financial records (no card data exists)."""
from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html

from .models import NovaPledge, Payment, SukukCertificate
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
        from .sukuk_service import CertificateError

        minted = pending = 0
        for cert in queryset:
            try:
                result = approve_certificate(cert, request.user)
            except CertificateError as exc:
                self.message_user(request, f"{cert}: not approved — {exc}", messages.WARNING)
                continue
            except Exception as exc:  # noqa: BLE001 — one certificate must not stop the rest
                self.message_user(
                    request, f"{cert}: approved, but settling failed ({exc}). It will be retried "
                    "automatically within the hour.", messages.ERROR,
                )
                continue
            if result.get("minted") or result.get("already"):
                minted += 1
            else:
                pending += 1
        if minted:
            self.message_user(
                request, f"Approved {minted} certificate(s) — units issued and pledged to Nova.",
                messages.SUCCESS,
            )
        if pending:
            self.message_user(
                request, f"Approved {pending} certificate(s); their units will be issued by the "
                "hourly reconciliation.", messages.WARNING,
            )

    @admin.action(description="EXCEPTION: reject Nova certificate (uses review_notes as the reason)")
    def reject_certificate_action(self, request, queryset):
        n = sum(1 for cert in queryset if reject_certificate(cert, request.user))
        self.message_user(
            request,
            f"[EXCEPTION PATH] Rejected {n} certificate(s) → investment(s) failed.",
            messages.WARNING,
        )


@admin.register(NovaPledge)
class NovaPledgeAdmin(admin.ModelAdmin):
    """
    Units bought with a Nova certificate stay pledged until Nova Finance's clearance. To
    release: enter the clearance reference on the pledge, save, then run the action.
    """

    list_display = ("investment", "property_slug", "units", "status", "release_reference", "created_at", "released_at")
    list_filter = ("status",)
    search_fields = ("investment__user__email", "property_slug", "release_reference")
    readonly_fields = (
        "id", "investment", "wallet", "property_slug", "units", "status", "released_by",
        "released_at", "created_at",
    )
    actions = ("action_release",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description="Release the pledge (Nova clearance received) — unlocks the units")
    def action_release(self, request, queryset):
        from django.contrib import messages

        from .nova_pledge import PledgeError, release_pledge

        done = 0
        for pledge in queryset:
            try:
                release_pledge(pledge.pk, reference=pledge.release_reference, by=request.user)
                done += 1
            except PledgeError as exc:
                self.message_user(request, f"{pledge}: {exc}", level=messages.WARNING)
        if done:
            self.message_user(request, f"{done} pledge(s) released.", level=messages.SUCCESS)
