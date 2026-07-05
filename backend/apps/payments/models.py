"""
Payments domain — Phase 5 (real PSPs). SPEC §6; DECISIONS.md "Payments".

A `Payment` is our record of a real charge attempt against a PSP for an investment.
Wave 1 = Stripe (card); Wave 2 = NOW Payments (crypto). Funds settle to the CLIENT's
PSP account directly (we don't custody).

SAFETY (real money): this model stores ONLY non-sensitive references — a provider
payment id, amount, currency, status (and, for crypto, the public deposit address +
expected amount). RAW CARD DATA NEVER appears here or anywhere on this server (Stripe
Elements tokenises it in the browser); crypto pay addresses are public by nature. The
per-provider payment id is the idempotency anchor — a given payment mints exactly once.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class PaymentProvider(models.TextChoices):
    STRIPE = "stripe", _("Stripe")
    # NOW Payments (crypto) lands in Wave 2 — reserved here, not built this wave.
    NOWPAYMENTS = "nowpayments", _("NOW Payments")


class PaymentState(models.TextChoices):
    PENDING = "pending", _("Pending")
    SUCCEEDED = "succeeded", _("Succeeded")
    FAILED = "failed", _("Failed")


class Payment(models.Model):
    """A PSP charge attempt for an investment. No raw card data — ever."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # NULL for a DEPOSIT (a wallet top-up has no investment). A buy / installment leaves
    # `deposit` NULL and sets this, exactly as before — the two are mutually exclusive.
    investment = models.ForeignKey(
        "investments.Investment", on_delete=models.CASCADE, related_name="payments",
        null=True, blank=True,
    )
    # Deposit Wave: when set, this charge funds a wallet TOP-UP (credits UserBalance), NOT
    # an investment. The gated completion core routes a deposit payment to a balance credit
    # (`credit_user_balance(source="deposit")`) instead of `mint_investment` — there is NO
    # mint. A normal buy / installment leaves this NULL and behaves EXACTLY as before.
    deposit = models.ForeignKey(
        "wallets.Deposit", on_delete=models.CASCADE, null=True, blank=True,
        related_name="payments",
    )
    # Installments Wave C: when set, this charge funds ONE scheduled installment of an
    # active plan (NOT the down-payment/full purchase). The `investment` above is then the
    # plan's down-payment investment (the position holding the locked tokens) — kept for
    # context + the broker/owner credit basis. A normal purchase / down-payment leaves this
    # NULL and behaves EXACTLY as before. On a confirmed webhook the gated core routes an
    # installment payment to `settle_installment_payment` (progressive release + per-
    # installment credit) instead of `mint_investment` — there is NO second mint.
    installment_payment = models.ForeignKey(
        "installments.InstallmentPayment",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="payments",
    )
    # Early payoff (Installments): when True — with `installment_payment` set to the plan's
    # FIRST still-pending row as the anchor — this ONE charge funds ALL remaining
    # installments at once (amount = sum of the pending rows). On the confirmed webhook the
    # gated core routes it to `settle_installment_payoff` (settle EVERY pending row →
    # progressive release to full unlock + complete the plan) instead of settling a single
    # installment. A normal per-installment charge leaves this False and settles only its
    # own row. NO new mint, NO clawback — only locked→released movement, exactly like a
    # per-installment settlement, just for all remaining rows in one atomic block.
    is_installment_payoff = models.BooleanField(default=False)
    provider = models.CharField(
        max_length=16, choices=PaymentProvider.choices, default=PaymentProvider.STRIPE
    )
    # Stripe PaymentIntent id (pi_…). Unique + nullable: NULL until the intent is
    # created; once set it is the idempotency key for webhook processing. Postgres
    # allows many NULLs under a UNIQUE constraint, so concurrent pre-intent rows are
    # fine. NEVER store the client_secret (sensitive, short-lived).
    stripe_payment_intent_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    # NOW Payments id (Wave 2). Unique + nullable, same idempotency role as the
    # Stripe intent id but for the crypto provider. NULL for Stripe payments.
    nowpayments_payment_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    amount = models.DecimalField(max_digits=16, decimal_places=2)  # USD (price) amount
    currency = models.CharField(max_length=8, default="usd")
    status = models.CharField(
        max_length=16, choices=PaymentState.choices, default=PaymentState.PENDING
    )
    failure_reason = models.CharField(max_length=300, blank=True, default="")

    # Crypto-specific (NOW Payments) — all PUBLIC references, no secrets. The deposit
    # address + expected crypto amount the user pays; populated when the payment is
    # created. `pay_amount` needs high precision (e.g. 0.00042 ETH).
    pay_currency = models.CharField(max_length=24, blank=True, default="")
    pay_address = models.CharField(max_length=255, blank=True, default="")
    pay_amount = models.DecimalField(
        max_digits=36, decimal_places=18, null=True, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("payment")
        verbose_name_plural = _("payments")
        ordering = ("-created_at",)

    def __str__(self):
        ref = self.stripe_payment_intent_id or self.nowpayments_payment_id or "(no-ref)"
        return f"{self.provider}:{ref} {self.amount}{self.currency} [{self.status}]"


class SukukCertificate(models.Model):
    """
    A Nova / Sukuk certificate a buyer uploads to fund an investment — the manual,
    admin-approved payment rail (DECISIONS.md "Nova / Pronova"). The PDF evidences an
    off-platform, USD-pegged Nova instrument; on ADMIN approval the investment settles
    exactly like any completed buy (sukuk_service.approve_certificate → settle_investment),
    so tokens + owner/broker credit + the buyer-borne fee behave identically to card/crypto.

    Amount authority: the investment's OWN economics settle (token_amount × price + the
    buyer-borne fee, server-computed). `claimed_value` / `sukuk_id` / `issuer` /
    `validity_date` are BUYER-SUPPLIED REVIEWER METADATA only — the admin verifies the
    certificate covers the amount due; the user never dictates the settled amount.

    File privacy: financial evidence — served ONLY via the self-scoped/staff-gated download
    view (never public /media/), mirroring the KYC/KYB document vaults.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending review")
        APPROVED = "approved", _("Approved")
        REJECTED = "rejected", _("Rejected")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # One certificate per investment (its proof of funds).
    investment = models.OneToOneField(
        "investments.Investment", on_delete=models.CASCADE, related_name="sukuk_certificate"
    )
    file = models.FileField(upload_to="sukuk_certificates/%Y/%m/")
    file_size = models.PositiveIntegerField(null=True, blank=True)
    file_type = models.CharField(max_length=100, blank=True, default="")

    # Reviewer metadata (buyer-supplied claims; NOT the settled amount).
    sukuk_id = models.CharField(max_length=100, blank=True, default="")
    issuer = models.CharField(max_length=200, blank=True, default="")
    claimed_value = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    validity_date = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    review_notes = models.CharField(max_length=500, blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("sukuk certificate")
        verbose_name_plural = _("sukuk certificates")
        ordering = ("-created_at",)

    def __str__(self):
        return f"sukuk cert [{self.status}] for investment {self.investment_id}"
