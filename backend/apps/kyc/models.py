"""
Investor KYC domain — Phase 4 (SPEC §3.4; DECISIONS.md "Phase 4").

`UserKYC` is the per-user verification record the wallet/invest gate reads. The
canonical status enum (`pending|submitted|approved|rejected`) matches the Supabase
`kyc_status` the frontend already expects (src/hooks/useUserWallet.ts `KycStatus`).

Approval is AUTOMATIC: the Sumsub webhook (or, for DEBUG testing, `dev_grant_kyc` /
`KYC_AUTO_APPROVE`) flips `status` to `approved`, which opens
`core.permissions.KYCApprovedPermission`. No admin sits in the normal path
(DECISIONS.md "Phase 4" #5) — admin is an exception handler only.

KYC is ONE-TIME (no expiry / re-KYC) — DECISIONS.md "Phase 4" #2.

PII: with the Sumsub WebSDK, identity capture/liveness/docs live on Sumsub's side;
the optional personal-info fields here are only what the frontend's submit form
sends. `KYCDocument` exists for the API-fallback path but is secondary (#4).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class KYCStatus(models.TextChoices):
    # Canonical 4-value machine the frontend expects (Supabase kyc_status enum).
    PENDING = "pending", _("Pending")
    SUBMITTED = "submitted", _("Submitted")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")


class UserKYC(models.Model):
    """
    A user's KYC verification state. OneToOne with related_name="kyc" so the gate
    resolves `request.user.kyc` (core.permissions.KYCApprovedPermission). SPEC §3.4.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="kyc",
    )
    status = models.CharField(
        max_length=12, choices=KYCStatus.choices, default=KYCStatus.PENDING, db_index=True
    )

    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, default="")

    # Sumsub linkage (blank until the provider is configured + an applicant is created).
    # `sumsub_applicant_id` is how the webhook finds this record by applicantId.
    sumsub_applicant_id = models.CharField(
        max_length=64, blank=True, default="", db_index=True
    )
    # Raw last review answer for audit (e.g. "GREEN"/"RED"); never gates on its own.
    sumsub_review_answer = models.CharField(max_length=16, blank=True, default="")

    # Optional personal info the frontend submit form may send (minimal PII; Sumsub
    # holds the authoritative identity data). All optional.
    first_name = models.CharField(max_length=120, blank=True, default="")
    last_name = models.CharField(max_length=120, blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=120, blank=True, default="")
    country = models.CharField(max_length=120, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    address = models.CharField(max_length=400, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("user KYC")
        verbose_name_plural = _("user KYC")
        ordering = ("-created_at",)

    def __str__(self):
        return f"KYC[{self.status}] {self.user_id}"

    @property
    def is_approved(self) -> bool:
        return self.status == KYCStatus.APPROVED

    # --- state transitions (the only places status changes) ------------------ #
    def mark_submitted(self):
        """Advance to `submitted` unless already approved (KYC is one-time)."""
        if self.status == KYCStatus.APPROVED:
            return
        self.status = KYCStatus.SUBMITTED
        if self.submitted_at is None:
            self.submitted_at = timezone.now()

    def mark_approved(self, *, review_answer: str = ""):
        self.status = KYCStatus.APPROVED
        self.approved_at = timezone.now()
        self.rejection_reason = ""
        if review_answer:
            self.sumsub_review_answer = review_answer

    def mark_rejected(self, *, reason: str = "", review_answer: str = ""):
        self.status = KYCStatus.REJECTED
        self.rejected_at = timezone.now()
        self.rejection_reason = (reason or "")[:500]
        if review_answer:
            self.sumsub_review_answer = review_answer


class KYCDocument(models.Model):
    """
    Optional/secondary identity document store (SPEC §3.4). With the Sumsub WebSDK
    the documents live on Sumsub; this backs the API-fallback path only and is NOT
    the primary flow (DECISIONS.md "Phase 4" #4).
    """

    class DocumentType(models.TextChoices):
        ID_FRONT = "id_front", _("ID front")
        ID_BACK = "id_back", _("ID back")
        SELFIE = "selfie", _("Selfie")
        PROOF_OF_ADDRESS = "proof_of_address", _("Proof of address")
        COMPANY_DOCS = "company_docs", _("Company documents")

    class DocStatus(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kyc = models.ForeignKey(
        UserKYC, on_delete=models.CASCADE, related_name="documents"
    )
    document_type = models.CharField(max_length=24, choices=DocumentType.choices)
    file = models.FileField(upload_to="kyc_documents/%Y/%m/")
    status = models.CharField(
        max_length=12, choices=DocStatus.choices, default=DocStatus.PENDING
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("KYC document")
        verbose_name_plural = _("KYC documents")
        ordering = ("-uploaded_at",)

    def __str__(self):
        return f"{self.document_type} ({self.kyc_id})"
