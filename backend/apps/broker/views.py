"""
Broker API — Phase 12 Wave A (BROKER_SURFACE.md). Backs broker onboarding (apply →
upload/submit licence → see referral code/link once approved) and the public referral-code
resolve used at signup. Identity verification reuses the EXISTING investor KYC surface
(/api/kyc/*) — there is NO broker KYC endpoint here.

Broker-scoped (auth; a caller only ever sees/edits their OWN broker row):
  GET   /api/broker/profile/            Own broker profile (404 → frontend null). Includes
                                        kyc_status (mirrored from the shared UserKYC).
  POST  /api/broker/profile/            Apply as broker (create). Idempotent.
  POST  /api/broker/license/submit/     Persist licence number/authority/expiry.
  POST  /api/broker/license/upload/     Upload the licence document (multipart).

Public (AllowAny):
  GET   /api/broker/referral/resolve/?code=CODE   Validate a referral code at signup.

Licence approval is the SANCTIONED ADMIN step (Django admin), gated on the broker's
identity KYC already being approved (services.approve_license). NO money/commission here.
"""
import logging

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasActivatedBroker

from .models import BrokerProfile
from .serializers import (
    BrokerApplySerializer,
    BrokerLicenseSubmitSerializer,
    BrokerProfileSerializer,
)
from .services import (
    broker_property_stats,
    commission_ledger,
    resolve_referral_code,
    submit_license,
)

log = logging.getLogger(__name__)


def _get_broker(user):
    return BrokerProfile.objects.filter(user=user).first()


def _profile_payload(broker, user):
    """The profile body + the mirrored identity-KYC status (read from the shared UserKYC)."""
    data = BrokerProfileSerializer(broker).data
    kyc = getattr(user, "kyc", None)
    data["kyc_status"] = kyc.status if kyc else "pending"
    return data


class BrokerProfileView(APIView):
    """
    GET the caller's broker profile (404 if none). POST to apply (create) when none
    exists; idempotent (returns the existing one if already applied). The broker never
    sets status / referral_code / any money field here.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        broker = _get_broker(request.user)
        if broker is None:
            return Response(
                {"detail": "No broker profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_profile_payload(broker, request.user))

    def post(self, request):
        existing = _get_broker(request.user)
        if existing is not None:
            return Response(_profile_payload(existing, request.user))

        serializer = BrokerApplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        broker = BrokerProfile.objects.create(
            user=request.user,
            contact_name=data["contact_name"],
            email=data["email"],
            phone=data.get("phone") or None,
        )
        return Response(
            _profile_payload(broker, request.user), status=status.HTTP_201_CREATED
        )


class BrokerLicenseSubmitView(APIView):
    """Persist licence number/authority/expiry + record submission (status stays pending)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        broker = _get_broker(request.user)
        if broker is None:
            return Response(
                {"detail": "Apply as a broker before submitting a licence."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = BrokerLicenseSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        broker = submit_license(broker, license_info=serializer.validated_data)
        return Response(_profile_payload(broker, request.user))


class BrokerLicenseUploadView(APIView):
    """POST (multipart): the broker uploads their licence document."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        broker = _get_broker(request.user)
        if broker is None:
            return Response(
                {"detail": "Apply as a broker before uploading a licence."},
                status=status.HTTP_404_NOT_FOUND,
            )
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"detail": "A file is required.", "code": "no_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        broker.license_document = upload
        broker.mark_license_submitted()
        broker.save()
        return Response(
            _profile_payload(broker, request.user), status=status.HTTP_201_CREATED
        )


class ReferralResolveView(APIView):
    """
    PUBLIC: validate a referral code at signup. Returns {valid, broker_name?} — never any
    contact/identity data. Used by the frontend's /ref/<code> capture to confirm the code
    before carrying it through registration (the actual linkage happens server-side at
    register time, set-once).
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # truly public

    def get(self, request):
        broker = resolve_referral_code(request.query_params.get("code", ""))
        if broker is None:
            return Response({"valid": False})
        return Response({"valid": True, "broker_name": broker.contact_name or "Broker"})


class BrokerCommissionsView(APIView):
    """
    GET the caller-broker's commission ledger + totals + referred-investor roster
    (Phase 12 Wave B). Gated to an APPROVED broker. The balance + withdrawal surface is
    the EXISTING `/api/wallets/balance/` + `/api/wallets/withdrawals/` (the broker got a
    custodial wallet + `UserBalance` at KYC) — this endpoint is the commission view only.
    """

    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def get(self, request):
        broker = request.user.broker_profile
        return Response(commission_ledger(broker))


class BrokerPropertyStatsView(APIView):
    """
    GET the caller-broker's PER-PROPERTY stats overlay (Broker Listings). Strictly
    broker-scoped: conversions / investors / raised count ONLY this broker's own referred
    investors (never the property's total base); commission is the broker's stamped
    BrokerCommission total per property; per-property leads are null (Phase 2). The
    frontend merges this onto the public catalogue (propertiesApi.list).
    """

    permission_classes = [IsAuthenticated, HasActivatedBroker]

    def get(self, request):
        return Response(broker_property_stats(request.user.broker_profile))
