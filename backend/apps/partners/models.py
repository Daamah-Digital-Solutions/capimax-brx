"""
Strategic Partner onboarding domain — Phase 11 Wave A (PARTNERS_SURFACE.md).

A partner is a SERVICE VENDOR (valuation, property management, insurance, …) — a THIN,
NON-EARNING variant of the property owner/developer. This wave builds PARTNER ENTITY
VERIFICATION (business KYB) + the PUBLIC PARTNERS DIRECTORY. It mirrors the OWNER/
DEVELOPER KYB flow (apps/owner, apps/developer) exactly — same status machine, same
Sumsub-level routing, same approval hinge — so the same automation holds: KYB GREEN →
partner activated, no admin in the normal path.

CRITICAL — NO MONEY ANYWHERE. Partners provide services; they never earn on the
platform. There is NO UserBalance, NO withdrawal, NO earnings field in this domain.

TWO INDEPENDENT STATES (PARTNERS_SURFACE.md "Wave detail"):
  * kyb_status / status — the VERIFICATION gate (HasActivatedPartner; gates the Wave B
    work portal). Driven automatically by the signed Sumsub webhook.
  * directory_status — whether the partner appears in the PUBLIC partners directory.
    This is a SEPARATE admin approve/reject step, INDEPENDENT of KYB: a partner can be
    KYB-verified yet not directory-approved, or directory-rejected. The admin's only
    directory action is approve/reject — the PARTNER supplies the directory data, the
    admin never enters it.

DELIBERATELY NOT HERE (Wave B): the assignment/deliverable workflow (admin assigns a
Property→partner with a service type + due date + deliverables; partner uploads via a
SubmissionDocument-style model; admin approves/requests revision).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class PartnerStatus(models.TextChoices):
    # Mirrors DeveloperStatus — the authoritative partner VERIFICATION gate
    # (HasActivatedPartner).
    PENDING = "pending", _("Pending")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")
    SUSPENDED = "suspended", _("Suspended")


class PartnerKYBStatus(models.TextChoices):
    # Mirrors DeveloperKYBStatus exactly (the KYB machine).
    NOT_STARTED = "not_started", _("Not started")
    DOCUMENTS_PENDING = "documents_pending", _("Documents pending")
    UNDER_REVIEW = "under_review", _("Under review")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")


class PartnerDirectoryStatus(models.TextChoices):
    # The SEPARATE public-directory visibility gate (independent of KYB). The public
    # directory endpoint lists ONLY partners with directory_status == APPROVED.
    PENDING = "pending", _("Pending")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")


class PartnerCategory(models.TextChoices):
    # The service categories the public directory (Partners.tsx) groups by.
    DEVELOPERS = "developers", _("Developers")
    HOTELS = "hotels", _("Hotels")
    PROPERTY_MANAGEMENT = "property-management", _("Property Management")
    INSURANCE = "insurance", _("Insurance")
    VALUATION = "valuation", _("Valuation")
    DIGITAL_FINANCE = "digital-finance", _("Digital Finance")


class PartnerProfile(models.Model):
    """
    A strategic partner's entity-verification profile + KYB state + the partner-entered
    public-directory fields (Phase 11 Wave A).

    OneToOne with the user (related_name="partner_profile") so the gate resolves
    `request.user.partner_profile` (core.permissions.HasActivatedPartner) and one-
    partner-per-user holds at the DB level. The KYB block mirrors DeveloperProfile so the
    automation + admin patterns are identical. NO money fields — partners never earn.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="partner_profile",
    )

    # Contact / application (the partner applies with their entity contact details).
    contact_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True, null=True)

    status = models.CharField(
        max_length=12, choices=PartnerStatus.choices, default=PartnerStatus.PENDING,
        db_index=True,
    )
    applied_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, null=True)

    # KYB block (business verification). The automation hinge flips these.
    kyb_status = models.CharField(
        max_length=20, choices=PartnerKYBStatus.choices,
        default=PartnerKYBStatus.NOT_STARTED, db_index=True,
    )
    business_type = models.CharField(max_length=64, blank=True, null=True)
    business_registration_number = models.CharField(max_length=120, blank=True, null=True)
    tax_id = models.CharField(max_length=120, blank=True, null=True)
    business_address = models.CharField(max_length=500, blank=True, null=True)
    business_description = models.TextField(blank=True, null=True)

    # Sumsub linkage (blank until configured + an applicant is created). The webhook
    # finds this record by applicantId; the KYB applicant is a PARTNER-business level
    # one (SUMSUB_PARTNER_KYB_LEVEL_NAME) — distinct from owner/developer/LP levels.
    sumsub_applicant_id = models.CharField(
        max_length=64, blank=True, default="", db_index=True
    )
    sumsub_review_answer = models.CharField(max_length=16, blank=True, default="")

    kyb_submitted_at = models.DateTimeField(null=True, blank=True)
    kyb_approved_at = models.DateTimeField(null=True, blank=True)
    kyb_rejected_at = models.DateTimeField(null=True, blank=True)
    kyb_rejection_reason = models.CharField(max_length=500, blank=True, null=True)

    # --- Public-directory fields (the PARTNER fills these; the admin never does) ----- #
    # These feed the public partners directory (Partners.tsx) when directory_status is
    # APPROVED. Bilingual EN/AR to match the frontend's rendered shape.
    company_name = models.CharField(max_length=255, blank=True, null=True)
    company_name_ar = models.CharField(max_length=255, blank=True, null=True)
    category = models.CharField(
        max_length=32, choices=PartnerCategory.choices, blank=True, null=True
    )
    description = models.TextField(blank=True, null=True)
    description_ar = models.TextField(blank=True, null=True)
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    country = models.CharField(max_length=120, blank=True, null=True)
    country_ar = models.CharField(max_length=120, blank=True, null=True)
    website = models.URLField(max_length=500, blank=True, null=True)

    # The SEPARATE public-directory visibility gate (independent of KYB). The admin's
    # only directory action is approve/reject — never data entry.
    directory_status = models.CharField(
        max_length=12, choices=PartnerDirectoryStatus.choices,
        default=PartnerDirectoryStatus.PENDING, db_index=True,
    )
    directory_reviewed_at = models.DateTimeField(null=True, blank=True)
    directory_review_notes = models.CharField(max_length=500, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "partner_profiles"
        verbose_name = _("partner profile")
        verbose_name_plural = _("partner profiles")
        ordering = ("-created_at",)

    def __str__(self):
        return f"Partner[{self.status}/{self.directory_status}] {self.user_id}"

    @property
    def is_approved(self) -> bool:
        return self.status == PartnerStatus.APPROVED

    @property
    def is_directory_listed(self) -> bool:
        return self.directory_status == PartnerDirectoryStatus.APPROVED

    # --- KYB state transitions (the only places KYB status changes) ----------- #
    def mark_kyb_submitted(self):
        """Advance KYB to `under_review` unless already approved (KYB is one-time)."""
        if self.kyb_status == PartnerKYBStatus.APPROVED:
            return
        self.kyb_status = PartnerKYBStatus.UNDER_REVIEW
        if self.kyb_submitted_at is None:
            self.kyb_submitted_at = timezone.now()

    def mark_approved(self, *, review_answer: str = ""):
        """KYB GREEN → partner approved (verification). Idempotent."""
        self.status = PartnerStatus.APPROVED
        self.approved_at = self.approved_at or timezone.now()
        self.rejection_reason = None
        self.kyb_status = PartnerKYBStatus.APPROVED
        self.kyb_approved_at = self.kyb_approved_at or timezone.now()
        self.kyb_rejection_reason = None
        if review_answer:
            self.sumsub_review_answer = review_answer

    def mark_rejected(self, *, reason: str = "", review_answer: str = ""):
        """KYB RED → partner rejected (verification)."""
        self.status = PartnerStatus.REJECTED
        self.rejected_at = timezone.now()
        self.kyb_status = PartnerKYBStatus.REJECTED
        self.kyb_rejected_at = timezone.now()
        self.kyb_rejection_reason = (reason or "")[:500]
        self.rejection_reason = (reason or "")[:500]
        if review_answer:
            self.sumsub_review_answer = review_answer

    # --- Directory transitions (INDEPENDENT of KYB; admin-only) --------------- #
    def mark_directory_approved(self):
        """Admin approves the public-directory listing (independent of KYB)."""
        self.directory_status = PartnerDirectoryStatus.APPROVED
        self.directory_reviewed_at = timezone.now()
        self.directory_review_notes = None

    def mark_directory_rejected(self, *, notes: str = ""):
        """Admin rejects the public-directory listing (independent of KYB)."""
        self.directory_status = PartnerDirectoryStatus.REJECTED
        self.directory_reviewed_at = timezone.now()
        self.directory_review_notes = (notes or "")[:500]
