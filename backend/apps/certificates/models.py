"""
Certificate domain — Phase 3 Wave 2 (provisional records only).

SPEC §3.3 (`certificates`) / §4.1 (generate-certificate). This wave creates the
PROVISIONAL certificate record that process-investment originally made — with REAL
property/SPV/fee data (NOT the old edge function's hardcoded "Dubai, UAE" /
platform_fee=0). PDF rendering + QR + public verification endpoint are WAVE 3, so
the PDF/verification fields exist but stay empty here.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class CertificateStatus(models.TextChoices):
    PROVISIONAL = "provisional", _("Provisional")
    FINAL = "final", _("Final")
    REVOKED = "revoked", _("Revoked")


class Certificate(models.Model):
    """Ownership certificate. SPEC §3.3."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="certificates"
    )
    investment = models.ForeignKey(
        "investments.Investment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificates",
    )
    certificate_id = models.CharField(max_length=40, unique=True)  # e.g. CERT-2026-XXX-######
    status = models.CharField(
        max_length=12, choices=CertificateStatus.choices, default=CertificateStatus.PROVISIONAL
    )
    issue_date = models.DateField(auto_now_add=True)
    subscription_date = models.DateField(null=True, blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)

    # Investor identity (masked).
    investor_name = models.CharField(max_length=200, blank=True)
    investor_id_masked = models.CharField(max_length=64, blank=True)

    # SPV + property (REAL data from the Property/SPVRecord — not hardcoded).
    spv_name = models.CharField(max_length=200, blank=True)
    spv_registration_ref = models.CharField(max_length=120, blank=True)
    property_name = models.CharField(max_length=200, blank=True)
    property_location = models.CharField(max_length=200, blank=True)
    listing_id = models.CharField(max_length=64, blank=True)

    # Economics (REAL: from the property's token_price + fees).
    investment_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    units_purchased = models.PositiveIntegerField(default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ownership_percentage = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    platform_fee = models.DecimalField(max_digits=16, decimal_places=2, default=0)

    authorized_signatory = models.CharField(max_length=200, blank=True)

    # Verification / PDF — populated in WAVE 3 (generate-certificate).
    digital_signature_hash = models.CharField(max_length=128, blank=True)
    qr_code_data = models.TextField(blank=True)  # the URL encoded in the QR
    verification_code = models.CharField(max_length=64, unique=True, db_index=True)
    verification_url = models.CharField(max_length=300, blank=True)
    pdf_file = models.FileField(upload_to="certificates/%Y/%m/", null=True, blank=True)
    pdf_url = models.CharField(max_length=500, blank=True)  # API download path
    pdf_path = models.CharField(max_length=500, blank=True)  # storage-relative path

    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=300, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("certificate")
        verbose_name_plural = _("certificates")
        ordering = ("-issue_date",)

    def __str__(self):
        return f"{self.certificate_id} ({self.status})"

    def mark_final(self):
        """
        provisional -> final transition (sets finalized_at). The trigger for this is
        a CONFIRMED real payment, which lands in the Payments phase; the field +
        transition are wired here so that phase only has to call it. SPEC §3.3.
        """
        from django.utils import timezone

        if self.status != CertificateStatus.FINAL:
            self.status = CertificateStatus.FINAL
            self.finalized_at = timezone.now()
            self.save(update_fields=["status", "finalized_at", "updated_at"])

    def revoke(self, reason=""):
        """Revoke a certificate (admin action). SPEC §3.3."""
        from django.utils import timezone

        self.status = CertificateStatus.REVOKED
        self.revoked_at = timezone.now()
        self.revocation_reason = reason or self.revocation_reason
        self.save(update_fields=["status", "revoked_at", "revocation_reason", "updated_at"])
