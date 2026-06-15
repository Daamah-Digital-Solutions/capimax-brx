"""Investment routes — mounted at /api/investments/ (see config/urls.py)."""
from django.urls import path

from .views import (
    InvestmentCreateView,
    InvestmentDetailView,
    InvestmentMintView,
)

app_name = "investments"

urlpatterns = [
    path("", InvestmentCreateView.as_view(), name="investment-create"),
    path("<uuid:pk>/", InvestmentDetailView.as_view(), name="investment-detail"),
    path("<uuid:pk>/mint/", InvestmentMintView.as_view(), name="investment-mint"),
]
