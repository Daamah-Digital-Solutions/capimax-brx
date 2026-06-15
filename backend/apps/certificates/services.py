"""
Provisional certificate creation — Phase 3 Wave 2.

Recreates the record process-investment originally made, but with REAL property /
SPV / fee data (SPEC §7C.5), not the old hardcoded "Dubai, UAE" / fee=0. No PDF or
QR rendering here — that is Wave 3 (generate-certificate).
"""
from __future__ import annotations

import hashlib
import secrets
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import Certificate, CertificateStatus


def _mask_id(value: str) -> str:
    """Mask a user id for display: keep the last 4 chars."""
    s = str(value).replace("-", "")
    return f"****{s[-4:]}" if len(s) >= 4 else "****"


def _investor_name(user) -> str:
    profile = getattr(user, "profile", None)
    full = getattr(profile, "full_name", "") if profile else ""
    if full:
        return full
    # Fall back to the email local-part (never expose more than needed).
    return (user.email or "").split("@")[0]


def create_provisional_certificate(investment) -> Certificate:
    """
    Create (idempotently) the provisional Certificate for a completed investment.
    Returns the existing certificate if one already exists for the investment.
    """
    existing = Certificate.objects.filter(investment=investment).first()
    if existing is not None:
        return existing

    prop = investment.property
    user = investment.user

    # Real SPV data if the property has it (SPEC §7C.5), else blanks.
    spv = getattr(prop, "spv", None)
    spv_name = getattr(spv, "name", "") or ""
    spv_ref = getattr(spv, "registration_number", "") or ""

    # Real platform fee amount from the property's configured rate.
    fee_rate = Decimal(str(getattr(prop, "fee_platform", 0) or 0))
    platform_fee = (investment.amount_invested * fee_rate / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    year = timezone.now().year
    prop_token = "".join(c for c in prop.slug if c.isalnum()).upper()[:4] or "PROP"
    cert_id = f"CERT-{year}-{prop_token}-{secrets.token_hex(3).upper()}"
    verification_code = secrets.token_urlsafe(16)

    return Certificate.objects.create(
        user=user,
        investment=investment,
        certificate_id=cert_id,
        status=CertificateStatus.PROVISIONAL,
        subscription_date=timezone.now().date(),
        investor_name=_investor_name(user),
        investor_id_masked=_mask_id(user.id),
        spv_name=spv_name,
        spv_registration_ref=spv_ref,
        property_name=prop.name,
        property_location=prop.location,  # REAL location, not hardcoded "Dubai, UAE"
        listing_id=prop.slug,
        investment_amount=investment.amount_invested,
        units_purchased=investment.token_amount,
        unit_price=investment.price_per_token,
        ownership_percentage=investment.ownership_percentage,
        platform_fee=platform_fee,
        verification_code=verification_code,
        verification_url="",  # set when the PDF is generated (Wave 3)
    )


def _signature_hash(cert) -> str:
    """Tamper-evident digest over the certificate's material fields (SHA-256)."""
    canonical = "|".join(
        str(x) for x in (
            cert.certificate_id, cert.investor_name, cert.investor_id_masked,
            cert.property_name, cert.spv_name, cert.investment_amount,
            cert.units_purchased, cert.unit_price, cert.ownership_percentage,
            cert.verification_code,
        )
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def generate_certificate(investment, status=None):
    """
    Port of generate-certificate (SPEC §4.1): ensure the provisional record exists,
    then render the real PDF + QR. IDEMPOTENT — if the PDF already exists, returns the
    certificate unchanged (no regen).

    All data comes from the real Investment/Property/SPV record. The QR encodes the
    public verification URL {FRONTEND_URL}/verify/{code}.
    """
    cert = create_provisional_certificate(investment)

    # Idempotent: a generated PDF already exists → return as-is.
    if cert.pdf_file:
        return cert

    if status in (CertificateStatus.PROVISIONAL, CertificateStatus.FINAL):
        cert.status = status

    # Verification URL + QR payload + signatory + signature.
    frontend = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    cert.verification_url = f"{frontend}/verify/{cert.verification_code}"
    cert.qr_code_data = cert.verification_url
    cert.authorized_signatory = getattr(
        settings, "CERTIFICATE_AUTHORIZED_SIGNATORY", "Authorized Signatory"
    )
    cert.digital_signature_hash = _signature_hash(cert)

    # Render + store the PDF.
    from .pdf import render_certificate_pdf

    pdf_bytes = render_certificate_pdf(cert)
    filename = f"{cert.certificate_id}.pdf"
    cert.pdf_file.save(filename, ContentFile(pdf_bytes), save=False)
    cert.pdf_path = cert.pdf_file.name
    cert.pdf_url = f"/api/certificates/{cert.id}/pdf/"  # authenticated download
    cert.save()
    return cert
