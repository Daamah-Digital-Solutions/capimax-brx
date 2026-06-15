"""
LP API — Phase 6 Wave 1 (SPEC §2.7 / §3.8). Backs src/hooks/useLiquidityProvider.ts.

  GET   /api/lp/profile/                 Own LP profile (404 → frontend treats as null).
  POST  /api/lp/profile/                 Apply as LP (create; idempotent).
  PATCH /api/lp/profile/bank-details/    Update bank payout details.
  PATCH /api/lp/profile/crypto-details/  Update crypto payout details.
  GET   /api/lp/transactions/            Own LP ledger.
  POST  /api/lp/withdrawals/             Create a withdrawal request (tx).
  GET   /api/lp/documents/               Own documents + shared templates.
  POST  /api/lp/documents/               Upload a document (multipart).
  DELETE/api/lp/documents/{id}/          Delete own document.
  GET   /api/lp/documents/{id}/download/ Owner/template file download (blob).
  POST  /api/lp/kyb/submit/              Persist business info → KYB under_review.
  POST  /api/lp/kyb/documents/           Upload a KYB document (multipart).
  POST  /api/lp/kyb/access-token/        Sumsub WebSDK token (503 when deferred).

Everything is OWNER-SCOPED: a caller only ever sees/edits their own LP rows.
KYB approval is AUTOMATIC via the shared signed Sumsub webhook (business level) —
no admin in the normal path.
"""
import logging

from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasActivatedLP
from apps.kyc import sumsub

from . import market_services
from .models import (
    KYBStatus,
    LiquidityProvider,
    LPDocument,
    LPHolding,
    LPKYBDocument,
    LPMarketListing,
    LPStatus,
    LPTransaction,
)
from .serializers import (
    LiquidityProviderSerializer,
    LPApplySerializer,
    LPBankDetailsSerializer,
    LPCryptoDetailsSerializer,
    LPDocumentSerializer,
    LPHoldingSerializer,
    LPHoldingStatusSerializer,
    LPKYBSubmitSerializer,
    LPListAssetSerializer,
    LPMarketListingSerializer,
    LPTransactionSerializer,
    LPWithdrawalSerializer,
)
from .services import mark_documents_pending, submit_kyb

log = logging.getLogger(__name__)


def _get_lp(user):
    return LiquidityProvider.objects.filter(user=user).first()


class LPProfileView(APIView):
    """GET the caller's LP profile (404 if none); POST to apply (idempotent)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response(
                {"detail": "No LP profile for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(LiquidityProviderSerializer(lp).data)

    def post(self, request):
        existing = _get_lp(request.user)
        if existing is not None:
            # Idempotent: applying again just returns the current profile.
            return Response(LiquidityProviderSerializer(existing).data)

        serializer = LPApplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lp = LiquidityProvider.objects.create(
            user=request.user,
            company_name=data.get("company_name") or None,
            contact_name=data["contact_name"],
            email=data["email"],
            phone=data.get("phone") or None,
            country=data.get("country") or None,
            investment_amount=data["investment_amount"],
        )
        return Response(
            LiquidityProviderSerializer(lp).data, status=status.HTTP_201_CREATED
        )


class LPBankDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response({"detail": "No LP profile."}, status=status.HTTP_404_NOT_FOUND)
        serializer = LPBankDetailsSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(lp, field, value)
        lp.save(update_fields=[*serializer.validated_data.keys(), "updated_at"])
        return Response(LiquidityProviderSerializer(lp).data)


class LPCryptoDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response({"detail": "No LP profile."}, status=status.HTTP_404_NOT_FOUND)
        serializer = LPCryptoDetailsSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(lp, field, value)
        lp.save(update_fields=[*serializer.validated_data.keys(), "updated_at"])
        return Response(LiquidityProviderSerializer(lp).data)


class LPTransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response([])
        txs = LPTransaction.objects.filter(lp=lp)
        return Response(LPTransactionSerializer(txs, many=True).data)


class LPWithdrawalView(APIView):
    """Create a withdrawal request (a pending LPTransaction). Owner-scoped."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response({"detail": "No LP profile."}, status=status.HTTP_404_NOT_FOUND)
        serializer = LPWithdrawalSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        amount = serializer.validated_data["amount"]
        if amount > lp.current_balance:
            return Response(
                {"detail": "Insufficient balance.", "code": "insufficient_balance"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tx = LPTransaction.objects.create(
            lp=lp,
            tx_type="withdrawal",
            amount=amount,
            currency="USD",
            status=LPTransaction.TxStatus.PENDING,
            withdrawal_method=serializer.validated_data["withdrawal_method"],
            notes=serializer.validated_data.get("notes") or None,
        )
        return Response(
            LPTransactionSerializer(tx).data, status=status.HTTP_201_CREATED
        )


class LPDocumentsView(APIView):
    """List own docs (+ shared templates); upload a new document."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        docs = LPDocument.objects.filter(Q(user=request.user) | Q(is_template=True))
        return Response(LPDocumentSerializer(docs, many=True).data)

    def post(self, request):
        upload = request.FILES.get("file")
        document_type = request.data.get("document_type") or "other"
        document_name = request.data.get("document_name") or (
            upload.name if upload else "document"
        )
        lp = _get_lp(request.user)
        doc = LPDocument.objects.create(
            lp=lp,
            user=request.user,
            document_name=document_name,
            document_type=document_type,
            file=upload,
            file_size=getattr(upload, "size", None),
            is_template=False,
            uploaded_by="user",
        )
        return Response(
            LPDocumentSerializer(doc).data, status=status.HTTP_201_CREATED
        )


class LPDocumentDetailView(APIView):
    """Delete one of the caller's own documents (never a template)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, doc_id):
        doc = get_object_or_404(
            LPDocument, pk=doc_id, user=request.user, is_template=False
        )
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LPDocumentDownloadView(APIView):
    """Owner/template file download (blob)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        doc = get_object_or_404(
            LPDocument.objects.filter(Q(user=request.user) | Q(is_template=True)),
            pk=doc_id,
        )
        if not doc.file:
            return Response({"detail": "No file."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            doc.file.open("rb"), as_attachment=True, filename=doc.document_name
        )


class LPKYBSubmitView(APIView):
    """Persist business info + advance KYB to `under_review` (idempotent)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response(
                {"detail": "Apply as an LP before submitting KYB."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = LPKYBSubmitSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        lp = submit_kyb(lp, business_info=serializer.validated_data)
        return Response(LiquidityProviderSerializer(lp).data)


class LPKYBDocumentsView(APIView):
    """Upload a KYB verification document (multipart). Moves KYB → documents_pending."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        lp = _get_lp(request.user)
        if lp is None:
            return Response(
                {"detail": "Apply as an LP before uploading KYB documents."},
                status=status.HTTP_404_NOT_FOUND,
            )
        upload = request.FILES.get("file")
        document_type = request.data.get("document_type") or "other"
        document_name = request.data.get("document_name") or (
            upload.name if upload else "document"
        )
        doc = LPKYBDocument.objects.create(
            lp=lp,
            user=request.user,
            document_name=document_name,
            document_type=document_type,
            file=upload,
            file_size=getattr(upload, "size", None),
        )
        mark_documents_pending(lp)
        return Response(
            {"id": str(doc.id), "document_type": doc.document_type,
             "document_name": doc.document_name, "status": doc.status},
            status=status.HTTP_201_CREATED,
        )


class LPKYBAccessTokenView(APIView):
    """
    Issue a Sumsub WebSDK access token for KYB (business level). When Sumsub is
    unconfigured (deferred keys) returns 503 + a machine code so the frontend
    degrades to the form/dev path rather than breaking — mirrors investor KYC.
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
        lp = _get_lp(request.user)
        if lp is None:
            return Response(
                {"detail": "Apply as an LP first."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            if not lp.sumsub_applicant_id:
                lp.sumsub_applicant_id = sumsub.create_applicant(
                    request.user.pk, level_name=settings.SUMSUB_KYB_LEVEL_NAME
                )
                lp.mark_kyb_submitted()
                lp.save()
            token = sumsub.issue_access_token(
                request.user.pk, level_name=settings.SUMSUB_KYB_LEVEL_NAME
            )
        except sumsub.SumsubError:
            log.warning("Sumsub KYB access-token issue failed for user %s", request.user.pk)
            return Response(
                {"configured": True, "code": "kyb_provider_error",
                 "detail": "Could not start verification. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"configured": True, "token": token})


# --------------------------------------------------------------------------- #
# LP secondary market — Phase 6 Wave 2. Backs src/hooks/useLPMarket.ts +
# useLPHoldings.ts. Inventory is visible only to approved LPs; purchase is gated by
# HasActivatedLP and settles on-chain (apps/lp/market_services.py).
# --------------------------------------------------------------------------- #
def _is_approved_lp(user) -> bool:
    lp = getattr(user, "liquidity_provider", None)
    return bool(lp and lp.status == LPStatus.APPROVED)


class LPMarketView(APIView):
    """GET both arrays the hook needs; POST to list (escrow-locks) your tokens."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        mine, market = market_services.listings_for(
            request.user, is_approved_lp=_is_approved_lp(request.user)
        )
        return Response({
            "my_listings": LPMarketListingSerializer(mine, many=True).data,
            "listings": LPMarketListingSerializer(market, many=True).data,
        })

    def post(self, request):
        serializer = LPListAssetSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        listing = market_services.create_listing(
            user=request.user, data=serializer.validated_data
        )
        return Response(
            LPMarketListingSerializer(listing).data, status=status.HTTP_201_CREATED
        )


class LPMarketCancelView(APIView):
    """Seller-scoped cancel → release the escrow lock."""

    permission_classes = [IsAuthenticated]

    def post(self, request, listing_id):
        listing = market_services.cancel_listing(user=request.user, listing_id=listing_id)
        return Response(LPMarketListingSerializer(listing).data)


class LPMarketPurchaseView(APIView):
    """Approved-LP-only purchase → on-chain settlement (debit/credit + token transfer)."""

    permission_classes = [IsAuthenticated, HasActivatedLP]

    def post(self, request, listing_id):
        result = market_services.purchase_listing(
            buyer_user=request.user, listing_id=listing_id
        )
        return Response(result, status=status.HTTP_200_OK)


class LPHoldingsView(APIView):
    """The caller's LP holdings (frontend useLPHoldings). Empty unless an LP profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        lp = getattr(request.user, "liquidity_provider", None)
        if lp is None:
            return Response([])
        holdings = LPHolding.objects.filter(lp=lp)
        return Response(LPHoldingSerializer(holdings, many=True).data)


class LPHoldingDetailView(APIView):
    """PATCH a holding's status (frontend updateHoldingStatus / resale flow)."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, holding_id):
        lp = getattr(request.user, "liquidity_provider", None)
        holding = get_object_or_404(LPHolding, pk=holding_id, lp=lp) if lp else None
        if holding is None:
            return Response({"detail": "Holding not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = LPHoldingStatusSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        holding.status = serializer.validated_data["status"]
        listed_at = serializer.validated_data.get("listed_at")
        if listed_at:
            holding.listed_at = listed_at
        if holding.status == LPHolding.Status.SOLD:
            holding.sold_at = timezone.now()
        holding.save(update_fields=["status", "listed_at", "sold_at", "updated_at"])
        return Response(LPHoldingSerializer(holding).data)
