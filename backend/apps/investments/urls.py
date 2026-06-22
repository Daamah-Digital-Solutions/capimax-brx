"""Investment routes — mounted at /api/investments/ (see config/urls.py)."""
from django.urls import path

from .views import (
    InvestmentCreateView,
    InvestmentDetailView,
    InvestmentMintView,
    ReinvestmentHistoryView,
)

app_name = "investments"

urlpatterns = [
    path("", InvestmentCreateView.as_view(), name="investment-create"),
    # Reinvestment history (balance-funded buys) — self-scoped. Before <uuid:pk> so the
    # literal segment isn't captured as a pk.
    path("reinvestments/", ReinvestmentHistoryView.as_view(), name="reinvestment-history"),
    path("<uuid:pk>/", InvestmentDetailView.as_view(), name="investment-detail"),
    path("<uuid:pk>/mint/", InvestmentMintView.as_view(), name="investment-mint"),
]
