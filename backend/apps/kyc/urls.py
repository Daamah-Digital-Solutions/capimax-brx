"""KYC routes — mounted at /api/kyc/ (see config/urls.py). Phase 4."""
from django.urls import path

from .views import KYCAccessTokenView, KYCMeView, KYCSubmitView, SumsubWebhookView

app_name = "kyc"

urlpatterns = [
    path("me/", KYCMeView.as_view(), name="kyc-me"),
    path("submit/", KYCSubmitView.as_view(), name="kyc-submit"),
    path("access-token/", KYCAccessTokenView.as_view(), name="kyc-access-token"),
    # PUBLIC, signature-verified provider callback (the automation hinge).
    path("webhook/sumsub/", SumsubWebhookView.as_view(), name="kyc-webhook-sumsub"),
]
