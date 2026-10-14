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

    class FeePayer(models.TextChoices):
        # Off-plan decision 5: the BUYER pays the resale fee on top and the seller receives
        # the full price. Listings made before that rule keep the seller-paid fee they were
        # listed with (history stays true).
        BUYER = "buyer", _("Buyer")
        SELLER = "seller", _("Seller")

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
    fee_payer = models.CharField(
        max_length=8, choices=FeePayer.choices, default=FeePayer.BUYER
    )

    # Off-plan §6 — POSITION listing: a whole active installment plan is sold as one
    # position and the buyer takes over the remaining installments. token_amount = all the
    # plan's units, unit_price = the seller's price per unit, total_value = the cash the
    # seller receives (units × price − remaining principal). Figures are kept current while
    # the listing is open (an installment paid meanwhile raises the seller's cash).
    plan = models.ForeignKey(
        "installments.InstallmentPlan", on_delete=models.PROTECT, null=True, blank=True,
        related_name="position_listings",
    )
    position_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    paid_principal = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    assumed_principal = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )

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
        constraints = [
            models.UniqueConstraint(
                fields=["plan"], condition=models.Q(status="listed"),
                name="uniq_listed_position_per_plan",
            )
        ]

    @property
    def is_position(self) -> bool:
        return self.plan_id is not None

    @property
    def buyer_fee(self):
        return self.platform_fee_amount if self.fee_payer == self.FeePayer.BUYER else 0

    @property
    def buyer_total(self):
        """What the buyer pays: the price, plus the resale fee when the buyer carries it."""
        return self.total_value + self.buyer_fee

    def __str__(self):
        return f"{self.token_amount} {self.token_symbol} [{self.status}] by {self.seller_id}"
