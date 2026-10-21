"""Notification routes — mounted at /api/notifications/ (see config/urls.py). Phase 10."""
from django.urls import path

from .inbox import InboxMessageView, InboxReadAllView, InboxView
from .views import (
    DeleteNotificationView,
    MarkAllReadView,
    MarkReadView,
    NotificationPreferencesView,
    NotificationsView,
    UnreadCountView,
)

app_name = "notifications"

urlpatterns = [
    path("", NotificationsView.as_view(), name="notifications"),
    path("unread-count/", UnreadCountView.as_view(), name="notifications-unread-count"),
    path("preferences/", NotificationPreferencesView.as_view(), name="notifications-preferences"),
    path("mark-all-read/", MarkAllReadView.as_view(), name="notifications-mark-all-read"),
    # Inbox: messages from the platform team (apps/notifications/inbox.py).
    path("messages/", InboxView.as_view(), name="inbox"),
    path("messages/read-all/", InboxReadAllView.as_view(), name="inbox-read-all"),
    path("messages/<uuid:pk>/", InboxMessageView.as_view(), name="inbox-message"),
    path("<uuid:notification_id>/read/", MarkReadView.as_view(), name="notifications-read"),
    path("<uuid:notification_id>/delete/", DeleteNotificationView.as_view(), name="notifications-delete"),
]
