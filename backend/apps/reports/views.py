"""
Reports-export API — Phase 13. Self-scoped, read-only export of the CALLER's own data
into a downloadable CSV or PDF. NO new business logic / figures — adapters reuse the same
querysets the existing page endpoints serve; this view only chooses the format and streams
the file. Reuses the certificate `FileResponse` download pattern.

  GET /api/reports/<context>/export?format=csv|pdf[&year=YYYY][&period=...]
        context ∈ {wallet, distributions, owner-earnings, lp, broker-commissions}
  GET /api/reports/distributions/tax?year=YYYY      (PDF informational annual summary)
"""
import io

from django.http import FileResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .adapters import ADAPTERS, distributions_tax
from .export import to_csv
from .pdf import render_statement_pdf


def _filename(context: str, fmt: str) -> str:
    stamp = timezone.now().strftime("%Y%m%d")
    return f"capimax-{context}-{stamp}.{fmt}"


def _stream(data: bytes, filename: str, content_type: str) -> FileResponse:
    # Mirrors the certificate PDF download (apps/certificates/views.py).
    return FileResponse(
        io.BytesIO(data), as_attachment=True, filename=filename, content_type=content_type
    )


def _build(payload: dict, fmt: str, filename_ctx: str) -> FileResponse:
    if fmt == "pdf":
        kwargs = dict(
            title=payload["title"], period=payload.get("period", ""),
            columns=payload["columns"], rows=payload["rows"], meta=payload.get("meta"),
        )
        # Only override the renderer's default disclaimer when the adapter supplied one.
        if payload.get("disclaimer"):
            kwargs["disclaimer"] = payload["disclaimer"]
        return _stream(render_statement_pdf(**kwargs), _filename(filename_ctx, "pdf"), "application/pdf")
    csv_bytes = to_csv(payload["columns"], payload["rows"])
    return _stream(csv_bytes, _filename(filename_ctx, "csv"), "text/csv")


class ReportExportView(APIView):
    """Export one of the caller's report contexts as CSV (default) or PDF."""

    permission_classes = [IsAuthenticated]

    def get(self, request, context):
        adapter = ADAPTERS.get(context)
        if adapter is None:
            return Response(
                {"detail": f"Unknown report context '{context}'."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # NB: the param is `fmt`, NOT `format` — DRF reserves `?format=` for content
        # negotiation and would 404 on an unknown renderer before this view runs.
        fmt = (request.query_params.get("fmt") or "csv").lower()
        if fmt not in ("csv", "pdf"):
            fmt = "csv"
        payload = adapter(
            request.user,
            year=request.query_params.get("year"),
            period=request.query_params.get("period", ""),
        )
        return _build(payload, fmt, context)


class DistributionsTaxView(APIView):
    """INFORMATIONAL annual distribution-income summary (PDF). NOT a tax document."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = distributions_tax(request.user, year=request.query_params.get("year"))
        pdf = render_statement_pdf(
            title=payload["title"], period=payload.get("period", ""),
            columns=payload["columns"], rows=payload["rows"],
            meta=payload.get("meta"), disclaimer=payload["disclaimer"],
        )
        return _stream(pdf, _filename("distributions-tax", "pdf"), "application/pdf")
