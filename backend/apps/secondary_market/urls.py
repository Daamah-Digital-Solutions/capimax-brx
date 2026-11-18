"""Peer secondary-market routes — mounted at /api/secondary-market/. Phase 6 Wave 3."""
from django.urls import path

from .views import (
    SecondaryMarketFeePreviewView,
    SecondaryMarketCancelView,
    SecondaryMarketPlanPartQuoteView,
    SecondaryMarketPositionView,
    SecondaryMarketPurchaseView,
    SecondaryMarketTradesView,
    SecondaryMarketView,
)

app_name = "secondary_market"

urlpatterns = [
    path("", SecondaryMarketView.as_view(), name="secondary-market"),
    path("fee-preview/", SecondaryMarketFeePreviewView.as_view(), name="secondary-market-fee-preview"),
    path("positions/", SecondaryMarketPositionView.as_view(), name="secondary-market-positions"),
    path("trades/", SecondaryMarketTradesView.as_view(), name="secondary-market-trades"),
    path("<uuid:listing_id>/cancel/", SecondaryMarketCancelView.as_view(), name="secondary-market-cancel"),
    path("<uuid:listing_id>/plan-part/", SecondaryMarketPlanPartQuoteView.as_view(), name="secondary-market-plan-part"),
    path("<uuid:listing_id>/purchase/", SecondaryMarketPurchaseView.as_view(), name="secondary-market-purchase"),
]
