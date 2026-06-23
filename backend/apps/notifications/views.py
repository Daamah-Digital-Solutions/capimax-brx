"""
Notifications read/state API — Phase 10. Backs the bell + the Notifications page.

  GET  /api/notifications/                 own, not-deleted, newest first (capped).
  GET  /api/notifications/unread-count/    own unread count (drives the bell badge).
  POST /api/notifications/<id>/read/        mark one read.
  POST /api/notifications/mark-all-read/    mark all own unread → read.
  POST /api/notifications/<id>/delete/      SOFT delete (hide from the list).

All SELF-SCOPED: a caller only ever sees/mutates their own notifications. There is no
create endpoint — notifications are emitted server-side at event points (services.notify).
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, NotificationPreference
from .serializers import NotificationPreferenceSerializer, NotificationSerializer

# Cap the list (poll-on-load, no realtime) — the bell/page only need recent items.
LIST_LIMIT = 100


class NotificationsView(APIView):
    """GET the caller's notifications (own, not deleted, newest first)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(
            user=request.user, deleted=False
        )[:LIST_LIMIT]
        return Response(NotificationSerializer(qs, many=True).data)


class UnreadCountView(APIView):
    """GET the caller's unread (not-deleted) count — drives the bell badge."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            user=request.user, read=False, deleted=False
        ).count()
        return Response({"unread": count})


class MarkReadView(APIView):
    """POST: mark one of the caller's notifications read."""

    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        notif = get_object_or_404(Notification, pk=notification_id, user=request.user)
        if not notif.read:
            notif.read = True
            notif.save(update_fields=["read"])
        return Response(NotificationSerializer(notif).data)


class MarkAllReadView(APIView):
    """POST: mark all the caller's unread notifications read."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            user=request.user, read=False, deleted=False
        ).update(read=True)
        return Response({"updated": updated})


class DeleteNotificationView(APIView):
    """POST: SOFT-delete one of the caller's notifications (hidden, not removed)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        notif = get_object_or_404(Notification, pk=notification_id, user=request.user)
        if not notif.deleted:
            notif.deleted = True
            notif.save(update_fields=["deleted"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationPreferencesView(APIView):
    """
    GET   /api/notifications/preferences/   the caller's 7 per-type toggles (created with
                                            the UI defaults on first access).
    PATCH /api/notifications/preferences/   update one or more toggles (partial).

    SELF-SCOPED: always the caller's own row — there is no cross-user access path. Only
    the in-app per-type preferences live here; channel/digest are UI-only "Coming soon".
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        prefs = NotificationPreference.get_for(request.user)
        return Response(NotificationPreferenceSerializer(prefs).data)

    def patch(self, request):
        prefs = NotificationPreference.get_for(request.user)
        serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
