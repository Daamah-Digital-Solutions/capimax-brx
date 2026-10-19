from django.contrib import admin, messages

from . import services
from .models import Beneficiary, EstateCertificate, EstateClaim, UnitTransfer


@admin.register(UnitTransfer)
class UnitTransferAdmin(admin.ModelAdmin):
    """Read-only: a transfer moves only through the actions (which keep the holds right)."""

    list_display = ("reference", "kind", "asset", "sender", "recipient_email", "property_name",
                    "units", "amount", "status", "deliver_on", "created_at")
    list_filter = ("kind", "asset", "status")
    search_fields = ("reference", "sender__email", "recipient_email")
    actions = ("action_deliver", "action_cancel")

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Deliver now (if due and the recipient is verified)")
    def action_deliver(self, request, queryset):
        for t in queryset:
            self.message_user(request, f"{t.reference}: {services.deliver_safely(t.pk)}")

    @admin.action(description="Cancel and return to the sender")
    def action_cancel(self, request, queryset):
        n = 0
        for t in queryset.filter(status__in=UnitTransfer.OPEN).exclude(kind=UnitTransfer.Kind.ESTATE):
            services._close(t, UnitTransfer.Status.CANCELLED, "Cancelled by the platform.")
            n += 1
        self.message_user(request, f"{n} transfer(s) cancelled and returned.")


class BeneficiaryInline(admin.TabularInline):
    model = Beneficiary
    fk_name = "holder"
    extra = 0
    can_delete = False
    readonly_fields = ("full_name", "email", "relationship", "percent")


@admin.register(EstateCertificate)
class EstateCertificateAdmin(admin.ModelAdmin):
    list_display = ("number", "holder", "issued_at", "updated_at")
    search_fields = ("number", "holder__email")
    readonly_fields = ("number", "holder", "issued_at", "updated_at")


@admin.register(EstateClaim)
class EstateClaimAdmin(admin.ModelAdmin):
    """
    Check the death certificate, then approve: the holder's free units and wallet are split
    among their beneficiaries (each receives it once verified) and the holder's account is
    closed. Units locked in installment plans or listings are not distributed (noted).
    Write the reason in "Decision note" before rejecting.
    """

    list_display = ("certificate_number", "holder", "claimant", "status", "created_at", "decided_at")
    list_filter = ("status",)
    search_fields = ("certificate_number", "holder__email", "claimant__email")
    readonly_fields = ("id", "holder", "claimant", "certificate_number", "death_certificate",
                       "date_of_death", "notes", "status", "decided_by", "decided_at", "created_at")
    actions = ("action_approve", "action_reject")

    def has_add_permission(self, request):
        return False

    def holder_beneficiaries(self, obj):
        return ", ".join(f"{b.full_name} ({b.percent}%)" for b in obj.holder.beneficiaries.all())

    def get_readonly_fields(self, request, obj=None):
        return self.readonly_fields + ("holder_beneficiaries",)

    @admin.action(description="APPROVE — distribute the estate to the beneficiaries")
    def action_approve(self, request, queryset):
        from rest_framework.exceptions import ValidationError

        for claim in queryset:
            try:
                services.approve_claim(claim.pk, request.user)
                self.message_user(request, f"{claim.certificate_number}: approved and distributed.",
                                  level=messages.SUCCESS)
            except ValidationError as exc:
                self.message_user(request, f"{claim.certificate_number}: {exc.detail}", level=messages.WARNING)

    @admin.action(description="Reject (uses the decision note as the reason)")
    def action_reject(self, request, queryset):
        from rest_framework.exceptions import ValidationError

        for claim in queryset:
            try:
                services.reject_claim(claim.pk, request.user, claim.decision_note)
                self.message_user(request, f"{claim.certificate_number}: rejected.")
            except ValidationError as exc:
                self.message_user(request, f"{claim.certificate_number}: {exc.detail}", level=messages.WARNING)
