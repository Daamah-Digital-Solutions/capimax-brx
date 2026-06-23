"""
Support / tickets domain — the backend the existing `Support.tsx` UI already lays out.

FOLLOW-THE-FRONTEND: every choice here mirrors the page EXACTLY (it was 100% mock):
  * category options  → the New-Ticket form's <select> (investment/payments/account/
    technical/other);
  * priority options  → the form's <select> (low/medium/high);
  * status values     → the Ticket-list badges (open/pending/resolved) — NOTE the UI uses
    "pending", not "in_progress", so we follow the UI;
  * human ref         → "TKT-####" (the list showed TKT-001).

SCOPE (this build): records + self-scoped CRUD ONLY. Everything is SELF-SCOPED to the
submitting user (`SupportTicket.user == request.user`); admins may read any ticket and
advance its status. NO money / chain / PII-file logic. The form's attachment dropzone is
display-only (no <input type=file>), so attachments are NOT wired here (flagged).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class SupportTicket(models.Model):
    """One support ticket raised by a user. Fields mirror the New-Ticket form 1:1."""

    # Form <select> options (Support.tsx category select).
    class Category(models.TextChoices):
        INVESTMENT = "investment", _("Investment")
        PAYMENTS = "payments", _("Payments")
        ACCOUNT = "account", _("Account")
        TECHNICAL = "technical", _("Technical")
        OTHER = "other", _("Other")

    # Form <select> options (Support.tsx priority select).
    class Priority(models.TextChoices):
        LOW = "low", _("Low")
        MEDIUM = "medium", _("Medium")
        HIGH = "high", _("High")

    # Ticket-list badge values (Support.tsx getStatusBadge) — UI shows pending, not in_progress.
    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        PENDING = "pending", _("Pending")
        RESOLVED = "resolved", _("Resolved")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    # Human-readable ref the UI displays (TKT-0001). Auto-assigned on first save.
    reference = models.CharField(max_length=16, unique=True, blank=True)
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=Category.choices)
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.LOW
    )
    details = models.TextField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "support_tickets"
        verbose_name = _("support ticket")
        verbose_name_plural = _("support tickets")
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        # Assign a unique TKT-#### ref the first time the row is saved. Sequential-ish
        # (count-based) with a unique-guard loop so a collision just advances the number.
        if not self.reference:
            n = SupportTicket.objects.count() + 1
            candidate = f"TKT-{n:04d}"
            while SupportTicket.objects.filter(reference=candidate).exists():
                n += 1
                candidate = f"TKT-{n:04d}"
            self.reference = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} [{self.status}] {self.subject} ({self.user_id})"
