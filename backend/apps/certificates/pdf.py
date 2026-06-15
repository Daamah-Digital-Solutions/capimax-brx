"""
Certificate PDF + QR rendering — Phase 3 Wave 3 (SPEC §4.1 / §7C.5).

ReportLab (pure-Python, no system libraries — chosen over WeasyPrint which needs
cairo/pango, painful on Windows). A single Letter page laid out with the canvas API
for precise control. The QR is a REAL scannable code (qrcode lib) encoding the public
verification URL — the old edge function only drew a placeholder box.

ALL values come from the Certificate record (which is populated from the REAL
Property / Investment / SPV models), never hardcoded constants.
"""
from __future__ import annotations

import io

import qrcode
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# Brand palette. Header uses the REAL platform name "CAPIMAX BRX" (matches the
# frontend — VerifyCertificate.tsx / index; NOT the legacy "CAPIMAX RT").
_NAVY = HexColor("#0B1F3A")
_GOLD = HexColor("#C8A24B")
_GREY = HexColor("#6B7280")
_DARK = HexColor("#111827")
_PAGE_W, _PAGE_H = letter

_STATUS_COLORS = {
    "final": HexColor("#15803D"),
    "provisional": HexColor("#B45309"),
    "revoked": HexColor("#B91C1C"),
}


def _qr_image(url: str) -> ImageReader:
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _money(value) -> str:
    try:
        return f"${float(value):,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def render_certificate_pdf(cert) -> bytes:
    """Render `cert` (a Certificate) to PDF bytes. Pulls only from the record."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle(f"Capimax BRX Certificate {cert.certificate_id}")

    # --- Header band ------------------------------------------------------- #
    c.setFillColor(_NAVY)
    c.rect(0, _PAGE_H - 1.4 * inch, _PAGE_W, 1.4 * inch, fill=1, stroke=0)
    c.setFillColor(_GOLD)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(0.75 * inch, _PAGE_H - 0.78 * inch, "CAPIMAX BRX")
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica", 12)
    c.drawString(0.75 * inch, _PAGE_H - 1.05 * inch, "Certificate of Fractional Ownership")

    # Status badge (top-right of the band).
    status = (cert.status or "provisional").lower()
    badge = _STATUS_COLORS.get(status, _GREY)
    c.setFillColor(badge)
    c.roundRect(_PAGE_W - 2.4 * inch, _PAGE_H - 0.95 * inch, 1.65 * inch, 0.4 * inch, 6, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(_PAGE_W - 1.575 * inch, _PAGE_H - 0.7 * inch, status.upper())

    # --- Certificate id + dates ------------------------------------------- #
    y = _PAGE_H - 1.9 * inch
    c.setFillColor(_DARK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(0.75 * inch, y, f"Certificate ID: {cert.certificate_id}")
    c.setFillColor(_GREY)
    c.setFont("Helvetica", 10)
    issue = cert.issue_date.isoformat() if cert.issue_date else ""
    sub = cert.subscription_date.isoformat() if cert.subscription_date else ""
    c.drawString(0.75 * inch, y - 0.22 * inch, f"Issue date: {issue}    Subscription date: {sub}")

    # --- Detail sections --------------------------------------------------- #
    def section(title, rows, top):
        c.setFillColor(_NAVY)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(0.75 * inch, top, title)
        c.setStrokeColor(_GOLD)
        c.setLineWidth(1)
        c.line(0.75 * inch, top - 0.06 * inch, _PAGE_W - 2.4 * inch, top - 0.06 * inch)
        yy = top - 0.32 * inch
        for label, value in rows:
            c.setFillColor(_GREY)
            c.setFont("Helvetica", 9)
            c.drawString(0.85 * inch, yy, label)
            c.setFillColor(_DARK)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(2.7 * inch, yy, str(value))
            yy -= 0.26 * inch
        return yy

    y = section(
        "INVESTOR",
        [
            ("Legal name", cert.investor_name or "—"),
            ("Investor ID", cert.investor_id_masked or "—"),
        ],
        y - 0.5 * inch,
    )

    y = section(
        "PROPERTY & SPV",
        [
            ("Property", cert.property_name or "—"),
            ("Location", cert.property_location or "—"),
            ("SPV", cert.spv_name or "—"),
            ("SPV registration", cert.spv_registration_ref or "—"),
            ("Listing ID", cert.listing_id or "—"),
        ],
        y - 0.2 * inch,
    )

    y = section(
        "INVESTMENT",
        [
            ("Investment amount", _money(cert.investment_amount)),
            ("Tokens / units", f"{cert.units_purchased:,}"),
            ("Unit price", _money(cert.unit_price)),
            # The CORRECTED ownership (from real token_supply), shown to 4 dp.
            ("Ownership", f"{float(cert.ownership_percentage):.4f}%"),
            ("Platform fee", _money(cert.platform_fee)),
        ],
        y - 0.2 * inch,
    )

    # --- QR + verification ------------------------------------------------- #
    qr_url = cert.verification_url or ""
    if qr_url:
        c.drawImage(_qr_image(qr_url), _PAGE_W - 2.2 * inch, 1.4 * inch,
                    width=1.5 * inch, height=1.5 * inch, mask="auto")
        c.setFillColor(_GREY)
        c.setFont("Helvetica", 7)
        c.drawCentredString(_PAGE_W - 1.45 * inch, 1.28 * inch, "Scan to verify")

    c.setFillColor(_DARK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(0.75 * inch, 2.5 * inch, "Verification")
    c.setFillColor(_GREY)
    c.setFont("Helvetica", 9)
    c.drawString(0.75 * inch, 2.28 * inch, f"Code: {cert.verification_code}")
    c.drawString(0.75 * inch, 2.10 * inch, f"Verify at: {qr_url}")
    if cert.digital_signature_hash:
        c.setFont("Helvetica", 7)
        c.drawString(0.75 * inch, 1.92 * inch, f"Signature: {cert.digital_signature_hash}")

    # --- Footer ------------------------------------------------------------ #
    c.setStrokeColor(_GOLD)
    c.line(0.75 * inch, 1.0 * inch, _PAGE_W - 0.75 * inch, 1.0 * inch)
    c.setFillColor(_NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(0.75 * inch, 0.78 * inch, cert.authorized_signatory or "Authorized Signatory")
    c.setFillColor(_GREY)
    c.setFont("Helvetica", 7.5)
    c.drawString(0.75 * inch, 0.6 * inch,
                 "This certificate represents fractional ownership recorded on-chain. "
                 "UNAUDITED testnet deployment — not an offer of securities.")

    c.showPage()
    c.save()
    return buf.getvalue()
