"""
Investment domain — Phase 3 Wave 2.

An `Investment` is a user's purchase of tokens in a property. SPEC §3.2 /
§4.1 (process-investment). Money flow is SIMULATED in this wave (real PSPs are the
Payments phase); token MINTING is real (on-chain). Token economics follow the
LOCKED policy: price = property.token_price (per-property, admin-set), ownership =
token_amount / property.token_supply * 100 (NEVER the old hardcoded /1000).
"""
import builtins
import uuid
from decimal import Decimal

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

    # Installments (Wave B). A normal purchase leaves these falsy/null and behaves
    # EXACTLY as before. For an installment purchase: the FULL position is still
    # minted (token_amount = full, ownership = full/supply), but only the
    # down-payment is CHARGED + CREDITED now (`charge_amount`), and the unpaid share
    # of the minted tokens is held LOCKED (mint_investment sets OwnershipToken.locked_amount).
    is_installment = models.BooleanField(default=False)
    down_payment_amount = models.DecimalField(
        max_digits=16, decimal_places=2, null=True, blank=True
    )
    # Fees (buyer-borne, LOCKED policy). The platform + management fee CHARGED to the
    # buyer ON TOP of the token value, computed at create time from the property's
    # admin-set rates (Property.fee_platform + fee_management). `amount_invested` stays
    # the pure token value (tokens × price) — it drives ownership + the owner credit —
    # while the buyer actually pays `settlement_amount` (value + fee). The fee is the
    # platform's; the owner receives the full token value (NO fee carved out). For an
    # installment the full fee is charged once, with the down-payment.
    fee_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    # Pronova discount (buyer perk, PLATFORM-ABSORBED). Subtracted from `settlement_amount`
    # ONLY — the buyer pays less, but the owner still receives the full token value
    # (`charge_amount`) and tokens/ownership are unchanged. 0 for every non-Pronova method.
    # Set at create time from the property's admin rate (Property.fee_pronova_discount). The
    # platform's net for the sale = fee_amount − discount_amount (UNCAPPED — may be negative).
    discount_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    installment_plan = models.ForeignKey(
        "installments.InstallmentPlan",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="investments",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # NOTE: this model has a `property` FK field, which shadows the `property`
    # builtin inside the class body — so the decorator must be `builtins.property`.
    @builtins.property
    def charge_amount(self):
        """
        The money charged/credited for THIS payment. The full price for a normal
        purchase; the DOWN-PAYMENT for an installment purchase (Wave B). Both the
        gated PSP charge and the owner/broker credit scope to this — so a normal
        buy is unchanged (charge_amount == amount_invested) and an installment
        credits only on money actually paid.
        """
        if self.is_installment and self.down_payment_amount is not None:
            return self.down_payment_amount
        return self.amount_invested

    @builtins.property
    def settlement_amount(self):
        """
        What the BUYER actually pays at the gated (down-payment / full) settlement:
        the token-value `charge_amount` PLUS the buyer-borne fee (Option A), LESS the
        platform-absorbed Pronova discount (`discount_amount`, 0 for every non-Pronova
        method). Used by the PSP charge (Stripe/NOW) and the balance debit so the amount
        collected equals the displayed total. A normal buy pays amount_invested + fee; a
        Pronova buy pays value + fee − discount; an installment pays the down-payment + the
        full fee (charged once). Later installments carry no extra fee.
        """
        return (
            self.charge_amount
            + (self.fee_amount or Decimal("0"))
            - (self.discount_amount or Decimal("0"))
        )

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
