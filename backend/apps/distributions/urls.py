"""Distribution routes — mounted at /api/distributions/ (see config/urls.py). Phase 9."""
from django.urls import path

from .views import DistributionsView

app_name = "distributions"

urlpatterns = [
    # Investor read surface — the caller's own payouts (history + rollup + stats).
    path("", DistributionsView.as_view(), name="distributions"),
]
