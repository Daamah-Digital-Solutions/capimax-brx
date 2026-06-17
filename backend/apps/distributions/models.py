"""
Investor distributions domain — Phase 9 (DISTRIBUTIONS_SURFACE.md; SPEC §3).

A DISTRIBUTION is a periodic CASH yield an admin declares for a property: a money
pool that is split PRO-RATA across the property's current ACTIVE token holders and
credited to each holder's internal `UserBalance` (the same balance stack investors,
LPs and owners already use). This is the read-side that backs the investor
`Distributions.tsx` page (rental/appreciation yield), and is DISTINCT from owner /
developer PRIMARY-SALE earnings (one-time, submitter-credited; apps/investments
`_credit_owner_for_primary_sale`, source="primary_sale").

LOCKED v1 scope (Phase 9):
  * ADMIN declares (sanctioned admin action, like property publication) — no
    owner-funded flow (the frontend has no owner-declare UI).
  * Pro-rata by FULL `token_amount` of ACTIVE holdings (NOT net of `locked_amount`
    — escrow is about tradability, not ownership). Holders are SNAPSHOT at
    declaration time; each payout records the tokens the holder held then.
  * INTERNAL-BALANCE ONLY — credited via wallets.credit_user_balance with a DISTINCT
    source="distribution". NO PropertyToken call, no token transfer, no on-chain move.
  * Credited IMMEDIATELY on declare (status "paid"). NO scheduling/recurrence engine
    (the admin declares each period manually; the frontend Schedule tab just shows
    what's been declared).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Distribution(models.Model):
    """
    One declared distribution: a money pool for a single property + period, split
    across that property's holders at declaration time. Created by the admin declare
    surface (apps/distributions/admin.py) — never by hand or by an API write.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", _("Draft")  # transient: created, before crediting commits
        PAID = "paid", _("Paid")     # credited to all holders (the only investor-visible state)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Property.slug (the frontend string id) + denormalized name — mirrors how
    # OwnershipToken stores property_id/property_name (wallets/models.py:115-116).
    property_id = models.CharField(max_length=64, db_index=True)
    property_name = models.CharField(max_length=200, blank=True, default="")

    # Who declared it. SET_NULL keeps the historical row if the admin is later removed.
    declared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="declared_distributions",
    )

    pool_amount_usd = models.DecimalField(max_digits=18, decimal_places=2)
    # Presentation metadata (frontend Distributions.tsx): `type` is the cadence the
    # investor sees ("monthly" | "quarterly" | …); `period_label` e.g. "Q4 2024".
    dist_type = models.CharField(max_length=32, blank=True, default="")
    period_label = models.CharField(max_length=64, blank=True, default="")
    pay_date = models.DateField()

    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "distributions"
        verbose_name = _("distribution")
        verbose_name_plural = _("distributions")
        ordering = ("-pay_date", "-created_at")

    def __str__(self):
        return f"Distribution[{self.status}] ${self.pool_amount_usd} · {self.property_id}"


class DistributionPayout(models.Model):
    """
    One holder's pro-rata share of a Distribution — the frozen snapshot of what the
    holder held at declaration time + the cash credited to their UserBalance.

    `unique(distribution, user)` is the IDEMPOTENCY anchor: a holder gets exactly one
    payout per distribution, so a re-run of the declare/credit step can never
    double-credit (one user holds at most one ACTIVE position per property — the
    OwnershipToken unique(wallet, property_id) + wallet OneToOne user guarantee it).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    distribution = models.ForeignKey(
        Distribution, on_delete=models.CASCADE, related_name="payouts"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="distribution_payouts"
    )
    # The holding this share derives from (snapshot link). SET_NULL: the payout row is
    # a permanent financial record even if the position is later sold/removed.
    holding = models.ForeignKey(
        "wallets.OwnershipToken", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="distribution_payouts",
    )
    # Frozen at declaration time (never recomputed later).
    tokens_at_snapshot = models.PositiveIntegerField(default=0)
    ownership_pct_at_snapshot = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    share_amount_usd = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    # True once the UserBalance credit has been written (the credit guard).
    credited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "distribution_payouts"
        verbose_name = _("distribution payout")
        verbose_name_plural = _("distribution payouts")
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["distribution", "user"], name="uniq_payout_per_distribution_user"
            )
        ]

    def __str__(self):
        return f"Payout ${self.share_amount_usd} → {self.user_id} ({self.distribution_id})"
