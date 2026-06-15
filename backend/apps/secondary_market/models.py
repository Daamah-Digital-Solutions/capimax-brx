"""
Investor PEER secondary market — Phase 6 Wave 3 (SPEC §3.9; SECONDARY_MARKET_SURFACE.md).

One-shot "buy-now" listings, investor↔investor: a KYC-approved seller lists ownership
tokens at a price; another KYC-approved investor buys the whole listing. Settles via
the internal balance (UserBalance) + a REAL on-chain token transfer seller→buyer,
reusing the LP-market foundation (escrow via OwnershipToken.locked_amount, the
apps.chain transfer, UserBalance debit/credit). This is NOT the bid/ask order book —
that remains a deferred, separately-scoped wave.

Fields mirror the real `secondary_market_listings` schema (§3.9) + the frontend
shapes. `seller_type`/`buyer_type` ∈ investor|lp (an LP may resell here too, via the
LPMarket resale bridge).
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class SecondaryMarketListing(models.Model):
    class Status(models.TextChoices):
        LISTED = "listed", _("Listed")
        PENDING = "pending", _("Pending")
        COMPLETED = "completed", _("Completed")
        CANCELLED = "cancelled", _("Cancelled")
        EXPIRED = "expired", _("Expired")

    class PartyType(models.TextChoices):
        INVESTOR = "investor", _("Investor")
        LP = "lp", _("Liquidity Provider")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="secondary_market_listings",
    )
    seller_type = models.CharField(
        max_length=12, choices=PartyType.choices, default=PartyType.INVESTOR
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="secondary_market_purchases",
    )
    buyer_type = models.CharField(
        max_length=12, choices=PartyType.choices, blank=True, default=""
    )

    property_id = models.CharField(max_length=64, db_index=True)  # Property.slug
    property_name = models.CharField(max_length=200)
    token_symbol = models.CharField(max_length=16)
    token_amount = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=16, decimal_places=2, default=100)
    total_value = models.DecimalField(max_digits=18, decimal_places=2)
    platform_fee_percent = models.DecimalField(max_digits=6, decimal_places=3, default=0.5)
    platform_fee_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.LISTED, db_index=True
    )
    settlement_tx_hash = models.CharField(max_length=66, blank=True, default="")

    listed_at = models.DateTimeField(default=timezone.now)
    purchased_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=500, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "secondary_market_listings"
        verbose_name = _("secondary market listing")
        verbose_name_plural = _("secondary market listings")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.token_amount} {self.token_symbol} [{self.status}] by {self.seller_id}"
