"""Reports-export routes — mounted at /api/reports/ (see config/urls.py). Phase 13."""
from django.urls import path

from .views import DistributionsTaxView, ReportExportView

app_name = "reports"

urlpatterns = [
    # Informational annual distribution-income summary (PDF). NOT a tax document.
    path("distributions/tax/", DistributionsTaxView.as_view(), name="distributions-tax"),
    # Generic self-scoped export: ?format=csv|pdf[&year=YYYY][&period=...].
    path("<str:context>/export/", ReportExportView.as_view(), name="export"),
]
