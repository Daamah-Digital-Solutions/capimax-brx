"""
Developer admin — Phase 8 Wave A.

AUTOMATION-FIRST: the normal developer-KYB approval path is the signed Sumsub webhook
(developer business level). The admin is an EXCEPTION HANDLER only — the approve/reject
actions below are present but clearly labelled "exception" and route through the SAME
services (so a manual approve still activates the developer role). Mirrors
apps/owner/admin.py (OwnerProfileAdmin).
"""
from django.contrib import admin, messages

from .models import DeveloperProfile
from .services import approve_kyb, reject_kyb


@admin.register(DeveloperProfile)
class DeveloperProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "company_name", "status", "kyb_status", "applied_at", "approved_at")
    list_filter = ("status", "kyb_status")
    search_fields = ("user__email", "company_name", "contact_name", "sumsub_applicant_id")
    readonly_fields = (
        "id", "user", "status", "applied_at", "approved_at", "rejected_at",
        "kyb_status", "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
        "sumsub_applicant_id", "sumsub_review_answer",
        "created_at", "updated_at",
    )
    actions = ["exception_approve_kyb", "exception_reject_kyb"]

    def has_add_permission(self, request):
        # Developer profiles are created by the apply endpoint, never by hand.
        return False

    @admin.action(description="EXCEPTION: approve developer KYB (activates developer role)")
    def exception_approve_kyb(self, request, queryset):
        n = 0
        for developer in queryset:
            approve_kyb(developer, review_answer="ADMIN", source="admin")
            n += 1
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} developer(s) + activated role. "
            "Normal approvals come from the Sumsub developer-KYB webhook.",
            messages.WARNING,
        )

    @admin.action(description="EXCEPTION: reject developer KYB")
    def exception_reject_kyb(self, request, queryset):
        n = 0
        for developer in queryset:
            reject_kyb(developer, reason="Rejected via admin exception action", source="admin")
            n += 1
        self.message_user(
            request, f"[EXCEPTION PATH] Rejected {n} developer(s).", messages.WARNING
        )
