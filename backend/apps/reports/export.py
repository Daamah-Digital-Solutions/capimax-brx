"""
Reports-export — Phase 13. Generic, REUSABLE renderers that turn already-served,
self-scoped data into a downloadable file. There is NO business logic here and NO new
figures are computed — callers (apps/reports/adapters.py) pass in the exact rows their
existing page endpoints already return; this module only formats them.

  * to_csv(columns, rows)  → stdlib csv (no library), UTF-8 with a BOM so Excel opens
                             Arabic / $ correctly.
  * PDF lives in apps/reports/pdf.py (reuses the certificates ReportLab stack).
"""
from __future__ import annotations

import csv
import io

# UTF-8 byte-order mark — makes Excel render Arabic + symbols correctly on open.
_BOM = "﻿"


def _cell(value) -> str:
    if value is None:
        return ""
    return str(value)


def to_csv(columns: list[tuple[str, str]], rows: list[dict]) -> bytes:
    """
    Render rows → CSV bytes. `columns` is [(key, header), ...]; each row is a dict keyed
    by the column keys. Returns UTF-8 bytes prefixed with a BOM (Excel-friendly for AR).
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([header for _key, header in columns])
    for row in rows:
        writer.writerow([_cell(row.get(key, "")) for key, _header in columns])
    return (_BOM + buf.getvalue()).encode("utf-8")
