"""PWA settings serializer — branding fields only (no PII/secrets)."""
from rest_framework import serializers

from .models import PWASettings


class PWASettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PWASettings
        fields = (
            "id", "app_name", "app_short_name", "app_description",
            "theme_color", "background_color", "install_prompt_enabled",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
