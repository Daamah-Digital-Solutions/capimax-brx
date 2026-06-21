"""Installments routes — mounted at /api/installments/ (see config/urls.py). Wave A."""
from django.urls import path

from .views import InstallmentPlansView

app_name = "installments"

urlpatterns = [
    # Self-scoped: the caller's own installment plans + schedules (read-only this wave).
    path("plans/", InstallmentPlansView.as_view(), name="installment-plans"),
]
