"""
Certificate of fractional ownership — the shared Capimax BRX document design
(apps/reports/brand.py): framed A4 page, logo, holder statement, property / investment /
on-chain details, a scannable QR to the public verification page, and a signature line.

Every value comes from the Certificate record (filled from the real Property / Investment /
SPV records) plus the holder's wallet and the property's deployed token contract — the
contract shows as pending until it is really deployed, never invented.
"""
from __future__ import annotations

from apps.reports.brand import (
    CONTENT_W, CX, GOLD, GREEN_D, INK, LEFT, MUTED, PANEL, RIGHT, Doc, divider, draw, fit_centred,
    holder_for, money, qr_image, wrap,
)

_STATUS = {"final": ("FINAL", GREEN_D), "provisional": ("PROVISIONAL", GOLD), "revoked": ("REVOKED", INK)}


def _contract(cert) -> tuple[str, str, str]:
    """(standard, contract address or 'Pending deployment', network) for the property."""
    prop = getattr(getattr(cert, "investment", None), "property", None)
    tm = getattr(prop, "token_metadata", None) if prop else None
    addr = (getattr(tm, "deployed_contract_address", "") or "").strip()
    if not addr:
        return (getattr(tm, "standard", "") or "—"), "Pending deployment", "—"
    net = (getattr(tm, "deployment_network", "") or "").lower()
    return (getattr(tm, "standard", "") or "—"), addr, ("BSC Testnet" if "test" in net else "BSC Mainnet")


def _panel(d: Doc, x: float, top: float, w: float, title: str, rows: list[tuple[str, str]]) -> float:
    c = d.c
    h = 26 + 24 * len(rows)
    c.setFillColor(PANEL)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.roundRect(x, top - h, w, h, 6, stroke=1, fill=1)
    draw(c, x + 12, top - 15, title, "Helvetica-Bold", 8, GREEN_D)
    yy = top - 34
    for label, value in rows:
        draw(c, x + 12, yy, label.upper(), "Helvetica", 6.4, MUTED)
        lines = wrap(value, "Helvetica-Bold", 8.6, w - 24, max_lines=1)
        draw(c, x + 12, yy - 10, lines[0], "Helvetica-Bold", 8.6, INK)
        yy -= 24
    return top - h


def render_certificate_pdf(cert) -> bytes:
    """Render `cert` (a Certificate) to PDF bytes."""
    status = (cert.status or "provisional").lower()
    d = Doc(
        title="Certificate of Ownership",
        ref=cert.certificate_id,
        subtitle="Fractional ownership of a tokenised property",
        note=("This certificate records fractional ownership held through the property's SPV and "
              "recorded on-chain. Verify it at any time with the QR code or the verification code. "
              "A provisional certificate becomes final when the purchase is fully settled."),
    )
    c = d.c
    user = getattr(cert, "user", None)
    holder = holder_for(user) if user is not None else None
    name = cert.investor_name or (holder.name if holder else "—")

    # --- holder statement --------------------------------------------------- #
    y = d.y - 4
    draw(c, CX, y, "This certifies that", "Helvetica-Oblique", 10.5, MUTED, "center")
    fit_centred(c, CX, y - 28, name, "Helvetica-Bold", 22, CONTENT_W - 40, INK)
    divider(c, CX, y - 42, 120)
    units = f"{cert.units_purchased:,}"
    line = (f"is the registered holder of {units} unit{'s' if cert.units_purchased != 1 else ''} "
            f"of {cert.property_name or 'the property'}, representing "
            f"{float(cert.ownership_percentage):.4f}% ownership.")
    yy = y - 62
    for ln in wrap(line, "Helvetica", 10.5, CONTENT_W - 60):
        draw(c, CX, yy, ln, "Helvetica", 10.5, INK, "center")
        yy -= 15

    # status badge
    label, color = _STATUS.get(status, (status.upper(), MUTED))
    bw = 92
    c.setFillColor(color)
    c.roundRect(CX - bw / 2, yy - 18, bw, 18, 9, stroke=0, fill=1)
    draw(c, CX, yy - 12, label, "Helvetica-Bold", 8.5, PANEL, "center")
    top = yy - 34

    # --- detail panels (2 × 2) ------------------------------------------------ #
    gap = 12
    w = (CONTENT_W - gap) / 2
    standard, contract, network = _contract(cert)
    left1 = _panel(d, LEFT, top, w, "HOLDER", [
        ("Name", name),
        ("Email", holder.email if holder and holder.email else "—"),
        ("Investor ID", cert.investor_id_masked or "—"),
    ])
    right1 = _panel(d, LEFT + w + gap, top, w, "PROPERTY & SPV", [
        ("Property", cert.property_name or "—"),
        ("Location", cert.property_location or "—"),
        ("SPV", f"{cert.spv_name or '—'}" + (f"  ({cert.spv_registration_ref})" if cert.spv_registration_ref else "")),
    ])
    top2 = min(left1, right1) - gap
    left2 = _panel(d, LEFT, top2, w, "INVESTMENT", [
        ("Units / tokens", units),
        ("Unit price", f"{money(cert.unit_price)} USD"),
        ("Investment amount", f"{money(cert.investment_amount)} USD"),
        ("Ownership", f"{float(cert.ownership_percentage):.4f}%"),
    ])
    right2 = _panel(d, LEFT + w + gap, top2, w, "ON-CHAIN RECORD", [
        ("Holder wallet", holder.wallet_address if holder and holder.wallet_address else "—"),
        ("Token contract", contract),
        ("Standard / network", f"{standard} · {network}"),
        ("Listing ID", cert.listing_id or "—"),
    ])
    y = min(left2, right2) - 18

    # --- verification + dates + signature ----------------------------------- #
    qr_size = 92
    url = cert.verification_url or ""
    if url:
        c.drawImage(qr_image(url), RIGHT - qr_size, y - qr_size, width=qr_size, height=qr_size, mask="auto")
        draw(c, RIGHT - qr_size / 2, y - qr_size - 10, "Scan to verify", "Helvetica", 6.8, MUTED, "center")
    rows = [
        ("Issue date", cert.issue_date.strftime("%d %b %Y") if cert.issue_date else "—"),
        ("Subscription date", cert.subscription_date.strftime("%d %b %Y") if cert.subscription_date else "—"),
        ("Verification code", cert.verification_code or "—"),
        ("Verify at", url or "—"),
    ]
    yy = y - 6
    for label_, value in rows:
        draw(c, LEFT + 4, yy, label_, "Helvetica", 8, MUTED)
        for ln in wrap(value, "Helvetica-Bold", 8.4, CONTENT_W - qr_size - 150, max_lines=2):
            draw(c, LEFT + 120, yy, ln, "Helvetica-Bold", 8.4, INK)
            yy -= 12
        yy -= 3
    if cert.digital_signature_hash:
        draw(c, LEFT + 4, yy, "Digital signature", "Helvetica", 8, MUTED)
        for ln in wrap(cert.digital_signature_hash, "Helvetica", 6.6, CONTENT_W - qr_size - 150, max_lines=2):
            draw(c, LEFT + 120, yy, ln, "Helvetica", 6.6, INK)
            yy -= 9

    sig_y = 150
    c.setStrokeColor(INK)
    c.setLineWidth(0.6)
    c.line(LEFT, sig_y, LEFT + 190, sig_y)
    draw(c, LEFT, sig_y - 12, cert.authorized_signatory or "Authorized Signatory", "Helvetica-Bold", 8.6, INK)
    draw(c, LEFT, sig_y - 23, "For and on behalf of Capimax BRX", "Helvetica", 7.4, MUTED)
    d.y = sig_y - 30
    return d.finish()
