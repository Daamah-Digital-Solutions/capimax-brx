"""
Wallet API — Phase 3 Wave 1.

  POST /api/wallets/      Create the caller's custodial wallet. KYC-GATED.
  GET  /api/wallets/me/   Return the caller's wallet (404 if none).

KYC gate: wallet creation requires an approved KYC record via
`core.permissions.KYCApprovedPermission`. That permission is currently an
always-deny stub (the KYC domain ships in a later phase), so this endpoint is
fully built and correct but returns 403 "KYC approval is required" today —
matching the frontend's create-wallet expectation (SPEC §4.1). When the KYC phase
flips the gate, this endpoint works unchanged.

No endpoint ever exposes private key material.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.shortcuts import get_object_or_404

from apps.core.permissions import KYCApprovedPermission

from .models import (
    BalanceTransaction,
    OwnershipToken,
    UserBalance,
    UserWallet,
    WalletTransaction,
    Withdrawal,
)
from .serializers import (
    BalanceTransactionSerializer,
    OwnershipTokenSerializer,
    UserBalanceSerializer,
    UserWalletSerializer,
    WalletTransactionSerializer,
    WithdrawalCreateSerializer,
    WithdrawalSerializer,
)
from .services import (
    InsufficientBalance,
    get_or_create_custodial_wallet,
    request_withdrawal,
)


class WalletCreateView(APIView):
    """Create (or return the existing) custodial wallet for the caller. KYC-gated."""

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        wallet, created = get_or_create_custodial_wallet(request.user)
        serializer = UserWalletSerializer(wallet)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MyWalletView(APIView):
    """Return the caller's wallet. Reading your own wallet only needs auth."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = UserWallet.objects.filter(user=request.user).first()
        if wallet is None:
            return Response(
                {"detail": "No wallet found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UserWalletSerializer(wallet).data)


class WalletTokensView(APIView):
    """
    GET /api/wallets/{wallet_id}/tokens/ — the wallet's OwnershipToken positions.
    Owner-only: the wallet must belong to the caller (SPEC §2.2 / §5.2).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, wallet_id):
        wallet = get_object_or_404(UserWallet, pk=wallet_id, user=request.user)
        tokens = OwnershipToken.objects.filter(wallet=wallet)
        return Response(OwnershipTokenSerializer(tokens, many=True).data)


class WalletTransactionsView(APIView):
    """
    GET /api/wallets/{wallet_id}/transactions/ — the wallet's on-chain transactions
    (most recent first, capped). Owner-only. Backs the frontend's "Recent
    Transactions" card with REAL mint receipts instead of the old Supabase table.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, wallet_id):
        wallet = get_object_or_404(UserWallet, pk=wallet_id, user=request.user)
        txs = WalletTransaction.objects.filter(wallet=wallet)[:50]
        return Response(WalletTransactionSerializer(txs, many=True).data)


class UserBalanceView(APIView):
    """
    GET /api/wallets/balance/ — the caller's internal USD balance (sale proceeds,
    withdrawable). Phase 6 Wave 3. Defaults to 0 when none exists yet.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        balance = UserBalance.objects.filter(user=request.user).first()
        data = {
            "current_balance": float(balance.current_balance) if balance else 0.0,
            "currency": balance.currency if balance else "USD",
        }
        return Response(UserBalanceSerializer(data).data)


class BalanceTransactionsView(APIView):
    """
    GET /api/wallets/balance/transactions/ — the caller's internal-balance ledger
    history (most recent first, capped). Self-scoped: a user only ever sees their OWN
    entries. READ-ONLY — this surfaces the already-recorded credits/debits (distribution
    credits, secondary-sale proceeds, broker commission, withdrawals, …); it never moves
    money. Phase 12 finishing — backs the investor wallet's real transaction history.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        txs = BalanceTransaction.objects.filter(
            balance__user=request.user
        ).select_related("balance")[:100]
        return Response(BalanceTransactionSerializer(txs, many=True).data)


class WithdrawalsView(APIView):
    """
    GET  /api/wallets/withdrawals/ — the caller's withdrawal history.
    POST /api/wallets/withdrawals/ — request a withdrawal (debits the internal
    balance + records a pending request). Mirrors the LP withdrawal. Owner-scoped.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = Withdrawal.objects.filter(user=request.user)
        return Response(WithdrawalSerializer(items, many=True).data)

    def post(self, request):
        serializer = WithdrawalCreateSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        try:
            withdrawal = request_withdrawal(
                request.user,
                serializer.validated_data["amount"],
                method=serializer.validated_data["method"],
                notes=serializer.validated_data.get("notes") or "",
            )
        except InsufficientBalance:
            return Response(
                {"detail": "Insufficient balance.", "code": "insufficient_balance"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            WithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED
        )
