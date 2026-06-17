"""Partner-scoped routes — mounted at /api/partner/ (see config/urls.py). Phase 11 Wave A."""
from django.urls import path

from .views import (
    PartnerKYBAccessTokenView,
    PartnerKYBSubmitView,
    PartnerProfileView,
)

app_name = "partner"

urlpatterns = [
    # Partner entity verification + directory-details entry (Wave A).
    path("profile/", PartnerProfileView.as_view(), name="partner-profile"),
    path("kyb/submit/", PartnerKYBSubmitView.as_view(), name="partner-kyb-submit"),
    path("kyb/access-token/", PartnerKYBAccessTokenView.as_view(), name="partner-kyb-access-token"),
]
