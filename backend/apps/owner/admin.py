"""
Owner admin — Phase 7 Wave A.

AUTOMATION-FIRST: the normal owner-KYB approval path is the signed Sumsub webhook
(owner business level). The admin is an EXCEPTION HANDLER only — the approve/reject
actions below are present but clearly labelled "exception" and route through the
SAME services (so a manual approve still activates the owner role). Mirrors
apps/lp/admin.py.
"""
from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.template.response import TemplateResponse
from django.utils import timezone

from apps.properties.models import (
    AssetType,
    Country,
    ExitAvailability,
    PropertyModelType,
    PropertyStatus,
    RiskLevel,
    YieldType,
)

from .models import (
    OwnerKYBDocument,
    OwnerProfile,
    PropertySubmission,
    SubmissionDocument,
    SubmissionStatus,
)
from .services import (
    SubmissionNotReviewable,
    approve_kyb,
    publish_submission,
    reject_kyb,
    reject_submission,
)
from .services import _property_defaults_from  # initial prefill for the review form


class OwnerKYBDocumentInline(admin.TabularInline):
    """READONLY view of the owner's uploaded entity-KYB documents — so the admin can
    review the business evidence before manually approving KYB. Mirrors the owner
    SubmissionDocumentInline (read-only, no add)."""

    model = OwnerKYBDocument
    extra = 0
    readonly_fields = ("id", "document_type", "document_name", "file", "file_size", "status", "created_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(OwnerProfile)
class OwnerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "company_name", "status", "kyb_status", "applied_at", "approved_at")
    list_filter = ("status", "kyb_status")
    search_fields = ("user__email", "company_name", "contact_name", "sumsub_applicant_id")
    readonly_fields = (
        "id", "user", "status", "applied_at", "approved_at", "rejected_at",
        "kyb_status", "kyb_submitted_at", "kyb_approved_at", "kyb_rejected_at",
        "sumsub_applicant_id", "sumsub_review_answer",
        "created_at", "updated_at",
    )
    inlines = [OwnerKYBDocumentInline]
    actions = ["exception_approve_kyb", "exception_reject_kyb"]

    def has_add_permission(self, request):
        # Owner profiles are created by the apply endpoint, never by hand.
        return False

    @admin.action(description="EXCEPTION: approve owner KYB (activates owner role)")
    def exception_approve_kyb(self, request, queryset):
        n = 0
        for owner in queryset:
            approve_kyb(owner, review_answer="ADMIN", source="admin")
            n += 1
        self.message_user(
            request,
            f"[EXCEPTION PATH] Approved {n} owner(s) + activated role. "
            "Normal approvals come from the Sumsub owner-KYB webhook.",
            messages.WARNING,
        )

    @admin.action(description="EXCEPTION: reject owner KYB")
    def exception_reject_kyb(self, request, queryset):
        n = 0
        for owner in queryset:
            reject_kyb(owner, reason="Rejected via admin exception action", source="admin")
            n += 1
        self.message_user(
            request, f"[EXCEPTION PATH] Rejected {n} owner(s).", messages.WARNING
        )


# --------------------------------------------------------------------------- #
# Property submission intake (Wave B) — READ surface. The Wave-C review pipeline
# (assign investment model + publish a Property + deploy token) is the SANCTIONED
# admin REVIEW step (locked decision: an investment property must be human-reviewed
# before going live — admin here is the reviewer, not an exception handler).
# Submissions are created via the API, never by hand.
# --------------------------------------------------------------------------- #
class SubmissionDocumentInline(admin.TabularInline):
    model = SubmissionDocument
    extra = 0
    readonly_fields = ("id", "document_type", "document_name", "file", "file_size", "uploaded_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class PublishSubmissionForm(forms.Form):
    """
    The admin review form: ASSIGN the investment model + refine the Property fields the
    6-step submission form never collected (Arabic copy, hero image, yield/risk/exit,
    country normalization), then publish. Per-model nested detail (installment schedule,
    phases, …) is added afterward via the Property admin inlines if the model needs it.
    """

    model = forms.ChoiceField(
        choices=PropertyModelType.choices, label="Investment model (assigned by reviewer)"
    )
    name_ar = forms.CharField(max_length=200, label="Name (Arabic)")
    image = forms.URLField(label="Hero image URL", max_length=500)
    location = forms.CharField(max_length=200)
    location_ar = forms.CharField(max_length=200, label="Location (Arabic)")
    description_ar = forms.CharField(widget=forms.Textarea, label="Description (Arabic)", required=False)
    country = forms.ChoiceField(choices=Country.choices)
    city = forms.CharField(max_length=80)
    asset_type = forms.ChoiceField(choices=AssetType.choices)
    status = forms.ChoiceField(choices=PropertyStatus.choices)
    yield_type = forms.ChoiceField(choices=YieldType.choices)
    risk_level = forms.ChoiceField(choices=RiskLevel.choices)
    exit_availability = forms.ChoiceField(choices=ExitAvailability.choices)
    total_value = forms.DecimalField(min_value=0, max_digits=16, decimal_places=2)
    token_price = forms.DecimalField(min_value=1, max_digits=12, decimal_places=2, initial=100)
    min_investment = forms.DecimalField(min_value=0, max_digits=12, decimal_places=2)
    expected_yield = forms.DecimalField(min_value=0, max_value=100, required=False, max_digits=6, decimal_places=2)
    expected_growth = forms.DecimalField(min_value=0, max_value=100, required=False, max_digits=6, decimal_places=2)
    deploy_token = forms.BooleanField(
        required=False, label="Also deploy the token contract (BSC Testnet)"
    )


class RejectSubmissionForm(forms.Form):
    review_notes = forms.CharField(
        widget=forms.Textarea, label="Rejection reason (shown to the owner)"
    )


@admin.register(PropertySubmission)
class PropertySubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "name", "submitter", "property_type", "status", "published_property",
        "submitted_at", "reviewed_at",
    )
    list_filter = ("status", "property_type", "construction_status", "country")
    search_fields = ("name", "submitter__email", "city", "district")
    readonly_fields = (
        "id", "submitter", "name", "property_type", "construction_status", "description",
        "country", "city", "district", "address",
        "property_value_usd", "min_investment", "expected_yield", "duration_years",
        "distribution_model", "status", "review_notes", "submitted_at", "reviewed_at",
        "published_property", "created_at", "updated_at",
    )
    inlines = [SubmissionDocumentInline]
    actions = ["approve_and_publish", "reject"]

    def has_add_permission(self, request):
        # Submissions are created via the owner submission API, never by hand.
        return False

    # ----------------------------------------------------------------------- #
    # Review actions (intermediate forms). Single-submission: each property needs
    # its own model + fields, so the reviewer acts on one at a time.
    # ----------------------------------------------------------------------- #
    def _single(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request, "Select exactly ONE submission to review.", messages.WARNING
            )
            return None
        return queryset.first()

    @admin.action(description="Approve & publish (assign investment model)")
    def approve_and_publish(self, request, queryset):
        submission = self._single(request, queryset)
        if submission is None:
            return
        if submission.published_property_id:
            self.message_user(request, "Already published.", messages.WARNING)
            return
        if submission.status not in (SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW):
            self.message_user(
                request, f"Cannot publish a '{submission.status}' submission.", messages.WARNING
            )
            return

        if request.POST.get("apply"):
            form = PublishSubmissionForm(request.POST)
            if form.is_valid():
                data = dict(form.cleaned_data)
                model = data.pop("model")
                deploy = data.pop("deploy_token", False)
                try:
                    publish_submission(
                        submission, model=model, overrides=data, deploy=deploy, reviewer=request.user
                    )
                except (ValidationError, SubmissionNotReviewable) as exc:
                    self.message_user(request, f"Publish failed: {exc}", messages.ERROR)
                    return
                except Exception as exc:  # e.g. chain deploy failure — surface, don't crash
                    self.message_user(request, f"Publish failed: {exc}", messages.ERROR)
                    return
                submission.refresh_from_db()
                self.message_user(
                    request,
                    f"Published '{submission.published_property.slug}' "
                    f"(model={model}, is_published=True) and linked the owner.",
                    messages.SUCCESS,
                )
                return
        else:
            # Prefill from the submission's mapped defaults + a model guess.
            defaults = _property_defaults_from(submission)
            defaults["model"] = (
                PropertyModelType.READY
                if submission.construction_status == "ready"
                else PropertyModelType.PHASING
            )
            form = PublishSubmissionForm(initial=defaults)

        context = {
            **self.admin_site.each_context(request),
            "title": "Approve & publish submission",
            "intro": (
                f"Review '{submission.name}' by {submission.submitter}. Assign the "
                f"investment model and confirm the catalog fields, then publish. The "
                f"Property is created unpublished, validated, then published."
            ),
            "form": form,
            "queryset": queryset,
            "action_name": "approve_and_publish",
            "submit_label": "Publish property",
            "back_url": request.get_full_path(),
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/owner/review_submission.html", context)

    @admin.action(description="Reject (record notes for the owner)")
    def reject(self, request, queryset):
        submission = self._single(request, queryset)
        if submission is None:
            return
        if request.POST.get("apply"):
            form = RejectSubmissionForm(request.POST)
            if form.is_valid():
                try:
                    reject_submission(
                        submission, review_notes=form.cleaned_data["review_notes"],
                        reviewer=request.user,
                    )
                except SubmissionNotReviewable as exc:
                    self.message_user(request, f"Reject failed: {exc}", messages.ERROR)
                    return
                self.message_user(request, "Submission rejected; the owner can see the notes.", messages.SUCCESS)
                return
        else:
            form = RejectSubmissionForm()
        context = {
            **self.admin_site.each_context(request),
            "title": "Reject submission",
            "intro": f"Reject '{submission.name}'. No property is created.",
            "form": form,
            "queryset": queryset,
            "action_name": "reject",
            "submit_label": "Reject submission",
            "back_url": request.get_full_path(),
            "opts": self.model._meta,
        }
        return TemplateResponse(request, "admin/owner/review_submission.html", context)


@admin.register(SubmissionDocument)
class SubmissionDocumentAdmin(admin.ModelAdmin):
    list_display = ("document_name", "document_type", "submission", "uploaded_at")
    list_filter = ("document_type",)
    search_fields = ("document_name", "submission__name", "submission__submitter__email")
    readonly_fields = ("id", "submission", "document_type", "document_name", "file", "file_size", "uploaded_at")

    def has_add_permission(self, request):
        return False
