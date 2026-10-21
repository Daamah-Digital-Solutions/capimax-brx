"""
The Capimax BRX document design — one look for every PDF the platform issues (statements,
receipts, schedules, certificates, reports).

A4, cream page with a dark-teal / gold double frame and corner flourishes, the official
logo on top, the document title, an account-holder block (name, email, on-chain wallet),
a summary panel, then sections of key/value rows or striped tables that continue across
pages (the table header repeats). Every page ends with a short note and
"<document no.> • Page X of Y • capimaxbrx.com".

Arabic text (names, property names) is shaped and ordered right-to-left and drawn with the
bundled DejaVu font; everything else uses Helvetica. Pure ReportLab — no system libraries.

This module only lays out what the caller passes; it never computes figures.
"""
from __future__ import annotations

import io
import pathlib
import re
from dataclasses import dataclass, field
from datetime import datetime

from django.utils import timezone
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# --------------------------------------------------------------------------- #
# Palette (the logo's dark teal + green, the site's gold) and page geometry
# --------------------------------------------------------------------------- #
INK = HexColor("#0A2928")
GREEN = HexColor("#2FAD6F")
GREEN_D = HexColor("#1D7A4E")
GOLD = HexColor("#C59A2E")
GOLD_L = HexColor("#E6CB7A")
MUTED = HexColor("#5F6B6A")
PANEL = HexColor("#F1F6F3")
CREAM = HexColor("#FDFCF8")
RED = HexColor("#B23A2E")
AMBER = HexColor("#B7791F")
WHITE = HexColor("#FFFFFF")

W, H = 595.0, 842.0  # A4 in points
CX = W / 2
LEFT, RIGHT = 58.0, W - 58.0
CONTENT_W = RIGHT - LEFT
BOTTOM = 112.0  # content stops here; the footer lives below

SITE = "capimaxbrx.com"
ISSUER = "Capimax BRX"

_ASSETS = pathlib.Path(__file__).resolve().parent / "assets"
LOGO_PATH = _ASSETS / "capimax-brx-logo.png"

# --------------------------------------------------------------------------- #
# Fonts + Arabic
# --------------------------------------------------------------------------- #
_AR = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
_FONTS_READY = False


def _register_fonts() -> bool:
    global _FONTS_READY
    if _FONTS_READY:
        return True
    try:
        pdfmetrics.registerFont(TTFont("BRX-Sans", str(_ASSETS / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("BRX-Sans-Bold", str(_ASSETS / "DejaVuSans-Bold.ttf")))
        _FONTS_READY = True
    except Exception:  # noqa: BLE001 — a missing font must never break a download
        _FONTS_READY = False
    return _FONTS_READY


def _visual(text: str) -> str:
    """Arabic → joined letter forms in right-to-left display order."""
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display

        return get_display(arabic_reshaper.reshape(text))
    except Exception:  # noqa: BLE001 — libraries missing: draw as-is
        return text


def prep(text, font: str) -> tuple[str, str]:
    """(text to draw, font to use). Text with Arabic goes through shaping + the DejaVu font."""
    s = "" if text is None else str(text)
    if _AR.search(s) and _register_fonts():
        bold = "Bold" in font
        return _visual(s), ("BRX-Sans-Bold" if bold else "BRX-Sans")
    return s, font


def width(text, font: str, size: float) -> float:
    s, f = prep(text, font)
    return stringWidth(s, f, size)


def clip(text, font: str, size: float, max_w: float) -> str:
    """Shorten with an ellipsis so the value fits its column."""
    s = "" if text is None else str(text)
    if width(s, font, size) <= max_w:
        return s
    while s and width(s + "…", font, size) > max_w:
        s = s[:-1]
    return s + "…"


def wrap(text, font: str, size: float, max_w: float, max_lines: int | None = None) -> list[str]:
    words = ("" if text is None else str(text)).split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if width(trial, font, size) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = clip(lines[-1] + " …", font, size, max_w)
    return lines or [""]


def draw(c, x: float, y: float, text, font: str = "Helvetica", size: float = 9,
         color=INK, align: str = "left"):
    s, f = prep(text, font)
    c.setFillColor(color)
    c.setFont(f, size)
    if align == "right":
        c.drawRightString(x, y, s)
    elif align == "center":
        c.drawCentredString(x, y, s)
    else:
        c.drawString(x, y, s)


def spaced(c, cx: float, y: float, text: str, font: str, size: float, spacing: float, color):
    """Centred, letter-spaced title (contained so the spacing never leaks to later text)."""
    s, f = prep(text, font)
    w = stringWidth(s, f, size) + spacing * max(0, len(s) - 1)
    c.saveState()
    t = c.beginText(cx - w / 2, y)
    t.setFont(f, size)
    t.setFillColor(color)
    t.setCharSpace(spacing)
    t.textLine(s)
    c.drawText(t)
    c.restoreState()


def fit_centred(c, cx: float, y: float, text, font: str, size: float, max_w: float, color=INK):
    while size > 8 and width(text, font, size) > max_w:
        size -= 0.5
    draw(c, cx, y, text, font, size, color, "center")


# --------------------------------------------------------------------------- #
# Ornaments
# --------------------------------------------------------------------------- #
def _diamond(c, x: float, y: float, d: float):
    p = c.beginPath()
    p.moveTo(x, y + d)
    p.lineTo(x + d, y)
    p.lineTo(x, y - d)
    p.lineTo(x - d, y)
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def divider(c, cx: float, y: float, half: float):
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.8)
    c.line(cx - half, y, cx - 7, y)
    c.line(cx + 7, y, cx + half, y)
    c.setFillColor(GOLD)
    _diamond(c, cx, y, 3.2)
    c.restoreState()


def _corner(c, x: float, y: float, sx: int, sy: int):
    c.saveState()
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.line(x + sx * 9, y + sy * 9, x + sx * 32, y + sy * 9)
    c.line(x + sx * 9, y + sy * 9, x + sx * 9, y + sy * 32)
    c.setFillColor(GOLD)
    _diamond(c, x + sx * 9, y + sy * 9, 3.0)
    c.restoreState()


def page_frame(c):
    """Cream ground, a faint diagonal watermark, dark-teal / gold double border + corners."""
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.saveState()
    c.setFillColor(Color(0.04, 0.16, 0.16, alpha=0.035))
    c.translate(CX, H / 2 - 40)
    c.rotate(35)
    c.setFont("Helvetica-Bold", 92)
    c.drawCentredString(0, 0, "CAPIMAX BRX")
    c.restoreState()
    c.setStrokeColor(INK)
    c.setLineWidth(2.6)
    c.roundRect(26, 26, W - 52, H - 52, 9, stroke=1, fill=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(0.9)
    c.rect(35, 35, W - 70, H - 70, stroke=1, fill=0)
    _corner(c, 39, H - 39, 1, -1)
    _corner(c, W - 39, H - 39, -1, -1)
    _corner(c, 39, 39, 1, 1)
    _corner(c, W - 39, 39, -1, 1)


def logo(c, cx: float, top: float, w: float) -> float:
    """Draw the official logo centred at `cx` hanging from `top`; returns its bottom y."""
    try:
        from reportlab.lib.utils import ImageReader

        img = ImageReader(str(LOGO_PATH))
        iw, ih = img.getSize()
        h = w * ih / iw
        c.drawImage(img, cx - w / 2, top - h, width=w, height=h, mask="auto")
        return top - h
    except Exception:  # noqa: BLE001 — asset missing: a lettered fallback
        spaced(c, cx, top - 24, "CAPIMAX BRX", "Helvetica-Bold", 18, 3, INK)
        return top - 30


def qr_image(url: str):
    import qrcode
    from reportlab.lib.utils import ImageReader

    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0A2928", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


# --------------------------------------------------------------------------- #
# Data shapes
# --------------------------------------------------------------------------- #
@dataclass
class Holder:
    name: str
    email: str = ""
    wallet_address: str = ""
    network: str = ""
    extra: list[tuple[str, str]] = field(default_factory=list)


_NETWORK_LABELS = {"bsc-testnet": "BNB Smart Chain Testnet", "bsc-mainnet": "BNB Smart Chain",
                   "bsc": "BNB Smart Chain"}


def holder_for(user, extra: list[tuple[str, str]] | None = None) -> Holder:
    """The account holder block for `user`: name, email and their on-chain wallet."""
    profile = getattr(user, "profile", None)
    name = (getattr(profile, "full_name", None) or "").strip() or (user.email or "").split("@")[0]
    address = network = ""
    try:
        w = user.wallet
        address = w.wallet_address or ""
        network = _NETWORK_LABELS.get(str(w.network), str(w.network or ""))
    except Exception:  # noqa: BLE001 — no wallet yet
        pass
    return Holder(name=name or "Account holder", email=user.email or "", wallet_address=address,
                  network=network, extra=list(extra or []))


@dataclass
class Col:
    key: str
    header: str
    weight: float = 1.0
    align: str = "left"  # left | right | center
    wrap: bool = False  # up to 2 lines instead of an ellipsis
    tone: str = ""  # "signed": negatives red, positives green; "status": coloured status
    fmt: str = ""  # "money" | "signed" | "date" | "pct" | "int" — how a raw value is shown


_RIGHT_KEYS = re.compile(r"amount|total|balance|gross|net|fee|value|commission|investment|price|"
                         r"units|invested|principal|paid_amount|income|cost|return", re.I)
_WIDE_KEYS = re.compile(r"property|description|memo|item|referral|name|details|note", re.I)
_NARROW_KEYS = {"#": 0.45, "sequence": 0.45, "status": 0.95, "type": 1.0, "date": 0.95, "due": 0.95,
                "paid": 0.95}


def as_col(spec) -> Col:
    """Accept a Col, or the legacy (key, header[, options]) tuple the adapters use."""
    if isinstance(spec, Col):
        return spec
    key, header, *rest = spec
    opts = rest[0] if rest else {}
    weight = _NARROW_KEYS.get(key, 1.0)
    if _WIDE_KEYS.search(key):
        weight = 1.9
    align = "right" if (_RIGHT_KEYS.search(key) or "(USD)" in str(header)) else "left"
    if key in ("date", "due", "paid", "status", "type", "sequence"):
        align = "left"
    return Col(key=key, header=str(header), weight=opts.get("weight", weight),
               align=opts.get("align", align), wrap=opts.get("wrap", bool(_WIDE_KEYS.search(key))),
               tone=opts.get("tone", ""), fmt=opts.get("fmt", ""))


def show(value, fmt: str) -> str:
    """A raw cell value as the PDF shows it."""
    if value is None or value == "":
        return ""
    if fmt == "money":
        return money(value)
    if fmt == "signed":
        return money(value, signed=True)
    if fmt == "date":
        return day(value)
    if fmt == "pct":
        try:
            return f"{float(value):.2f}%"
        except (TypeError, ValueError):
            return str(value)
    if fmt == "int":
        try:
            return f"{int(value):,}"
        except (TypeError, ValueError):
            return str(value)
    if fmt == "label":
        return nice(value)
    return str(value)


_STATUS_TONE = {"paid": GREEN_D, "completed": GREEN_D, "credited": GREEN_D, "active": GREEN_D,
                "approved": GREEN_D, "final": GREEN_D, "succeeded": GREEN_D,
                "pending": AMBER, "processing": AMBER, "provisional": AMBER, "upcoming": AMBER,
                "missed": RED, "overdue": RED, "failed": RED, "rejected": RED, "revoked": RED,
                "cancelled": MUTED, "canceled": MUTED}


def nice(value) -> str:
    """snake/slug → Sentence case for display (installment_autodebit → Installment autodebit)."""
    s = "" if value is None else str(value)
    if "_" in s or (s and s.islower() and " " not in s and "-" not in s and "@" not in s):
        s = s.replace("_", " ")
        return s[:1].upper() + s[1:]
    return s


def money(value, signed: bool = False, currency: str = "") -> str:
    from decimal import Decimal

    try:
        v = Decimal(str(value))
    except Exception:  # noqa: BLE001
        return str(value)
    text = f"{abs(v):,.2f}"
    sign = ("+" if v >= 0 else "-") if signed else ("-" if v < 0 else "")
    out = f"{sign}{text}"
    return f"{out} {currency}".strip() if currency else out


def day(d) -> str:
    if d is None or d == "":
        return "—"
    if isinstance(d, str):
        try:
            d = datetime.fromisoformat(d.replace("Z", "+00:00"))
        except ValueError:
            return d
    return d.strftime("%d %b %Y")


# --------------------------------------------------------------------------- #
# The document
# --------------------------------------------------------------------------- #
class _NumberedCanvas(canvas.Canvas):
    """Keeps each page until save() so the footer can say "Page X of Y"."""

    def __init__(self, *args, footer=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._brx_pages = []
        self._brx_footer = footer

    def showPage(self):  # noqa: N802 — ReportLab API
        self._brx_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._brx_pages)
        for i, state in enumerate(self._brx_pages, start=1):
            self.__dict__.update(state)
            if self._brx_footer:
                self._brx_footer(self, i, total)
            super().showPage()
        super().save()


class Doc:
    """One branded document. Methods draw top-down and break pages as needed."""

    def __init__(self, *, title: str, ref: str, subtitle: str = "", note: str = "",
                 issued: datetime | None = None):
        _register_fonts()
        self.title = title
        self.ref = ref
        self.subtitle = subtitle
        self.note = note
        self.issued = issued or timezone.now()
        self.buf = io.BytesIO()
        self.c = _NumberedCanvas(self.buf, pagesize=(W, H), footer=self._footer)
        self.c.setTitle(f"{ISSUER} — {title}")
        self.c.setAuthor(ISSUER)
        self.c.setSubject(ref)
        self._table_header_again = None
        page_frame(self.c)
        self.y = self._first_header()

    # --- page furniture ------------------------------------------------------ #
    def _first_header(self) -> float:
        c = self.c
        bottom = logo(c, CX, 792, 172)
        divider(c, CX, bottom - 14, 150)
        spaced(c, CX, bottom - 44, self.title, "Helvetica-Bold", 20, 1.2, INK)
        y = bottom - 62
        if self.subtitle:
            draw(c, CX, y, self.subtitle, "Helvetica-Oblique", 10, MUTED, "center")
            y -= 14
        return y - 12

    def _continued_header(self) -> float:
        c = self.c
        logo(c, LEFT + 52, 800, 104)
        draw(c, RIGHT, 782, f"{self.title} (continued)", "Helvetica-Bold", 10.5, INK, "right")
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.8)
        c.line(LEFT, 764, RIGHT, 764)
        return 744.0

    def _footer(self, c, page: int, total: int):
        y = 94
        if self.note:
            for ln in wrap(self.note, "Helvetica", 7.2, 440, max_lines=3):
                draw(c, CX, y, ln, "Helvetica", 7.2, MUTED, "center")
                y -= 9.5
        c.setStrokeColor(GOLD_L)
        c.setLineWidth(0.6)
        c.line(LEFT, 66, RIGHT, 66)
        draw(c, LEFT, 54, self.ref, "Helvetica", 7.5, GOLD)
        draw(c, CX, 54, f"Page {page} of {total}", "Helvetica", 7.5, GOLD, "center")
        draw(c, RIGHT, 54, SITE, "Helvetica", 7.5, GOLD, "right")

    def new_page(self):
        self.c.showPage()
        page_frame(self.c)
        self.y = self._continued_header()
        if self._table_header_again:
            self._table_header_again()

    def ensure(self, needed: float):
        if self.y - needed < BOTTOM:
            self.new_page()

    # --- blocks -------------------------------------------------------------- #
    def holder(self, h: Holder, *, label: str = "ACCOUNT HOLDER"):
        """Name, email, wallet + document number / issue date in a framed panel."""
        c = self.c
        rows_left = [(label, h.name, True), ("EMAIL", h.email or "—", False)]
        if h.wallet_address:
            lab = f"WALLET ADDRESS — {h.network.upper()}" if h.network else "WALLET ADDRESS"
            rows_left.append((lab, h.wallet_address, False))
        rows_right = [("DOCUMENT NO.", self.ref), ("ISSUED", f"{day(self.issued)} {self.issued:%H:%M} UTC")]
        rows_right += [(k.upper(), v) for k, v in h.extra]
        n = max(len(rows_left), len(rows_right))
        ph = 18 + n * 25
        self.ensure(ph + 8)
        top = self.y
        c.setFillColor(PANEL)
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.7)
        c.roundRect(LEFT, top - ph, CONTENT_W, ph, 6, stroke=1, fill=1)
        split = LEFT + CONTENT_W * 0.64
        yy = top - 16
        for lab, val, strong in rows_left:
            draw(c, LEFT + 14, yy, lab, "Helvetica", 6.6, MUTED)
            draw(c, LEFT + 14, yy - 11, clip(val, "Helvetica-Bold" if strong else "Helvetica",
                                               10 if strong else 8.6, split - LEFT - 26),
                 "Helvetica-Bold" if strong else "Helvetica", 10 if strong else 8.6, INK)
            yy -= 25
        yy = top - 16
        for lab, val in rows_right:
            draw(c, split + 12, yy, lab, "Helvetica", 6.6, MUTED)
            draw(c, split + 12, yy - 11, clip(val, "Helvetica", 8.6, RIGHT - split - 24),
                 "Helvetica", 8.6, INK)
            yy -= 25
        self.y = top - ph - 16

    def summary(self, fields: list, cols: int = 3):
        """A panel of figures: [(label, value) or (label, value, strong)]."""
        if not fields:
            return
        c = self.c
        rows = (len(fields) + cols - 1) // cols
        ph = 14 + rows * 34
        self.ensure(ph + 8)
        top = self.y
        c.setFillColor(WHITE)
        c.setStrokeColor(GOLD)
        c.setLineWidth(0.7)
        c.roundRect(LEFT, top - ph, CONTENT_W, ph, 6, stroke=1, fill=1)
        cw = CONTENT_W / cols
        for i, f in enumerate(fields):
            label, value = f[0], f[1]
            strong = len(f) > 2 and f[2]
            col, row = i % cols, i // cols
            x = LEFT + 14 + col * cw
            yy = top - 18 - row * 34
            draw(c, x, yy, str(label).upper(), "Helvetica", 6.6, MUTED)
            draw(c, x, yy - 14, clip(value, "Helvetica-Bold", 10.5, cw - 22),
                 "Helvetica-Bold", 10.5, GREEN_D if strong else INK)
        self.y = top - ph - 18

    def section(self, title: str, hint: str = ""):
        # Room for the heading, a table header and a first row — never a stranded heading.
        self.ensure(90)
        c = self.c
        draw(c, LEFT, self.y, title, "Helvetica-Bold", 11.5, INK)
        if hint:
            draw(c, RIGHT, self.y, hint, "Helvetica-Oblique", 8, MUTED, "right")
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.2)
        c.line(LEFT, self.y - 6, LEFT + 44, self.y - 6)
        c.setStrokeColor(GOLD_L)
        c.setLineWidth(0.5)
        c.line(LEFT + 44, self.y - 6, RIGHT, self.y - 6)
        self.y -= 22

    def kv(self, rows: list, label_w: float = 150):
        """Label / value lines (values wrap)."""
        c = self.c
        for r in rows:
            label, value = r[0], r[1]
            strong = len(r) > 2 and r[2]
            font = "Helvetica-Bold" if strong else "Helvetica"
            lines = wrap(value if value not in (None, "") else "—", font, 9.2, CONTENT_W - label_w - 8)
            self.ensure(14 * len(lines) + 4)
            draw(c, LEFT + 4, self.y, label, "Helvetica", 8.4, MUTED)
            for ln in lines:
                draw(c, LEFT + label_w, self.y, ln, font, 9.2, GREEN_D if strong else INK)
                self.y -= 13.5
            self.y -= 3

    def paragraph(self, text: str, size: float = 8.8, color=MUTED, font: str = "Helvetica"):
        for ln in wrap(text, font, size, CONTENT_W):
            self.ensure(size + 6)
            draw(self.c, LEFT, self.y, ln, font, size, color)
            self.y -= size + 4
        self.y -= 4

    def table(self, columns: list, rows: list[dict], *, empty: str = "No records.",
              totals: dict | None = None):
        cols = [as_col(x) for x in columns]
        c = self.c
        total_w = sum(col.weight for col in cols) or 1
        xs, x = [], LEFT
        for col in cols:
            w = CONTENT_W * col.weight / total_w
            xs.append((x, w))
            x += w
        pad = 5

        def header():
            c.setFillColor(INK)
            c.roundRect(LEFT, self.y - 6, CONTENT_W, 19, 3, stroke=0, fill=1)
            for col, (cx0, cw) in zip(cols, xs):
                tx = cx0 + cw - pad if col.align == "right" else (cx0 + cw / 2 if col.align == "center" else cx0 + pad)
                draw(c, tx, self.y, clip(col.header.upper(), "Helvetica-Bold", 6.8, cw - 2 * pad),
                     "Helvetica-Bold", 6.8, WHITE, col.align)
            self.y -= 21

        self.ensure(19 + 40)
        header()
        self._table_header_again = header
        if not rows:
            draw(c, LEFT + pad, self.y, empty, "Helvetica-Oblique", 9, MUTED)
            self.y -= 18
        for i, row in enumerate(rows):
            cells = []
            n_lines = 1
            for col, (cx0, cw) in zip(cols, xs):
                val = show(row.get(col.key, ""), col.fmt)
                if col.wrap:
                    lines = wrap(val, "Helvetica", 8.2, cw - 2 * pad, max_lines=2)
                else:
                    lines = [clip(val, "Helvetica", 8.2, cw - 2 * pad)]
                n_lines = max(n_lines, len(lines))
                cells.append(lines)
            rh = 8 + 10.5 * n_lines
            if self.y - rh < BOTTOM:
                self.new_page()
            if i % 2:
                c.setFillColor(PANEL)
                c.rect(LEFT, self.y - rh + 9, CONTENT_W, rh, stroke=0, fill=1)
            for col, (cx0, cw), lines in zip(cols, xs, cells):
                color = INK
                font = "Helvetica"
                raw = show(row.get(col.key, ""), col.fmt)
                if col.tone == "signed" and raw:
                    color = RED if raw.lstrip().startswith("-") else GREEN_D
                    font = "Helvetica-Bold"
                elif col.tone == "status":
                    color = _STATUS_TONE.get(raw.strip().lower(), INK)
                    font = "Helvetica-Bold"
                tx = cx0 + cw - pad if col.align == "right" else (cx0 + cw / 2 if col.align == "center" else cx0 + pad)
                ly = self.y
                for ln in lines:
                    draw(c, tx, ly, ln, font, 8.2, color, col.align)
                    ly -= 10.5
            self.y -= rh
        self._table_header_again = None
        if totals:
            self.ensure(24)
            c.setStrokeColor(GOLD)
            c.setLineWidth(0.9)
            c.line(LEFT, self.y + 7, RIGHT, self.y + 7)
            for col, (cx0, cw) in zip(cols, xs):
                val = totals.get(col.key)
                if val in (None, ""):
                    continue
                val = show(val, col.fmt) if col.fmt in ("money", "signed", "int") else str(val)
                tx = cx0 + cw - pad if col.align == "right" else cx0 + pad
                draw(c, tx, self.y - 6, clip(val, "Helvetica-Bold", 8.6, cw - 2 * pad),
                     "Helvetica-Bold", 8.6, INK, col.align)
            self.y -= 24
        self.y -= 10

    def finish(self) -> bytes:
        self.c.showPage()
        self.c.save()
        return self.buf.getvalue()


def doc_ref(prefix: str, obj_id=None, when: datetime | None = None) -> str:
    """Stable document numbers: <PREFIX>-<yyyymmdd>-<first 8 of the id>."""
    when = when or timezone.now()
    tail = str(obj_id or "").replace("-", "")[:8].upper() or when.strftime("%H%M%S")
    return f"{prefix}-{when:%Y%m%d}-{tail}"
