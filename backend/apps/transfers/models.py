"""
Moving property units or wallet money to another person without a sale.

One record — `UnitTransfer` — covers the three ways it happens:

  gift      an investor gives units or an amount to anyone, by email, now or on a date.
  family    an investor moves units or an amount to one of their family members.
  estate    after an approved inheritance claim, the holder's free units and wallet are
            split among their beneficiaries (EstateClaim).

What is given is held from the moment it is scheduled — units are locked in the sender's
position, an amount leaves their wallet — so it can't be spent twice. It reaches the
recipient only once they have a verified email and approved KYC; until then it waits, and
it's handed over automatically as soon as they verify. A gift or family transfer that is
cancelled, expires unclaimed, or fails returns everything to the sender.
"""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.private_media import PrivateUpload


def _claim_upload_to(instance, filename):
    # Kept for migration 0002; new uploads use PrivateUpload (apps/core/private_media.py).
    import os

    ext = os.path.splitext(filename or "")[1].lower()[:8]
    return f"estate_claims/{uuid.uuid4().hex}{uuid.uuid4().hex}{ext}"


class UnitTransfer(models.Model):
    class Kind(models.TextChoices):
        GIFT = "gift", "Gift"
        FAMILY = "family", "Family transfer"
        ESTATE = "estate", "Inheritance"

    class Asset(models.TextChoices):
        UNITS = "units", "Property units"
        CASH = "cash", "Wallet amount"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"          # held; goes out on deliver_on
        WAITING = "waiting", "Waiting for recipient"  # due, but the recipient isn't verified yet
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled — returned"
        EXPIRED = "expired", "Expired — returned"
        FAILED = "failed", "Failed — returned"

    OPEN = (Status.SCHEDULED, Status.WAITING)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    asset = models.CharField(max_length=10, choices=Asset.choices)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="transfers_sent"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name="transfers_received",
    )
    recipient_email = models.EmailField()
    recipient_name = models.CharField(max_length=120, blank=True, default="")
    property_slug = models.CharField(max_length=255, blank=True, default="")
    property_name = models.CharField(max_length=255, blank=True, default="")
    token_symbol = models.CharField(max_length=32, blank=True, default="")
    units = models.PositiveIntegerField(default=0)
    # Cash: the amount given. Units: their value at the sender's average cost (the
    # recipient's cost basis), for display and records only.
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    fee_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    message = models.CharField(max_length=500, blank=True, default="")
    occasion = models.CharField(max_length=40, blank=True, default="")
    deliver_on = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED)
    family_account = models.ForeignKey(
        "family.FamilyAccount", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="unit_transfers",
    )
    estate_claim = models.ForeignKey(
        "transfers.EstateClaim", on_delete=models.PROTECT, null=True, blank=True,
        related_name="transfers",
    )
    reference = models.CharField(max_length=20, unique=True)
    tx_hash = models.CharField(max_length=120, blank=True, default="")
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    invited_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    closed_reason = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "deliver_on"]),
            models.Index(fields=["recipient_email", "status"]),
        ]

    def __str__(self):
        return f"{self.reference} {self.kind} → {self.recipient_email} ({self.status})"


class Beneficiary(models.Model):
    """Who inherits a holder's units and wallet, and in what share (all shares ≤ 100%)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    holder = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="beneficiaries"
    )
    full_name = models.CharField(max_length=120)
    email = models.EmailField()
    relationship = models.CharField(max_length=40, blank=True, default="")
    percent = models.DecimalField(max_digits=5, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(fields=["holder", "email"], name="uniq_beneficiary_email"),
        ]

    def __str__(self):
        return f"{self.full_name} {self.percent}% of {self.holder_id}"


class EstateCertificate(models.Model):
    """The holder's beneficiary designation, numbered CPB-XXXX-XXXX. A claimant quotes it."""

    holder = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="estate_certificate"
    )
    number = models.CharField(max_length=20, unique=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.number


class EstateClaim(models.Model):
    """A beneficiary reports the holder's death; an admin reviews the death certificate."""

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved — estate distributed"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    holder = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="estate_claims"
    )
    claimant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="estate_claims_made"
    )
    certificate_number = models.CharField(max_length=20)
    death_certificate = models.FileField(upload_to=PrivateUpload("estate_claims"))
    date_of_death = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=1000, blank=True, default="")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SUBMITTED)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.CharField(max_length=1000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # One open claim per holder at a time.
            models.UniqueConstraint(
                fields=["holder"], condition=Q(status="submitted"), name="uniq_open_estate_claim",
            ),
        ]

    def __str__(self):
        return f"Claim on {self.certificate_number} ({self.status})"
