"""Notification serializers — Phase 10. Read-only notification projection + the per-user
preference read/write shape (camelCase keys matching the frontend's settings column)."""
from rest_framework import serializers

from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "type", "params", "action_url", "read", "created_at")
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    The 7 per-type toggles, keyed EXACTLY as the frontend expects
    (src/pages/Notifications.tsx:30-38). snake_case model fields are surfaced under the
    UI's camelCase keys via `source`. All optional so PATCH can update a single toggle.
    """

    newProperties = serializers.BooleanField(source="new_properties", required=False)
    priceAlerts = serializers.BooleanField(source="price_alerts", required=False)
    marketUpdates = serializers.BooleanField(source="market_updates", required=False)

    class Meta:
        model = NotificationPreference
        fields = (
            "distributions",
            "installments",
            "newProperties",
            "reports",
            "priceAlerts",
            "marketUpdates",
            "security",
        )
        extra_kwargs = {
            "distributions": {"required": False},
            "installments": {"required": False},
            "reports": {"required": False},
            "security": {"required": False},
        }
