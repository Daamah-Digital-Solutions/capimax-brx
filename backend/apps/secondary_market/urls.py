"""Peer secondary-market routes — mounted at /api/secondary-market/. Phase 6 Wave 3."""
from django.urls import path

from .views import (
    SecondaryMarketCancelView,
    SecondaryMarketPurchaseView,
    SecondaryMarketTradesView,
    SecondaryMarketView,
)

app_name = "secondary_market"

urlpatterns = [
    path("", SecondaryMarketView.as_view(), name="secondary-market"),
    path("trades/", SecondaryMarketTradesView.as_view(), name="secondary-market-trades"),
    path("<uuid:listing_id>/cancel/", SecondaryMarketCancelView.as_view(), name="secondary-market-cancel"),
    path("<uuid:listing_id>/purchase/", SecondaryMarketPurchaseView.as_view(), name="secondary-market-purchase"),
]
