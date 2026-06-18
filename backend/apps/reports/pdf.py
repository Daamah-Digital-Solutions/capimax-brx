"""
Reusable "statement" PDF renderer — Phase 13. REUSES the same ReportLab stack the
certificates already ship (apps/certificates/pdf.py: pure-Python canvas, no WeasyPrint /
system libs) and the same brand palette, but as a GENERIC, multi-row table statement
(header band → title/period/meta → paginated data table → disclaimer footer).

NO business logic, NO computed figures — the caller passes the exact columns + rows +
meta its existing endpoint already produced; this only lays them out. A new Canvas page
is started automatically when the table overflows.
"""
from __future__ import annotations

import io

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

# Same brand palette as certificates/pdf.py.
_NAVY = HexColor("#0B1F3A")
_GOLD = HexColor("#C8A24B")
_GREY = HexColor("#6B7280")
_DARK = HexColor("#111827")
_PAGE_W, _PAGE_H = letter
_LEFT = 0.75 * inch
_RIGHT = _PAGE_W - 0.75 * inch

# The same testnet disclaimer the certificate footer uses (tone reused for reports).
DEFAULT_DISCLAIMER = (
    "Informational only — generated from your account records on an UNAUDITED testnet "
    "deployment. Not a tax document and not an offer of securities."
)


def _header_band(c, subtitle: str):
    c.setFillColor(_NAVY)
    c.rect(0, _PAGE_H - 1.2 * inch, _PAGE_W, 1.2 * inch, fill=1, stroke=0)
    c.setFillColor(_GOLD)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(_LEFT, _PAGE_H - 0.7 * inch, "CAPIMAX BRX")
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica", 11)
    c.drawString(_LEFT, _PAGE_H - 0.95 * inch, subtitle)


def _footer(c, disclaimer: str):
    c.setStrokeColor(_GOLD)
    c.setLineWidth(1)
    c.line(_LEFT, 0.85 * inch, _RIGHT, 0.85 * inch)
    c.setFillColor(_GREY)
    c.setFont("Helvetica", 7.5)
    # Wrap the disclaimer across up to two lines.
    words, line, lines = disclaimer.split(), "", []
    for w in words:
        if c.stringWidth(line + " " + w, "Helvetica", 7.5) < (_RIGHT - _LEFT):
            line = (line + " " + w).strip()
        else:
            lines.append(line)
            line = w
    lines.append(line)
    y = 0.66 * inch
    for ln in lines[:2]:
        c.drawString(_LEFT, y, ln)
        y -= 0.13 * inch


def _table_header(c, columns, col_x, y):
    c.setFillColor(_NAVY)
    c.setFont("Helvetica-Bold", 9)
    for (_key, header), x in zip(columns, col_x):
        c.drawString(x, y, str(header))
    c.setStrokeColor(_GOLD)
    c.setLineWidth(0.8)
    c.line(_LEFT, y - 0.07 * inch, _RIGHT, y - 0.07 * inch)
    return y - 0.28 * inch


def render_statement_pdf(
    *,
    title: str,
    period: str = "",
    columns: list[tuple[str, str]],
    rows: list[dict],
    meta: list[tuple[str, str]] | None = None,
    disclaimer: str = DEFAULT_DISCLAIMER,
) -> bytes:
    """Render a generic statement to PDF bytes. Pure layout — no figures are derived."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle(title)

    # Even column positions across the printable width.
    n = max(1, len(columns))
    usable = _RIGHT - _LEFT
    col_x = [_LEFT + i * (usable / n) for i in range(n)]

    def new_page(first: bool):
        _header_band(c, title)
        yy = _PAGE_H - 1.6 * inch
        if first:
            c.setFillColor(_GREY)
            c.setFont("Helvetica", 10)
            if period:
                c.drawString(_LEFT, yy, f"Period: {period}")
                yy -= 0.22 * inch
            for label, value in (meta or []):
                c.setFillColor(_GREY)
                c.setFont("Helvetica", 9)
                c.drawString(_LEFT, yy, f"{label}:")
                c.setFillColor(_DARK)
                c.setFont("Helvetica-Bold", 9)
                c.drawString(_LEFT + 1.6 * inch, yy, str(value))
                yy -= 0.2 * inch
            yy -= 0.1 * inch
        _footer(c, disclaimer)
        return _table_header(c, columns, col_x, yy)

    y = new_page(first=True)
    c.setFont("Helvetica", 9)
    for row in rows:
        if y < 1.2 * inch:  # space for the footer — start a new page
            c.showPage()
            y = new_page(first=False)
            c.setFont("Helvetica", 9)
        c.setFillColor(_DARK)
        for (key, _header), x in zip(columns, col_x):
            val = row.get(key, "")
            c.drawString(x, y, "" if val is None else str(val))
        y -= 0.24 * inch

    if not rows:
        c.setFillColor(_GREY)
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(_LEFT, y, "No records for this period.")

    c.showPage()
    c.save()
    return buf.getvalue()
