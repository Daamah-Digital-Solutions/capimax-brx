"""
Owner API — Phase 7 Wave A (OWNER_SURFACE.md). Backs the owner KYB onboarding entry
(src/hooks/useOwnerProfile.ts).

  GET   /api/owner/profile/            Own owner profile (404 → frontend treats as null).
  POST  /api/owner/profile/            Apply as owner (create; idempotent).
  POST  /api/owner/kyb/submit/         Persist business info → KYB under_review.
  POST  /api/owner/kyb/access-token/   Sumsub WebSDK token (owner business level; 503
                                       when keys deferred).

Everything is OWNER-SCOPED: a caller only ever sees/edits their own owner row.
KYB approval is AUTOMATIC via the shared signed Sumsub webhook (owner business
level) — no admin in the normal path. Mirrors apps/lp/views.py.
"""
import logging

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasActivatedOwner
from apps.kyc import sumsub

from .models import OwnerProfile, PropertySubmission, SubmissionDocument, SubmissionStatus
from .serializers import (
    OwnerApplySerializer,
    OwnerKYBSubmitSerializer,
    OwnerProfileSerializer,
    PropertySubmissionSerializer,
    PropertySubmissionWriteSerializer,
    SubmissionDocumentSerializer,
)
from .services import MissingRequiredDocuments, submit_kyb, submit_submission

log = logging.getLogger(__name__)


def _get_owner(user):
    return OwnerProfile.objects.filter(user=user).first()


class OwnerProfileView(APIView):
    """GET the caller's owner profile (404 if none); POST to apply (idempotent)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "No owner profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(OwnerProfileSerializer(owner).data)

    def post(self, request):
        existing = _get_owner(request.user)
        if existing is not None:
            # Idempotent: applying again just returns the current profile.
            return Response(OwnerProfileSerializer(existing).data)

        serializer = OwnerApplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        owner = OwnerProfile.objects.create(
            user=request.user,
            company_name=data.get("company_name") or None,
            contact_name=data["contact_name"],
            email=data["email"],
            phone=data.get("phone") or None,
            country=data.get("country") or None,
        )
        return Response(
            OwnerProfileSerializer(owner).data, status=status.HTTP_201_CREATED
        )


class OwnerKYBSubmitView(APIView):
    """Persist business info + advance KYB to `under_review` (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "Apply as an owner before submitting KYB."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = OwnerKYBSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        owner = submit_kyb(owner, business_info=serializer.validated_data)
        return Response(OwnerProfileSerializer(owner).data)


class OwnerKYBAccessTokenView(APIView):
    """
    Issue a Sumsub WebSDK access token for owner KYB (owner business level). When
    Sumsub is unconfigured (deferred keys) returns 503 + a machine code so the
    frontend degrades to the form/dev path rather than breaking — mirrors LP KYB.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.conf import settings

        if not sumsub.is_configured():
            return Response(
                {"configured": False, "code": "kyb_provider_unconfigured",
                 "detail": "KYB provider is not configured yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        owner = _get_owner(request.user)
        if owner is None:
            return Response(
                {"detail": "Apply as an owner first."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            if not owner.sumsub_applicant_id:
                owner.sumsub_applicant_id = sumsub.create_applicant(
                    request.user.pk, level_name=settings.SUMSUB_OWNER_KYB_LEVEL_NAME
                )
                owner.mark_kyb_submitted()
                owner.save()
            token = sumsub.issue_access_token(
                request.user.pk, level_name=settings.SUMSUB_OWNER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Sumsub owner-KYB access-token issue failed for user %s", request.user.pk)
            return Response(
                {"configured": True, "code": "kyb_provider_error",
                 "detail": "Could not start verification. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"configured": True, "token": token})


# --------------------------------------------------------------------------- #
# Property submission intake — Phase 7 Wave B. ALL gated [IsAuthenticated,
# HasActivatedOwner] (KYB-gated, like investing requires approved KYC) and
# OWNER-SCOPED (a caller only ever sees/edits their OWN submissions/documents). NO
# Property row is created or published in this wave (that is Wave C).
# --------------------------------------------------------------------------- #
def _get_submission(user, submission_id):
    """Owner-scoped lookup: only the submitter's own submission (else 404)."""
    return get_object_or_404(PropertySubmission, pk=submission_id, submitter=user)


class SubmissionsView(APIView):
    """GET the caller's submissions; POST to create a new DRAFT."""

    permission_classes = [IsAuthenticated, HasActivatedOwner]

    def get(self, request):
        subs = PropertySubmission.objects.filter(submitter=request.user)
        return Response(PropertySubmissionSerializer(subs, many=True).data)

    def post(self, request):
        serializer = PropertySubmissionWriteSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        sub = PropertySubmission.objects.create(
            submitter=request.user, **serializer.validated_data
        )
        return Response(
            PropertySubmissionSerializer(sub).data, status=status.HTTP_201_CREATED
        )


class SubmissionDetailView(APIView):
    """GET one own submission; PATCH content (only while DRAFT)."""

    permission_classes = [IsAuthenticated, HasActivatedOwner]

    def get(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        return Response(PropertySubmissionSerializer(sub).data)

    def patch(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        if sub.status != SubmissionStatus.DRAFT:
            return Response(
                {"detail": "Only a draft submission can be edited.",
                 "code": "not_a_draft"},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = PropertySubmissionWriteSerializer(
            data=request.data or {}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(sub, field, value)
        sub.save()
        return Response(PropertySubmissionSerializer(sub).data)


class SubmissionSubmitView(APIView):
    """POST: transition a DRAFT → SUBMITTED (validates required documents present)."""

    permission_classes = [IsAuthenticated, HasActivatedOwner]

    def post(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        try:
            sub = submit_submission(sub)
        except MissingRequiredDocuments as exc:
            return Response(
                {"detail": "Upload the required documents before submitting.",
                 "code": "missing_required_documents", "missing": exc.missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(PropertySubmissionSerializer(sub).data)


class SubmissionDocumentsView(APIView):
    """GET the submission's documents; POST to upload one (multipart)."""

    permission_classes = [IsAuthenticated, HasActivatedOwner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        docs = SubmissionDocument.objects.filter(submission=sub)
        return Response(SubmissionDocumentSerializer(docs, many=True).data)

    def post(self, request, submission_id):
        sub = _get_submission(request.user, submission_id)
        if sub.status != SubmissionStatus.DRAFT:
            return Response(
                {"detail": "Documents can only be added while the submission is a draft.",
                 "code": "not_a_draft"},
                status=status.HTTP_409_CONFLICT,
            )
        upload = request.FILES.get("file")
        document_type = request.data.get("document_type") or "other"
        document_name = request.data.get("document_name") or (
            upload.name if upload else "document"
        )
        doc = SubmissionDocument.objects.create(
            submission=sub,
            document_type=document_type,
            document_name=document_name,
            file=upload,
            file_size=getattr(upload, "size", None),
        )
        return Response(
            SubmissionDocumentSerializer(doc).data, status=status.HTTP_201_CREATED
        )


class SubmissionDocumentDetailView(APIView):
    """DELETE one of the caller's own submission documents (draft only)."""

    permission_classes = [IsAuthenticated, HasActivatedOwner]

    def delete(self, request, submission_id, doc_id):
        sub = _get_submission(request.user, submission_id)
        doc = get_object_or_404(SubmissionDocument, pk=doc_id, submission=sub)
        if sub.status != SubmissionStatus.DRAFT:
            return Response(
                {"detail": "Documents can only be removed while the submission is a draft.",
                 "code": "not_a_draft"},
                status=status.HTTP_409_CONFLICT,
            )
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubmissionDocumentDownloadView(APIView):
    """Owner-scoped download of a submission document (blob)."""

    permission_classes = [IsAuthenticated, HasActivatedOwner]

    def get(self, request, submission_id, doc_id):
        sub = _get_submission(request.user, submission_id)
        doc = get_object_or_404(SubmissionDocument, pk=doc_id, submission=sub)
        if not doc.file:
            return Response({"detail": "No file."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            doc.file.open("rb"), as_attachment=True, filename=doc.document_name
        )


# --------------------------------------------------------------------------- #
# Owner earnings / ledger — Phase 7 Wave D. Owner-scoped read of the owner's
# PRIMARY-sale proceeds (gross − platform/management fees) per property + totals.
# Balance + payout reuse the existing GET /api/wallets/balance/ and GET/POST
# /api/wallets/withdrawals/ — NO new withdrawal mechanism. NOT investor distributions.
# --------------------------------------------------------------------------- #
class OwnerEarningsView(APIView):
    """Summary of the caller's primary-sale earnings, per owned property + totals."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from decimal import Decimal, ROUND_HALF_UP

        from django.db.models import Count, Sum

        from apps.investments.models import Investment, PaymentStatus
        from apps.properties.models import Property

        rows = []
        total_net = Decimal("0")
        total_units = 0
        total_investors = 0
        # Only the caller's owned (submitted_by) properties.
        for prop in Property.objects.filter(submitted_by=request.user):
            agg = Investment.objects.filter(
                property=prop, payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
            ).aggregate(
                gross=Sum("amount_invested"),
                units=Sum("token_amount"),
                investors=Count("user", distinct=True),
            )
            gross = Decimal(agg["gross"] or 0)
            units = int(agg["units"] or 0)
            investors = int(agg["investors"] or 0)
            fee_percent = (prop.fee_platform or Decimal("0")) + (prop.fee_management or Decimal("0"))
            fees = (gross * fee_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            net = (gross - fees).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total_net += net
            total_units += units
            total_investors += investors
            rows.append({
                "property_id": prop.slug,
                "property_name": prop.name,
                "is_published": prop.is_published,
                "token_supply": int(prop.token_supply or 0),
                "units_sold": units,
                "investors": investors,
                "gross_proceeds": float(gross),
                "fees": float(fees),
                "net_proceeds": float(net),
            })

        return Response({
            "total_net_proceeds": float(total_net),
            "total_units_sold": total_units,
            "total_investors": total_investors,
            "properties": rows,
        })
