"""Support routes — mounted at /api/support/ (see config/urls.py)."""
from django.urls import path

from .views import (
    SupportTicketAdminView,
    SupportTicketDetailView,
    SupportTicketReplyView,
    SupportTicketsView,
)

app_name = "support"

urlpatterns = [
    path("tickets/", SupportTicketsView.as_view(), name="support-tickets"),
    path("tickets/<uuid:ticket_id>/", SupportTicketDetailView.as_view(), name="support-ticket-detail"),
    path("tickets/<uuid:ticket_id>/messages/", SupportTicketReplyView.as_view(), name="support-ticket-reply"),
    path("admin/tickets/<uuid:ticket_id>/", SupportTicketAdminView.as_view(), name="support-ticket-admin"),
]
