"""Certificate admin — Phase 3 Wave 3. SPEC §3.3 (list/search/filter + revoke action)."""
from django.contrib import admin, messages

from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = (
        "certificate_id",
        "investor_name",
        "property_name",
        "status",
        "issue_date",
    )
    list_filter = ("status",)
    search_fields = ("certificate_id", "verification_code", "investor_name")
    readonly_fields = ("id", "created_at", "updated_at", "issue_date")
    actions = ["revoke_certificates"]

    @admin.action(description="Revoke selected certificates")
    def revoke_certificates(self, request, queryset):
        n = 0
        for cert in queryset:
            cert.revoke(reason="Revoked via admin action")
            n += 1
        self.message_user(request, f"Revoked {n} certificate(s).", messages.SUCCESS)

    def has_add_permission(self, request):
        # Certificates are created by the investment/generation services.
        return False
