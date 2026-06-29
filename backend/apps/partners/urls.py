"""Partner-scoped routes — mounted at /api/partner/ (see config/urls.py). Phase 11 Wave A."""
from django.urls import path

from .views import (
    AssignmentSubmitView,
    DeliverableDocumentDownloadView,
    DeliverableUploadView,
    PartnerAssignmentDetailView,
    PartnerAssignmentsView,
    PartnerKYBAccessTokenView,
    PartnerKYBDocumentDownloadView,
    PartnerKYBDocumentsView,
    PartnerKYBSubmitView,
    PartnerProfileView,
)

app_name = "partner"

urlpatterns = [
    # Partner entity verification + directory-details entry (Wave A).
    path("profile/", PartnerProfileView.as_view(), name="partner-profile"),
    path("kyb/submit/", PartnerKYBSubmitView.as_view(), name="partner-kyb-submit"),
    path("kyb/access-token/", PartnerKYBAccessTokenView.as_view(), name="partner-kyb-access-token"),
    path("kyb/documents/", PartnerKYBDocumentsView.as_view(), name="partner-kyb-documents"),
    path("kyb/documents/<uuid:doc_id>/download/",
         PartnerKYBDocumentDownloadView.as_view(), name="partner-kyb-document-download"),
    # Assignment / deliverable work portal (Wave B) — self-scoped to the caller-partner.
    path("assignments/", PartnerAssignmentsView.as_view(), name="partner-assignments"),
    path("assignments/<uuid:assignment_id>/", PartnerAssignmentDetailView.as_view(),
         name="partner-assignment-detail"),
    path("assignments/<uuid:assignment_id>/submit/", AssignmentSubmitView.as_view(),
         name="partner-assignment-submit"),
    path("deliverables/<uuid:deliverable_id>/upload/", DeliverableUploadView.as_view(),
         name="partner-deliverable-upload"),
    path("deliverables/documents/<uuid:document_id>/download/",
         DeliverableDocumentDownloadView.as_view(), name="partner-deliverable-download"),
]
