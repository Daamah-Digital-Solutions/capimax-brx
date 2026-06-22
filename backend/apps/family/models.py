"""
Family domain — Wave A (FAMILY_SURFACE.md). The LAST Supabase-backed domain, repointed.

A primary investor designates FAMILY MEMBERS, allocates a % of their returns to each, links
the members' bank accounts (PII: MASKED last-4 only), and configures transfer schedules.

WAVE A SCOPE = records + allocation config ONLY. There is deliberately NO money movement, NO
token transfer, NO bank payout, and NO distribution skim in this wave:
  * members are PASSIVE SUB-RECORDS — no FK to a real User, no KYC, no wallet (whether they
    become real users gates later waves — a deferred product decision);
  * a `FamilyTransaction` is an ACTIVITY LOG row only — creating a "transfer" records intent,
    it never debits/credits a balance, moves a token, or creates a Withdrawal;
  * `total_transferred` stays 0 and bank `is_verified` stays False this wave (nothing executes).
Everything is SELF-SCOPED to the primary investor (`FamilyAccount.investor == request.user`).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class FamilyAccountStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    ACTIVE = "active", _("Active")
    SUSPENDED = "suspended", _("Suspended")


class FamilyAccessLevel(models.TextChoices):
    VIEW_ONLY = "view_only", _("View only")
    AUTHORIZED = "authorized", _("Authorized")


class FamilyAccount(models.Model):
    """
    One family MEMBER record under a primary investor. The member is a SUB-RECORD this wave
    (name/email/relationship) — NOT a real User (no FK, no login, no KYC, no wallet). The
    `investor` FK is the only link to a real account and is the self-scoping key.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="family_members"
    )
    member_name = models.CharField(max_length=200)
    member_email = models.EmailField()
    relationship = models.CharField(max_length=40)
    status = models.CharField(
        max_length=12, choices=FamilyAccountStatus.choices,
        default=FamilyAccountStatus.ACTIVE, db_index=True,
    )
    access_level = models.CharField(
        max_length=12, choices=FamilyAccessLevel.choices,
        default=FamilyAccessLevel.VIEW_ONLY,
    )
    # The % of the investor's returns earmarked for this member. Σ across a investor's members
    # is validated ≤ 100 (apps/family/services.py). Config only this wave — NO auto-skim hook.
    allocated_returns_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    # Running total actually transferred. Stays 0 in Wave A (nothing executes).
    total_transferred = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    linked_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("family account")
        verbose_name_plural = _("family accounts")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.member_name} ({self.relationship}) of {self.investor_id}"


class FamilyBankAccount(models.Model):
    """
    A member's linked bank account. PII DISCIPLINE: only the MASKED last-4 is ever stored —
    the full account number / IBAN are masked server-side at write time and NEVER persisted.
    `is_verified` is a future per-account check (stays False in Wave A — nothing verifies it).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family_account = models.ForeignKey(
        FamilyAccount, on_delete=models.CASCADE, related_name="bank_accounts"
    )
    bank_name = models.CharField(max_length=120)
    bank_code = models.CharField(max_length=40, blank=True, default="")
    account_holder_name = models.CharField(max_length=200)
    # MASKED ONLY — e.g. "****1234". Never the full number.
    account_number_masked = models.CharField(max_length=20)
    iban_masked = models.CharField(max_length=20, blank=True, default="")
    currency = models.CharField(max_length=8, default="USD")
    is_verified = models.BooleanField(default=False)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("family bank account")
        verbose_name_plural = _("family bank accounts")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.bank_name} {self.account_number_masked} ({self.family_account_id})"


class FamilyScheduleType(models.TextChoices):
    IMMEDIATE = "immediate", _("Immediate")
    WEEKLY = "weekly", _("Weekly")
    MONTHLY = "monthly", _("Monthly")
    QUARTERLY = "quarterly", _("Quarterly")
    THRESHOLD = "threshold", _("Threshold")


class FamilyTransferSchedule(models.Model):
    """Auto-transfer cadence config for a member's bank. CONFIG ONLY — nothing runs it in Wave A."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family_account = models.ForeignKey(
        FamilyAccount, on_delete=models.CASCADE, related_name="schedules"
    )
    bank_account = models.ForeignKey(
        FamilyBankAccount, on_delete=models.CASCADE, related_name="schedules"
    )
    schedule_type = models.CharField(max_length=12, choices=FamilyScheduleType.choices)
    threshold_amount = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True
    )
    next_transfer_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("family transfer schedule")
        verbose_name_plural = _("family transfer schedules")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.schedule_type} → {self.bank_account_id} [{'on' if self.is_active else 'off'}]"


class FamilyTransactionStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    PROCESSING = "processing", _("Processing")
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")


class FamilyTransaction(models.Model):
    """
    Activity-LOG row for a family account (allocation / bank_linked / schedule_created /
    transfer_initiated). RECORD ONLY in Wave A — it NEVER moves money or tokens: a recorded
    "transfer" stays `pending` and is never executed (no balance debit/credit, no on-chain
    transfer, no Withdrawal). `amount` is the recorded intent, not a settled figure.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family_account = models.ForeignKey(
        FamilyAccount, on_delete=models.CASCADE, related_name="transactions"
    )
    bank_account = models.ForeignKey(
        FamilyBankAccount, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="transactions",
    )
    transaction_type = models.CharField(max_length=32)
    amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="USD")
    status = models.CharField(
        max_length=12, choices=FamilyTransactionStatus.choices,
        default=FamilyTransactionStatus.PENDING,
    )
    reference_number = models.CharField(max_length=64, blank=True, default="")
    description = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    # The primary investor who initiated the record (members aren't users this wave).
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="family_transactions_initiated",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("family transaction")
        verbose_name_plural = _("family transactions")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.transaction_type} {self.amount or ''} [{self.status}] ({self.family_account_id})"
