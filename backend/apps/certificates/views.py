"""
Certificate API — Phase 3 Wave 3 (SPEC §4.1 / §4.2 / §2.3).

  POST /api/certificates/generate/     Generate (idempotent) the PDF for an investment.
  GET  /api/certificates/              List the caller's certificates.
  GET  /api/certificates/{id}/pdf/     Owner-only PDF download.
  GET  /api/certificates/verify/{code}/  PUBLIC curated verification projection.
"""
import logging

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.investments.models import Investment

from .models import Certificate
from .serializers import CertificatePublicSerializer, CertificateSerializer
from .services import generate_certificate

log = logging.getLogger(__name__)


class CertificateGenerateView(APIView):
    """Generate (idempotent) the certificate PDF for one of the caller's investments."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        investment_id = request.data.get("investment_id")
        if not investment_id:
            return Response(
                {"success": False, "error": "investment_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Ownership: the investment must belong to the caller.
        try:
            investment = Investment.objects.get(id=investment_id, user=request.user)
        except (Investment.DoesNotExist, ValueError, Exception):
            return Response(
                {"success": False, "error": "Investment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        cert = generate_certificate(investment, status=request.data.get("status"))
        return Response(
            {"success": True, "certificate": CertificateSerializer(cert).data},
            status=status.HTTP_200_OK,
        )


class CertificateListView(APIView):
    """List the authenticated user's certificates (SPEC §2.3)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Certificate.objects.filter(user=request.user)
        return Response(CertificateSerializer(qs, many=True).data)


class CertificatePdfView(APIView):
    """Owner-only PDF download. Never serves another user's certificate."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            cert = Certificate.objects.get(pk=pk, user=request.user)
        except Certificate.DoesNotExist:
            raise Http404
        # Generate the PDF on first download (idempotent) so the button always works —
        # certificates are created provisionally and the PDF is rendered lazily. This
        # fixes the client-reported "download does nothing" (the file simply wasn't
        # rendered until someone opened it).
        if not cert.pdf_file and cert.investment_id:
            try:
                cert = generate_certificate(cert.investment)
            except Exception:  # noqa: BLE001 — surface as 404, never a 500
                log.exception("lazy certificate PDF generation failed (cert=%s)", cert.pk)
        if not cert.pdf_file:
            raise Http404("PDF could not be generated.")
        return FileResponse(
            cert.pdf_file.open("rb"),
            as_attachment=True,
            filename=f"{cert.certificate_id}.pdf",
            content_type="application/pdf",
        )


class CertificateVerifyView(APIView):
    """
    PUBLIC verification (SPEC §4.2 verify_certificate). Returns ONLY the curated
    projection for the certificate with this verification_code. No auth, no PII.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # truly public — never evaluate a token here

    def get(self, request, code):
        try:
            cert = Certificate.objects.get(verification_code=code)
        except Certificate.DoesNotExist:
            return Response(
                {"detail": "Certificate not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(CertificatePublicSerializer(cert).data)
