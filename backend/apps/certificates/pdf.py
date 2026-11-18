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
    CONTENT_W, CX, GOLD, GREEN_D, INK, LEFT, MUTED, PANEL, RIGHT, Doc, day, divider, draw, fit_centred,
    holder_for, mbox, money, mx, qr_image, width, wrap,
)
from apps.reports.doc_lang import tr, tr_value

_STATUS = {"final": ("Final", GREEN_D), "provisional": ("Provisional", GOLD), "revoked": ("Revoked", INK)}


def _contract(cert) -> tuple[str, str, str]:
    """(standard, contract address or 'Pending deployment', network) for the property."""
    prop = getattr(getattr(cert, "investment", None), "property", None)
    tm = getattr(prop, "token_metadata", None) if prop else None
    addr = (getattr(tm, "deployed_contract_address", "") or "").strip()
    if not addr:
        return (getattr(tm, "standard", "") or "—"), "Pending deployment", "—"
    net = (getattr(tm, "deployment_network", "") or "").lower()
    return (getattr(tm, "standard", "") or "—"), addr, ("BSC Testnet" if "test" in net else "BSC Mainnet")


def _row_lines(value, w: float, max_lines: int) -> list[str]:
    """A panel value's lines: each "\n"-separated part starts its own line (wrapped), at most
    `max_lines` in all; the last line shows "…" when the text is longer."""
    out: list[str] = []
    for part in str(value).split("\n"):
        room = max_lines - len(out)
        if room <= 0:
            break
        out += wrap(tr_value(part), "Helvetica-Bold", 8.6, w - 24, max_lines=room)
    return out or ["—"]


def _panel_rows(rows, w: float) -> list[tuple[str, list[str]]]:
    return [(r[0], _row_lines(r[1], w, r[2] if len(r) > 2 else 1)) for r in rows]


def _panel_height(rows) -> float:
    return 26 + sum(14 + 10 * len(lines) for _, lines in rows)


def _panel(d: Doc, x: float, top: float, w: float, title: str, rows, h: float | None = None) -> float:
    """A titled panel of label / value rows; `rows` come from _panel_rows. `h` lets the two
    panels side by side share one height."""
    c = d.c
    h = h or _panel_height(rows)
    c.setFillColor(PANEL)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.7)
    c.roundRect(mbox(x, w), top - h, w, h, 6, stroke=1, fill=1)
    draw(c, x + 12, top - 15, tr(title).upper(), "Helvetica-Bold", 8, GREEN_D)
    yy = top - 34
    for label, lines in rows:
        draw(c, x + 12, yy, tr(label).upper(), "Helvetica", 6.4, MUTED)
        for i, ln in enumerate(lines):
            draw(c, x + 12, yy - 10 - 10 * i, ln, "Helvetica-Bold", 8.6, INK)
        yy -= 14 + 10 * len(lines)
    return top - h


def _panel_pair(d: Doc, top: float, w: float, gap: float, left, right) -> float:
    """Two panels side by side at the same height; returns the y under them."""
    lrows, rrows = _panel_rows(left[1], w), _panel_rows(right[1], w)
    h = max(_panel_height(lrows), _panel_height(rrows))
    _panel(d, LEFT, top, w, left[0], lrows, h)
    _panel(d, LEFT + w + gap, top, w, right[0], rrows, h)
    return top - h


NO_SPV = "the issuing SPV"


def _holder_lines(cert, units: str) -> list[str]:
    """The holder statement, wrapped. The percentage is a share of the SPV that owns the
    property (named in full), not of the property itself. When the sentence needs more than
    one line, the SPV's name starts a new line whole instead of being split mid-name."""
    spv = (cert.spv_name or "").strip() or NO_SPV
    line = tr(f"is the registered holder of {units} unit{'s' if cert.units_purchased != 1 else ''} "
              f"of {cert.property_name or 'the property'}, representing "
              f"{float(cert.ownership_percentage):.4f}% of the total issued interests in {spv}.")
    max_w = CONTENT_W - 60
    if spv == NO_SPV or width(line, "Helvetica", 10.5) <= max_w:
        return wrap(line, "Helvetica", 10.5, max_w)
    name = tr(spv)
    at = line.rfind(name)
    if at <= 0:
        return wrap(line, "Helvetica", 10.5, max_w)
    head, tail = line[:at].rstrip(), line[at:]
    return wrap(head, "Helvetica", 10.5, max_w) + wrap(tail, "Helvetica", 10.5, max_w)


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
    draw(c, CX, y, tr("This certifies that"), "Helvetica-Oblique", 10.5, MUTED, "center")
    fit_centred(c, CX, y - 28, name, "Helvetica-Bold", 22, CONTENT_W - 40, INK)
    divider(c, CX, y - 42, 120)
    units = f"{cert.units_purchased:,}"
    yy = y - 62
    for ln in _holder_lines(cert, units):
        draw(c, CX, yy, ln, "Helvetica", 10.5, INK, "center")
        yy -= 15

    # status badge
    label, color = _STATUS.get(status, (status, MUTED))
    label = tr_value(label).upper()
    bw = 92
    c.setFillColor(color)
    c.roundRect(CX - bw / 2, yy - 18, bw, 18, 9, stroke=0, fill=1)
    draw(c, CX, yy - 12, label, "Helvetica-Bold", 8.5, PANEL, "center")
    top = yy - 34

    # --- detail panels (2 × 2) ------------------------------------------------ #
    gap = 12
    w = (CONTENT_W - gap) / 2
    standard, contract, network = _contract(cert)
    spv = cert.spv_name or "—"
    if cert.spv_registration_ref:
        spv += ("\n" if cert.spv_name else "  ") + f"({cert.spv_registration_ref})"
    top2 = _panel_pair(d, top, w, gap, ("Holder", [
        ("Name", name),
        ("Email", holder.email if holder and holder.email else "—"),
        ("Investor ID", cert.investor_id_masked or "—"),
    ]), ("Property & SPV", [
        ("Property", cert.property_name or "—"),
        ("Location", cert.property_location or "—"),
        ("SPV", spv, 3),  # the full legal name (up to two lines), then the registration number
    ])) - gap
    y = _panel_pair(d, top2, w, gap, ("Investment", [
        ("Units / tokens", units),
        ("Unit price", f"{money(cert.unit_price)} USD"),
        ("Investment amount", f"{money(cert.investment_amount)} USD"),
        ("Share of the SPV", f"{float(cert.ownership_percentage):.4f}%"),
    ]), ("On-chain record", [
        ("Holder wallet", holder.wallet_address if holder and holder.wallet_address else "—"),
        ("Token contract", contract),
        ("Standard / network", f"{standard} · {network}"),
        ("Listing ID", cert.listing_id or "—"),
    ])) - 18

    # --- verification + dates + signature ----------------------------------- #
    qr_size = 92
    url = cert.verification_url or ""
    if url:
        c.drawImage(qr_image(url), mbox(RIGHT - qr_size, qr_size), y - qr_size, width=qr_size, height=qr_size, mask="auto")
        draw(c, RIGHT - qr_size / 2, y - qr_size - 10, tr("Scan to verify"), "Helvetica", 6.8, MUTED, "center")
    rows = [
        ("Issue date", day(cert.issue_date) if cert.issue_date else "—"),
        ("Subscription date", day(cert.subscription_date) if cert.subscription_date else "—"),
        ("Verification code", cert.verification_code or "—"),
        ("Verify at", url or "—"),
    ]
    yy = y - 6
    for label_, value in rows:
        draw(c, LEFT + 4, yy, tr(label_), "Helvetica", 8, MUTED)
        for ln in wrap(value, "Helvetica-Bold", 8.4, CONTENT_W - qr_size - 150, max_lines=2):
            draw(c, LEFT + 120, yy, ln, "Helvetica-Bold", 8.4, INK)
            yy -= 12
        yy -= 3
    if cert.digital_signature_hash:
        draw(c, LEFT + 4, yy, tr("Digital signature"), "Helvetica", 8, MUTED)
        for ln in wrap(cert.digital_signature_hash, "Helvetica", 6.6, CONTENT_W - qr_size - 150, max_lines=2):
            draw(c, LEFT + 120, yy, ln, "Helvetica", 6.6, INK)
            yy -= 9

    sig_y = 150
    c.setStrokeColor(INK)
    c.setLineWidth(0.6)
    c.line(mx(LEFT), sig_y, mx(LEFT + 190), sig_y)
    draw(c, LEFT, sig_y - 12, tr(cert.authorized_signatory or "Authorized Signatory"), "Helvetica-Bold", 8.6, INK)
    draw(c, LEFT, sig_y - 23, tr("For and on behalf of Capimax BRX"), "Helvetica", 7.4, MUTED)
    d.y = sig_y - 30
    return d.finish()
