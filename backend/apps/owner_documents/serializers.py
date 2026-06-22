"""Owner-document read serializer — mirrors `LPDocumentSerializer`."""
from rest_framework import serializers

from .models import OwnerDocument


class OwnerDocumentSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)
    # Keep the frontend's `file_path` key; the blob itself is fetched from the
    # owner-only download endpoint (not via a public/signed URL).
    file_path = serializers.SerializerMethodField()

    class Meta:
        model = OwnerDocument
        fields = (
            "id", "user_id", "document_name", "document_type", "file_path",
            "file_size", "file_type", "description", "property_name", "status",
            "uploaded_at", "created_at",
        )

    def get_file_path(self, obj):
        return obj.file.name if obj.file else None
