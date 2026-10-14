"""
Peer secondary-market API — Phase 6 Wave 3 (SPEC §2.8 / §3.9).

  GET  /api/secondary-market/             Browse: { my_listings, listings }.
  POST /api/secondary-market/             List your unlocked tokens (KYC-approved).
  POST /api/secondary-market/{id}/cancel/ Seller-scoped cancel → unlock escrow.
  POST /api/secondary-market/{id}/purchase/  Buy a listing (KYC-approved investor) →
                                          on-chain transfer + UserBalance settlement.
  GET  /api/secondary-market/trades/      Completed trades involving the caller.
  POST /api/secondary-market/positions/   List a whole installment plan as one position
                                          { plan_id, price_per_unit? } (off-plan §6).

List + buy require an approved KYC (consistent with invest-requires-KYC). Settlement
is atomic + idempotent + on-chain (apps/secondary_market/services.py).
"""
from django.conf import settings
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import KYCApprovedPermission

from . import services
from .models import SecondaryMarketListing
from .serializers import (
    PositionListSerializer,
    PurchaseSerializer,
    SecondaryListAssetSerializer,
    SecondaryMarketListingSerializer,
)


class SecondaryMarketView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mine, market = services.listings_for(request.user)
        mine = mine.select_related("plan").prefetch_related("plan__payments")
        market = market.select_related("plan").prefetch_related("plan__payments")
        return Response({
            "my_listings": SecondaryMarketListingSerializer(mine, many=True).data,
            "listings": SecondaryMarketListingSerializer(market, many=True).data,
            # Resale fee %, paid by the buyer on top of the price.
            "fee_percent": float(settings.SECONDARY_MARKET_FEE_PERCENT),
        })

    def post(self, request):
        # Listing requires approved KYC (same gate as investing).
        self.permission_classes = [IsAuthenticated, KYCApprovedPermission]
        self.check_permissions(request)
        serializer = SecondaryListAssetSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        listing = services.create_listing(user=request.user, data=serializer.validated_data)
        return Response(
            SecondaryMarketListingSerializer(listing).data, status=status.HTTP_201_CREATED
        )


class SecondaryMarketCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, listing_id):
        listing = services.cancel_listing(user=request.user, listing_id=listing_id)
        return Response(SecondaryMarketListingSerializer(listing).data)


class SecondaryMarketPurchaseView(APIView):
    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request, listing_id):
        serializer = PurchaseSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        result = services.purchase_listing(
            buyer_user=request.user, listing_id=listing_id,
            expected_cash=serializer.validated_data.get("expected_cash"),
            expected_fee=serializer.validated_data.get("expected_fee"),
        )
        return Response(result, status=status.HTTP_200_OK)


class SecondaryMarketPositionView(APIView):
    """List a whole active installment plan as one position (KYC-approved holder)."""

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        serializer = PositionListSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        listing = services.create_position_listing(
            user=request.user,
            plan_id=serializer.validated_data["plan_id"],
            price_per_unit=serializer.validated_data.get("price_per_unit"),
        )
        return Response(
            SecondaryMarketListingSerializer(listing).data, status=status.HTTP_201_CREATED
        )


class SecondaryMarketTradesView(APIView):
    """Completed trades involving the caller (as seller or buyer) — trade history."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        trades = SecondaryMarketListing.objects.filter(
            Q(seller=request.user) | Q(buyer=request.user),
            status=SecondaryMarketListing.Status.COMPLETED,
        )
        return Response(SecondaryMarketListingSerializer(trades, many=True).data)
