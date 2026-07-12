"""Wallet routes — mounted at /api/wallets/ (see config/urls.py)."""
from django.urls import path

from .payment_methods import (
    BankAccountDetailView,
    BankAccountListCreateView,
    BankAccountSetDefaultView,
    CryptoWalletDetailView,
    CryptoWalletListCreateView,
    CryptoWalletSetDefaultView,
    PaymentMethodAuditLogView,
    SavedCardDetailView,
    SavedCardListCreateView,
    SavedCardSetDefaultView,
)
from .views import (
    BalanceTransactionsView,
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
    # Read-only internal-balance ledger history (self-scoped). Phase 12 finishing.
    path("balance/transactions/", BalanceTransactionsView.as_view(), name="wallet-balance-transactions"),
    path("withdrawals/", WithdrawalsView.as_view(), name="wallet-withdrawals"),
    # Payout instruments (client note 11) — real Django-backed bank accounts, crypto
    # wallets, and saved cards; replaces the dead Supabase managers. Self-scoped.
    path("payment-methods/bank-accounts/", BankAccountListCreateView.as_view(), name="pm-bank-list"),
    path("payment-methods/bank-accounts/<uuid:pk>/", BankAccountDetailView.as_view(), name="pm-bank-detail"),
    path("payment-methods/bank-accounts/<uuid:pk>/set-default/", BankAccountSetDefaultView.as_view(), name="pm-bank-default"),
    path("payment-methods/crypto-wallets/", CryptoWalletListCreateView.as_view(), name="pm-crypto-list"),
    path("payment-methods/crypto-wallets/<uuid:pk>/", CryptoWalletDetailView.as_view(), name="pm-crypto-detail"),
    path("payment-methods/crypto-wallets/<uuid:pk>/set-default/", CryptoWalletSetDefaultView.as_view(), name="pm-crypto-default"),
    path("payment-methods/cards/", SavedCardListCreateView.as_view(), name="pm-card-list"),
    path("payment-methods/cards/<uuid:pk>/", SavedCardDetailView.as_view(), name="pm-card-detail"),
    path("payment-methods/cards/<uuid:pk>/set-default/", SavedCardSetDefaultView.as_view(), name="pm-card-default"),
    path("payment-methods/audit-log/", PaymentMethodAuditLogView.as_view(), name="pm-audit-log"),
    path("<uuid:wallet_id>/tokens/", WalletTokensView.as_view(), name="wallet-tokens"),
    path(
        "<uuid:wallet_id>/transactions/",
        WalletTransactionsView.as_view(),
        name="wallet-transactions",
    ),
]
