"""
Partner API — Phase 11 Wave A (PARTNERS_SURFACE.md). Backs the partner KYB onboarding +
directory-details entry (src/hooks/usePartnerProfile.ts) and the PUBLIC directory
(Partners.tsx).

Partner-scoped (auth; a caller only ever sees/edits their OWN partner row):
  GET   /api/partner/profile/            Own partner profile (404 → frontend null).
  POST  /api/partner/profile/            Apply as partner (create); or, if one exists,
                                         update own public-directory fields. Idempotent.
  POST  /api/partner/kyb/submit/         Persist business info → KYB under_review.
  POST  /api/partner/kyb/access-token/   Sumsub WebSDK token (partner business level;
                                         503 when keys deferred).

Public (AllowAny):
  GET   /api/partners/directory/         The public partners directory — ONLY partners
                                         whose directory_status == approved.

KYB approval is AUTOMATIC via the shared signed Sumsub webhook (partner business level)
— no admin in the normal path. Directory visibility is a SEPARATE admin approve/reject
step (Django admin). Mirrors apps/developer/views.py (KYB subset). NO money anywhere.
"""
import logging

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasActivatedPartner
from apps.kyc import sumsub

from .models import (
    Assignment,
    AssignmentEvent,
    Deliverable,
    DeliverableDocument,
    PartnerDirectoryStatus,
    PartnerProfile,
)
from .serializers import (
    AssignmentEventSerializer,
    AssignmentSerializer,
    PartnerApplySerializer,
    PartnerDirectorySerializer,
    PartnerKYBSubmitSerializer,
    PartnerProfileSerializer,
    PublicPartnerSerializer,
)
from .services import (
    submit_assignment,
    submit_kyb,
    update_directory_details,
    upload_deliverable_document,
)

log = logging.getLogger(__name__)

# Cap the derived activity feed so the portal list stays light.
ACTIVITY_LIMIT = 50


def _get_partner(user):
    return PartnerProfile.objects.filter(user=user).first()


class PartnerProfileView(APIView):
    """
    GET the caller's partner profile (404 if none). POST to apply (create) when none
    exists, or to update the caller's own public-directory fields when one does. Both
    idempotent; the partner never sets status / directory_status here.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        partner = _get_partner(request.user)
        if partner is None:
            return Response(
                {"detail": "No partner profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PartnerProfileSerializer(partner).data)

    def post(self, request):
        existing = _get_partner(request.user)
        if existing is not None:
            # Update the partner's own directory details (no status change).
            serializer = PartnerDirectorySerializer(data=request.data or {})
            serializer.is_valid(raise_exception=True)
            partner = update_directory_details(existing, details=serializer.validated_data)
            return Response(PartnerProfileSerializer(partner).data)

        serializer = PartnerApplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        partner = PartnerProfile.objects.create(
            user=request.user,
            contact_name=data["contact_name"],
            email=data["email"],
            phone=data.get("phone") or None,
            # Directory fields may be supplied at apply time (all optional).
            company_name=data.get("company_name") or None,
            company_name_ar=data.get("company_name_ar") or None,
            category=data.get("category") or None,
            description=data.get("description") or None,
            description_ar=data.get("description_ar") or None,
            logo_url=data.get("logo_url") or None,
            country=data.get("country") or None,
            country_ar=data.get("country_ar") or None,
            website=data.get("website") or None,
        )
        return Response(
            PartnerProfileSerializer(partner).data, status=status.HTTP_201_CREATED
        )


class PartnerKYBSubmitView(APIView):
    """Persist business info + advance KYB to `under_review` (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        partner = _get_partner(request.user)
        if partner is None:
            return Response(
                {"detail": "Apply as a partner before submitting KYB."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PartnerKYBSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        partner = submit_kyb(partner, business_info=serializer.validated_data)
        return Response(PartnerProfileSerializer(partner).data)


class PartnerKYBAccessTokenView(APIView):
    """
    Issue a Sumsub WebSDK access token for partner KYB (partner business level). When
    Sumsub is unconfigured (deferred keys) returns 503 + a machine code so the frontend
    degrades to the form/dev path rather than breaking — mirrors developer KYB.
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
        partner = _get_partner(request.user)
        if partner is None:
            return Response(
                {"detail": "Apply as a partner first."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            if not partner.sumsub_applicant_id:
                partner.sumsub_applicant_id = sumsub.create_applicant(
                    request.user.pk, level_name=settings.SUMSUB_PARTNER_KYB_LEVEL_NAME
                )
                partner.mark_kyb_submitted()
                partner.save()
            token = sumsub.issue_access_token(
                request.user.pk, level_name=settings.SUMSUB_PARTNER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Sumsub partner-KYB access-token issue failed for user %s", request.user.pk)
            return Response(
                {"configured": True, "code": "kyb_provider_error",
                 "detail": "Could not start verification. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"configured": True, "token": token})


class PublicPartnerDirectoryView(APIView):
    """
    The PUBLIC partners directory. AllowAny. Returns ONLY partners whose
    directory_status == approved (the separate admin-approved listing), shaped to
    Partners.tsx. Never exposes contact/KYB/Sumsub internals.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # truly public listing

    def get(self, request):
        qs = (
            PartnerProfile.objects.filter(
                directory_status=PartnerDirectoryStatus.APPROVED
            )
            .exclude(company_name__isnull=True)
            .exclude(company_name="")
            .order_by("company_name")
        )
        return Response(PublicPartnerSerializer(qs, many=True).data)


# =========================================================================== #
# Wave B — the partner WORK PORTAL (StrategicPartners.tsx). All endpoints are gated
# [IsAuthenticated, HasActivatedPartner] and SELF-SCOPED to the caller's own assignments
# (cross-partner access → 404). Admin assignment + review happen in the Django admin
# (the sanctioned admin surfaces). NO money anywhere.
# =========================================================================== #
def _partner_or_403(request):
    """The caller's PartnerProfile (HasActivatedPartner already guaranteed it's approved)."""
    return request.user.partner_profile


def _own_assignment(request, assignment_id):
    """Self-scoped lookup: only the caller-partner's own assignment (else 404)."""
    partner = _partner_or_403(request)
    return get_object_or_404(Assignment, pk=assignment_id, partner=partner)


def _own_deliverable(request, deliverable_id):
    """Self-scoped lookup: a deliverable on one of the caller-partner's assignments."""
    partner = _partner_or_403(request)
    return get_object_or_404(
        Deliverable, pk=deliverable_id, assignment__partner=partner
    )


class PartnerAssignmentsView(APIView):
    """GET the caller-partner's assignments + the derived activity feed."""

    permission_classes = [IsAuthenticated, HasActivatedPartner]

    def get(self, request):
        partner = _partner_or_403(request)
        assignments = (
            Assignment.objects.filter(partner=partner)
            .prefetch_related("deliverables", "deliverables__documents")
        )
        events = (
            AssignmentEvent.objects.filter(assignment__partner=partner)
            .select_related("assignment")[:ACTIVITY_LIMIT]
        )
        return Response({
            "assignments": AssignmentSerializer(assignments, many=True).data,
            "activity": AssignmentEventSerializer(events, many=True).data,
        })


class PartnerAssignmentDetailView(APIView):
    """GET one of the caller-partner's own assignments (404 if not theirs)."""

    permission_classes = [IsAuthenticated, HasActivatedPartner]

    def get(self, request, assignment_id):
        assignment = _own_assignment(request, assignment_id)
        return Response(AssignmentSerializer(assignment).data)


class DeliverableUploadView(APIView):
    """POST (multipart): the partner uploads a document for one of their deliverables."""

    permission_classes = [IsAuthenticated, HasActivatedPartner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, deliverable_id):
        deliverable = _own_deliverable(request, deliverable_id)
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "A file is required.", "code": "no_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        upload_deliverable_document(
            deliverable, file=upload,
            original_filename=getattr(upload, "name", "document"),
            file_size=getattr(upload, "size", None),
            actor=request.user,
        )
        # Return the refreshed assignment so the UI updates status/progress/feed.
        assignment = Assignment.objects.get(pk=deliverable.assignment_id)
        return Response(
            AssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED
        )


class AssignmentSubmitView(APIView):
    """POST: the partner marks an assignment ready for review (→ submitted)."""

    permission_classes = [IsAuthenticated, HasActivatedPartner]

    def post(self, request, assignment_id):
        assignment = _own_assignment(request, assignment_id)
        assignment = submit_assignment(assignment, actor=request.user)
        return Response(AssignmentSerializer(assignment).data)


class DeliverableDocumentDownloadView(APIView):
    """Partner-scoped download of one of their own deliverable documents (blob)."""

    permission_classes = [IsAuthenticated, HasActivatedPartner]

    def get(self, request, document_id):
        partner = _partner_or_403(request)
        doc = get_object_or_404(
            DeliverableDocument, pk=document_id, assignment__partner=partner
        )
        if not doc.file:
            return Response({"detail": "No file."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            doc.file.open("rb"), as_attachment=True, filename=doc.original_filename
        )
