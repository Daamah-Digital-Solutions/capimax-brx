"""
Property read filters (django-filter). SPEC §3.3 / §2.12.

Mirrors the membership-style filters MarketplaceFilters.tsx emits (country/status/
assetType/exitAvailability/yieldType as multi-select, model/category as single), plus
a yield range. The frontend currently filters client-side over the full list; these
server filters provide the same capability for the API (and for Products/ProductCategory
which select by model/category).
"""
import django_filters

from .models import Property


class PropertyFilter(django_filters.FilterSet):
    # Multi-value "in" filters (e.g. ?country=uae,ksa) — match the UI's checkboxes.
    country = django_filters.BaseInFilter(field_name="country", lookup_expr="in")
    status = django_filters.BaseInFilter(field_name="status", lookup_expr="in")
    assetType = django_filters.BaseInFilter(field_name="asset_type", lookup_expr="in")
    exitAvailability = django_filters.BaseInFilter(
        field_name="exit_availability", lookup_expr="in"
    )
    yieldType = django_filters.BaseInFilter(field_name="yield_type", lookup_expr="in")

    # Single-value (URL params used by Marketplace tabs / Products).
    model = django_filters.CharFilter(field_name="model")
    category = django_filters.CharFilter(field_name="category")

    # Yield/ROI range over expected_yield OR expected_growth.
    yieldMin = django_filters.NumberFilter(method="filter_yield_min")
    yieldMax = django_filters.NumberFilter(method="filter_yield_max")

    class Meta:
        model = Property
        fields = []

    def filter_yield_min(self, queryset, name, value):
        from django.db.models import Q

        return queryset.filter(Q(expected_yield__gte=value) | Q(expected_growth__gte=value))

    def filter_yield_max(self, queryset, name, value):
        from django.db.models import Q

        return queryset.filter(Q(expected_yield__lte=value) | Q(expected_growth__lte=value))
