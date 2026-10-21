"""Broker-scoped routes — mounted at /api/broker/ (see config/urls.py). Phase 12 Wave A."""
from django.urls import path

from . import leads
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
    # Referrals made by hand: invite a client / bring a property with the owner's authorization.
    path("leads/", leads.LeadsView.as_view(), name="broker-leads"),
    path("leads/clients/", leads.ClientLeadView.as_view(), name="broker-lead-client"),
    path("leads/properties/", leads.PropertyLeadView.as_view(), name="broker-lead-property"),
    path("leads/<uuid:pk>/authorization/upload/", leads.AuthorizationUploadView.as_view(), name="broker-lead-auth-upload"),
    path("leads/<uuid:pk>/authorization/request/", leads.AuthorizationRequestView.as_view(), name="broker-lead-auth-request"),
    path("leads/<uuid:pk>/cancel/", leads.LeadCancelView.as_view(), name="broker-lead-cancel"),
    path("leads/<uuid:pk>/documents/<uuid:doc_id>/download/", leads.LeadDocumentDownloadView.as_view(),
         name="broker-lead-doc"),
    # PUBLIC: the owner reviews and confirms a property referral from the emailed link.
    path("authorize/<str:token>/", leads.OwnerAuthorizationView.as_view(), name="broker-owner-authorize"),
]
