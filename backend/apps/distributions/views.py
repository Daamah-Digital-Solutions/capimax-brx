"""
Distributions read API — Phase 9. Backs the investor `Distributions.tsx` page.

  GET /api/distributions/   The caller's OWN distribution payouts, shaped to the exact
                            objects Distributions.tsx renders (history rows + per-
                            property rollup + summary stats). SELF-SCOPED: a caller only
                            ever sees their own payouts.

There is NO write endpoint — declaring a distribution is a sanctioned ADMIN action
(apps/distributions/admin.py), never a user/API write.
"""
from decimal import Decimal

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from apps.properties.models import Property

from .models import Distribution, DistributionPayout


class DistributionsView(APIView):
    """Summary + history + per-property rollup of the caller's distribution payouts."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Only PAID distributions are investor-visible (a DRAFT never credits).
        payouts = list(
            DistributionPayout.objects.filter(
                user=request.user,
                credited=True,
                distribution__status=Distribution.Status.PAID,
            ).select_related("distribution")
        )

        # Resolve property display fields (Arabic name + English name + annual yield)
        # for the slugs the caller has payouts in — one query.
        slugs = {p.distribution.property_id for p in payouts}
        props = {
            prop.slug: prop
            for prop in Property.objects.filter(slug__in=slugs).only(
                "slug", "name", "name_ar", "expected_yield"
            )
        }

        def name_en(slug, fallback):
            prop = props.get(slug)
            return prop.name if prop else (fallback or slug)

        def name_ar(slug, fallback):
            prop = props.get(slug)
            return prop.name_ar if prop else (fallback or slug)

        def yield_pct(slug):
            prop = props.get(slug)
            return float(prop.expected_yield) if prop and prop.expected_yield is not None else 0.0

        # --- History rows (newest first; payouts already default-ordered by -created_at). #
        rows = []
        for p in payouts:
            d = p.distribution
            rows.append({
                "id": str(p.id),
                "propertyId": d.property_id,
                "property": name_ar(d.property_id, d.property_name),
                "propertyEn": name_en(d.property_id, d.property_name),
                "amount": float(p.share_amount_usd),
                "type": d.dist_type or "",
                "period": d.period_label or d.pay_date.isoformat(),
                "date": d.pay_date.isoformat(),
                "status": d.status,  # "paid" in v1
                "yield": yield_pct(d.property_id),
            })

        # --- Per-property rollup. #
        by_property: dict[str, dict] = {}
        for p in payouts:
            d = p.distribution
            slug = d.property_id
            agg = by_property.get(slug)
            if agg is None:
                agg = {
                    "id": slug,
                    "name": name_ar(slug, d.property_name),
                    "nameEn": name_en(slug, d.property_name),
                    "totalDistributed": 0.0,
                    "annualYield": yield_pct(slug),
                    "type": d.dist_type or "",
                    "nextPayment": None,  # v1: no scheduling/recurrence
                    "status": "active",
                    "_latest": d.pay_date,
                }
                by_property[slug] = agg
            agg["totalDistributed"] += float(p.share_amount_usd)
            # Keep the most-recent distribution's cadence as the property's frequency.
            if d.pay_date >= agg["_latest"]:
                agg["_latest"] = d.pay_date
                agg["type"] = d.dist_type or agg["type"]
        property_rollup = []
        for agg in by_property.values():
            agg.pop("_latest", None)
            property_rollup.append(agg)

        # --- Summary stats. #
        total_received = sum((p.share_amount_usd for p in payouts), Decimal("0"))
        this_year = timezone.now().year
        ytd_payouts = [p for p in payouts if p.distribution.pay_date.year == this_year]
        year_to_date = sum((p.share_amount_usd for p in ytd_payouts), Decimal("0"))
        active_months = {
            (p.distribution.pay_date.year, p.distribution.pay_date.month) for p in ytd_payouts
        }
        average_monthly = (
            float(year_to_date) / len(active_months) if active_months else 0.0
        )

        stats = {
            # v1 credits immediately → nothing pending and no scheduled next payment.
            "totalReceived": float(total_received),
            "pendingAmount": 0.0,
            "nextPaymentDate": None,
            "yearToDate": float(year_to_date),
            "averageMonthly": round(average_monthly, 2),
            "propertiesDistributing": len(by_property),
        }

        return Response({
            "stats": stats,
            "distributions": rows,
            "by_property": property_rollup,
        })
