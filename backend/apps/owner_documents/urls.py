"""Owner-documents routes — mounted at /api/owner-documents/ (see config/urls.py)."""
from django.urls import path

from .views import (
    OwnerDocumentDetailView,
    OwnerDocumentDownloadView,
    OwnerDocumentsView,
)

app_name = "owner_documents"

urlpatterns = [
    path("", OwnerDocumentsView.as_view(), name="owner-documents"),
    path("<uuid:doc_id>/", OwnerDocumentDetailView.as_view(), name="owner-document-detail"),
    path("<uuid:doc_id>/download/", OwnerDocumentDownloadView.as_view(), name="owner-document-download"),
]
