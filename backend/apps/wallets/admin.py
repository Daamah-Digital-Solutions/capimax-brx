"""
Wallet admin — Phase 3 Wave 1.

SAFETY: the admin shows wallet ADDRESSES (public) and key-material METADATA only.
It never displays the encrypted private key (let alone plaintext). Everything is
read-only: wallets are created by the generation service, never hand-edited.
"""
from django.contrib import admin

from .models import (
    BalanceTransaction,
    OwnershipToken,
    UserBalance,
    UserWallet,
    WalletKeyMaterial,
    WalletTransaction,
    Withdrawal,
)


@admin.register(UserWallet)
class UserWalletAdmin(admin.ModelAdmin):
    list_display = ("wallet_address", "user", "network", "wallet_type", "created_at")
    list_filter = ("network", "wallet_type")
    search_fields = ("wallet_address", "user__email")
    readonly_fields = (
        "id",
        "user",
        "wallet_address",
        "network",
        "wallet_type",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        # Wallets are minted by the service (with key generation), never in admin.
        return False


@admin.register(WalletKeyMaterial)
class WalletKeyMaterialAdmin(admin.ModelAdmin):
    """
    Ops visibility that a key EXISTS and which backend protects it — WITHOUT ever
    rendering the ciphertext. `encrypted_private_key` is intentionally excluded
    from both the list and the form.
    """

    list_display = ("wallet", "key_backend", "created_at")
    list_filter = ("key_backend",)
    search_fields = ("wallet__wallet_address",)
    # Only non-secret metadata is shown; the ciphertext field is never included.
    fields = ("wallet", "key_backend", "created_at")
    readonly_fields = ("wallet", "key_backend", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(OwnershipToken)
class OwnershipTokenAdmin(admin.ModelAdmin):
    list_display = (
        "wallet",
        "property_name",
        "token_symbol",
        "token_amount",
        "ownership_percentage",
        "status",
    )
    list_filter = ("status",)
    search_fields = ("wallet__wallet_address", "property_id", "property_name")
    readonly_fields = tuple(
        f.name for f in OwnershipToken._meta.fields
    )

    def has_add_permission(self, request):
        return False  # mutated only by the mint service


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ("wallet", "tx_type", "tx_hash", "block_number", "status", "created_at")
    list_filter = ("tx_type", "status")
    search_fields = ("wallet__wallet_address", "tx_hash")
    readonly_fields = tuple(f.name for f in WalletTransaction._meta.fields)

    def has_add_permission(self, request):
        return False  # written only after a confirmed on-chain receipt


@admin.register(UserBalance)
class UserBalanceAdmin(admin.ModelAdmin):
    list_display = ("user", "current_balance", "currency", "updated_at")
    search_fields = ("user__email",)
    readonly_fields = tuple(f.name for f in UserBalance._meta.fields)

    def has_add_permission(self, request):
        return False  # mutated only by the settlement service


@admin.register(BalanceTransaction)
class BalanceTransactionAdmin(admin.ModelAdmin):
    list_display = ("balance", "entry_type", "amount", "source", "reference", "created_at")
    list_filter = ("entry_type", "source")
    search_fields = ("balance__user__email", "reference")
    readonly_fields = tuple(f.name for f in BalanceTransaction._meta.fields)

    def has_add_permission(self, request):
        return False


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display = ("user", "amount", "currency", "method", "status", "reference", "created_at")
    list_filter = ("status", "method", "currency")
    search_fields = ("user__email", "reference")
    readonly_fields = ("id", "user", "amount", "currency", "method", "reference", "created_at")
