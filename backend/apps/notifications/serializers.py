"""Notification serializer — Phase 10. Read-only projection (type + params + state)."""
from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "type", "params", "action_url", "read", "created_at")
        read_only_fields = fields
