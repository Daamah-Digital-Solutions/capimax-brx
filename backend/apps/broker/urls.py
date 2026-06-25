"""Broker-scoped routes — mounted at /api/broker/ (see config/urls.py). Phase 12 Wave A."""
from django.urls import path

from .views import (
    BrokerCommissionsView,
    BrokerLicenseSubmitView,
    BrokerLicenseUploadView,
    BrokerProfileView,
    BrokerPropertyStatsView,
    ReferralResolveView,
)

app_name = "broker"

urlpatterns = [
    # Broker onboarding (apply → submit/upload licence → see referral code once approved).
    path("profile/", BrokerProfileView.as_view(), name="broker-profile"),
    path("license/submit/", BrokerLicenseSubmitView.as_view(), name="broker-license-submit"),
    path("license/upload/", BrokerLicenseUploadView.as_view(), name="broker-license-upload"),
    # PUBLIC: referral-code validation at signup (AllowAny).
    path("referral/resolve/", ReferralResolveView.as_view(), name="broker-referral-resolve"),
    # Commission ledger + totals + referred-investor roster (Wave B). Approved-broker only.
    path("commissions/", BrokerCommissionsView.as_view(), name="broker-commissions"),
    # Per-property broker stats overlay for Broker Listings (broker-scoped). Approved-only.
    path("property-stats/", BrokerPropertyStatsView.as_view(), name="broker-property-stats"),
]
