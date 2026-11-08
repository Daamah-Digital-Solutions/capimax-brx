"""Installments routes — mounted at /api/installments/ (see config/urls.py). Wave A + C."""
from django.urls import path

from .views import (
    InstallmentPlansView,
    InstallmentPreviewPdfView,
    InstallmentPreviewView,
    PayNextInstallmentView,
    PayoffInstallmentView,
    PlanPartPreviewView,
)

app_name = "installments"

urlpatterns = [
    # Public live plan preview (pure engine math; writes nothing) — the single source of
    # truth for every installment calculator on the property page.
    path("preview/", InstallmentPreviewView.as_view(), name="installment-preview"),
    # The same preview as a branded PDF (download at payment).
    path("preview/pdf/", InstallmentPreviewPdfView.as_view(), name="installment-preview-pdf"),
    # Self-scoped: the caller's own installment plans + schedules (read).
    path("plans/", InstallmentPlansView.as_view(), name="installment-plans"),
    # Wave C: gated charge for the next due installment (Stripe/NOW) → progressive release.
    path(
        "plans/<uuid:plan_id>/pay-next/",
        PayNextInstallmentView.as_view(),
        name="installment-pay-next",
    ),
    # Selling / transferring part of a plan: both plans and the money, before doing it.
    path("plans/<uuid:plan_id>/part/", PlanPartPreviewView.as_view(), name="installment-plan-part"),
    # Early payoff: one gated charge for ALL remaining installments → full unlock + complete.
    path(
        "plans/<uuid:plan_id>/pay-off/",
        PayoffInstallmentView.as_view(),
        name="installment-pay-off",
    ),
]
