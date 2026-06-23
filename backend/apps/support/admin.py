"""Support-ticket admin — operators triage + resolve tickets (status is editable)."""
from django.contrib import admin

from .models import SupportTicket


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = (
        "reference", "subject", "category", "priority", "status", "user", "created_at",
    )
    list_filter = ("status", "priority", "category", "created_at")
    search_fields = ("reference", "subject", "details", "user__email")
    # Operators may change status (open→pending→resolved); the rest is read-only.
    readonly_fields = (
        "id", "reference", "user", "subject", "category", "priority", "details",
        "created_at", "updated_at",
    )
    ordering = ("-created_at",)
