"""
Browser error reports (POST /api/monitoring/client-errors/): uncaught errors from the React app
are logged to the "client" logger — real crashes at ERROR (alert email via apps.core.alerts),
the expected "stale bundle after a deploy" chunk errors at WARNING (log only).
"""
from __future__ import annotations

import logging

from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .throttling import AuthIPThrottle

client_log = logging.getLogger("client")

# A deploy replaces the hashed bundles; a tab still running the old build then fails to load a
# chunk. That is expected and self-heals on reload, so it is logged but not emailed.
_STALE_BUNDLE_MARKERS = (
    "failed to fetch dynamically imported module",
    "importing a module script failed",
    "error loading dynamically imported module",
    "chunkloaderror",
    "loading chunk",
)


class ClientErrorSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
    stack = serializers.CharField(max_length=6000, required=False, allow_blank=True)
    source = serializers.CharField(max_length=40, required=False, allow_blank=True)
    url = serializers.CharField(max_length=500, required=False, allow_blank=True)
    release = serializers.CharField(max_length=80, required=False, allow_blank=True)


class ClientErrorView(APIView):
    """Uncaught browser errors (public; throttled per IP). Never echoes anything back."""

    permission_classes = [AllowAny]
    authentication_classes = []  # a broken/expired token must not block the report
    throttle_classes = [AuthIPThrottle]
    throttle_scope = "client_errors"

    def post(self, request):
        ser = ClientErrorSerializer(data=request.data or {})
        if not ser.is_valid():
            return Response(status=status.HTTP_204_NO_CONTENT)
        d = ser.validated_data
        text = f"{d['message']}\n{d.get('stack', '')}".lower()
        stale = any(m in text for m in _STALE_BUNDLE_MARKERS)
        level = logging.WARNING if stale else logging.ERROR
        client_log.log(
            level,
            "Browser error (%s) on %s: %s\nRelease: %s\nUser agent: %s\n\n%s",
            d.get("source") or "error",
            d.get("url") or "?",
            d["message"],
            d.get("release") or "?",
            request.META.get("HTTP_USER_AGENT", "")[:300],
            d.get("stack") or "(no stack)",
            extra={"alert_signature": d["message"][:200]},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
