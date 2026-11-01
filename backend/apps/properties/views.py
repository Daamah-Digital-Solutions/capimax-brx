"""
Property read API — Phase 2. SPEC §2.12 / §3.3.

Public (AllowAny) read endpoints matching the frontend's property-reading screens.
List returns a bare JSON array (no pagination) because Marketplace.tsx consumes a
plain array and filters client-side — keeping that shape avoids any UI change.

    GET /api/properties/                 list (+ filters, search, ordering)
    GET /api/properties/{slug}/          full detail (model-specific nested + data-room)
    GET /api/properties/featured/        Index featured
    GET /api/properties/funded/          FundedProperties (closed deals)
    GET /api/properties/stats/           aggregate stats (Marketplace GlobalStats source)
"""
from django.db.models import Avg, Sum
from apps.developer.models import DeveloperProfile, DeveloperStatus
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from . import pricing
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
    "gallery",
    "construction_milestones",
    "post_handover_benefits",
    "installment_terms",
)


class PropertyViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only catalogue. Public — browsing/detail are public in the UI. SPEC §5.2."""

    permission_classes = [AllowAny]
    authentication_classes = []  # public; no auth needed to browse
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PropertyFilter
    search_fields = ["name", "name_ar", "name_fr", "location", "location_ar", "location_fr"]
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
        qs = Property.objects.filter(is_published=True).prefetch_related("gallery")
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

    @action(detail=True)
    def prices(self, request, slug=None):
        """
        GET /api/properties/{slug}/prices/ — off-plan unit price: launch, current, % change
        since launch, current phase name, and every recorded point (public).
        """
        return Response(pricing.price_summary(self.get_object(), french=request.query_params.get("lang") == "fr"))

    @action(detail=False)
    def registrations(self, request):
        """
        GET /api/properties/registrations/ — for the Verification Center: each published
        property's Wyoming registrations a visitor can check on the state's own registry —
        its SPV (name + filing ID, Wyoming SPVs only) and its digital asset ID (when registered).
        """
        from .models import SPVRecord

        rows = []
        for spv in SPVRecord.objects.filter(property__is_published=True).select_related("property"):
            prop = spv.property
            wyoming = spv.is_wyoming()
            if not wyoming and not spv.digital_asset_id:
                continue
            rows.append({
                "id": prop.slug,
                "name": (request.query_params.get("lang") == "fr" and prop.name_fr) or prop.name,
                "nameAr": prop.name_ar or prop.name,
                "spvName": spv.name if wyoming else "",
                "filingId": spv.registration_number if wyoming else "",
                "digitalAssetId": spv.digital_asset_id,
            })
        rows.sort(key=lambda r: r["name"])
        return Response(rows)

    @action(detail=False)
    def funded(self, request):
        """Closed deals for FundedProperties.tsx (it computes its own aggregate stats)."""
        qs = Property.objects.filter(is_published=True, funded_date__isnull=False).order_by(
            "-funded_date"
        )
        return Response(FundedPropertySerializer(qs, many=True, context=self.get_serializer_context()).data)

    @action(detail=False)
    def stats(self, request):
        """
        Real aggregate marketplace stats for the Marketplace GlobalStats band — all
        computed from live data (published Property rows + approved developer entities).
        Every value reads the true state (0 on an empty catalogue). NO hardcoded numbers.

          * ready / construction / funded / totalProperties — counts by status
          * totalInvestors / totalValue / avgYield — aggregates over published rows
          * developers — distinct VERIFIED developer entities (approved DeveloperProfile)
          * cities — distinct non-empty cities among published properties
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
                "developers": DeveloperProfile.objects.filter(
                    status=DeveloperStatus.APPROVED
                ).count(),
                "cities": qs.exclude(city="").values("city").distinct().count(),
            }
        )
