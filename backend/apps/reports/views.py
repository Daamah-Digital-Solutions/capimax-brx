"""
Reports-export API — Phase 13. Self-scoped, read-only export of the CALLER's own data
into a downloadable CSV or PDF. NO new business logic / figures — adapters reuse the same
querysets the existing page endpoints serve; this view only chooses the format and streams
the file. Reuses the certificate `FileResponse` download pattern.

  GET /api/reports/<context>/export?fmt=csv|pdf[&period=month|quarter|year][&year=YYYY]
                                       [&start=YYYY-MM-DD&end=YYYY-MM-DD]
        context ∈ {wallet, portfolio, analytics, distributions, installments,
                   owner-earnings, lp, broker-commissions}
  GET /api/reports/distributions/tax?year=YYYY      (PDF informational annual summary)
  GET /api/reports/installments/<plan id>/pdf/      (one plan's schedule)
"""
import io

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .adapters import ADAPTERS, distributions_tax, installment_plan, resolve_range
from .brand import holder_for
from .export import to_csv
from .pdf import render_payload


def _filename(context: str, fmt: str) -> str:
    stamp = timezone.now().strftime("%Y%m%d")
    return f"capimax-{context}-{stamp}.{fmt}"


def _stream(data: bytes, filename: str, content_type: str) -> FileResponse:
    # Mirrors the certificate PDF download (apps/certificates/views.py).
    return FileResponse(
        io.BytesIO(data), as_attachment=True, filename=filename, content_type=content_type
    )


def _build(payload: dict, fmt: str, filename_ctx: str, user) -> FileResponse:
    if fmt == "pdf":
        pdf = render_payload(payload, holder_for(user))
        return _stream(pdf, _filename(filename_ctx, "pdf"), "application/pdf")
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
        q = request.query_params
        rng = resolve_range(q.get("period", ""), q.get("year"), q.get("start"), q.get("end"))
        return _build(adapter(request.user, rng=rng), fmt, context, request.user)


class DistributionsTaxView(APIView):
    """INFORMATIONAL annual distribution-income summary (PDF). NOT a tax document."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = distributions_tax(request.user, year=request.query_params.get("year"))
        pdf = render_payload(payload, holder_for(request.user))
        return _stream(pdf, _filename("distributions-tax", "pdf"), "application/pdf")


class InstallmentPlanPdfView(APIView):
    """GET /api/reports/installments/<plan id>/pdf/ — one plan's schedule (owner only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, plan_id):
        payload = installment_plan(request.user, plan_id)
        pdf = render_payload(payload, holder_for(request.user))
        return _stream(pdf, _filename("installment-schedule", "pdf"), "application/pdf")


class ReceiptListView(APIView):
    """GET /api/reports/receipts/ — every receipt the caller can download (newest first)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .receipts import list_receipts

        return Response(list_receipts(request.user))


class ReceiptPdfView(APIView):
    """GET /api/reports/receipts/<ledger|payment|installment>/<id>/ — the receipt PDF (owner only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, kind, obj_id):
        from . import receipts

        builder = {
            "ledger": receipts.ledger_receipt,
            "payment": receipts.payment_receipt,
            "installment": receipts.installment_receipt,
        }.get(kind)
        if builder is None:
            raise Http404
        filename, pdf = builder(request.user, obj_id)
        return _stream(pdf, filename, "application/pdf")
