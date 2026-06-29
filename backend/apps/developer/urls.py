"""Developer routes — mounted at /api/developer/ (see config/urls.py). Phase 8 Wave A."""
from django.urls import path

from .views import (
    DeveloperKYBAccessTokenView,
    DeveloperKYBDocumentDownloadView,
    DeveloperKYBDocumentsView,
    DeveloperKYBSubmitView,
    DeveloperProfileView,
)

app_name = "developer"

urlpatterns = [
    # Developer entity verification (Wave A).
    path("profile/", DeveloperProfileView.as_view(), name="developer-profile"),
    path("kyb/submit/", DeveloperKYBSubmitView.as_view(), name="developer-kyb-submit"),
    path("kyb/access-token/", DeveloperKYBAccessTokenView.as_view(), name="developer-kyb-access-token"),
    path("kyb/documents/", DeveloperKYBDocumentsView.as_view(), name="developer-kyb-documents"),
    path(
        "kyb/documents/<uuid:doc_id>/download/",
        DeveloperKYBDocumentDownloadView.as_view(),
        name="developer-kyb-document-download",
    ),
]
