"""Owner-document admin — metadata only (never a raw file dump)."""
from django.contrib import admin

from .models import OwnerDocument


@admin.register(OwnerDocument)
class OwnerDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "document_name", "document_type", "user", "file_size",
        "status", "uploaded_at",
    )
    list_filter = ("document_type", "status", "uploaded_at")
    search_fields = ("document_name", "property_name", "user__email")
    readonly_fields = (
        "id", "user", "document_name", "document_type", "file", "file_size",
        "file_type", "description", "property_name", "status",
        "uploaded_at", "created_at",
    )
    ordering = ("-created_at",)
