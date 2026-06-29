"""
Partner admin — Phase 11 Wave A.

TWO clearly-separated, INDEPENDENT admin responsibilities (PARTNERS_SURFACE.md):

  (1) KYB / verification — the normal path is the signed Sumsub webhook (partner
      business level); the admin is an EXCEPTION HANDLER only. The approve/reject KYB
      actions route through the SAME services (so a manual approve still activates the
      partner role). Mirrors apps/developer/admin.py.

  (2) Public-directory visibility — a DELIBERATE admin review step, independent of KYB.
      "Approve directory listing" / "Reject directory listing" flip ONLY directory_status
      (whether the partner appears in the public directory). The admin enters NO company
      data — the PARTNER supplied it; the admin only approves/rejects the listing.

A partner can be KYB-approved yet directory-pending (or directory-rejected) and vice
versa — the two states never touch each other.
"""
from django import forms
from django.contrib import admin, messages
from django.template.response import TemplateResponse

from apps.notifications.services import NotificationType, notify

from .models import (
    Assignment,
    AssignmentEvent,
    Deliverable,
    DeliverableDocument,
    PartnerKYBDocument,
    PartnerProfile,
    PartnerStatus,
)
from .services import (
    _log_event,
    approve_deliverable,
    approve_directory,
    approve_kyb,
    reject_directory,
    reject_kyb,
    request_revision,
)


class PartnerKYBDocumentInline(admin.TabularInline):
    """READONLY view of the partner's uploaded entity-KYB documents — so the admin can
    review the business evidence before manually approving KYB. SEPARATE from the
    Wave-B DeliverableDocument (work product). Mirrors the owner KYB-doc inline."""

    model = PartnerKYBDocument
    extra = 0
    readonly_fields = ("id", "document_type", "document_name", "file", "file_size", "status", "created_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PartnerProfile)
class PartnerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user", "company_name", "category", "status", "kyb_status",
        "directory_status", "applied_at", "approved_at",
    )
    list_filter = ("status", "kyb_status", "directory_status", "category")
    search_fields = ("user__email", "company_name", "contact_name", "sumsub_applicant_id")
    readonly_fields = (
        "id", "user", "status", "applied_at", "approved_at", "rejected_at",
        "kyb_status", "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
        "sumsub_applicant_id", "sumsub_review_answer",
        "directory_status", "directory_reviewed_at",
        "created_at", "updated_at",
    )
    inlines = [PartnerKYBDocumentInline]
    actions = [
        "exception_approve_kyb",
        "exception_reject_kyb",
        "approve_directory_listing",
        "reject_directory_listing",
    ]

    def has_add_permission(self, request):
        # Partner profiles are created by the apply endpoint, never by hand.
        return False

    # --- (1) KYB / verification (exception path) ----------------------------- #
    @admin.action(description="EXCEPTION: approve partner KYB (activates partner role)")
    def exception_approve_kyb(self, request, queryset):
        n = 0
        for partner in queryset:
            approve_kyb(partner, review_answer="ADMIN", source="admin")
            n += 1
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} partner(s) + activated role. "
            "Normal approvals come from the Sumsub partner-KYB webhook. "
            "(This does NOT publish them to the public directory — that is a separate action.)",
            messages.WARNING,
        )

    @admin.action(description="EXCEPTION: reject partner KYB")
    def exception_reject_kyb(self, request, queryset):
        n = 0
        for partner in queryset:
            reject_kyb(partner, reason="Rejected via admin exception action", source="admin")
            n += 1
        self.message_user(
            request, f"[EXCEPTION PATH] Rejected {n} partner(s).", messages.WARNING
        )

    # --- (2) Public-directory visibility (the deliberate review step) -------- #
    @admin.action(description="Approve directory listing (show in public directory)")
    def approve_directory_listing(self, request, queryset):
        n = 0
        for partner in queryset:
            approve_directory(partner, admin=request.user)
            n += 1
        self.message_user(
            request,
            f"Published {n} partner(s) to the public directory. "
            "(Independent of KYB — this only controls public visibility.)",
            messages.SUCCESS,
        )

    @admin.action(description="Reject directory listing (hide from public directory)")
    def reject_directory_listing(self, request, queryset):
        n = 0
        for partner in queryset:
            reject_directory(partner, admin=request.user,
                             notes="Directory listing rejected via admin action")
            n += 1
        self.message_user(
            request,
            f"Removed {n} partner(s) from the public directory.",
            messages.WARNING,
        )


# =========================================================================== #
# Wave B — assignment / deliverable workflow. The admin ASSIGNS work (the sanctioned
# admin action, like property publication) and REVIEWS deliverables (approve / request
# revision). Both write AssignmentEvents + fire notify() through the services.
# =========================================================================== #
class DeliverableInline(admin.TabularInline):
    """Define the required deliverables AT ASSIGN TIME (admin-defined)."""

    model = Deliverable
    extra = 2
    fields = ("name", "name_ar", "due_date", "status")
    readonly_fields = ("status",)  # status is workflow-driven, never set by hand


class AssignmentAdminForm(forms.ModelForm):
    class Meta:
        model = Assignment
        fields = ("partner", "property", "service_type", "due_date", "notes")

    def clean_partner(self):
        partner = self.cleaned_data["partner"]
        # Locked: only a KYB-approved partner may be assigned work.
        if partner.status != PartnerStatus.APPROVED:
            raise forms.ValidationError(
                "This partner is not KYB-approved yet — they cannot be assigned work."
            )
        return partner


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    """
    Create = the ADMIN ASSIGN action: pick a KYB-approved partner + a Property + service
    type + due date, and define the deliverables inline. On create we denormalize the
    Property display fields, write the ASSIGNED event, and notify the partner.
    """

    form = AssignmentAdminForm
    inlines = [DeliverableInline]
    list_display = (
        "property_name", "partner", "service_type", "status", "due_date",
        "progress_display", "assigned_at",
    )
    list_filter = ("status", "service_type")
    search_fields = ("property_name", "partner__user__email", "partner__company_name")
    readonly_fields = (
        "id", "status", "property_name", "property_name_ar", "location", "location_ar",
        "review_notes", "assigned_by", "assigned_at", "submitted_at", "completed_at",
        "created_at", "updated_at",
    )

    @admin.display(description="Progress")
    def progress_display(self, obj):
        return f"{obj.derived_progress()}%"

    def get_readonly_fields(self, request, obj=None):
        # On the ADD form, partner/property/service_type/due_date/notes must be editable.
        if obj is None:
            return ("id", "assigned_by", "assigned_at", "created_at", "updated_at")
        # Once created, the core assignment is immutable from the admin (workflow-driven).
        return self.readonly_fields + ("partner", "property", "service_type", "due_date", "notes")

    def save_model(self, request, obj, form, change):
        if not change:
            # Denormalize the Property display fields + record the assigning admin.
            prop = obj.property
            if prop is not None:
                obj.property_name = getattr(prop, "name", "") or ""
                obj.property_name_ar = getattr(prop, "name_ar", "") or ""
                obj.location = getattr(prop, "location", "") or ""
                obj.location_ar = getattr(prop, "location_ar", "") or ""
            obj.assigned_by = request.user
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        if not change:
            # Deliverables now exist (inline saved). Write the ASSIGNED event + notify the
            # partner — the create_assignment side-effects, applied to the admin-built row.
            assignment = form.instance
            _log_event(
                assignment, AssignmentEvent.EventType.ASSIGNED, actor=request.user,
                meta={"property": assignment.property_name},
            )
            notify(
                assignment.partner.user, NotificationType.PARTNER_ASSIGNED,
                params={"property": assignment.property_name,
                        "service_type": assignment.service_type},
                action_url="/strategic-partners",
            )
            self.message_user(
                request,
                f"Assigned '{assignment.property_name}' to {assignment.partner.user.email} "
                f"with {assignment.deliverables.count()} deliverable(s); the partner was notified.",
                messages.SUCCESS,
            )


class _RevisionNotesForm(forms.Form):
    review_notes = forms.CharField(
        widget=forms.Textarea, label="Revision notes (shown to the partner)"
    )


@admin.register(Deliverable)
class DeliverableAdmin(admin.ModelAdmin):
    """The admin REVIEW surface: approve a deliverable, or request a revision (notes)."""

    list_display = ("name", "assignment", "status", "due_date")
    list_filter = ("status",)
    search_fields = ("name", "assignment__property_name", "assignment__partner__user__email")
    readonly_fields = ("id", "assignment", "status", "created_at", "updated_at")
    actions = ["approve_selected", "request_revision_selected"]

    def has_add_permission(self, request):
        # Deliverables are defined at assign time (inline on the Assignment), never alone.
        return False

    @admin.action(description="Approve deliverable(s) (notifies partner; completes when all approved)")
    def approve_selected(self, request, queryset):
        n = 0
        for deliverable in queryset:
            approve_deliverable(deliverable, admin=request.user)
            n += 1
        self.message_user(request, f"Approved {n} deliverable(s).", messages.SUCCESS)

    @admin.action(description="Request revision (record notes for the partner)")
    def request_revision_selected(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request, "Select exactly ONE deliverable to request a revision.",
                messages.WARNING,
            )
            return
        deliverable = queryset.first()
        if request.POST.get("apply"):
            form = _RevisionNotesForm(request.POST)
            if form.is_valid():
                request_revision(
                    deliverable, admin=request.user,
                    review_notes=form.cleaned_data["review_notes"],
                )
                self.message_user(
                    request, "Revision requested; the partner can see the notes.",
                    messages.SUCCESS,
                )
                return
        else:
            form = _RevisionNotesForm()
        context = {
            **self.admin_site.each_context(request),
            "title": "Request revision",
            "intro": f"Request changes on '{deliverable.name}'. The partner is notified.",
            "form": form,
            "queryset": queryset,
            "action_name": "request_revision_selected",
            "submit_label": "Request revision",
            "back_url": request.get_full_path(),
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/partners/request_revision.html", context)


@admin.register(DeliverableDocument)
class DeliverableDocumentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "deliverable", "assignment", "uploaded_at")
    search_fields = ("original_filename", "assignment__property_name")
    readonly_fields = (
        "id", "deliverable", "assignment", "file", "original_filename", "file_size",
        "uploaded_at",
    )

    def has_add_permission(self, request):
        return False


@admin.register(AssignmentEvent)
class AssignmentEventAdmin(admin.ModelAdmin):
    list_display = ("assignment", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    search_fields = ("assignment__property_name",)
    readonly_fields = ("id", "assignment", "event_type", "actor", "meta", "created_at")

    def has_add_permission(self, request):
        return False
