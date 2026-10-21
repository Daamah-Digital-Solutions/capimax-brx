"""Notifications admin — Phase 10. READ-ONLY: notifications are emitted by the service
layer at event points, never created or edited by hand."""
from django.contrib import admin

from .models import MessageBroadcast, Notification, NotificationPreference, PlatformMessage


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


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    """Read-only ops view of a user's per-type toggles (users edit their own via the API)."""

    list_display = (
        "user", "distributions", "installments", "new_properties", "reports",
        "price_alerts", "market_updates", "security", "updated_at",
    )
    search_fields = ("user__email",)
    readonly_fields = tuple(f.name for f in NotificationPreference._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(MessageBroadcast)
class MessageBroadcastAdmin(admin.ModelAdmin):
    """Write a message to one user or to everyone with a role. Saving sends it (inbox +
    notification + email); a sent message can't be edited."""

    list_display = ("subject", "audience", "user", "recipients", "created_by", "created_at")
    list_filter = ("audience",)
    search_fields = ("subject", "body", "user__email")
    autocomplete_fields = ("user",)
    fields = ("audience", "user", "subject", "body", "recipients", "created_by", "created_at")
    readonly_fields = ("recipients", "created_by", "created_at")

    def get_readonly_fields(self, request, obj=None):
        if obj is not None:
            return ("audience", "user", "subject", "body", "recipients", "created_by", "created_at")
        return self.readonly_fields

    def save_model(self, request, obj, form, change):
        from django.contrib import messages

        if change:
            return
        obj.created_by = request.user
        super().save_model(request, obj, form, change)
        from .inbox import deliver

        n = deliver(obj)
        messages.success(request, f"Sent to {n} user(s).")


@admin.register(PlatformMessage)
class PlatformMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "recipient", "read_at", "created_at")
    list_filter = ("read_at",)
    search_fields = ("subject", "recipient__email")
    readonly_fields = ("recipient", "broadcast", "subject", "body", "read_at", "created_at")

    def has_add_permission(self, request):
        return False
