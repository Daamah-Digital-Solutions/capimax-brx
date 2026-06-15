"""Wallet routes — mounted at /api/wallets/ (see config/urls.py)."""
from django.urls import path

from .views import (
    MyWalletView,
    UserBalanceView,
    WalletCreateView,
    WalletTokensView,
    WalletTransactionsView,
    WithdrawalsView,
)

app_name = "wallets"

urlpatterns = [
    path("", WalletCreateView.as_view(), name="wallet-create"),
    path("me/", MyWalletView.as_view(), name="wallet-me"),
    # Internal balance + investor withdrawal (Phase 6 Wave 3).
    path("balance/", UserBalanceView.as_view(), name="wallet-balance"),
    path("withdrawals/", WithdrawalsView.as_view(), name="wallet-withdrawals"),
    path("<uuid:wallet_id>/tokens/", WalletTokensView.as_view(), name="wallet-tokens"),
    path(
        "<uuid:wallet_id>/transactions/",
        WalletTransactionsView.as_view(),
        name="wallet-transactions",
    ),
]
