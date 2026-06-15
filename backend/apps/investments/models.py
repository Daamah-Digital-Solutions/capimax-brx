"""
Investment domain — Phase 3 Wave 2.

An `Investment` is a user's purchase of tokens in a property. SPEC §3.2 /
§4.1 (process-investment). Money flow is SIMULATED in this wave (real PSPs are the
Payments phase); token MINTING is real (on-chain). Token economics follow the
LOCKED policy: price = property.token_price (per-property, admin-set), ownership =
token_amount / property.token_supply * 100 (NEVER the old hardcoded /1000).
"""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


class PaymentStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    PROCESSING = "processing", _("Processing")
    COMPLETED = "completed", _("Completed")
    FAILED = "failed", _("Failed")


class Investment(models.Model):
    """A token purchase. Mirrors Supabase `investments` (SPEC §3.2)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="investments"
    )
    # FK to the REAL property (not a free string); the frontend's string id is
    # Property.slug, resolved at the API boundary.
    property = models.ForeignKey(
        "properties.Property", on_delete=models.PROTECT, related_name="investments"
    )
    property_name = models.CharField(max_length=200)  # denormalized per SPEC

    amount_invested = models.DecimalField(max_digits=16, decimal_places=2)
    token_amount = models.PositiveIntegerField()  # whole shares (contract decimals == 0)
    token_symbol = models.CharField(max_length=16)
    price_per_token = models.DecimalField(max_digits=12, decimal_places=2)
    # Computed from the property's real token_supply.
    ownership_percentage = models.DecimalField(max_digits=12, decimal_places=6)

    payment_method = models.CharField(max_length=24)
    payment_status = models.CharField(
        max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING
    )

    tokens_minted = models.BooleanField(default=False)
    minted_at = models.DateTimeField(null=True, blank=True)
    wallet = models.ForeignKey(
        "wallets.UserWallet",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="investments",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("investment")
        verbose_name_plural = _("investments")
        ordering = ("-created_at",)
        constraints = [
            # SPEC §3.2: at most one in-flight (pending|processing) investment per
            # (user, property). Replicates the Supabase partial unique index.
            models.UniqueConstraint(
                fields=["user", "property"],
                condition=Q(payment_status__in=["pending", "processing"]),
                name="uniq_active_investment_per_user_property",
            )
        ]

    def __str__(self):
        return f"{self.token_amount} {self.token_symbol} · {self.user_id} · {self.payment_status}"
