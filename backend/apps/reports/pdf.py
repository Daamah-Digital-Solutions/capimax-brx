"""
Statement / report PDFs in the shared Capimax BRX design (apps/reports/brand.py).

`render_payload` draws an adapter payload (holder block → summary panel → sections);
`render_statement_pdf` keeps the older single-table call used elsewhere (beneficiary
certificate) and draws it the same way. Layout only — no figures are derived here.
"""
from __future__ import annotations

from .brand import Doc, Holder, doc_ref

DEFAULT_DISCLAIMER = (
    "Informational only — generated from your Capimax BRX account records. Not a tax document "
    "and not an offer of securities."
)


def render_payload(payload: dict, holder: Holder | None = None) -> bytes:
    ref = payload.get("ref") or doc_ref(payload.get("ref_prefix", "DOC"), payload.get("ref_id"))
    d = Doc(title=payload["title"], ref=ref, subtitle=payload.get("subtitle", ""),
            note=payload.get("note") or DEFAULT_DISCLAIMER)
    if holder is not None:
        if payload.get("holder_extra"):
            holder.extra = list(holder.extra) + list(payload["holder_extra"])
        d.holder(holder)
    d.summary(payload.get("summary") or [])
    sections = payload.get("sections")
    if sections is None:
        sections = [{"title": payload.get("table_title", "Details"), "columns": payload["columns"],
                     "rows": payload["rows"], "totals": payload.get("totals")}]
    for s in sections:
        d.section(s["title"], s.get("hint", ""))
        d.table(s["columns"], s["rows"], empty=s.get("empty", "No records."), totals=s.get("totals"))
    for p in payload.get("paragraphs") or []:
        d.paragraph(p)
    return d.finish()


def render_statement_pdf(
    *,
    title: str,
    period: str = "",
    columns: list,
    rows: list[dict],
    meta: list[tuple[str, str]] | None = None,
    disclaimer: str = DEFAULT_DISCLAIMER,
    holder: Holder | None = None,
    ref: str | None = None,
    table_title: str = "Details",
) -> bytes:
    """Single-table document: `meta` becomes the summary panel."""
    return render_payload({
        "title": title, "subtitle": period, "ref": ref or doc_ref("DOC"), "note": disclaimer,
        "summary": [(k, str(v)) for k, v in (meta or [])],
        "sections": [{"title": table_title, "columns": columns, "rows": rows}],
    }, holder)
