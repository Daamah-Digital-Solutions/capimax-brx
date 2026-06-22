"""Family routes — mounted at /api/family/ (see config/urls.py). Wave A."""
from django.urls import path

from .views import (
    FamilyAccountDetailView,
    FamilyAccountsView,
    FamilyBankAccountsView,
    FamilyTransactionsView,
    FamilyTransferSchedulesView,
)

app_name = "family"

urlpatterns = [
    path("accounts/", FamilyAccountsView.as_view(), name="family-accounts"),
    path("accounts/<uuid:account_id>/", FamilyAccountDetailView.as_view(), name="family-account-detail"),
    path("banks/", FamilyBankAccountsView.as_view(), name="family-banks"),
    path("schedules/", FamilyTransferSchedulesView.as_view(), name="family-schedules"),
    path("transactions/", FamilyTransactionsView.as_view(), name="family-transactions"),
]
