"""Payment routes — mounted at /api/payments/ (see config/urls.py). Phase 5 Wave 1."""
from django.urls import path

from .views import (
    CreateDepositNowPaymentsView,
    CreateDepositStripeIntentView,
    CreateNowPaymentsView,
    CreateStripeIntentView,
    NowPaymentsIpnView,
    StripeConfigView,
    StripeWebhookView,
)

app_name = "payments"

urlpatterns = [
    # Wave 1 — Stripe (card).
    path("stripe/config/", StripeConfigView.as_view(), name="stripe-config"),
    path("stripe/create-intent/", CreateStripeIntentView.as_view(), name="stripe-create-intent"),
    # PUBLIC, signature-verified provider callback (the automation hinge).
    path("stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    # Wave 2 — NOW Payments (crypto).
    path("nowpayments/create/", CreateNowPaymentsView.as_view(), name="nowpayments-create"),
    # PUBLIC, signature-verified IPN callback (the automation hinge).
    path("nowpayments/ipn/", NowPaymentsIpnView.as_view(), name="nowpayments-ipn"),
    # Deposit / top-up — reuses the gated Stripe/NOW path; credits balance (no mint).
    path("deposit/stripe/", CreateDepositStripeIntentView.as_view(), name="deposit-stripe"),
    path("deposit/nowpayments/", CreateDepositNowPaymentsView.as_view(), name="deposit-nowpayments"),
]
