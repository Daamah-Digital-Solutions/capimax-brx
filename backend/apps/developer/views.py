"""
Developer API — Phase 8 Wave A (DEVELOPER_SURFACE.md). Backs the developer KYB
onboarding entry (src/hooks/useDeveloperProfile.ts).

  GET   /api/developer/profile/            Own developer profile (404 → frontend null).
  POST  /api/developer/profile/            Apply as developer (create; idempotent).
  POST  /api/developer/kyb/submit/         Persist business info → KYB under_review.
  POST  /api/developer/kyb/access-token/   Sumsub WebSDK token (developer business level;
                                           503 when keys deferred).

Everything is DEVELOPER-SCOPED: a caller only ever sees/edits their own developer row.
KYB approval is AUTOMATIC via the shared signed Sumsub webhook (developer business
level) — no admin in the normal path. Mirrors apps/owner/views.py (KYB subset).
"""
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.kyc import sumsub

from .models import DeveloperProfile
from .serializers import (
    DeveloperApplySerializer,
    DeveloperKYBSubmitSerializer,
    DeveloperProfileSerializer,
)
from .services import submit_kyb

log = logging.getLogger(__name__)


def _get_developer(user):
    return DeveloperProfile.objects.filter(user=user).first()


class DeveloperProfileView(APIView):
    """GET the caller's developer profile (404 if none); POST to apply (idempotent)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        developer = _get_developer(request.user)
        if developer is None:
            return Response(
                {"detail": "No developer profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(DeveloperProfileSerializer(developer).data)

    def post(self, request):
        existing = _get_developer(request.user)
        if existing is not None:
            # Idempotent: applying again just returns the current profile.
            return Response(DeveloperProfileSerializer(existing).data)

        serializer = DeveloperApplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        developer = DeveloperProfile.objects.create(
            user=request.user,
            company_name=data.get("company_name") or None,
            contact_name=data["contact_name"],
            email=data["email"],
            phone=data.get("phone") or None,
            country=data.get("country") or None,
        )
        return Response(
            DeveloperProfileSerializer(developer).data, status=status.HTTP_201_CREATED
        )


class DeveloperKYBSubmitView(APIView):
    """Persist business info + advance KYB to `under_review` (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        developer = _get_developer(request.user)
        if developer is None:
            return Response(
                {"detail": "Apply as a developer before submitting KYB."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = DeveloperKYBSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        developer = submit_kyb(developer, business_info=serializer.validated_data)
        return Response(DeveloperProfileSerializer(developer).data)


class DeveloperKYBAccessTokenView(APIView):
    """
    Issue a Sumsub WebSDK access token for developer KYB (developer business level).
    When Sumsub is unconfigured (deferred keys) returns 503 + a machine code so the
    frontend degrades to the form/dev path rather than breaking — mirrors owner KYB.
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
        developer = _get_developer(request.user)
        if developer is None:
            return Response(
                {"detail": "Apply as a developer first."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            if not developer.sumsub_applicant_id:
                developer.sumsub_applicant_id = sumsub.create_applicant(
                    request.user.pk, level_name=settings.SUMSUB_DEVELOPER_KYB_LEVEL_NAME
                )
                developer.mark_kyb_submitted()
                developer.save()
            token = sumsub.issue_access_token(
                request.user.pk, level_name=settings.SUMSUB_DEVELOPER_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Sumsub developer-KYB access-token issue failed for user %s", request.user.pk)
            return Response(
                {"configured": True, "code": "kyb_provider_error",
                 "detail": "Could not start verification. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"configured": True, "token": token})
