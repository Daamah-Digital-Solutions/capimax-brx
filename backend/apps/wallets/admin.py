"""
Wallet admin — Phase 3 Wave 1.

SAFETY: the admin shows wallet ADDRESSES (public) and key-material METADATA only.
It never displays the encrypted private key (let alone plaintext). Everything is
read-only: wallets are created by the generation service, never hand-edited.
"""
from django.contrib import admin, messages

from .models import (
    BalanceTransaction,
    Deposit,
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
    """
    The status moves only through the actions below (apps/wallets/payouts.py): "failed"
    returns the amount to the investor's wallet, "paid" closes it. Editing it by hand would
    skip the refund, so it is read-only here.
    """

    list_display = (
        "user", "amount", "currency", "method", "provider", "speed", "destination_label",
        "status", "reference", "created_at",
    )
    list_filter = ("status", "method", "provider", "currency")
    search_fields = ("user__email", "reference")
    fields = (
        "id", "user", "amount", "currency", "method", "provider", "speed", "fee_amount",
        "reference", "status", "destination_label", "bank_account", "crypto_wallet", "notes",
        "payout_reference", "failure_reason", "processed_at", "created_at",
    )
    # Only the operator's notes are editable: the payout reference, or why it failed.
    readonly_fields = tuple(f for f in fields if f not in ("payout_reference", "failure_reason"))
    actions = ("action_pay_stripe", "action_processing", "action_paid", "action_failed")

    @admin.action(description="Approve and pay via Stripe (automatic bank withdrawals)")
    def action_pay_stripe(self, request, queryset):
        from django.contrib import messages

        from .auto_payouts import execute

        results = {}
        for wd in queryset:
            outcome = execute(wd.pk)
            results[outcome] = results.get(outcome, 0) + 1
        labels = {"paid": "paid", "failed": "failed and refunded",
                  "awaiting_balance": "waiting (platform Stripe balance too low)",
                  "skipped": "skipped (not a pending Stripe withdrawal, or payout account not ready)"}
        for outcome, n in results.items():
            level = messages.SUCCESS if outcome == "paid" else messages.WARNING
            self.message_user(request, f"{n} withdrawal(s) {labels.get(outcome, outcome)}.", level=level)

    def _run(self, request, queryset, step, done_msg, **kwargs):
        from django.contrib import messages

        from .payouts import WithdrawalStateError

        ok = 0
        for wd in queryset:
            try:
                step(wd.pk, **{k: (v(wd) if callable(v) else v) for k, v in kwargs.items()})
                ok += 1
            except WithdrawalStateError as exc:
                self.message_user(request, str(exc), level=messages.WARNING)
        if ok:
            self.message_user(request, done_msg.format(n=ok), level=messages.SUCCESS)

    @admin.action(description="Mark as processing (payout started)")
    def action_processing(self, request, queryset):
        from .payouts import mark_processing

        self._run(request, queryset, mark_processing, "{n} withdrawal(s) marked processing.")

    @admin.action(description="Mark as PAID (completed)")
    def action_paid(self, request, queryset):
        from .payouts import complete_withdrawal

        self._run(
            request, queryset, complete_withdrawal, "{n} withdrawal(s) marked paid.",
            payout_reference=lambda wd: wd.payout_reference,
        )

    @admin.action(description="Mark as FAILED and return the amount to the wallet")
    def action_failed(self, request, queryset):
        from .payouts import fail_withdrawal

        self._run(
            request, queryset, fail_withdrawal,
            "{n} withdrawal(s) failed; the amounts were returned to the wallets.",
            reason=lambda wd: wd.failure_reason,
        )


@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    # Card/crypto credits are settlement-gated (PSP webhook) — never an admin action. A MANUAL
    # bank deposit has no webhook, so an admin reviews the uploaded proof and approves HERE →
    # the balance is credited through the SAME idempotent core the webhook uses (never twice).
    list_display = (
        "reference", "user", "amount", "payment_method", "target", "status", "credited", "created_at",
    )
    list_filter = ("status", "payment_method", "credited", "target")
    search_fields = ("user__email", "id", "reference")
    readonly_fields = (
        "id", "user", "amount", "payment_method", "target", "reference", "proof_file",
        "status", "credited", "credited_at", "created_at", "updated_at",
    )
    actions = ("approve_bank_deposits", "reject_bank_deposits")

    @admin.action(description="Approve selected BANK deposits (verify proof → credit balance)")
    def approve_bank_deposits(self, request, queryset):
        from apps.payments.services import approve_bank_deposit

        credited = 0
        for dep in queryset.filter(payment_method="bank", credited=False):
            try:
                if approve_bank_deposit(dep):
                    credited += 1
            except Exception as exc:  # noqa: BLE001 — surface, don't 500 the admin
                self.message_user(
                    request, f"{dep.reference or dep.id}: {exc}", level=messages.ERROR
                )
        self.message_user(
            request, f"Credited {credited} bank deposit(s).", level=messages.SUCCESS
        )

    @admin.action(description="Reject selected PENDING bank deposits (bad/missing proof)")
    def reject_bank_deposits(self, request, queryset):
        from apps.payments.services import reject_bank_deposit

        rejected = 0
        for dep in queryset.filter(payment_method="bank", credited=False, status="pending"):
            reject_bank_deposit(dep)
            rejected += 1
        self.message_user(
            request, f"Rejected {rejected} bank deposit(s).", level=messages.WARNING
        )
