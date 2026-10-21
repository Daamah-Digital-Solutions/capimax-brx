"""Support-ticket admin — read the conversation, reply to the user, set the status.

A reply written here goes to the user's ticket thread and tells them (in-app + email); the
ticket then waits for them ("pending"). Marking it resolved tells them too.
"""
from django.contrib import admin

from .models import SupportTicket, SupportTicketMessage


class ReplyInline(admin.StackedInline):
    model = SupportTicketMessage
    extra = 1
    fields = ("body", "is_staff", "author", "created_at")
    readonly_fields = ("is_staff", "author", "created_at")
    verbose_name = "reply"
    verbose_name_plural = "conversation (add a reply at the bottom)"

    def has_change_permission(self, request, obj=None):
        return False  # sent replies are never edited

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "subject", "category", "priority", "status", "user", "created_at", "updated_at",
    )
    list_filter = ("status", "priority", "category", "created_at")
    search_fields = ("reference", "subject", "details", "user__email")
    # Operators reply and change status; the rest is read-only.
    readonly_fields = (
        "id", "reference", "user", "subject", "category", "priority", "details",
        "created_at", "updated_at",
    )
    ordering = ("-updated_at",)
    inlines = [ReplyInline]

    def save_model(self, request, obj, form, change):
        self._resolved_now = change and "status" in form.changed_data and obj.status == SupportTicket.Status.RESOLVED
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        from apps.notifications.models import Notification
        from apps.notifications.services import notify

        new = formset.save(commit=False)
        ticket = form.instance
        replied = False
        for reply in new:
            reply.author = request.user
            reply.is_staff = True
            reply.save()
            replied = True
        if replied:
            if ticket.status != SupportTicket.Status.RESOLVED:
                ticket.status = SupportTicket.Status.PENDING
                ticket.save(update_fields=["status", "updated_at"])
            notify(ticket.user, Notification.Type.SUPPORT_REPLY,
                   params={"reference": ticket.reference, "subject": ticket.subject},
                   action_url=f"/support?ticket={ticket.pk}")
        if getattr(self, "_resolved_now", False):
            notify(ticket.user, Notification.Type.SUPPORT_RESOLVED,
                   params={"reference": ticket.reference, "subject": ticket.subject},
                   action_url=f"/support?ticket={ticket.pk}")
