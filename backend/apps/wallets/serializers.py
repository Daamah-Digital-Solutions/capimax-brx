"""
Wallet serializers — Phase 3 Wave 1.

Exposes ONLY public wallet fields. There is deliberately no field for, and no code
path to, the private key. The key material lives in a separate model with no
serializer at all (apps/wallets/models.py: WalletKeyMaterial).
"""
from decimal import Decimal

from rest_framework import serializers

from .models import (
    BalanceTransaction,
    OwnershipToken,
    UserWallet,
    WalletTransaction,
    Withdrawal,
)


class OwnershipTokenSerializer(serializers.ModelSerializer):
    """
    Matches the frontend `OwnershipToken` shape (src/hooks/useOwnershipTokens.ts).
    Read-only — positions are mutated only by the mint service.
    """

    wallet_id = serializers.UUIDField(read_only=True)
    # Escrow/installment lock: shares not freely tradable (LP/secondary escrow OR an
    # installment's unpaid, still-locked portion). `available_amount` = token_amount −
    # locked_amount. Lets holdings honestly show "X of Y released" without a separate call.
    available_amount = serializers.IntegerField(read_only=True)

    class Meta:
        model = OwnershipToken
        fields = (
            "id",
            "wallet_id",
            "property_id",
            "property_name",
            "token_symbol",
            "token_amount",
            "locked_amount",
            "available_amount",
            "token_value_usd",
            "ownership_percentage",
            "acquisition_date",
            "last_distribution_date",
            "total_distributions",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class WalletTransactionSerializer(serializers.ModelSerializer):
    """
    Matches the frontend `WalletTransaction` shape (src/hooks/useUserWallet.ts):
    id, tx_hash, tx_type, amount, token_symbol, status, block_number, created_at.
    Read-only — written only by the mint/transfer services after a confirmed
    on-chain receipt (tx_hash/block_number are always REAL chain values).
    """

    class Meta:
        model = WalletTransaction
        fields = (
            "id",
            "tx_hash",
            "tx_type",
            "amount",
            "token_symbol",
            "status",
            "block_number",
            "created_at",
        )
        read_only_fields = fields


class UserWalletSerializer(serializers.ModelSerializer):
    """
    Matches the frontend `Wallet` shape (src/hooks/useUserWallet.ts):
    id, wallet_address, network, wallet_type, created_at. All read-only —
    wallets are created by the generation service, never by client-supplied data.
    """

    class Meta:
        model = UserWallet
        fields = ("id", "wallet_address", "network", "wallet_type", "created_at")
        read_only_fields = fields


# --------------------------------------------------------------------------- #
# Internal balance + investor withdrawal (Phase 6 Wave 3). Money as JSON numbers.
# --------------------------------------------------------------------------- #
class UserBalanceSerializer(serializers.Serializer):
    """The caller's internal proceeds balance (sale proceeds, withdrawable)."""

    current_balance = serializers.FloatField()
    currency = serializers.CharField()


class WithdrawalSerializer(serializers.ModelSerializer):
    amount = serializers.FloatField(read_only=True)

    class Meta:
        model = Withdrawal
        fields = (
            "id", "amount", "currency", "method", "status", "reference",
            "notes", "processed_at", "created_at",
        )
        read_only_fields = fields


class WithdrawalCreateSerializer(serializers.Serializer):
    """Request a withdrawal of internal balance (mirrors the LP withdrawal form)."""

    amount = serializers.DecimalField(
        max_digits=18, decimal_places=2, min_value=Decimal("0.01")
    )
    method = serializers.ChoiceField(choices=["bank", "crypto"])
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)


class BalanceTransactionSerializer(serializers.ModelSerializer):
    """
    Read-only view of an internal-balance ledger entry (Phase 6 Wave 2). Backs the
    investor/owner wallet's REAL transaction history — `entry_type` (credit|debit) gives
    the sign, `source` identifies the money movement (distribution / secondary_sale /
    broker_commission / primary_sale / withdrawal / …) which the frontend localizes by
    key (no stored display strings). Never written via the API.
    """

    amount = serializers.FloatField(read_only=True)

    class Meta:
        model = BalanceTransaction
        fields = ("id", "entry_type", "amount", "source", "reference", "memo", "created_at")
        read_only_fields = fields
