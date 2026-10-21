"""
Broker admin — Phase 12 Wave A.

The licence-approval action is the SANCTIONED ADMIN HINGE (not an exception handler): a
human reviews the uploaded professional licence and approves it — but ONLY once the
broker's identity KYC is already approved (services.approve_license enforces this and
raises otherwise). Approval activates the broker role. This mirrors the owner-publish /
partner directory-approval pattern, layered on personal KYC instead of business KYB.

A `kyc_approved` column surfaces the identity state so the admin only approves the licence
on a KYC-verified broker. Broker profiles are created via the apply API, never by hand.
"""
from django import forms
from django.contrib import admin, messages
from django.template.response import TemplateResponse

from .models import BrokerLead, BrokerLeadDocument, BrokerCommission, BrokerProfile
from .services import LicenseNotApprovable, approve_license, reject_license


class RejectLicenseForm(forms.Form):
    notes = forms.CharField(
        widget=forms.Textarea, label="Rejection reason (shown to the broker)"
    )


@admin.register(BrokerProfile)
class BrokerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user", "contact_name", "status", "kyc_approved", "license_number",
        "referral_code", "applied_at", "approved_at",
    )
    list_filter = ("status",)
    search_fields = ("user__email", "contact_name", "license_number", "referral_code")
    readonly_fields = (
        "id", "user", "status", "applied_at", "approved_at", "rejected_at",
        "license_submitted_at", "license_reviewed_at", "review_notes",
        "referral_code", "kyc_approved",
        "commission_rate", "total_commission_earned", "pending_commission",
        "created_at", "updated_at",
    )
    actions = ["approve_license_action", "reject_license_action"]

    def has_add_permission(self, request):
        # Broker profiles are created by the apply endpoint, never by hand.
        return False

    @admin.display(boolean=True, description="KYC approved")
    def kyc_approved(self, obj):
        kyc = getattr(obj.user, "kyc", None)
        return bool(kyc and kyc.status == "approved")

    @admin.action(description="Approve licence (activates broker role; requires KYC approved)")
    def approve_license_action(self, request, queryset):
        approved, blocked = 0, 0
        for broker in queryset:
            try:
                approve_license(broker, admin=request.user, source="admin")
                approved += 1
            except LicenseNotApprovable:
                blocked += 1
        if approved:
            self.message_user(
                request,
                f"Approved {approved} broker licence(s) + activated the broker role.",
                messages.SUCCESS,
            )
        if blocked:
            self.message_user(
                request,
                f"Skipped {blocked} broker(s): identity KYC is not approved yet. The "
                "broker must complete personal KYC before the licence can be approved.",
                messages.WARNING,
            )

    @admin.action(description="Reject licence (record notes for the broker)")
    def reject_license_action(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request, "Select exactly ONE broker to reject.", messages.WARNING
            )
            return
        broker = queryset.first()
        if request.POST.get("apply"):
            form = RejectLicenseForm(request.POST)
            if form.is_valid():
                reject_license(
                    broker, admin=request.user, notes=form.cleaned_data["notes"],
                    source="admin",
                )
                self.message_user(
                    request, "Licence rejected; the broker can see the notes.",
                    messages.SUCCESS,
                )
                return
        else:
            form = RejectLicenseForm()
        context = {
            **self.admin_site.each_context(request),
            "title": "Reject broker licence",
            "intro": f"Reject {broker.contact_name or broker.user}'s licence. The role stays inactive.",
            "form": form,
            "queryset": queryset,
            "action_name": "reject_license_action",
            "submit_label": "Reject licence",
            "back_url": request.get_full_path(),
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/broker/reject_license.html", context)


@admin.register(BrokerCommission)
class BrokerCommissionAdmin(admin.ModelAdmin):
    """Read-only view of the structured, append-only commission ledger (the money moves
    via BalanceTransaction; this is the queryable stamped record). Never hand-edited."""

    list_display = (
        "created_at", "broker", "property_name", "gross", "rate_applied",
        "commission", "is_legacy",
    )
    list_filter = ("is_legacy",)
    search_fields = ("broker__user__email", "property_slug", "property_name")
    readonly_fields = (
        "id", "broker", "investment", "property_slug", "property_name", "gross",
        "rate_applied", "commission", "balance_transaction", "is_legacy", "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False  # append-only; stamped at conversion, never edited


class BrokerLeadDocumentInline(admin.TabularInline):
    model = BrokerLeadDocument
    extra = 0
    fields = ("kind", "file", "original_name", "uploaded_at")
    readonly_fields = ("kind", "file", "original_name", "uploaded_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(BrokerLead)
class BrokerLeadAdmin(admin.ModelAdmin):
    """Broker referrals. Property referrals: contact the owner, then mark listed (linked to the
    published property — needs the owner's authorization) or not listed (with a note the broker
    sees). The broker is told at every step."""

    list_display = ("name", "kind", "status", "authorization", "broker", "email", "created_at")
    list_filter = ("kind", "status", "authorization")
    search_fields = ("name", "email", "broker__user__email")
    readonly_fields = (
        "id", "broker", "kind", "status", "name", "email", "phone", "details", "authorization",
        "auth_requested_at", "auth_confirmed_at", "auth_confirmed_name", "auth_confirmed_ip",
        "decided_at", "created_at", "updated_at",
    )
    fields = readonly_fields[:9] + ("auth_requested_at", "auth_confirmed_at", "auth_confirmed_name",
                                    "auth_confirmed_ip", "property", "admin_note", "decided_at",
                                    "created_at", "updated_at")
    autocomplete_fields = ("property",)
    inlines = [BrokerLeadDocumentInline]
    actions = ("mark_contacted", "mark_listed", "mark_declined")

    def _decide(self, request, qs, status, check=None):
        from django.contrib import messages
        from django.utils import timezone

        from .leads import notify_broker

        done = 0
        for lead in qs.filter(kind=BrokerLead.Kind.PROPERTY):
            problem = check(lead) if check else None
            if problem:
                messages.error(request, f"{lead.name}: {problem}")
                continue
            lead.status = status
            lead.decided_at = timezone.now()
            lead.save()
            notify_broker(lead)
            done += 1
        if done:
            messages.success(request, f"{done} referral(s) updated and the broker told.")

    @admin.action(description="Owner contacted")
    def mark_contacted(self, request, qs):
        self._decide(request, qs, BrokerLead.Status.CONTACTED)

    @admin.action(description="Listed (set the property first, needs the owner's authorization)")
    def mark_listed(self, request, qs):
        def check(lead):
            if not lead.is_authorized():
                return "the owner's authorization isn't complete yet."
            if not lead.property_id:
                return "choose the published property on the referral first."
            return None

        self._decide(request, qs, BrokerLead.Status.LISTED, check)

    @admin.action(description="Not listed (write the reason in the admin note first)")
    def mark_declined(self, request, qs):
        self._decide(request, qs, BrokerLead.Status.DECLINED,
                     lambda lead: None if lead.admin_note.strip() else "write the reason in the admin note first.")
