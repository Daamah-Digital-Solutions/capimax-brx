"""
Broker onboarding domain — Phase 12 Wave A (BROKER_SURFACE.md §1/§4 + the verification
analysis). The broker is a REFERRAL-COMMISSION agent (a MONEY-earning role), but THIS
wave builds ONLY verification + referral attribution — NO commission/money is computed or
credited here (that is Wave B).

HYBRID verification (the locked decision):
  * IDENTITY is verified by the EXISTING investor personal-KYC path (apps/kyc.UserKYC —
    role-agnostic — flowing through the shared Sumsub webhook's investor FALLBACK
    resolver). The broker submits personal KYC at the investor level; we do NOT add a 6th
    KYB webhook resolver and do NOT extend the webhook (broker is personal KYC, not
    business KYB).
  * LICENSE + broker data live here on `BrokerProfile`. The broker uploads a professional
    licence document; an ADMIN reviews + approves it (Sumsub does not verify licences).

ACTIVATION HINGE (services.approve_license): the admin approves the licence ONLY when the
broker's UserKYC is already approved; that approval flips `Profile.role_status` → ACTIVE
(when role == broker). This is the sanctioned admin step — it mirrors the owner-publish /
partner directory-approval pattern, layered on personal KYC instead of business KYB.

REFERRAL ATTRIBUTION: each broker owns a unique `referral_code` → a link `/ref/<code>`. An
investor who registers via that link is PERMANENTLY linked to the broker via
`core.Profile.referred_by_broker` (set ONCE at registration, never reassigned — first
broker wins). That durable link is what Wave B's commission will read.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class BrokerStatus(models.TextChoices):
    # The broker's overall approval state, driven by the LICENCE-approval hinge (the
    # admin can only approve once UserKYC identity is already approved). Mirrors
    # OwnerStatus' shape so the admin/permission patterns are identical.
    PENDING = "pending", _("Pending")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")
    SUSPENDED = "suspended", _("Suspended")


def generate_referral_code() -> str:
    """
    A unique, human-shareable referral code (the mock's `BROKER123` form). Uppercase
    `BRK` + 6 hex chars from a uuid4. Loops until unique (collisions are vanishingly
    unlikely but we guarantee it).
    """
    while True:
        code = "BRK" + uuid.uuid4().hex[:6].upper()
        if not BrokerProfile.objects.filter(referral_code=code).exists():
            return code


class BrokerProfile(models.Model):
    """
    A broker's licence-verification profile + referral identity (Phase 12 Wave A).

    OneToOne with the user (related_name="broker_profile") so the gate resolves
    `request.user.broker_profile` (core.permissions.HasActivatedBroker) and one-broker-
    per-user holds at the DB level. IDENTITY is NOT stored here — it lives on the shared
    `UserKYC` record (related_name="kyc"); this profile carries only the licence, the
    referral code, and (defined-but-unused-this-wave) commission accumulators.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="broker_profile",
    )

    # Contact / application (the broker applies with their contact details).
    contact_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True, null=True)

    status = models.CharField(
        max_length=12, choices=BrokerStatus.choices, default=BrokerStatus.PENDING,
        db_index=True,
    )
    applied_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    # --- Professional licence (admin-reviewed; the sanctioned hinge) ---------- #
    license_number = models.CharField(max_length=120, blank=True, null=True)
    license_authority = models.CharField(max_length=255, blank=True, null=True)
    license_expiry = models.DateField(null=True, blank=True)
    license_document = models.FileField(
        upload_to="broker_licenses/%Y/%m/", null=True, blank=True
    )
    license_submitted_at = models.DateTimeField(null=True, blank=True)
    license_reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.CharField(max_length=500, blank=True, null=True)

    # --- Referral identity ---------------------------------------------------- #
    # Unique, auto-generated on first save. The basis of `/ref/<code>` attribution.
    referral_code = models.CharField(
        max_length=16, unique=True, blank=True, db_index=True
    )

    # --- Commission accumulators (Wave B) ------------------------------------- #
    # DEFINED now so the schema is stable, but NEVER written this wave — Wave A is
    # verification + attribution only (locked decision #5). Wave B credits commission
    # (default 5%, PLATFORM-borne, on a referred investor's completed primary sale, at
    # the mint/settlement point, idempotent, via UserBalance/Withdrawal).
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=5,
        help_text="Percent commission (Wave B). Default 5%.",
    )
    total_commission_earned = models.DecimalField(
        max_digits=18, decimal_places=2, default=0
    )
    pending_commission = models.DecimalField(
        max_digits=18, decimal_places=2, default=0
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "broker_profiles"
        verbose_name = _("broker profile")
        verbose_name_plural = _("broker profiles")
        ordering = ("-created_at",)

    def __str__(self):
        return f"Broker[{self.status}] {self.user_id}"

    def save(self, *args, **kwargs):
        # Auto-assign a unique referral code on first save (idempotent thereafter).
        if not self.referral_code:
            self.referral_code = generate_referral_code()
        super().save(*args, **kwargs)

    @property
    def is_approved(self) -> bool:
        return self.status == BrokerStatus.APPROVED

    @property
    def referral_link(self) -> str:
        """Relative share path; the frontend prepends the origin (`/ref/<code>`)."""
        return f"/ref/{self.referral_code}"

    # --- state transitions (the only places status changes) ------------------ #
    def mark_license_submitted(self):
        """Record licence submission. Status stays PENDING (admin approves the hinge)."""
        if self.license_submitted_at is None:
            self.license_submitted_at = timezone.now()

    def mark_approved(self):
        """Licence approved by the admin (gated on KYC). Idempotent."""
        self.status = BrokerStatus.APPROVED
        self.approved_at = self.approved_at or timezone.now()
        self.license_reviewed_at = timezone.now()
        self.review_notes = None

    def mark_rejected(self, *, notes: str = ""):
        """Licence rejected by the admin."""
        self.status = BrokerStatus.REJECTED
        self.rejected_at = timezone.now()
        self.license_reviewed_at = timezone.now()
        self.review_notes = (notes or "")[:500]
