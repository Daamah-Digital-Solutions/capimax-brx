"""
Requests for an extra role (multi-role accounts — see apps/roles/services.py).

Every account starts as an Investor. Property Owner is granted instantly; Broker, Liquidity
Provider, Developer and Strategic Partner are requested with a short form plus documents and
an admin approves or rejects them here ("Role applications" in the Django admin).
"""
import uuid

from django.conf import settings
from django.db import models

from apps.core.private_media import PrivateUpload


class RoleApplication(models.Model):
    class Role(models.TextChoices):
        BROKER = "broker", "Broker"
        LP = "lp", "Liquidity Provider"
        DEVELOPER = "developer", "Developer"
        PARTNER = "partner", "Strategic Partner"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="role_applications"
    )
    role = models.CharField(max_length=12, choices=Role.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    # The form answers (fields depend on the role — services.ROLE_FORMS).
    data = models.JSONField(default=dict, blank=True)
    # Shown to the applicant when rejected.
    review_note = models.CharField(max_length=1000, blank=True, default="")
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="uniq_role_application"),
        ]

    def __str__(self):
        return f"{self.get_role_display()} — {self.user.email} ({self.status})"


class RoleApplicationDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        RoleApplication, on_delete=models.CASCADE, related_name="documents"
    )
    kind = models.CharField(max_length=32)
    file = models.FileField(upload_to=PrivateUpload("role_applications"))
    original_name = models.CharField(max_length=255, blank=True, default="")
    size = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind"]
        constraints = [
            models.UniqueConstraint(fields=["application", "kind"], name="uniq_role_application_doc"),
        ]

    def __str__(self):
        return f"{self.kind}: {self.original_name}"
