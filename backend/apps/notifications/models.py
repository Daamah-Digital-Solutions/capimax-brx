"""
In-app notifications domain — Phase 10 (NOTIFICATIONS_SURFACE.md).

A Notification is an informational, in-app message emitted server-side at an existing
user-facing event point (KYC/KYB approved, mint complete, distribution credited, etc.).

DESIGN (locked): we store a TYPE (enum) + a small JSON `params` dict + an `action_url`
— NEVER display strings. The frontend renders the EN/AR copy from its i18n layer keyed
by `type`, interpolating `params` (same approach used repointing Distributions — Arabic
stays in `t()`). This keeps the backend language-agnostic.

In-app ONLY (no email/SMS/push/digest). Preferences are NOT modelled (v1 emits all
events; the frontend's per-type/channel toggles are local-only UI).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Notification(models.Model):
    class Type(models.TextChoices):
        # Verification.
        KYC_APPROVED = "kyc_approved", _("KYC approved")
        KYC_REJECTED = "kyc_rejected", _("KYC rejected")
        KYB_APPROVED = "kyb_approved", _("KYB approved")  # params.role = lp|owner|developer
        KYB_REJECTED = "kyb_rejected", _("KYB rejected")
        # Wallet / investing.
        WALLET_CREATED = "wallet_created", _("Wallet created")
        INVESTMENT_MINTED = "investment_minted", _("Investment minted")
        # Money in.
        EARNINGS_CREDITED = "earnings_credited", _("Primary-sale earnings credited")
        DISTRIBUTION_CREDITED = "distribution_credited", _("Distribution credited")
        SECONDARY_SALE_BUYER = "secondary_sale_buyer", _("Secondary purchase settled")
        SECONDARY_SALE_SELLER = "secondary_sale_seller", _("Secondary sale settled")
        WITHDRAWAL_REQUESTED = "withdrawal_requested", _("Withdrawal requested")
        # Submission review.
        SUBMISSION_PUBLISHED = "submission_published", _("Property submission published")
        SUBMISSION_REJECTED = "submission_rejected", _("Property submission rejected")
        # Partner assignment workflow (Phase 11 Wave B). params.property = property name.
        PARTNER_ASSIGNED = "partner_assigned", _("Assignment received")
        PARTNER_DELIVERABLE_SUBMITTED = "partner_deliverable_submitted", _("Deliverable submitted (to admin)")
        PARTNER_DELIVERABLE_APPROVED = "partner_deliverable_approved", _("Deliverable approved")
        PARTNER_REVISION_REQUESTED = "partner_revision_requested", _("Revision requested")
        PARTNER_ASSIGNMENT_COMPLETED = "partner_assignment_completed", _("Assignment completed")
        # Broker licence verification (Phase 12 Wave A). Identity KYC reuses KYC_APPROVED;
        # these cover the SEPARATE admin licence-approval hinge that activates the role.
        BROKER_LICENSE_APPROVED = "broker_license_approved", _("Broker licence approved")
        BROKER_LICENSE_REJECTED = "broker_license_rejected", _("Broker licence rejected")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=32, choices=Type.choices)
    # Interpolation values for the frontend copy (e.g. {"property": "...", "amount": "980.00"}).
    # JSON-serializable only — money is stored as a string, never a Decimal.
    params = models.JSONField(default=dict, blank=True)
    action_url = models.CharField(max_length=200, blank=True, default="")
    read = models.BooleanField(default=False)
    # Soft delete: the trash action hides the row; it is never hard-deleted.
    deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "notifications"
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["user", "read"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.type} → {self.user_id} ({'read' if self.read else 'unread'})"
