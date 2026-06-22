"""
PWA settings API — a singleton global-config endpoint, repointed off Supabase.

  GET   /api/pwa-settings/   The singleton (readable app-wide for branding + install prompt).
  PATCH /api/pwa-settings/   ADMIN-ONLY update (global app config). Mirrors the frontend
  PUT   /api/pwa-settings/   admin gate (Settings.tsx renders the editor only for role 'admin').

The ONE security point: the write is gated by `IsAdminRole` (staff OR profile.role=='admin');
a normal authenticated user gets 403 and cannot change global config.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminRole

from .models import PWASettings
from .serializers import PWASettingsSerializer


class PWASettingsView(APIView):
    """Read the PWA singleton (public); update it (admin-only)."""

    def get_permissions(self):
        # Branding is read app-wide; only the write is admin-gated.
        if self.request.method in ("PATCH", "PUT"):
            return [IsAdminRole()]
        return [AllowAny()]

    def get(self, request):
        return Response(PWASettingsSerializer(PWASettings.load()).data)

    def patch(self, request):
        settings_obj = PWASettings.load()
        serializer = PWASettingsSerializer(
            settings_obj, data=request.data or {}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # Allow PUT as a full-update alias (same admin gate, partial-tolerant).
    def put(self, request):
        return self.patch(request)
