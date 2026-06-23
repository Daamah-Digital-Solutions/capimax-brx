"""
Support API — the backend for the existing Support.tsx UI (was 100% mock).

  GET  /api/support/tickets/                 The caller's OWN tickets + real unresolved_count.
  POST /api/support/tickets/                 The New-Ticket form submits here (self-scoped).
  GET  /api/support/tickets/<id>/            One of the caller's OWN tickets (else 404).
  PATCH /api/support/admin/tickets/<id>/     ADMIN-ONLY: advance status (open→pending→resolved).

SELF-SCOPED: every user-facing queryset is `filter(user=request.user)`, so a user only ever
sees / opens their OWN tickets (a second user gets 404 and never appears in another's list).
The admin status endpoint is gated by IsAdminRole (staff OR profile.role=='admin').
NO money / chain / file logic anywhere.
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdminRole

from .models import SupportTicket
from .serializers import (
    SupportTicketAdminUpdateSerializer,
    SupportTicketCreateSerializer,
)


def _ticket_dict(t: SupportTicket) -> dict:
    """Read shape — hand-built to match the frontend SupportTicketRow interface."""
    return {
        "id": str(t.id),
        "reference": t.reference,
        "subject": t.subject,
        "category": t.category,
        "priority": t.priority,
        "details": t.details,
        "status": t.status,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


class SupportTicketsView(APIView):
    """List the caller's own tickets (+ real unresolved count); create a new ticket."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SupportTicket.objects.filter(user=request.user)
        unresolved = qs.exclude(status=SupportTicket.Status.RESOLVED).count()
        return Response(
            {
                "tickets": [_ticket_dict(t) for t in qs],
                "unresolved_count": unresolved,
            }
        )

    def post(self, request):
        ser = SupportTicketCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        ticket = SupportTicket.objects.create(
            user=request.user,
            subject=data["subject"],
            category=data["category"],
            priority=data.get("priority", SupportTicket.Priority.LOW),
            details=data["details"],
            # status defaults to OPEN on the model.
        )
        return Response(_ticket_dict(ticket), status=status.HTTP_201_CREATED)


class SupportTicketDetailView(APIView):
    """Read one of the caller's OWN tickets (self-scoped → 404 for anyone else)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, ticket_id):
        ticket = get_object_or_404(SupportTicket, id=ticket_id, user=request.user)
        return Response(_ticket_dict(ticket))


class SupportTicketAdminView(APIView):
    """ADMIN-ONLY: advance a ticket's status (open→pending→resolved). Any user's ticket."""

    permission_classes = [IsAdminRole]

    def patch(self, request, ticket_id):
        ticket = get_object_or_404(SupportTicket, id=ticket_id)
        ser = SupportTicketAdminUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ticket.status = ser.validated_data["status"]
        ticket.save(update_fields=["status", "updated_at"])
        return Response(_ticket_dict(ticket))
