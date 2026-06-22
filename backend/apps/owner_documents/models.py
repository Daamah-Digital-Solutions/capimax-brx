"""
Owner-documents domain — a personal document VAULT, repointed off Supabase
(OWNER_DOCUMENTS.md). Mirrors `apps.lp.LPDocument` (model + views + client) so it
reuses the established FileField pattern — files live under the already-gitignored
`backend/media/owner_documents/%Y/%m/`; nothing new is invented for storage.

SCOPE (this build): records + file storage ONLY. Everything is SELF-SCOPED to the
uploading user (`OwnerDocument.user == request.user`) — an owner only ever sees,
downloads, or deletes their OWN documents.

Deliberately NOT in scope:
  * NO `Property` FK — `property_name` stays a FREE-TEXT label (current frontend
    behaviour; binding to a real property is a deferred product decision);
  * the PropertyDetail "Verify Documents" data-room is a SEPARATE deferred surface
    (`property-documents`) and is NOT wired here — confirmed in OWNER_DOCUMENTS.md;
  * NO money / chain logic of any kind.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class OwnerDocument(models.Model):
    """One file in an owner's personal vault. Mirrors `apps.lp.LPDocument`."""

    # Matches the frontend `documentCategories` ids (OwnerDocuments.tsx).
    class DocType(models.TextChoices):
        OWNERSHIP = "ownership", _("Ownership")
        LEGAL = "legal", _("Legal")
        FINANCIAL = "financial", _("Financial")
        TRANSACTION = "transaction", _("Transaction")
        CERTIFICATE = "certificate", _("Certificate")
        CONTRACT = "contract", _("Contract")
        OTHER = "other", _("Other")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owner_documents",
    )
    document_name = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=32, choices=DocType.choices, default=DocType.OTHER
    )
    # Stored under the gitignored backend/media/ — same convention as kyc/lp/submission docs.
    file = models.FileField(upload_to="owner_documents/%Y/%m/", null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    file_type = models.CharField(max_length=128, blank=True, null=True)
    description = models.CharField(max_length=1000, blank=True, null=True)
    # FREE-TEXT label only (no Property FK this build — keeps current behaviour).
    property_name = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=16, default="active")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "owner_documents"
        verbose_name = _("owner document")
        verbose_name_plural = _("owner documents")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.document_name} [{self.document_type}] ({self.user_id})"
