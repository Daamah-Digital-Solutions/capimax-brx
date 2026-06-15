"""
Property read API — Phase 2. SPEC §2.12 / §3.3.

Public (AllowAny) read endpoints matching the frontend's property-reading screens.
List returns a bare JSON array (no pagination) because Marketplace.tsx consumes a
plain array and filters client-side — keeping that shape avoids any UI change.

    GET /api/properties/                 list (+ filters, search, ordering)
    GET /api/properties/{slug}/          full detail (model-specific nested + data-room)
    GET /api/properties/featured/        Index featured
    GET /api/properties/funded/          FundedProperties (closed deals)
    GET /api/properties/stats/           aggregate stats (optional GlobalStats source)
"""
from django.db.models import Avg, Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .filters import PropertyFilter
from .models import Property
from .serializers import (
    FundedPropertySerializer,
    PropertyDetailSerializer,
    PropertyListSerializer,
)

_DETAIL_RELATED = (
    "installment",
    "future",
    "option",
    "shared",
    "spv",
    "token_metadata",
    "financials",
)
_DETAIL_PREFETCH = (
    "phases",
    "portfolio_assets",
    "developer_reports",
    "valuation_reports",
    "documents",
)


class PropertyViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only catalogue. Public — browsing/detail are public in the UI. SPEC §5.2."""

    permission_classes = [AllowAny]
    authentication_classes = []  # public; no auth needed to browse
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PropertyFilter
    search_fields = ["name", "name_ar", "location", "location_ar"]
    ordering_fields = [
        "expected_yield",
        "expected_growth",
        "funded",
        "total_value",
        "investors",
        "display_order",
    ]
    pagination_class = None  # Marketplace expects a plain array, not {count, results}

    def get_queryset(self):
        qs = Property.objects.filter(is_published=True)
        if self.action == "retrieve":
            qs = qs.select_related(*_DETAIL_RELATED).prefetch_related(*_DETAIL_PREFETCH)
        return qs

    def get_serializer_class(self):
        return PropertyDetailSerializer if self.action == "retrieve" else PropertyListSerializer

    @action(detail=False)
    def featured(self, request):
        """Index featured carousel."""
        qs = self.get_queryset().filter(is_featured=True)
        return Response(PropertyListSerializer(qs, many=True, context=self.get_serializer_context()).data)

    @action(detail=False)
    def funded(self, request):
        """Closed deals for FundedProperties.tsx (it computes its own aggregate stats)."""
        qs = Property.objects.filter(is_published=True, funded_date__isnull=False).order_by(
            "-funded_date"
        )
        return Response(FundedPropertySerializer(qs, many=True).data)

    @action(detail=False)
    def stats(self, request):
        """
        Aggregate marketplace stats (count by status, totals, avg yield).
        Provided for a future GlobalStats wiring; GlobalStats currently shows static
        marketing numbers and is intentionally NOT wired here (see DECISIONS.md flag).
        """
        qs = Property.objects.filter(is_published=True)
        agg = qs.aggregate(
            total_value=Sum("total_value"),
            total_investors=Sum("investors"),
            avg_yield=Avg("expected_yield"),
        )
        return Response(
            {
                "totalProperties": qs.count(),
                "ready": qs.filter(status="ready").count(),
                "construction": qs.filter(status="construction").count(),
                "funded": qs.filter(funded_date__isnull=False).count(),
                "totalInvestors": agg["total_investors"] or 0,
                "totalValue": float(agg["total_value"] or 0),
                "avgYield": round(float(agg["avg_yield"] or 0), 1),
            }
        )
