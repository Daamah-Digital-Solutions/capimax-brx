"""
KYC API — Phase 4 (SPEC §3.4; DECISIONS.md "Phase 4").

  GET  /api/kyc/me/             Current KYC status (frontend KycStatus shape).
  POST /api/kyc/submit/         Create/advance to submitted; persist personal info;
                                create the Sumsub applicant if configured.
  POST /api/kyc/access-token/   Issue a Sumsub WebSDK access token for the frontend
                                (503 + machine code when the provider is unconfigured,
                                so the UI degrades to the dev path rather than break).
  POST /api/kyc/webhook/sumsub/ Signature-verified provider callback. GREEN→approved
                                (+ auto-create wallet), RED→rejected. PUBLIC, no auth.

Approval is AUTOMATIC (no admin in the normal path). The webhook is the only
production path to `approved`; dev_grant_kyc / KYC_AUTO_APPROVE cover testing.
"""
import json
import logging

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import sumsub
from .models import UserKYC
from .serializers import KYCStatusSerializer, KYCSubmitSerializer
from .services import approve_kyc, get_or_create_kyc, reject_kyc, submit_kyc

log = logging.getLogger(__name__)


class KYCMeView(APIView):
    """Return the caller's KYC status, creating a default `pending` record if none."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        kyc = get_or_create_kyc(request.user)
        return Response(KYCStatusSerializer(kyc).data)


class KYCSubmitView(APIView):
    """Persist personal info + advance to `submitted` (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KYCSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        kyc = submit_kyc(request.user, personal_info=serializer.validated_data)
        return Response(KYCStatusSerializer(kyc).data, status=status.HTTP_200_OK)


class KYCAccessTokenView(APIView):
    """
    Issue a Sumsub WebSDK access token. When Sumsub is unconfigured (deferred keys),
    returns 503 with a machine-readable code so the frontend shows the dev path.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not sumsub.is_configured():
            return Response(
                {
                    "configured": False,
                    "code": "kyc_provider_unconfigured",
                    "detail": "KYC provider is not configured yet.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # Mint a short-lived WebSDK token. `issue_access_token` (below) creates/reuses the Sumsub
        # applicant for our externalUserId on its own, and the webhook resolves by externalUserId
        # — so pre-creating an applicant here is only a BEST-EFFORT convenience to store the
        # applicantId. It must NOT be fatal: Sumsub returns an error when an applicant already
        # exists for this externalUserId (e.g. after `reset_kyc` cleared our LOCAL id while Sumsub
        # kept the applicant), which previously 502'd the whole flow. Creating the applicant does
        # NOT change the status — status advances to `submitted` only on the real
        # onApplicantSubmitted event — so an early widget-exit never strands the user.
        kyc = get_or_create_kyc(request.user)
        if not kyc.sumsub_applicant_id:
            try:
                kyc.sumsub_applicant_id = sumsub.create_applicant(request.user.pk)
                kyc.save(update_fields=["sumsub_applicant_id", "updated_at"])
            except sumsub.SumsubError as exc:
                # Already-exists / transient: the token call reuses the applicant and the webhook
                # resolves by externalUserId. Log the real Sumsub status; do NOT fail the request.
                log.info(
                    "create_applicant best-effort skip for user %s: %s", request.user.pk, exc
                )
        try:
            token = sumsub.issue_access_token(request.user.pk)
        except sumsub.SumsubError as exc:
            # A real provider failure (bad keys/level/signature/network). Log the status so the
            # journal shows WHY (previously only a generic warning, with no Sumsub detail).
            log.warning("Sumsub access-token issue failed for user %s: %s", request.user.pk, exc)
            return Response(
                {"configured": True, "code": "kyc_provider_error",
                 "detail": "Could not start verification. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"configured": True, "token": token})


class SumsubWebhookView(APIView):
    """
    Sumsub provider callback (the automation hinge). PUBLIC + signature-verified.
    We act ONLY on a valid signature; a bad/absent signature is rejected (401) and
    changes nothing. `applicantReviewed` GREEN→approved (+wallet), RED→rejected.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # truly public; never evaluate a JWT here

    def post(self, request):
        raw = request.body or b""
        signature = request.headers.get(sumsub.WEBHOOK_DIGEST_HEADER, "")
        alg = request.headers.get(sumsub.WEBHOOK_ALG_HEADER, "")

        if not sumsub.webhook_configured():
            # No secret → we cannot verify → refuse to act (deferred/inert).
            return Response(
                {"detail": "KYC webhook is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not sumsub.verify_webhook_signature(raw, signature, alg):
            log.warning("Rejected Sumsub webhook with bad/absent signature.")
            return Response(
                {"detail": "Invalid signature."}, status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            payload = json.loads(raw.decode() or "{}")
        except (ValueError, UnicodeDecodeError):
            return Response({"detail": "Bad payload."}, status=status.HTTP_400_BAD_REQUEST)

        info = sumsub.parse_review(payload)

        # Business-level (KYB) applicants belong to a verification domain keyed by the
        # Sumsub level name: PARTNER (Phase 11 Wave A), DEVELOPER (Phase 8 Wave A), OWNER
        # (Phase 7 Wave A) and LP (Phase 6 Wave 1). Try each in turn; the first that
        # claims the event (a matching profile + its level) fully handles it. Each
        # resolver only matches its OWN table / level name (the level names are distinct
        # per domain), so they never collide and order is safe. Lazy imports keep apps.kyc
        # decoupled at module load.
        from apps.developer.services import try_handle_developer_kyb_webhook
        from apps.lp.services import try_handle_kyb_webhook
        from apps.owner.services import try_handle_owner_kyb_webhook
        from apps.partners.services import try_handle_partner_kyb_webhook

        if try_handle_partner_kyb_webhook(info):
            return Response({"ok": True, "matched": True, "domain": "partner"})
        if try_handle_developer_kyb_webhook(info):
            return Response({"ok": True, "matched": True, "domain": "developer"})
        if try_handle_owner_kyb_webhook(info):
            return Response({"ok": True, "matched": True, "domain": "owner"})
        if try_handle_kyb_webhook(info):
            return Response({"ok": True, "matched": True, "domain": "lp"})

        kyc = self._resolve_kyc(info)
        if kyc is None:
            # Acknowledge so Sumsub stops retrying; nothing to update.
            log.info("Sumsub webhook for unknown applicant/user; ignored.")
            return Response({"ok": True, "matched": False})

        # We only act on review completion; other event types are acknowledged.
        if info["type"] in ("applicantReviewed", "applicantWorkflowCompleted"):
            if info["review_answer"] == "GREEN":
                approve_kyc(kyc, review_answer="GREEN", source="webhook")
            elif info["review_answer"] == "RED":
                reject_kyc(
                    kyc, reason=info["reject_reason"], review_answer="RED",
                    source="webhook",
                )
        return Response({"ok": True, "matched": True})

    @staticmethod
    def _resolve_kyc(info: dict):
        applicant_id = info.get("applicant_id")
        if applicant_id:
            kyc = UserKYC.objects.filter(sumsub_applicant_id=applicant_id).first()
            if kyc:
                return kyc
        external = info.get("external_user_id")
        if external:
            return UserKYC.objects.filter(user_id=external).first()
        return None
