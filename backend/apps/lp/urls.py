"""LP routes — mounted at /api/lp/ (see config/urls.py). Phase 6 Wave 1, SPEC §2.7."""
from django.urls import path

from .views import (
    LPBankDetailsView,
    LPCryptoDetailsView,
    LPDocumentDetailView,
    LPDocumentDownloadView,
    LPDocumentsView,
    LPHoldingDetailView,
    LPHoldingsView,
    LPKYBAccessTokenView,
    LPKYBDocumentsView,
    LPKYBSubmitView,
    LPMarketCancelView,
    LPMarketPurchaseView,
    LPMarketView,
    LPProfileView,
    LPTransactionsView,
    LPWithdrawalView,
)

app_name = "lp"

urlpatterns = [
    path("profile/", LPProfileView.as_view(), name="lp-profile"),
    path("profile/bank-details/", LPBankDetailsView.as_view(), name="lp-bank-details"),
    path("profile/crypto-details/", LPCryptoDetailsView.as_view(), name="lp-crypto-details"),
    path("transactions/", LPTransactionsView.as_view(), name="lp-transactions"),
    path("withdrawals/", LPWithdrawalView.as_view(), name="lp-withdrawals"),
    path("documents/", LPDocumentsView.as_view(), name="lp-documents"),
    path("documents/<uuid:doc_id>/", LPDocumentDetailView.as_view(), name="lp-document-detail"),
    path(
        "documents/<uuid:doc_id>/download/",
        LPDocumentDownloadView.as_view(),
        name="lp-document-download",
    ),
    path("kyb/submit/", LPKYBSubmitView.as_view(), name="lp-kyb-submit"),
    path("kyb/documents/", LPKYBDocumentsView.as_view(), name="lp-kyb-documents"),
    path("kyb/access-token/", LPKYBAccessTokenView.as_view(), name="lp-kyb-access-token"),
    # LP secondary market (Phase 6 Wave 2).
    path("market/", LPMarketView.as_view(), name="lp-market"),
    path("market/<uuid:listing_id>/cancel/", LPMarketCancelView.as_view(), name="lp-market-cancel"),
    path("market/<uuid:listing_id>/purchase/", LPMarketPurchaseView.as_view(), name="lp-market-purchase"),
    path("holdings/", LPHoldingsView.as_view(), name="lp-holdings"),
    path("holdings/<uuid:holding_id>/", LPHoldingDetailView.as_view(), name="lp-holding-detail"),
]
