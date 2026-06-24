"""Family routes — mounted at /api/family/ (see config/urls.py). Wave A."""
from django.urls import path

from .views import (
    FamilyAccountDetailView,
    FamilyAccountsView,
    FamilyAccrualView,
    FamilyAccrualWithdrawView,
    FamilyBankAccountsView,
    FamilyTransactionsView,
    FamilyTransferSchedulesView,
)

app_name = "family"

urlpatterns = [
    path("accounts/", FamilyAccountsView.as_view(), name="family-accounts"),
    path("accounts/<uuid:account_id>/", FamilyAccountDetailView.as_view(), name="family-account-detail"),
    # Wave B — the member's internal accrual ledger + the owner-driven withdrawal.
    path("accounts/<uuid:account_id>/accruals/", FamilyAccrualView.as_view(), name="family-accruals"),
    path("accounts/<uuid:account_id>/withdraw/", FamilyAccrualWithdrawView.as_view(), name="family-accrual-withdraw"),
    path("banks/", FamilyBankAccountsView.as_view(), name="family-banks"),
    path("schedules/", FamilyTransferSchedulesView.as_view(), name="family-schedules"),
    path("transactions/", FamilyTransactionsView.as_view(), name="family-transactions"),
]
