"""
Installments domain — Wave A (INSTALLMENTS_SURFACE.md).

A per-INVESTOR installment plan + its payment schedule. This is distinct from the
per-PROPERTY `properties.InstallmentSchedule` (which is just the property's advertised
terms): here each row is a real investor's own financing plan for one property.

WAVE A SCOPE = data model + schedule + read ONLY. There is deliberately NO money, NO
payment, NO mint, NO token movement in this wave — a plan is created in `draft` with all
its payments `pending`. The down-payment charge, the FULL-MINT-THEN-LOCK release, the
per-installment payments, and missed-payment forfeiture are LATER waves.

LOCKED ARCHITECTURE (recorded here so later waves don't drift): token release is
FULL-MINT-THEN-LOCK — on down-payment the FULL token_amount is minted ONCE but locked,
and a released amount grows as installments clear (the investor's "ownership growing" UI
is RELEASED %, not N separate mints). NONE of that lives in this wave.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class InstallmentFrequency(models.TextChoices):
    MONTHLY = "monthly", _("Monthly")
    QUARTERLY = "quarterly", _("Quarterly")


class InstallmentPlanStatus(models.TextChoices):
    DRAFT = "draft", _("Draft")          # built, nothing charged yet (Wave A end-state)
    ACTIVE = "active", _("Active")        # down-payment cleared (later wave)
    COMPLETED = "completed", _("Completed")  # all installments paid (later wave)
    DEFAULTED = "defaulted", _("Defaulted")  # missed beyond policy (later wave)


class InstallmentPaymentStatus(models.TextChoices):
    PENDING = "pending", _("Pending")
    PAID = "paid", _("Paid")
    MISSED = "missed", _("Missed")


class InstallmentPlan(models.Model):
    """
    One investor's installment financing plan for one property: a down-payment plus N
    equal installments of the financed remainder. Created via
    `services.build_installment_plan` (never a user-writable serializer); the schedule
    is the child `InstallmentPayment` rows.

    Money fields are the cent-exact PLAN figures; `installment_amount` is the headline
    per-installment value (the final row may absorb the rounding remainder — see the
    payment rows for the exact per-row amounts).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    investor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="installment_plans",
    )
    # FK to the REAL property (eligibility: property.model == "installment"). The
    # frontend's string id is Property.slug; `property_name` is denormalized like
    # investments.Investment.
    property = models.ForeignKey(
        "properties.Property", on_delete=models.PROTECT, related_name="installment_plans"
    )
    property_name = models.CharField(max_length=200)

    total_amount = models.DecimalField(max_digits=16, decimal_places=2)
    down_payment_amount = models.DecimalField(max_digits=16, decimal_places=2)
    down_payment_percent = models.DecimalField(max_digits=5, decimal_places=2)
    number_of_installments = models.PositiveIntegerField()
    installment_amount = models.DecimalField(max_digits=16, decimal_places=2)
    frequency = models.CharField(
        max_length=12, choices=InstallmentFrequency.choices,
        default=InstallmentFrequency.MONTHLY,
    )
    duration_months = models.PositiveIntegerField()  # number_of_installments × step

    status = models.CharField(
        max_length=12, choices=InstallmentPlanStatus.choices,
        default=InstallmentPlanStatus.DRAFT, db_index=True,
    )
    # Wave B: set when a CONFIRMED (webhook-gated) down-payment activates the plan.
    # The down-payment is tracked here on the plan (not as an InstallmentPayment row —
    # the schedule rows are the N financed installments only). Drives the released %.
    down_paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("installment plan")
        verbose_name_plural = _("installment plans")
        ordering = ("-created_at",)

    def __str__(self):
        return (
            f"plan {self.down_payment_percent}% + "
            f"{self.number_of_installments}×{self.frequency} "
            f"[{self.status}] {self.property_id} ({self.investor_id})"
        )


class InstallmentPayment(models.Model):
    """
    One scheduled installment within a plan (the financed remainder, split into N equal
    cent-exact rows — the LAST row absorbs any rounding remainder). The down-payment is
    NOT a payment row; it lives on the plan as `down_payment_amount`.

    Wave A: created `pending`; `paid_at` stays null. No money clears this wave.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(
        InstallmentPlan, on_delete=models.CASCADE, related_name="payments"
    )
    sequence = models.PositiveIntegerField()  # 1..N
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=16, decimal_places=2)
    status = models.CharField(
        max_length=12, choices=InstallmentPaymentStatus.choices,
        default=InstallmentPaymentStatus.PENDING,
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("installment payment")
        verbose_name_plural = _("installment payments")
        ordering = ("plan", "sequence")
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "sequence"], name="uniq_installment_seq_per_plan"
            )
        ]

    def __str__(self):
        return f"#{self.sequence} {self.amount} due {self.due_date} [{self.status}]"
