"""Installments routes — mounted at /api/installments/ (see config/urls.py). Wave A + C."""
from django.urls import path

from .views import (
    InstallmentPlansView,
    PayNextInstallmentView,
    PayoffInstallmentView,
)

app_name = "installments"

urlpatterns = [
    # Self-scoped: the caller's own installment plans + schedules (read).
    path("plans/", InstallmentPlansView.as_view(), name="installment-plans"),
    # Wave C: gated charge for the next due installment (Stripe/NOW) → progressive release.
    path(
        "plans/<uuid:plan_id>/pay-next/",
        PayNextInstallmentView.as_view(),
        name="installment-pay-next",
    ),
    # Early payoff: one gated charge for ALL remaining installments → full unlock + complete.
    path(
        "plans/<uuid:plan_id>/pay-off/",
        PayoffInstallmentView.as_view(),
        name="installment-pay-off",
    ),
]
