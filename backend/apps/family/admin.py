"""Family admin — Wave A. Read-mostly; bank rows show ONLY the masked last-4 (PII)."""
from django.contrib import admin

from .models import (
    FamilyAccount,
    FamilyAccrual,
    FamilyBankAccount,
    FamilyTransaction,
    FamilyTransferSchedule,
)


@admin.register(FamilyAccount)
class FamilyAccountAdmin(admin.ModelAdmin):
    list_display = ("member_name", "relationship", "investor", "status",
                    "access_level", "allocated_returns_percent", "created_at")
    list_filter = ("status", "access_level")
    search_fields = ("member_name", "member_email", "investor__email")
    readonly_fields = ("id", "investor", "linked_at", "created_at", "updated_at")


@admin.register(FamilyBankAccount)
class FamilyBankAccountAdmin(admin.ModelAdmin):
    # NOTE: only the masked last-4 exists — there is no full account number to show.
    list_display = ("bank_name", "account_number_masked", "currency",
                    "is_verified", "is_primary", "family_account")
    list_filter = ("is_verified", "is_primary", "currency")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(FamilyTransferSchedule)
class FamilyTransferScheduleAdmin(admin.ModelAdmin):
    list_display = ("schedule_type", "family_account", "bank_account",
                    "is_active", "next_transfer_date")
    list_filter = ("schedule_type", "is_active")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(FamilyTransaction)
class FamilyTransactionAdmin(admin.ModelAdmin):
    list_display = ("transaction_type", "amount", "status", "family_account",
                    "reference_number", "created_at")
    list_filter = ("transaction_type", "status")
    search_fields = ("reference_number", "family_account__member_name")
    readonly_fields = ("id", "created_at")


@admin.register(FamilyAccrual)
class FamilyAccrualAdmin(admin.ModelAdmin):
    # Append-only money ledger — READ-ONLY in admin (never hand-edit a financial record).
    list_display = ("entry_type", "amount_usd", "family_account", "investor",
                    "distribution", "withdrawal", "created_at")
    list_filter = ("entry_type",)
    search_fields = ("family_account__member_name", "investor__email")
    readonly_fields = (
        "id", "family_account", "investor", "entry_type", "amount_usd", "distribution",
        "source_payout", "allocation_percent", "owner_share_usd", "withdrawal", "memo",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
