"""
Installments admin — Wave A. READ-ONLY review of investor plans + schedules.

Plans are built by the service (`build_installment_plan`), never by hand — so adds are
disabled and the money/schedule fields are read-only. No charge/mint action exists in this
wave (those are later waves).
"""
from django.contrib import admin

from .models import InstallmentPayment, InstallmentPlan


class InstallmentPaymentInline(admin.TabularInline):
    model = InstallmentPayment
    extra = 0
    can_delete = False
    fields = ("sequence", "due_date", "amount", "status", "paid_at")
    readonly_fields = ("sequence", "due_date", "amount", "status", "paid_at")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(InstallmentPlan)
class InstallmentPlanAdmin(admin.ModelAdmin):
    list_display = (
        "id", "investor", "property", "status",
        "total_amount", "down_payment_amount", "down_payment_percent",
        "number_of_installments", "installment_amount", "frequency", "created_at",
    )
    list_filter = ("status", "frequency")
    search_fields = ("investor__email", "property__slug", "property_name")
    readonly_fields = (
        "id", "investor", "property", "property_name",
        "total_amount", "down_payment_amount", "down_payment_percent",
        "number_of_installments", "installment_amount", "frequency", "duration_months",
        "status", "created_at", "updated_at",
    )
    inlines = [InstallmentPaymentInline]

    def has_add_permission(self, request):
        # Plans are created by the service / a later Checkout wave, never by hand.
        return False
