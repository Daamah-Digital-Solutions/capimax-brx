"""
LP admin — Phase 6 Wave 1.

AUTOMATION-FIRST: the normal KYB approval path is the signed Sumsub webhook
(business level). The admin is an EXCEPTION HANDLER only — the approve/reject
actions below are present but clearly labelled "exception" and route through the
SAME services (so a manual approve still activates the LP role). SPEC §3.8 admin.
"""
from django.contrib import admin, messages

from .models import (
    LiquidityProvider,
    LPDocument,
    LPHolding,
    LPKYBDocument,
    LPMarketListing,
    LPTransaction,
)
from .services import approve_kyb, reject_kyb


@admin.register(LiquidityProvider)
class LiquidityProviderAdmin(admin.ModelAdmin):
    list_display = ("user", "company_name", "status", "kyb_status", "applied_at", "approved_at")
    list_filter = ("status", "kyb_status")
    search_fields = ("user__email", "company_name", "contact_name", "sumsub_applicant_id")
    readonly_fields = (
        "id", "user", "status", "applied_at", "approved_at", "rejected_at",
        "kyb_status", "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
        "sumsub_applicant_id", "sumsub_review_answer",
        "total_deposited", "total_withdrawn", "total_earnings", "current_balance",
        "created_at", "updated_at",
    )
    actions = ["exception_approve_kyb", "exception_reject_kyb"]

    def has_add_permission(self, request):
        # LP profiles are created by the apply endpoint, never by hand.
        return False

    @admin.action(description="EXCEPTION: approve KYB (activates LP role)")
    def exception_approve_kyb(self, request, queryset):
        n = 0
        for lp in queryset:
            approve_kyb(lp, review_answer="ADMIN", source="admin")
            n += 1
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} LP(s) + activated role. "
            "Normal approvals come from the Sumsub KYB webhook.",
            messages.WARNING,
        )

    @admin.action(description="EXCEPTION: reject KYB")
    def exception_reject_kyb(self, request, queryset):
        n = 0
        for lp in queryset:
            reject_kyb(lp, reason="Rejected via admin exception action", source="admin")
            n += 1
        self.message_user(
            request, f"[EXCEPTION PATH] Rejected {n} LP(s).", messages.WARNING
        )


@admin.register(LPTransaction)
class LPTransactionAdmin(admin.ModelAdmin):
    """
    Withdrawals move only through the actions (apps/lp/payouts.py): "failed" returns the
    amount to the LP balance, "paid" adds it to total_withdrawn. Status is read-only here.
    """

    list_display = ("lp", "tx_type", "amount", "currency", "status", "created_at")
    list_filter = ("tx_type", "status", "currency")
    search_fields = ("lp__user__email",)
    readonly_fields = (
        "id", "lp", "tx_type", "amount", "currency", "status", "balance_debited",
        "processed_at", "created_at",
    )
    actions = ("action_processing", "action_paid", "action_failed")

    def _run(self, request, queryset, step, done_msg, **kwargs):
        from django.contrib import messages

        from .payouts import LPWithdrawalError

        ok = 0
        for tx in queryset.filter(tx_type="withdrawal"):
            try:
                step(tx.pk, **{k: (v(tx) if callable(v) else v) for k, v in kwargs.items()})
                ok += 1
            except LPWithdrawalError as exc:
                self.message_user(request, str(exc), level=messages.WARNING)
        if ok:
            self.message_user(request, done_msg.format(n=ok), level=messages.SUCCESS)

    @admin.action(description="Withdrawal: mark as processing")
    def action_processing(self, request, queryset):
        from .payouts import mark_processing

        self._run(request, queryset, mark_processing, "{n} withdrawal(s) marked processing.")

    @admin.action(description="Withdrawal: mark as PAID (completed)")
    def action_paid(self, request, queryset):
        from .payouts import complete_lp_withdrawal

        self._run(
            request, queryset, complete_lp_withdrawal, "{n} withdrawal(s) marked paid.",
            payout_reference=lambda tx: tx.bank_reference or "",
        )

    @admin.action(description="Withdrawal: mark as FAILED and return the amount to the LP balance")
    def action_failed(self, request, queryset):
        from .payouts import fail_lp_withdrawal

        self._run(
            request, queryset, fail_lp_withdrawal,
            "{n} withdrawal(s) failed; the amounts were returned.",
            reason=lambda tx: tx.failure_reason,
        )


@admin.register(LPDocument)
class LPDocumentAdmin(admin.ModelAdmin):
    list_display = ("document_name", "document_type", "user", "is_template", "created_at")
    list_filter = ("document_type", "is_template")
    search_fields = ("document_name", "user__email")
    readonly_fields = ("id", "lp", "user", "file", "file_size", "created_at")


@admin.register(LPKYBDocument)
class LPKYBDocumentAdmin(admin.ModelAdmin):
    list_display = ("document_name", "document_type", "lp", "status", "created_at")
    list_filter = ("document_type", "status")
    search_fields = ("document_name", "lp__user__email")
    readonly_fields = ("id", "lp", "user", "file", "file_size", "created_at")


@admin.register(LPMarketListing)
class LPMarketListingAdmin(admin.ModelAdmin):
    list_display = (
        "property_name", "token_amount", "total_value", "status",
        "seller", "lp", "settlement_tx_hash", "created_at",
    )
    list_filter = ("status", "property_id")
    search_fields = ("property_name", "seller__email", "settlement_tx_hash")
    readonly_fields = (
        "id", "seller", "lp", "settlement_tx_hash", "platform_fee_percent",
        "platform_fee_amount", "net_amount", "purchased_at", "completed_at",
        "cancelled_at", "created_at", "updated_at",
    )

    def has_add_permission(self, request):
        # Listings are created via the API (which escrow-locks tokens), never by hand.
        return False


@admin.register(LPHolding)
class LPHoldingAdmin(admin.ModelAdmin):
    list_display = (
        "property_name", "token_amount", "purchase_price", "status",
        "lp", "purchase_date",
    )
    list_filter = ("status", "property_id")
    search_fields = ("property_name", "lp__user__email")
    readonly_fields = ("id", "lp", "listing", "purchase_price", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False
