"""
Partner admin — Phase 11 Wave A.

TWO clearly-separated, INDEPENDENT admin responsibilities (PARTNERS_SURFACE.md):

  (1) KYB / verification — the normal path is the signed Sumsub webhook (partner
      business level); the admin is an EXCEPTION HANDLER only. The approve/reject KYB
      actions route through the SAME services (so a manual approve still activates the
      partner role). Mirrors apps/developer/admin.py.

  (2) Public-directory visibility — a DELIBERATE admin review step, independent of KYB.
      "Approve directory listing" / "Reject directory listing" flip ONLY directory_status
      (whether the partner appears in the public directory). The admin enters NO company
      data — the PARTNER supplied it; the admin only approves/rejects the listing.

A partner can be KYB-approved yet directory-pending (or directory-rejected) and vice
versa — the two states never touch each other.
"""
from django.contrib import admin, messages

from .models import PartnerProfile
from .services import approve_directory, approve_kyb, reject_directory, reject_kyb


@admin.register(PartnerProfile)
class PartnerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user", "company_name", "category", "status", "kyb_status",
        "directory_status", "applied_at", "approved_at",
    )
    list_filter = ("status", "kyb_status", "directory_status", "category")
    search_fields = ("user__email", "company_name", "contact_name", "sumsub_applicant_id")
    readonly_fields = (
        "id", "user", "status", "applied_at", "approved_at", "rejected_at",
        "kyb_status", "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
        "sumsub_applicant_id", "sumsub_review_answer",
        "directory_status", "directory_reviewed_at",
        "created_at", "updated_at",
    )
    actions = [
        "exception_approve_kyb",
        "exception_reject_kyb",
        "approve_directory_listing",
        "reject_directory_listing",
    ]

    def has_add_permission(self, request):
        # Partner profiles are created by the apply endpoint, never by hand.
        return False

    # --- (1) KYB / verification (exception path) ----------------------------- #
    @admin.action(description="EXCEPTION: approve partner KYB (activates partner role)")
    def exception_approve_kyb(self, request, queryset):
        n = 0
        for partner in queryset:
            approve_kyb(partner, review_answer="ADMIN", source="admin")
            n += 1
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} partner(s) + activated role. "
            "Normal approvals come from the Sumsub partner-KYB webhook. "
            "(This does NOT publish them to the public directory — that is a separate action.)",
            messages.WARNING,
        )

    @admin.action(description="EXCEPTION: reject partner KYB")
    def exception_reject_kyb(self, request, queryset):
        n = 0
        for partner in queryset:
            reject_kyb(partner, reason="Rejected via admin exception action", source="admin")
            n += 1
        self.message_user(
            request, f"[EXCEPTION PATH] Rejected {n} partner(s).", messages.WARNING
        )

    # --- (2) Public-directory visibility (the deliberate review step) -------- #
    @admin.action(description="Approve directory listing (show in public directory)")
    def approve_directory_listing(self, request, queryset):
        n = 0
        for partner in queryset:
            approve_directory(partner, admin=request.user)
            n += 1
        self.message_user(
            request,
            f"Published {n} partner(s) to the public directory. "
            "(Independent of KYB — this only controls public visibility.)",
            messages.SUCCESS,
        )

    @admin.action(description="Reject directory listing (hide from public directory)")
    def reject_directory_listing(self, request, queryset):
        n = 0
        for partner in queryset:
            reject_directory(partner, admin=request.user,
                             notes="Directory listing rejected via admin action")
            n += 1
        self.message_user(
            request,
            f"Removed {n} partner(s) from the public directory.",
            messages.WARNING,
        )
