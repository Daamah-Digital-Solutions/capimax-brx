"""Public partner routes — mounted at /api/partners/ (see config/urls.py). Phase 11 Wave A.

Kept SEPARATE from the partner-scoped urls.py (mounted at /api/partner/) so the public,
AllowAny directory lives under the plural /api/partners/ path the frontend expects, while
the singular /api/partner/ stays auth-scoped to the caller's own profile.
"""
from django.urls import path

from .views import PublicPartnerDirectoryView

app_name = "partners_public"

urlpatterns = [
    path("directory/", PublicPartnerDirectoryView.as_view(), name="partners-directory"),
]
