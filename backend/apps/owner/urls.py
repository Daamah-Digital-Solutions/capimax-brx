"""Owner routes — mounted at /api/owner/ (see config/urls.py). Phase 7 Wave A + B."""
from django.urls import path

from .views import (
    OwnerDistributionsView,
    OwnerEarningsView,
    OwnerInvestorsView,
    OwnerKYBAccessTokenView,
    OwnerKYBSubmitView,
    OwnerProfileView,
    SubmissionDetailView,
    SubmissionDocumentDetailView,
    SubmissionDocumentDownloadView,
    SubmissionDocumentsView,
    SubmissionSubmitView,
    SubmissionsView,
)

app_name = "owner"

urlpatterns = [
    # Owner entity verification (Wave A).
    path("profile/", OwnerProfileView.as_view(), name="owner-profile"),
    path("kyb/submit/", OwnerKYBSubmitView.as_view(), name="owner-kyb-submit"),
    path("kyb/access-token/", OwnerKYBAccessTokenView.as_view(), name="owner-kyb-access-token"),
    # Owner analytics (Wave D + OwnerReports realness) — all period-aware, owner-scoped.
    path("earnings/", OwnerEarningsView.as_view(), name="owner-earnings"),
    path("distributions/", OwnerDistributionsView.as_view(), name="owner-distributions"),
    path("investors/", OwnerInvestorsView.as_view(), name="owner-investors"),
    # Property submission intake (Wave B) — gated to approved owners.
    path("submissions/", SubmissionsView.as_view(), name="owner-submissions"),
    path("submissions/<uuid:submission_id>/", SubmissionDetailView.as_view(), name="owner-submission-detail"),
    path("submissions/<uuid:submission_id>/submit/", SubmissionSubmitView.as_view(), name="owner-submission-submit"),
    path(
        "submissions/<uuid:submission_id>/documents/",
        SubmissionDocumentsView.as_view(),
        name="owner-submission-documents",
    ),
    path(
        "submissions/<uuid:submission_id>/documents/<uuid:doc_id>/",
        SubmissionDocumentDetailView.as_view(),
        name="owner-submission-document-detail",
    ),
    path(
        "submissions/<uuid:submission_id>/documents/<uuid:doc_id>/download/",
        SubmissionDocumentDownloadView.as_view(),
        name="owner-submission-document-download",
    ),
]
