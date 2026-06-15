"""
KYC admin — Phase 4.

AUTOMATION-FIRST: the normal approval path is the signed Sumsub webhook — there is
NO default approve action. The admin is an EXCEPTION HANDLER only, so the manual
approve/reject actions below are present but clearly labelled "exception" and route
through the same services (so a manual approve still auto-creates the wallet).
DECISIONS.md "Phase 4" #5 + "Governance".
"""
from django.contrib import admin, messages

from .models import KYCDocument, UserKYC
from .services import approve_kyc, reject_kyc


@admin.register(UserKYC)
class UserKYCAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "submitted_at", "approved_at", "rejected_at")
    list_filter = ("status",)
    search_fields = ("user__email", "sumsub_applicant_id")
    readonly_fields = (
        "id", "user", "status", "submitted_at", "approved_at", "rejected_at",
        "sumsub_applicant_id", "sumsub_review_answer", "created_at", "updated_at",
    )
    actions = ["exception_approve", "exception_reject"]

    def has_add_permission(self, request):
        # KYC records are created by the submit service / webhook, never by hand.
        return False

    @admin.action(description="EXCEPTION: approve selected KYC (auto-creates wallet)")
    def exception_approve(self, request, queryset):
        n = 0
        for kyc in queryset:
            approve_kyc(kyc, review_answer="ADMIN", source="admin")
            n += 1
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} KYC record(s) + queued wallet creation. "
            "Normal approvals come from the Sumsub webhook.",
            messages.WARNING,
        )

    @admin.action(description="EXCEPTION: reject selected KYC")
    def exception_reject(self, request, queryset):
        n = 0
        for kyc in queryset:
            reject_kyc(kyc, reason="Rejected via admin exception action", source="admin")
            n += 1
        self.message_user(
            request, f"[EXCEPTION PATH] Rejected {n} KYC record(s).", messages.WARNING
        )


@admin.register(KYCDocument)
class KYCDocumentAdmin(admin.ModelAdmin):
    list_display = ("kyc", "document_type", "status", "uploaded_at")
    list_filter = ("document_type", "status")
    search_fields = ("kyc__user__email",)
    readonly_fields = ("id", "kyc", "document_type", "file", "uploaded_at")

    def has_add_permission(self, request):
        return False
