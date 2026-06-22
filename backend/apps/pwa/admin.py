"""PWA settings admin — the singleton config row."""
from django.contrib import admin

from .models import PWASettings


@admin.register(PWASettings)
class PWASettingsAdmin(admin.ModelAdmin):
    list_display = ("app_name", "app_short_name", "install_prompt_enabled", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")

    def has_add_permission(self, request):
        # Singleton: never add a second row from the admin.
        return not PWASettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
