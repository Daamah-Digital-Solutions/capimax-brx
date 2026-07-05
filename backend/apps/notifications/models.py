"""
In-app notifications domain — Phase 10 (NOTIFICATIONS_SURFACE.md).

A Notification is an informational, in-app message emitted server-side at an existing
user-facing event point (KYC/KYB approved, mint complete, distribution credited, etc.).

DESIGN (locked): we store a TYPE (enum) + a small JSON `params` dict + an `action_url`
— NEVER display strings. The frontend renders the EN/AR copy from its i18n layer keyed
by `type`, interpolating `params` (same approach used repointing Distributions — Arabic
stays in `t()`). This keeps the backend language-agnostic.

In-app ONLY (no email/SMS/push/digest). Per-type PREFERENCES are modelled
(NotificationPreference, below): the frontend's 7 per-type toggles now persist and
gate `notify()`. The channel (email/SMS) + digest toggles stay UI-only "Coming soon"
(no mailer/SMS/scheduler exists — external/deferred, like the payment providers).
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
        # Broker commission (Phase 12 Wave B). Money-in: a referred investor's primary
        # sale settled → the broker is credited commission. params.amount/property.
        BROKER_COMMISSION_CREDITED = "broker_commission_credited", _("Broker commission credited")
        # Installments (Wave C). A confirmed scheduled installment cleared → released
        # tokens grow. params.sequence/total/released/tokens/property.
        INSTALLMENT_PAID = "installment_paid", _("Installment paid")
        # Installments (Wave D). A plan defaulted (missed payment past grace): the investor
        # KEEPS their paid tokens; unpaid tokens are forfeited. params.kept/forfeited/property.
        INSTALLMENT_DEFAULTED = "installment_defaulted", _("Installment plan defaulted")
        # Nova certificate (sukuk) payment rejected by the admin. params.property/slug/reason.
        # (Approval reuses INVESTMENT_MINTED — the investment settles like any completed buy.)
        SUKUK_REJECTED = "sukuk_rejected", _("Nova certificate rejected")

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


class NotificationPreference(models.Model):
    """
    Per-user in-app notification preferences — one row per user (singleton-per-user via
    OneToOne pk + `get_for`). The 7 boolean fields MATCH the frontend's settings column
    EXACTLY (src/pages/Notifications.tsx:30-38), including the defaults: every category
    defaults ON except `price_alerts` (priceAlerts=false in the UI preset).

    `notify()` reads these before creating an in-app row: if the user disabled the
    category that a notification's type maps to, the notification is skipped for them
    (apps/notifications/services.TYPE_PREF_KEY). Types with NO matching toggle (money-in,
    workflow, etc.) are NEVER gated — they always deliver (default-enabled).

    Only IN-APP delivery is real; the UI's channel (email/SMS) + digest toggles are NOT
    modelled here (no mailer/SMS/scheduler — shown disabled "Coming soon").
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
        primary_key=True,
    )
    # The 7 UI toggles (snake_case here; the serializer exposes the UI's camelCase keys).
    distributions = models.BooleanField(default=True)
    installments = models.BooleanField(default=True)
    new_properties = models.BooleanField(default=True)     # UI: newProperties
    reports = models.BooleanField(default=True)
    price_alerts = models.BooleanField(default=False)      # UI: priceAlerts (preset OFF)
    market_updates = models.BooleanField(default=True)     # UI: marketUpdates
    security = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification_preferences"
        verbose_name = _("notification preference")
        verbose_name_plural = _("notification preferences")

    @classmethod
    def get_for(cls, user):
        """Return the user's preferences, creating them (with the UI defaults) on first access."""
        obj, _created = cls.objects.get_or_create(user=user)
        return obj

    def __str__(self):
        return f"NotificationPreference[{self.user_id}]"
