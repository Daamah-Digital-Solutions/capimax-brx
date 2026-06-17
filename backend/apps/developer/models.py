"""
Property Developer onboarding domain — Phase 8 Wave A (DEVELOPER_SURFACE.md; SPEC §3.0).

This wave builds DEVELOPER ENTITY VERIFICATION ONLY: a user who self-registers with
role=developer (RegisterRole.tsx "Developer" card → ?role=developer) completes a
business KYB via Sumsub (a SEPARATE business level from the owner and LP) and becomes
an activated developer. It mirrors the OWNER KYB flow (apps/owner) exactly — which
itself mirrored the LP — so the same automation holds: KYB GREEN → developer approved
→ role_status flipped ACTIVE, no admin in the normal path.

WHY a SEPARATE model (not merged into OwnerProfile): developer and owner are SEPARATE
self-selectable roles (?role=developer vs ?role=owner; core.Profile.Role) and the
product owner locked them as distinct verifications (DEVELOPER_SURFACE.md §5 Q2). The
DeveloperProfile REUSES OwnerProfile's KYB shape/plumbing — same status machine, same
Sumsub-level routing, same approval hinge pattern — kept DRY by following the identical
service/serializer/view patterns rather than copy-pasting business logic.

DELIBERATELY NOT HERE (later waves, which REUSE apps/owner):
  * Property submission intake — the SAME SubmitProperty.tsx wizard + PropertySubmission
    (apps/owner); the submission gate will accept an approved developer OR owner.
  * Review → publish (admin assigns an under-construction model; submitted_by=developer).
  * Developer earnings — the SAME lump primary-sale credit as the owner (NO staged
    funding / milestone engine; the frontend has none — DEVELOPER_SURFACE.md §3, §5 Q1).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class DeveloperStatus(models.TextChoices):
    # Mirrors OwnerStatus — the authoritative developer capability gate
    # (HasActivatedDeveloper).
    PENDING = "pending", _("Pending")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")
    SUSPENDED = "suspended", _("Suspended")


class DeveloperKYBStatus(models.TextChoices):
    # Mirrors OwnerKYBStatus exactly (the KYB machine).
    NOT_STARTED = "not_started", _("Not started")
    DOCUMENTS_PENDING = "documents_pending", _("Documents pending")
    UNDER_REVIEW = "under_review", _("Under review")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")


class DeveloperProfile(models.Model):
    """
    A property developer's entity-verification profile + KYB state (Phase 8 Wave A).

    OneToOne with the user (related_name="developer_profile") so the gate resolves
    `request.user.developer_profile` (core.permissions.HasActivatedDeveloper) and one-
    developer-per-user holds at the DB level. Field shape mirrors OwnerProfile's KYB
    block (apps/owner/models.py) so the automation + admin patterns are identical. NO
    staged-funding / milestone fields (the frontend has none).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="developer_profile",
    )

    # Contact / application (the developer applies with their entity contact details).
    company_name = models.CharField(max_length=255, blank=True, null=True)
    contact_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True, null=True)
    country = models.CharField(max_length=120, blank=True, null=True)

    status = models.CharField(
        max_length=12, choices=DeveloperStatus.choices, default=DeveloperStatus.PENDING,
        db_index=True,
    )
    applied_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, null=True)

    # KYB block (business verification). The automation hinge flips these.
    kyb_status = models.CharField(
        max_length=20, choices=DeveloperKYBStatus.choices,
        default=DeveloperKYBStatus.NOT_STARTED, db_index=True,
    )
    business_type = models.CharField(max_length=64, blank=True, null=True)
    business_registration_number = models.CharField(max_length=120, blank=True, null=True)
    tax_id = models.CharField(max_length=120, blank=True, null=True)
    business_address = models.CharField(max_length=500, blank=True, null=True)
    business_description = models.TextField(blank=True, null=True)

    # Sumsub linkage (blank until configured + an applicant is created). The webhook
    # finds this record by applicantId; the KYB applicant is a DEVELOPER-business level
    # one (SUMSUB_DEVELOPER_KYB_LEVEL_NAME) — distinct from the owner's and LP's levels.
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
        db_table = "developer_profiles"
        verbose_name = _("developer profile")
        verbose_name_plural = _("developer profiles")
        ordering = ("-created_at",)

    def __str__(self):
        return f"Developer[{self.status}] {self.user_id}"

    @property
    def is_approved(self) -> bool:
        return self.status == DeveloperStatus.APPROVED

    # --- state transitions (the only places status changes) ------------------ #
    def mark_kyb_submitted(self):
        """Advance KYB to `under_review` unless already approved (KYB is one-time)."""
        if self.kyb_status == DeveloperKYBStatus.APPROVED:
            return
        self.kyb_status = DeveloperKYBStatus.UNDER_REVIEW
        if self.kyb_submitted_at is None:
            self.kyb_submitted_at = timezone.now()

    def mark_approved(self, *, review_answer: str = ""):
        """KYB GREEN → developer approved. Idempotent."""
        self.status = DeveloperStatus.APPROVED
        self.approved_at = self.approved_at or timezone.now()
        self.rejection_reason = None
        self.kyb_status = DeveloperKYBStatus.APPROVED
        self.kyb_approved_at = self.kyb_approved_at or timezone.now()
        self.kyb_rejection_reason = None
        if review_answer:
            self.sumsub_review_answer = review_answer

    def mark_rejected(self, *, reason: str = "", review_answer: str = ""):
        """KYB RED → developer rejected."""
        self.status = DeveloperStatus.REJECTED
        self.rejected_at = timezone.now()
        self.kyb_status = DeveloperKYBStatus.REJECTED
        self.kyb_rejected_at = timezone.now()
        self.kyb_rejection_reason = (reason or "")[:500]
        self.rejection_reason = (reason or "")[:500]
        if review_answer:
            self.sumsub_review_answer = review_answer
