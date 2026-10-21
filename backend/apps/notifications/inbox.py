"""
Inbox — messages from the platform team to users (admin → owner / developer / broker / …).

  GET  /api/notifications/messages/            the caller's messages + unread count
  GET  /api/notifications/messages/<id>/       one message (marks it read)
  POST /api/notifications/messages/read-all/   mark every message read

Admins write them in Django admin ("Messages to users"): to one user or to everyone holding
a role. Each recipient also gets an in-app notification and an email.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MessageBroadcast, Notification, PlatformMessage

_ROLE_MODEL = {
    MessageBroadcast.Audience.OWNERS: "owner",
    MessageBroadcast.Audience.DEVELOPERS: "developer",
    MessageBroadcast.Audience.BROKERS: "broker",
    MessageBroadcast.Audience.LPS: "lp",
    MessageBroadcast.Audience.PARTNERS: "partner",
}


def recipients_for(b: MessageBroadcast):
    User = get_user_model()
    if b.audience == MessageBroadcast.Audience.USER:
        return [b.user] if b.user and b.user.is_active else []
    if b.audience == MessageBroadcast.Audience.EVERYONE:
        return list(User.objects.filter(is_active=True))
    from apps.roles.services import _record_model

    model = _record_model(_ROLE_MODEL[b.audience])
    ids = model.objects.filter(status="approved").values_list("user_id", flat=True)
    return list(User.objects.filter(pk__in=ids, is_active=True))


def deliver(b: MessageBroadcast) -> int:
    """Put the message in every recipient's inbox and tell them (in-app + email)."""
    from .services import notify

    users = recipients_for(b)
    with transaction.atomic():
        msgs = PlatformMessage.objects.bulk_create([
            PlatformMessage(recipient=u, broadcast=b, subject=b.subject, body=b.body) for u in users
        ])
        b.recipients = len(msgs)
        b.save(update_fields=["recipients"])
    for m in msgs:
        notify(m.recipient, Notification.Type.PLATFORM_MESSAGE,
               params={"subject": m.subject, "body": m.body[:1500]},
               action_url=f"/messages?id={m.pk}")
    return len(msgs)


def _row(m: PlatformMessage, full: bool = False) -> dict:
    out = {"id": str(m.pk), "subject": m.subject, "created_at": m.created_at,
           "read": m.read_at is not None, "preview": m.body[:160]}
    if full:
        out["body"] = m.body
    return out


class InboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = PlatformMessage.objects.filter(recipient=request.user)[:200]
        return Response({
            "messages": [_row(m) for m in qs],
            "unread": PlatformMessage.objects.filter(recipient=request.user, read_at__isnull=True).count(),
        })


class InboxMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        m = get_object_or_404(PlatformMessage, pk=pk, recipient=request.user)
        if m.read_at is None:
            m.read_at = timezone.now()
            m.save(update_fields=["read_at"])
        return Response(_row(m, full=True))


class InboxReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        n = PlatformMessage.objects.filter(recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked": n})
