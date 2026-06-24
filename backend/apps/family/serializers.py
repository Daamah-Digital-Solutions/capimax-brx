"""
Family INPUT serializers — Wave A. Validation only; read output is hand-shaped in the views
(mirrors the installments/reinvestments precedent) to match the existing frontend TS shapes.
"""
from rest_framework import serializers


class FamilyAccountCreateSerializer(serializers.Serializer):
    member_name = serializers.CharField(max_length=200)
    member_email = serializers.EmailField()
    relationship = serializers.CharField(max_length=40)


class FamilyAccountUpdateSerializer(serializers.Serializer):
    """Partial update: member fields + access_level/status + the allocation %."""

    member_name = serializers.CharField(max_length=200, required=False)
    member_email = serializers.EmailField(required=False)
    relationship = serializers.CharField(max_length=40, required=False)
    status = serializers.ChoiceField(
        choices=["pending", "active", "suspended"], required=False
    )
    access_level = serializers.ChoiceField(
        choices=["view_only", "authorized"], required=False
    )
    allocated_returns_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False
    )


class FamilyBankAccountCreateSerializer(serializers.Serializer):
    family_account_id = serializers.UUIDField()
    bank_name = serializers.CharField(max_length=120)
    bank_code = serializers.CharField(max_length=40, required=False, allow_blank=True)
    account_holder_name = serializers.CharField(max_length=200)
    # FULL values accepted but MASKED server-side and never stored (PII). Write-only.
    account_number = serializers.CharField(max_length=40, write_only=True)
    iban = serializers.CharField(max_length=40, required=False, allow_blank=True, write_only=True)
    currency = serializers.CharField(max_length=8, required=False, default="USD")
    is_primary = serializers.BooleanField(required=False, default=False)


class FamilyTransferScheduleCreateSerializer(serializers.Serializer):
    family_account_id = serializers.UUIDField()
    bank_account_id = serializers.UUIDField()
    schedule_type = serializers.ChoiceField(
        choices=["immediate", "weekly", "monthly", "quarterly", "threshold"]
    )
    threshold_amount = serializers.DecimalField(
        max_digits=16, decimal_places=2, required=False, allow_null=True
    )


class FamilyTransactionCreateSerializer(serializers.Serializer):
    """Record-ONLY transfer intent. Creates a `pending` FamilyTransaction — NO money moves."""

    family_account_id = serializers.UUIDField()
    bank_account_id = serializers.UUIDField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=16, decimal_places=2)
    transfer_type = serializers.ChoiceField(
        choices=["returns", "tokens", "balance"], required=False, default="returns"
    )
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)


class FamilyAccrualWithdrawSerializer(serializers.Serializer):
    """
    Wave B — the owner withdraws a member's accrued cash. `amount` omitted → the full accrued
    balance; the actual ≤-balance check is enforced server-side in withdraw_family_accrual.
    """

    amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, required=False, allow_null=True
    )
    method = serializers.ChoiceField(choices=["bank", "crypto"], required=False, default="bank")
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)
