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

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.kyc import sumsub

from .models import PartnerDirectoryStatus, PartnerProfile
from .serializers import (
    PartnerApplySerializer,
    PartnerDirectorySerializer,
    PartnerKYBSubmitSerializer,
    PartnerProfileSerializer,
    PublicPartnerSerializer,
)
from .services import submit_kyb, update_directory_details

log = logging.getLogger(__name__)


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
