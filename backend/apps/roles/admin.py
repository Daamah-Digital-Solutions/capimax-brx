from django.contrib import admin, messages
from django.utils.html import format_html, format_html_join

from . import services
from .models import RoleApplication, RoleApplicationDocument


class DocumentInline(admin.TabularInline):
    model = RoleApplicationDocument
    extra = 0
    can_delete = False
    fields = ("kind", "open_file", "original_name", "size", "uploaded_at")
    readonly_fields = fields

    @admin.display(description="File")
    def open_file(self, obj):
        return format_html('<a href="{}" target="_blank" rel="noopener">Open</a>', obj.file.url) if obj.file else "—"

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(RoleApplication)
class RoleApplicationAdmin(admin.ModelAdmin):
    """
    Review the answers and documents, then Approve (the role is activated and the applicant is
    notified with a link to its dashboard) or Reject (write the reason in "Review note" first —
    the applicant sees it and can edit and resubmit).
    """

    list_display = ("user", "role", "status", "submitted_at", "decided_at")
    list_filter = ("status", "role")
    search_fields = ("user__email",)
    fields = ("user", "role", "status", "answers", "review_note", "submitted_at", "decided_at", "decided_by")
    readonly_fields = ("user", "role", "status", "answers", "submitted_at", "decided_at", "decided_by")
    inlines = [DocumentInline]
    actions = ("action_approve", "action_reject")

    def has_add_permission(self, request):
        return False

    @admin.display(description="Answers")
    def answers(self, obj):
        rows = format_html_join("", "<tr><th style='padding-right:12px'>{}</th><td>{}</td></tr>",
                                ((k.replace("_", " ").capitalize(), v) for k, v in (obj.data or {}).items()))
        return format_html("<table>{}</table>", rows)

    def _run(self, request, queryset, fn, done):
        from rest_framework.exceptions import ValidationError

        for app in queryset:
            try:
                fn(app)
                self.message_user(request, f"{app}: {done}", level=messages.SUCCESS)
            except ValidationError as exc:
                self.message_user(request, f"{app}: {exc.detail}", level=messages.WARNING)

    @admin.action(description="APPROVE — activate the role")
    def action_approve(self, request, queryset):
        self._run(request, queryset, lambda a: services.approve(a.pk, request.user), "approved")

    @admin.action(description="Reject (uses the review note as the reason)")
    def action_reject(self, request, queryset):
        self._run(request, queryset, lambda a: services.reject(a.pk, request.user, a.review_note), "rejected")
