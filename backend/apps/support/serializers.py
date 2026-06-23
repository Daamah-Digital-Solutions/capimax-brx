"""
Support INPUT serializers. Validation only; the read output is hand-shaped in the views
(mirrors the family/installments precedent) to match the frontend TS shape EXACTLY.

The choices below are copied verbatim from Support.tsx's <select> options + status badges —
do not add fields the form lacks, do not drop fields it has.
"""
from rest_framework import serializers

from .models import SupportTicket


class SupportTicketCreateSerializer(serializers.Serializer):
    """The New-Ticket form POSTs here. Fields = the form's inputs, 1:1."""

    subject = serializers.CharField(max_length=255)
    category = serializers.ChoiceField(choices=SupportTicket.Category.values)
    priority = serializers.ChoiceField(
        choices=SupportTicket.Priority.values,
        required=False,
        default=SupportTicket.Priority.LOW,
    )
    details = serializers.CharField()


class SupportTicketAdminUpdateSerializer(serializers.Serializer):
    """Admin advances a ticket through the UI's status values (open→pending→resolved)."""

    status = serializers.ChoiceField(choices=SupportTicket.Status.values)
