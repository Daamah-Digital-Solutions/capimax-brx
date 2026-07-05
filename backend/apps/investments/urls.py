"""Investment routes — mounted at /api/investments/ (see config/urls.py)."""
from django.urls import path

from .views import (
    InvestmentCreateView,
    InvestmentDetailView,
    InvestmentMintView,
    ReinvestmentHistoryView,
    SukukInvestmentsView,
)

app_name = "investments"

urlpatterns = [
    path("", InvestmentCreateView.as_view(), name="investment-create"),
    # Literal segments BEFORE <uuid:pk> so they aren't captured as a pk.
    # Reinvestment history (balance-funded buys) — self-scoped.
    path("reinvestments/", ReinvestmentHistoryView.as_view(), name="reinvestment-history"),
    # Nova certificate (sukuk) investments awaiting review / rejected — self-scoped.
    path("sukuk/", SukukInvestmentsView.as_view(), name="sukuk-investments"),
    path("<uuid:pk>/", InvestmentDetailView.as_view(), name="investment-detail"),
    path("<uuid:pk>/mint/", InvestmentMintView.as_view(), name="investment-mint"),
]
