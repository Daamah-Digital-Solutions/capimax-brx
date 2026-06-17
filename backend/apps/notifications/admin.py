"""Notifications admin — Phase 10. READ-ONLY: notifications are emitted by the service
layer at event points, never created or edited by hand."""
from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("type", "user", "read", "deleted", "created_at")
    list_filter = ("type", "read", "deleted")
    search_fields = ("user__email", "type", "action_url")
    readonly_fields = (
        "id", "user", "type", "params", "action_url", "read", "deleted", "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
