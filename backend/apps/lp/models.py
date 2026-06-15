"""
Liquidity Provider (LP) onboarding domain — Phase 6 Wave 1 (SPEC §3.8).

These models back the LP onboarding journey the frontend already drives
(src/hooks/useLiquidityProvider.ts + src/pages/LiquidityProvider.tsx):
apply → KYB (business verification) → approved LP with a balance "wallet",
transactions, and documents. Field names mirror the frontend interfaces EXACTLY
(the frontend is the source of truth) so the hook/page render unchanged.

AUTOMATION-FIRST: LP activation is automatic via Sumsub KYB (business level),
exactly like investor KYC — KYB GREEN → LP approved, no manual approval. The
`kyb_status` machine matches Supabase (`not_started|documents_pending|under_review
|approved|rejected`). Approval is the single hinge `services.approve_kyb`.

NOTE: the LP secondary market (`lp_holdings` / `lp_market_listings`) is the NEXT
wave (SPEC §3.8 last two models / §7C.1) and is deliberately NOT built here.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class LPStatus(models.TextChoices):
    # Matches the frontend `LiquidityProvider.status` union + SPEC §3.8.
    PENDING = "pending", _("Pending")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")
    SUSPENDED = "suspended", _("Suspended")


class KYBStatus(models.TextChoices):
    # Matches the frontend `kyb_status` union + Supabase enum (SPEC §3.8).
    NOT_STARTED = "not_started", _("Not started")
    DOCUMENTS_PENDING = "documents_pending", _("Documents pending")
    UNDER_REVIEW = "under_review", _("Under review")
    APPROVED = "approved", _("Approved")
    REJECTED = "rejected", _("Rejected")


class LiquidityProvider(models.Model):
    """
    A user's LP profile + balance wallet + KYB state (SPEC §3.8;
    src/hooks/useLiquidityProvider.ts `LiquidityProvider`).

    OneToOne with the user (related_name="liquidity_provider") so the gate resolves
    `request.user.liquidity_provider` (core.permissions.HasActivatedLP) and the
    frontend's `.maybeSingle()` semantics (one LP per user) hold at the DB level.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="liquidity_provider",
    )

    # Contact / application (frontend RegistrationData).
    company_name = models.CharField(max_length=255, blank=True, null=True)
    contact_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True, null=True)
    country = models.CharField(max_length=120, blank=True, null=True)
    investment_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    status = models.CharField(
        max_length=12, choices=LPStatus.choices, default=LPStatus.PENDING, db_index=True
    )
    applied_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=500, blank=True, null=True)

    # Payout details (set later via PATCH; never required to apply).
    bank_name = models.CharField(max_length=255, blank=True, null=True)
    bank_account_number = models.CharField(max_length=64, blank=True, null=True)
    bank_iban = models.CharField(max_length=64, blank=True, null=True)
    bank_swift = models.CharField(max_length=32, blank=True, null=True)
    crypto_wallet_address = models.CharField(max_length=128, blank=True, null=True)
    crypto_network = models.CharField(max_length=64, blank=True, null=True)

    # Balances (the LP "wallet"). Driven by transactions/earnings in later waves.
    total_deposited = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_withdrawn = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total_earnings = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    current_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    # KYB block (business verification). The automation hinge flips these.
    kyb_status = models.CharField(
        max_length=20, choices=KYBStatus.choices, default=KYBStatus.NOT_STARTED,
        db_index=True,
    )
    business_type = models.CharField(max_length=64, blank=True, null=True)
    business_registration_number = models.CharField(max_length=120, blank=True, null=True)
    tax_id = models.CharField(max_length=120, blank=True, null=True)
    business_address = models.CharField(max_length=500, blank=True, null=True)
    business_description = models.TextField(blank=True, null=True)
    annual_revenue = models.CharField(max_length=64, blank=True, null=True)
    source_of_funds = models.CharField(max_length=64, blank=True, null=True)

    # Sumsub linkage (blank until configured + an applicant is created). The webhook
    # finds this record by applicantId; the KYB applicant is a BUSINESS-level one.
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
        db_table = "liquidity_providers"
        verbose_name = _("liquidity provider")
        verbose_name_plural = _("liquidity providers")
        ordering = ("-created_at",)

    def __str__(self):
        return f"LP[{self.status}] {self.user_id}"

    @property
    def is_approved(self) -> bool:
        return self.status == LPStatus.APPROVED

    # --- state transitions (the only places status changes) ------------------ #
    def mark_kyb_submitted(self):
        """Advance KYB to `under_review` unless already approved (KYB is one-time)."""
        if self.kyb_status == KYBStatus.APPROVED:
            return
        self.kyb_status = KYBStatus.UNDER_REVIEW
        if self.kyb_submitted_at is None:
            self.kyb_submitted_at = timezone.now()

    def mark_approved(self, *, review_answer: str = ""):
        """KYB GREEN → LP approved. Idempotent."""
        self.status = LPStatus.APPROVED
        self.approved_at = self.approved_at or timezone.now()
        self.rejection_reason = None
        self.kyb_status = KYBStatus.APPROVED
        self.kyb_approved_at = self.kyb_approved_at or timezone.now()
        self.kyb_rejection_reason = None
        if review_answer:
            self.sumsub_review_answer = review_answer

    def mark_rejected(self, *, reason: str = "", review_answer: str = ""):
        """KYB RED → LP rejected."""
        self.status = LPStatus.REJECTED
        self.rejected_at = timezone.now()
        self.kyb_status = KYBStatus.REJECTED
        self.kyb_rejected_at = timezone.now()
        self.kyb_rejection_reason = (reason or "")[:500]
        self.rejection_reason = (reason or "")[:500]
        if review_answer:
            self.sumsub_review_answer = review_answer


class LPTransaction(models.Model):
    """LP ledger entry — deposits/withdrawals/earnings (SPEC §3.8; frontend `LPTransaction`)."""

    class TxStatus(models.TextChoices):
        PENDING = "pending", _("Pending")
        PROCESSING = "processing", _("Processing")
        COMPLETED = "completed", _("Completed")
        FAILED = "failed", _("Failed")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lp = models.ForeignKey(
        LiquidityProvider, on_delete=models.CASCADE, related_name="transactions"
    )
    tx_type = models.CharField(max_length=32)  # e.g. "withdrawal" | "deposit" | "earnings"
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=8, default="USD")
    status = models.CharField(
        max_length=12, choices=TxStatus.choices, default=TxStatus.PENDING
    )
    withdrawal_method = models.CharField(max_length=16, blank=True, null=True)  # bank|crypto
    bank_reference = models.CharField(max_length=120, blank=True, null=True)
    crypto_tx_hash = models.CharField(max_length=120, blank=True, null=True)
    notes = models.CharField(max_length=500, blank=True, null=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lp_transactions"
        verbose_name = _("LP transaction")
        verbose_name_plural = _("LP transactions")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.tx_type} {self.amount} {self.currency} ({self.lp_id})"


class LPDocument(models.Model):
    """
    LP document or shared template (SPEC §3.8; frontend `LPDocument`). Mirrors the
    owner-document storage pattern: the file is stored server-side and surfaced via
    a `file_path` + an owner-only download endpoint (the frontend downloads a blob).
    `is_template=True` rows are shared (visible to every LP) and have no owner `lp`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lp = models.ForeignKey(
        LiquidityProvider, on_delete=models.CASCADE, related_name="documents",
        null=True, blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="lp_documents", null=True, blank=True,
    )
    document_name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=64)
    file = models.FileField(upload_to="lp_documents/%Y/%m/", null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    is_template = models.BooleanField(default=False)
    uploaded_by = models.CharField(max_length=32, default="user")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lp_documents"
        verbose_name = _("LP document")
        verbose_name_plural = _("LP documents")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.document_name} ({self.document_type})"


class LPKYBDocument(models.Model):
    """KYB verification document (SPEC §3.8). Uploaded during the KYB step."""

    class DocStatus(models.TextChoices):
        PENDING = "pending", _("Pending")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lp = models.ForeignKey(
        LiquidityProvider, on_delete=models.CASCADE, related_name="kyb_documents"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="lp_kyb_documents",
    )
    document_name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=64)
    file = models.FileField(upload_to="lp_kyb_documents/%Y/%m/", null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=12, choices=DocStatus.choices, default=DocStatus.PENDING
    )
    rejection_reason = models.CharField(max_length=500, blank=True, null=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lp_kyb_documents"
        verbose_name = _("LP KYB document")
        verbose_name_plural = _("LP KYB documents")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.document_name} [{self.status}] ({self.lp_id})"


# --------------------------------------------------------------------------- #
# LP secondary market — Phase 6 Wave 2 (SPEC §3.8; SECONDARY_MARKET_SURFACE.md).
# Investors list ownership tokens; approved LPs buy them; tokens transfer on-chain
# seller→buyer; cash settles against internal balances. One-shot listings (whole
# listing bought atomically) — NOT an order book (that's a later wave).
# --------------------------------------------------------------------------- #
class LPMarketListing(models.Model):
    """
    An investor's (or reselling LP's) offer to sell a block of ownership tokens to an
    approved LP. Field names mirror the frontend `LPMarketListing`
    (src/hooks/useLPMarket.ts): `investor_id` is the SELLER, `lp_id` the BUYER
    (a LiquidityProvider, null until purchased).
    """

    class Status(models.TextChoices):
        LISTED = "listed", _("Listed")
        PENDING = "pending", _("Pending")
        COMPLETED = "completed", _("Completed")
        CANCELLED = "cancelled", _("Cancelled")
        EXPIRED = "expired", _("Expired")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # The SELLER (frontend `investor_id`). Any token holder may list; usually an investor.
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lp_market_listings"
    )
    # The BUYER LP (frontend `lp_id`), null until purchased.
    lp = models.ForeignKey(
        LiquidityProvider, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="purchases",
    )

    property_id = models.CharField(max_length=64, db_index=True)  # Property.slug
    property_name = models.CharField(max_length=200)
    token_symbol = models.CharField(max_length=16)
    token_amount = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=16, decimal_places=2, default=100)
    total_value = models.DecimalField(max_digits=18, decimal_places=2)
    platform_fee_percent = models.DecimalField(max_digits=6, decimal_places=3, default=1)
    platform_fee_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.LISTED, db_index=True
    )
    # The seller's on-chain settlement receipt, recorded only after a confirmed transfer.
    settlement_tx_hash = models.CharField(max_length=66, blank=True, default="")

    listed_at = models.DateTimeField(default=timezone.now)
    purchased_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lp_market_listings"
        verbose_name = _("LP market listing")
        verbose_name_plural = _("LP market listings")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.token_amount} {self.token_symbol} [{self.status}] by {self.seller_id}"


class LPHolding(models.Model):
    """
    An approved LP's purchased position (SPEC §3.8; frontend `LPHolding`,
    src/hooks/useLPHoldings.ts). Created when an LP buys a listing; the underlying
    tokens really sit in the LP's custodial wallet on-chain (also reflected in their
    OwnershipToken). This record carries the LP-market-specific lifecycle (resale).
    """

    class Status(models.TextChoices):
        HELD = "held", _("Held")
        LISTED_LP = "listed_lp", _("Listed (LP)")
        LISTED_SECONDARY = "listed_secondary", _("Listed (secondary)")
        SOLD = "sold", _("Sold")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lp = models.ForeignKey(
        LiquidityProvider, on_delete=models.CASCADE, related_name="holdings"
    )
    listing = models.ForeignKey(
        LPMarketListing, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="resulting_holdings",
    )
    property_id = models.CharField(max_length=64, db_index=True)
    property_name = models.CharField(max_length=200)
    token_symbol = models.CharField(max_length=16)
    token_amount = models.PositiveIntegerField()
    purchase_price = models.DecimalField(max_digits=18, decimal_places=2)
    current_value = models.DecimalField(max_digits=18, decimal_places=2)
    purchase_date = models.DateTimeField(default=timezone.now)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.HELD, db_index=True
    )
    listed_at = models.DateTimeField(null=True, blank=True)
    sold_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lp_holdings"
        verbose_name = _("LP holding")
        verbose_name_plural = _("LP holdings")
        ordering = ("-purchase_date",)

    def __str__(self):
        return f"{self.token_amount} {self.token_symbol} [{self.status}] · LP {self.lp_id}"
