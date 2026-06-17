"""Notification routes — mounted at /api/notifications/ (see config/urls.py). Phase 10."""
from django.urls import path

from .views import (
    DeleteNotificationView,
    MarkAllReadView,
    MarkReadView,
    NotificationsView,
    UnreadCountView,
)

app_name = "notifications"

urlpatterns = [
    path("", NotificationsView.as_view(), name="notifications"),
    path("unread-count/", UnreadCountView.as_view(), name="notifications-unread-count"),
    path("mark-all-read/", MarkAllReadView.as_view(), name="notifications-mark-all-read"),
    path("<uuid:notification_id>/read/", MarkReadView.as_view(), name="notifications-read"),
    path("<uuid:notification_id>/delete/", DeleteNotificationView.as_view(), name="notifications-delete"),
]
