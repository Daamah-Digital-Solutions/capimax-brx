"""Certificate routes — mounted at /api/certificates/ (see config/urls.py)."""
from django.urls import path

from .views import (
    CertificateGenerateView,
    CertificateListView,
    CertificatePdfView,
    CertificateVerifyView,
)

app_name = "certificates"

urlpatterns = [
    path("", CertificateListView.as_view(), name="certificate-list"),
    path("generate/", CertificateGenerateView.as_view(), name="certificate-generate"),
    # PUBLIC verification (curated projection). Literal prefix → no clash with <uuid>.
    path("verify/<str:code>/", CertificateVerifyView.as_view(), name="certificate-verify"),
    path("<uuid:pk>/pdf/", CertificatePdfView.as_view(), name="certificate-pdf"),
]
