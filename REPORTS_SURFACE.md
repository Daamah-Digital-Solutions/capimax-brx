# REPORTS_SURFACE.md — export/report-generation surface investigation

> Read-only. No code changed. Read only the listed targets; grepped only within `src/pages`,
> `src/components`, `backend/apps/reports`. Cited as `file:line`.

Context: DASHBOARD_GAPS.md bucketed every Export/Download/Tax/Statement button as
**A-BLOCKED:reports-export** (no document-generation backend). This inventories what each must produce
before we build it.

---

## 0. Backend stub + existing PDF tooling

- **`backend/apps/reports/`** is an **empty Phase-1 stub** — `models.py` comment-only ([reports/models.py:1-3](backend/apps/reports/models.py:1)),
  `admin.py` comment-only, `apps.py` only, `migrations/` = `__init__.py` only. **No models/views/urls/services.**
- **Existing PDF tooling (REUSE THIS — don't add a new lib):** certificates render PDFs with **ReportLab**
  (pure-Python canvas, chosen over WeasyPrint to avoid cairo/pango on Windows) + **qrcode** for QR
  ([certificates/pdf.py:1-21,56](backend/apps/certificates/pdf.py:56) — `render_certificate_pdf(cert) -> bytes`).
  Storage/serve pattern: `cert.pdf_file.save(name, ContentFile(pdf_bytes))` ([certificates/services.py:130-133](backend/apps/certificates/services.py:130))
  on a `FileField` ([certificates/models.py:70](backend/apps/certificates/models.py:70)), served via
  `FileResponse(..., content_type="application/pdf")` ([certificates/views.py:72-76](backend/apps/certificates/views.py:72)).
  **CSV** needs no library — stdlib `csv` → bytes → `FileResponse`/`HttpResponse`.

---

## 1. Inventory — every export button, by role

| # | Button (file:line) | Exports WHAT | Format implied | Scope | Real data today? |
|---|---|---|---|---|---|
| **Investor** |
| 1 | Distributions **Export Statement** ([Distributions.tsx:73](src/pages/Distributions.tsx:73)) | the distributions payout list (per-property cash credits) | PDF statement | per-period / full | ✅ `distributionsApi` |
| 2 | Distributions **Tax Report** ([Distributions.tsx:77](src/pages/Distributions.tsx:77)) | annual summary of distributions received | PDF **tax document** | per tax year | ✅ same data, year-grouped |
| 3 | Wallet **Export** ([Wallet.tsx:225](src/pages/Wallet.tsx:225)) | the internal-balance ledger (credits/debits) | **CSV** (raw rows) — maybe PDF too | full list | ✅ `/wallets/balance/transactions/` (just built) |
| 4 | Reports **Export Full / تصدير شامل** ([Reports.tsx:88](src/pages/Reports.tsx:88)) | portfolio analytics + a report catalog | PDF (multi-section) | full portfolio | ❌ **mock** (portfolioMetrics/propertyPerformance/recentReports) |
| 5 | Installments **Export Schedule** ([Installments.tsx:159](src/pages/Installments.tsx:159)) | the installment payment schedule | PDF/CSV schedule | full schedule | ❌ **installments domain unbuilt** |
| 6 | Documents **View/Download** ([Documents.tsx:327](src/pages/Documents.tsx:327) /:330) | a stored document (per row) | file download | per-document | ⚠️ NOT a report — a **document store** (A:documents, separate) |
| **Owner / Developer** |
| 7 | OwnerDashboard **Download comprehensive report / تقرير شامل** ([OwnerDashboard.tsx:220](src/pages/OwnerDashboard.tsx:220)) | owner assets + earnings summary | PDF | full | ✅ `ownerApi.earnings()` (+ dashboard metrics) |
| 8 | OwnerReports **Export Report** ([OwnerReports.tsx:97](src/pages/OwnerReports.tsx:97)) | per-property net proceeds / units sold / investors | PDF/CSV | full / per-period | ✅ `ownerApi.earnings()` |
| **LP** (one component, 4 buttons — [LPReports.tsx:92-107](src/components/liquidity/LPReports.tsx:92)) |
| 9 | **Monthly / Quarterly / Annual Report** ×3 | period-grouped deposits/earnings/withdrawals/net (already computed client-side from real LP tx) | PDF period report | per-period | ✅ `LPTransaction[]` (real) |
| 10 | **Export Data** | the raw LP transaction list | **CSV** | full | ✅ same |
| **Broker** |
| 11 | Commissions **Export Report** ([Commissions.tsx:131](src/pages/Commissions.tsx:131)) | the broker commission ledger | CSV/PDF | full | ⚠️ page is **mock**, but real data exists (`brokerApi.commissions`) |

---

## 2. Data sources — export is rendering EXISTING self-scoped data (no new business logic)

For the **real-data** exports (1,2,3,7,8,9,10, and broker via the live endpoint), the data already
exists and is self-scoped — the export is purely "render rows I already serve into a file":
- **Wallet** → `BalanceTransaction` (the new `/wallets/balance/transactions/`).
- **Distributions** → the distributions payout list (`distributionsApi`, Phase 9 — pro-rata credits).
- **Owner** → `ownerApi.earnings()` (per-property net proceeds, units sold, investors — Phase 7 Wave D).
- **LP** → `LPTransaction[]` (deposits/earnings/withdrawals — already grouped into monthly/YTD client-side).
- **Broker** → `brokerApi.commissions()` (the commission ledger + referrals — Phase 12 Wave B).

**Blocked-twice (need DATA first, not just an exporter):**
- **Reports.tsx (#4)** — portfolioMetrics, propertyPerformance, `recentReports` are ALL mock
  ([Reports.tsx:30-63](src/pages/Reports.tsx:30)). It's a dashboard + a report-document **catalog**
  (categories incl. a `tax` category, count badges, a list of named generated reports). Exporting it needs
  a real portfolio-analytics source AND (for the catalog) a notion of stored report documents.
- **Installments.tsx (#5)** — the installments domain is unbuilt; no schedule data to export.
- **Documents.tsx (#6)** — a document STORE (download existing files), not report generation — out of
  reports-export scope (bucket A:documents).

So: **most exports are zero-business-logic** (existing self-scoped rows → file). Reports + Installments are
the exceptions and should be deferred until their data layers exist.

## 3. Existing PDF tooling (confirmed)

- **PDF: ReportLab** (`render_*_pdf(obj) -> bytes` via the canvas API) — reuse the `certificates/pdf.py`
  pattern; the brand header band / section / table helpers there are directly adaptable to a "statement"
  layout. **qrcode** available if a verify-QR is wanted on statements.
- **CSV: stdlib `csv`** (no library) → bytes → `FileResponse`/`HttpResponse(content_type="text/csv")`.
- **Serve:** `FileResponse(bytes_or_file, as_attachment=True, filename=..., content_type=...)` (mirrors
  the certificate download). Optional `FileField` caching like certificates, or stream bytes directly
  (statements are cheap + change as new rows arrive, so **generate-on-demand** is simpler than caching).

## 4. Shared vs per-role — recommended smallest design

Two real shapes, not one:
- **(a) Raw list export (CSV)** — "export this table": Wallet ledger, LP raw data, broker ledger, owner
  per-property rows. This is a **single generic helper**: `(rows, columns) -> CSV bytes`. Clears the
  "Export"/"Export Data" buttons with almost no per-role work.
- **(b) Formatted statement (PDF)** — Distributions statement, OwnerReports, LP period reports, the
  owner "comprehensive report". A **single reusable ReportLab "statement" layout** (header band + titled
  sections + a table), parameterized by `{title, period, summary rows, line-item table}`; each context
  supplies its already-existing data.

**Recommendation (smallest):** one `apps/reports` export service with TWO renderers — `to_csv(rows, cols)`
and `to_statement_pdf(title, sections, table)` — plus thin **per-context data adapters** (each gathers its
self-scoped queryset and maps to rows). Endpoints: `GET /api/reports/<context>/export?format=csv|pdf`
(self-scoped, read-only). The **Tax Report** is a third, narrower PDF layout (annual grouping + a
"informational summary" header) built on the same statement renderer. Build order: CSV generic first
(clears the most buttons), then the PDF statement, then the tax layout; **defer Reports.tsx + Installments**
(no data yet).

## 5. Open questions (don't decide)

1. **PDF vs CSV per button** — some want BOTH (a human-readable PDF statement + a raw CSV). Which buttons
   are CSV-only (Wallet/LP "Export Data") vs PDF-only (Distributions "Statement", owner "comprehensive")
   vs both?
2. **Tax documents** ([Distributions.tsx:77](src/pages/Distributions.tsx:77), Reports `tax` category) — a
   specific legal form (1099 / local equivalent) or just an **informational annual summary**? On an
   UNAUDITED testnet, almost certainly informational — confirm (the certificate footer already disclaims
   "not an offer of securities").
3. **Reports.tsx scope** — is it a real **analytics dashboard** (needs a portfolio-analytics data source
   first), or just an **export hub / report library**? Its `recentReports` catalog implies **stored report
   documents** (a `Report` model with category + file) vs generate-on-demand. Decide before building #4.
4. **Caching vs on-demand** — cache generated PDFs on a `FileField` (like certificates) or stream fresh
   each request? Statements change as new rows land, so on-demand is likely simpler.
5. **Per-period parameters** — the period filters (Monthly/Quarterly/Annual, the Reports/OwnerReports
   period selects) must pass through to the export endpoint (e.g. `?period=2024-Q4`).

---

## Bottom line

`apps/reports` is an **empty stub**. **11 export buttons** across investor/owner/LP/broker + the shared
Reports page. **Most are zero-business-logic** — render already-served, self-scoped data (wallet ledger,
distributions, owner earnings, LP transactions, broker commissions) into a file. **Reuse the existing
ReportLab + qrcode stack** (certificates/pdf.py) for PDF and **stdlib `csv`** for CSV; serve via
`FileResponse`. Smallest design = **one export service with a generic CSV renderer + a reusable ReportLab
"statement" PDF renderer + thin per-context data adapters**, behind self-scoped `GET …/export?format=`
endpoints. **Defer Reports.tsx (mock dashboard + report catalog) and Installments (domain unbuilt)** — they
need a data layer first, not just an exporter. Biggest open decisions: **PDF-vs-CSV (or both) per button**,
whether **tax reports** are a legal form or an informational summary, and whether **Reports.tsx** is a
dashboard or a stored-report library.
