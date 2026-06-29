"""
Property Owner onboarding domain — Phase 7 Wave A (OWNER_SURFACE.md; SPEC §3.12).

This wave builds OWNER ENTITY VERIFICATION ONLY: a user who self-registers with
role=owner (RegisterRole.tsx "Property Owner" card → ?role=owner) completes a
business KYB via Sumsub (a SEPARATE business level from the LP) and becomes an
activated owner. It mirrors the LP KYB flow (apps/lp) exactly so the same automation
holds: KYB GREEN → owner approved → role_status flipped ACTIVE, no admin in the
normal path.

DELIBERATELY NOT HERE (later waves):
  * Property submission intake (SubmitProperty.tsx made real) + per-PROPERTY title
    deeds. The frontend "KYB + Title Docs" card splits into entity-KYB (here) and a
    per-property title deed collected AT SUBMISSION (next wave) — so NO title-doc
    fields live on OwnerProfile.
  * Review → publish pipeline; owner earnings/ledger/payout.
  * The DEVELOPER role (a separate later domain that will reuse this).

OwnerProfile mirrors LiquidityProvider's KYB shape (status + kyb_status machine +
business fields + Sumsub linkage + timestamps), MINUS the LP's investor balance /
payout / market fields (owners don't have an LP wallet here).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class OwnerStatus(models.TextChoices):
    # Mirrors LPStatus — the authoritative owner capability gate (HasActivatedOwner).
    PENDING = "pending", _("Pending")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")
    SUSPENDED = "suspended", _("Suspended")


class OwnerKYBStatus(models.TextChoices):
    # Mirrors LP KYBStatus exactly (the KYB machine).
    NOT_STARTED = "not_started", _("Not started")
    DOCUMENTS_PENDING = "documents_pending", _("Documents pending")
    UNDER_REVIEW = "under_review", _("Under review")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")


class OwnerProfile(models.Model):
    """
    A property owner's entity-verification profile + KYB state (Phase 7 Wave A).

    OneToOne with the user (related_name="owner_profile") so the gate resolves
    `request.user.owner_profile` (core.permissions.HasActivatedOwner) and one-owner-
    per-user holds at the DB level. Field shape mirrors LiquidityProvider's KYB block
    (apps/lp/models.py) so the automation + admin patterns are identical.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owner_profile",
    )

    # Contact / application (the owner applies with their entity contact details).
    company_name = models.CharField(max_length=255, blank=True, null=True)
    contact_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True, null=True)
    country = models.CharField(max_length=120, blank=True, null=True)

    status = models.CharField(
        max_length=12, choices=OwnerStatus.choices, default=OwnerStatus.PENDING,
        db_index=True,
    )
    applied_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, null=True)

    # KYB block (business verification). The automation hinge flips these.
    kyb_status = models.CharField(
        max_length=20, choices=OwnerKYBStatus.choices,
        default=OwnerKYBStatus.NOT_STARTED, db_index=True,
    )
    business_type = models.CharField(max_length=64, blank=True, null=True)
    business_registration_number = models.CharField(max_length=120, blank=True, null=True)
    tax_id = models.CharField(max_length=120, blank=True, null=True)
    business_address = models.CharField(max_length=500, blank=True, null=True)
    business_description = models.TextField(blank=True, null=True)

    # Sumsub linkage (blank until configured + an applicant is created). The webhook
    # finds this record by applicantId; the KYB applicant is an OWNER-business level
    # one (SUMSUB_OWNER_KYB_LEVEL_NAME) — distinct from the LP's KYB level.
    sumsub_applicant_id = models.CharField(
        max_length=64, blank=True, default="", db_index=True
    )
    sumsub_review_answer = models.CharField(max_length=16, blank=True, default="")

    kyb_submitted_at = models.DateTimeField(null=True, blank=True)
    kyb_approved_at = models.DateTimeField(null=True, blank=True)
    kyb_rejected_at = models.DateTimeField(null=True, blank=True)
    kyb_rejection_reason = models.CharField(max_length=500, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "owner_profiles"
        verbose_name = _("owner profile")
        verbose_name_plural = _("owner profiles")
        ordering = ("-created_at",)

    def __str__(self):
        return f"Owner[{self.status}] {self.user_id}"

    @property
    def is_approved(self) -> bool:
        return self.status == OwnerStatus.APPROVED

    # --- state transitions (the only places status changes) ------------------ #
    def mark_kyb_submitted(self):
        """Advance KYB to `under_review` unless already approved (KYB is one-time)."""
        if self.kyb_status == OwnerKYBStatus.APPROVED:
            return
        self.kyb_status = OwnerKYBStatus.UNDER_REVIEW
        if self.kyb_submitted_at is None:
            self.kyb_submitted_at = timezone.now()

    def mark_approved(self, *, review_answer: str = ""):
        """KYB GREEN → owner approved. Idempotent."""
        self.status = OwnerStatus.APPROVED
        self.approved_at = self.approved_at or timezone.now()
        self.rejection_reason = None
        self.kyb_status = OwnerKYBStatus.APPROVED
        self.kyb_approved_at = self.kyb_approved_at or timezone.now()
        self.kyb_rejection_reason = None
        if review_answer:
            self.sumsub_review_answer = review_answer

    def mark_rejected(self, *, reason: str = "", review_answer: str = ""):
        """KYB RED → owner rejected."""
        self.status = OwnerStatus.REJECTED
        self.rejected_at = timezone.now()
        self.kyb_status = OwnerKYBStatus.REJECTED
        self.kyb_rejected_at = timezone.now()
        self.kyb_rejection_reason = (reason or "")[:500]
        self.rejection_reason = (reason or "")[:500]
        if review_answer:
            self.sumsub_review_answer = review_answer


# --------------------------------------------------------------------------- #
# Property submission intake — Phase 7 Wave B (OWNER_SURFACE.md §2; SPEC §3.12).
# An APPROVED owner submits a property through the 6-step SubmitProperty.tsx wizard.
# This is a STAGING record only — NO catalog Property row is created/published here
# (that is Wave C: review → publish). Fields mirror exactly what the frontend form
# collects; there is intentionally NO investment-model field (the admin assigns the
# model during Wave-C review — the form has no model picker).
# --------------------------------------------------------------------------- #
class SubmissionStatus(models.TextChoices):
    DRAFT = "draft", _("Draft")
    SUBMITTED = "submitted", _("Submitted")
    UNDER_REVIEW = "under_review", _("Under review")  # set by Wave-C review pipeline
    APPROVED = "approved", _("Approved")              # set by Wave-C review pipeline
    REJECTED = "rejected", _("Rejected")              # set by Wave-C review pipeline


class PropertySubmission(models.Model):
    """
    A property an owner has submitted (or is drafting). Field names mirror the
    SubmitProperty.tsx wizard fields EXACTLY (frontend is the source of truth). All
    content fields are blank/nullable so a DRAFT can be saved partially; the
    draft→submitted transition is the only place required-document presence is checked
    (services.submit_submission). NO `Property` is created here.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="property_submissions",
    )

    # Step 1 — Basic info (selectedType / selectedStatus values from the form).
    name = models.CharField(max_length=255, blank=True, default="")
    property_type = models.CharField(max_length=32, blank=True, default="")  # residential|commercial|mixed|industrial|land
    construction_status = models.CharField(max_length=32, blank=True, default="")  # ready|under-construction|off-plan
    description = models.TextField(blank=True, default="")

    # Step 2 — Location. Coordinates are captured by MANUAL entry today (real, persisted);
    # the interactive map PICKER is layered on the frontend but stays inert until a maps
    # provider key lands (Google Maps/Mapbox) — exactly how payment providers defer. Lat
    # ∈ [-90, 90], Lng ∈ [-180, 180]; 6 dp ≈ 0.11 m precision. Nullable (optional + draft).
    country = models.CharField(max_length=120, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    district = models.CharField(max_length=255, blank=True, default="")
    address = models.TextField(blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Step 3 — Financial details.
    property_value_usd = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    min_investment = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    expected_yield = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    duration_years = models.PositiveIntegerField(null=True, blank=True)
    distribution_model = models.CharField(max_length=32, blank=True, default="")  # quarterly|semi-annual|annual

    # Step 5 — Media. Images + video are uploaded as SubmissionDocument rows
    # (document_type image|video — same multipart pattern as the Step-4 documents); the
    # optional virtual-tour link is a real persisted field here.
    virtual_tour_url = models.URLField(max_length=500, blank=True, default="")

    status = models.CharField(
        max_length=16, choices=SubmissionStatus.choices,
        default=SubmissionStatus.DRAFT, db_index=True,
    )
    review_notes = models.TextField(blank=True, default="")  # populated by Wave-C review
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)  # Wave-C: approve/reject time
    # The catalog Property this submission produced on approval (Wave C). NULL until
    # published; the idempotency guard so a submission can never publish twice.
    published_property = models.ForeignKey(
        "properties.Property", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "property_submissions"
        verbose_name = _("property submission")
        verbose_name_plural = _("property submissions")
        ordering = ("-created_at",)

    def __str__(self):
        return f"Submission[{self.status}] {self.name or self.id} ({self.submitter_id})"

    @property
    def is_draft(self) -> bool:
        return self.status == SubmissionStatus.DRAFT


class SubmissionDocument(models.Model):
    """
    A document attached to a property submission — the Step-4 checklist of
    SubmitProperty.tsx (Title Deed [required], Valuation Report [required], Insurance
    Policy, NOC, Financial Statements, Legal Documents [required]). The per-property
    TITLE DEED is `document_type == "title"` (the "Title Docs" requirement). Mirrors
    the LP KYB document pattern (file stored server-side, owner-only download).
    """

    # Mirrors the frontend `requiredDocuments` ids (SubmitProperty.tsx).
    class DocType(models.TextChoices):
        TITLE = "title", _("Title Deed")
        VALUATION = "valuation", _("Valuation Report")
        INSURANCE = "insurance", _("Insurance Policy")
        NOC = "noc", _("NOC")
        FINANCIAL = "financial", _("Financial Statements")
        LEGAL = "legal", _("Legal Documents")
        # Step-5 media — same file-upload pattern, distinct types (NOT required to submit).
        IMAGE = "image", _("Property Image")
        VIDEO = "video", _("Property Video")
        OTHER = "other", _("Other")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        PropertySubmission, on_delete=models.CASCADE, related_name="documents"
    )
    document_type = models.CharField(
        max_length=32, choices=DocType.choices, default=DocType.OTHER
    )
    document_name = models.CharField(max_length=255)
    file = models.FileField(upload_to="submission_documents/%Y/%m/", null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "submission_documents"
        verbose_name = _("submission document")
        verbose_name_plural = _("submission documents")
        ordering = ("-uploaded_at",)

    def __str__(self):
        return f"{self.document_name} [{self.document_type}] ({self.submission_id})"


# Documents that MUST be present before a draft can be submitted (the frontend marks
# these `required: true` in SubmitProperty.tsx Step 4).
REQUIRED_SUBMISSION_DOC_TYPES = (
    SubmissionDocument.DocType.TITLE,
    SubmissionDocument.DocType.VALUATION,
    SubmissionDocument.DocType.LEGAL,
)


# --------------------------------------------------------------------------- #
# Owner ENTITY-KYB document vault — manual-admin-approval support (deploy prep).
# A SEPARATE concern from the per-PROPERTY SubmissionDocument above (title-deed /
# valuation evidence for one property): this is the owner's BUSINESS-verification
# evidence (registration certificate / trade licence / …), uploaded during the KYB
# step so an admin can review it before manually approving KYB when Sumsub is
# deferred. Mirrors apps/lp/models.py LPKYBDocument EXACTLY.
# --------------------------------------------------------------------------- #
class OwnerKYBDocument(models.Model):
    """Owner entity-KYB verification document. Mirrors LPKYBDocument."""

    class DocStatus(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        OwnerProfile, on_delete=models.CASCADE, related_name="kyb_documents"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="owner_kyb_documents",
    )
    document_name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=64)
    file = models.FileField(upload_to="owner_kyb_documents/%Y/%m/", null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=12, choices=DocStatus.choices, default=DocStatus.PENDING
    )
    rejection_reason = models.CharField(max_length=500, blank=True, null=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "owner_kyb_documents"
        verbose_name = _("owner KYB document")
        verbose_name_plural = _("owner KYB documents")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.document_name} [{self.status}] ({self.owner_id})"
