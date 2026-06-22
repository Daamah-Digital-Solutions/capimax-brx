"""
Investment API — Phase 3 Wave 2 (SPEC §4.1).

  POST /api/investments/             Create an investment (simulated pay + auto-mint).
  POST /api/investments/{id}/mint/   Mint tokens for an already-paid investment.

Response shape matches the frontend's useInvestment:
  { success, investment_id, tokens_minted, certificate_generated, error? }
"""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Investment
from .serializers import InvestmentCreateSerializer, InvestmentSerializer
from .services import mint_investment


class InvestmentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # KYC-BEFORE-INVEST (Phase 4 #1, LOCKED). A user cannot invest before their
        # KYC is approved. We reject with a machine-readable `code` the frontend acts
        # on (routes to the KYC flow) rather than a raw error. Because approval
        # auto-creates the wallet, an approved user always has a wallet by here — so
        # there is no pre-wallet "tokens_minted=false" backlog in the happy path.
        kyc = getattr(request.user, "kyc", None)
        if not (kyc and kyc.status == "approved"):
            return Response(
                {
                    "success": False,
                    "code": "kyc_required",
                    "detail": "KYC approval is required before investing.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = InvestmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Imported here to keep the module import light; service raises DRF errors
        # (400 validation / 409 duplicate / 422 over-purchase) handled by DRF.
        from .services import create_investment

        result = create_investment(
            user=request.user,
            prop=data["property"],
            token_amount=data["token_amount"],
            payment_method=data["payment_method"],
            is_installment=data.get("is_installment", False),
            down_payment_percent=data.get("down_payment_percent"),
            n_installments=data.get("n_installments"),
            frequency=data.get("frequency", "monthly"),
        )
        investment = result["investment"]
        return Response(
            {
                "success": True,
                "investment_id": str(investment.id),
                "tokens_minted": result["tokens_minted"],
                "certificate_generated": result["certificate_generated"],
                # Phase 5: card investments require a real Stripe charge next (the
                # frontend then calls /api/payments/stripe/create-intent/).
                "payment_required": result.get("payment_required", False),
            },
            status=status.HTTP_201_CREATED,
        )


class InvestmentDetailView(APIView):
    """
    GET /api/investments/{id}/ — the caller's own investment (owner-only). Used by
    the checkout to POLL payment_status/tokens_minted while the Stripe webhook
    confirms the charge and the on-chain mint completes (Phase 5).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        investment = get_object_or_404(Investment, pk=pk, user=request.user)
        return Response(InvestmentSerializer(investment).data)


class ReinvestmentHistoryView(APIView):
    """
    GET /api/investments/reinvestments/ — the caller's REINVESTMENTS (self-scoped): the
    investments funded from internal balance (payment_method == "balance"). Reuses
    Investment with the funding method as the marker — no separate model. Shaped to the
    Reinvestment.tsx History tab. Available balance is read separately via
    /api/wallets/balance/ (not duplicated here).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .services import BALANCE_METHOD

        rows = (
            Investment.objects.filter(user=request.user, payment_method=BALANCE_METHOD)
            .select_related("property")
            .order_by("-created_at")
        )
        data = [
            {
                "id": str(inv.id),
                "property_id": inv.property.slug,
                "property_name": inv.property_name,
                # No bonus in v1 — source == net (discount deferred; see DECISIONS.md).
                "source_amount": float(inv.amount_invested),
                "discount_amount": 0.0,
                "net_investment_value": float(inv.amount_invested),
                "token_amount": inv.token_amount,
                "token_symbol": inv.token_symbol,
                "tokens_minted": inv.tokens_minted,
                "status": "completed" if inv.tokens_minted else (
                    "pending" if inv.payment_status == "completed" else inv.payment_status
                ),
                "created_at": inv.created_at.isoformat(),
            }
            for inv in rows
        ]
        return Response(data)


class InvestmentMintView(APIView):
    """Mint tokens for an existing, paid investment. Owner-only, idempotent."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        investment = get_object_or_404(Investment, pk=pk, user=request.user)
        result = mint_investment(investment)  # may raise ValidationError (400)

        if result.get("minted"):
            return Response(
                {
                    "success": True,
                    "investment_id": str(investment.id),
                    "tokens_minted": True,
                    "tx_hash": result.get("tx_hash"),
                },
                status=status.HTTP_200_OK,
            )

        reason = result.get("reason")
        if reason == "no_wallet":
            return Response(
                {
                    "success": False,
                    "tokens_minted": False,
                    "error": "A KYC-approved wallet is required to mint tokens.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        # contract_not_deployed (expected in Wave 2 until the testnet deploy lands):
        # this is a clear PENDING state, not a failure. No fake tx recorded.
        return Response(
            {
                "success": True,
                "investment_id": str(investment.id),
                "tokens_minted": False,
                "pending_reason": reason,
            },
            status=status.HTTP_200_OK,
        )
