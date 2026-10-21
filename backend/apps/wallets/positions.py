"""
A wallet's ownership positions, enriched for display: property metadata, the average cost
basis, today's unit price, and units still on a running installment plan. Shared by
GET /api/wallets/<id>/tokens/ (the Portfolio page) and the portfolio statement PDF so both
show the same figures.
"""
from .models import OwnershipToken
from .serializers import OwnershipTokenSerializer


def token_positions(user, wallet, request=None) -> list[dict]:
    from decimal import Decimal

    from django.db.models import Sum

    from apps.investments.models import Investment
    from apps.properties.models import Property

    tokens = list(OwnershipToken.objects.filter(wallet=wallet))
    data = OwnershipTokenSerializer(tokens, many=True).data

    # --- Batched Property enrichment (token.property_id == Property.slug; a CharField,
    # not an FK). One query, no N+1. Surfaces the metadata the model doesn't carry:
    # location/type/image + construction_progress + exit_eligible (all already on
    # Property). Missing/unpublished property → honest nulls, never faked. ---
    slugs = {t.property_id for t in tokens}
    props = (
        {
            p.slug: p
            for p in Property.objects.filter(slug__in=slugs).prefetch_related("gallery")
        }
        if slugs
        else {}
    )

    # --- Average cost basis per property from the caller's completed acquisitions.
    # Primary buys (card/crypto/balance/installment) and now secondary/LP buys all
    # record an Investment row, so Σ(amount_invested)/Σ(token_amount) is the real
    # average price/token — invariant to partial sells. ---
    avg_cost = {}
    rows = (
        Investment.objects.filter(user=user, tokens_minted=True)
        .values("property__slug")
        .annotate(amt=Sum("amount_invested"), toks=Sum("token_amount"))
    )
    for r in rows:
        if r["toks"]:
            avg_cost[r["property__slug"]] = Decimal(r["amt"]) / Decimal(r["toks"])

    # --- Off-plan §7: the unit price (launch, now, % change, last change) and, for units
    # on a running installment plan, the plan's units + remaining principal — the plan
    # is valued as a position (units × price − remaining) and sold only as a whole. ---
    from django.db.models import Max

    from apps.installments.models import InstallmentPlan, InstallmentPlanStatus
    from apps.installments.position import plan_units, remaining_principal
    from apps.payments.nova_pledge import pledged_units
    from apps.properties.models import PropertyPrice
    from apps.properties.pricing import change_since_launch_pct

    last_change = dict(
        PropertyPrice.objects.filter(property__slug__in=slugs)
        .values("property__slug")
        .annotate(at=Max("created_at"))
        .values_list("property__slug", "at")
    ) if slugs else {}
    plan_totals = {}
    active_plans = (
        InstallmentPlan.objects.filter(
            investor=user, status=InstallmentPlanStatus.ACTIVE,
            property__slug__in=slugs,
        )
        .select_related("property")
        .prefetch_related("payments", "investments")
    ) if slugs else []
    for plan in active_plans:
        inv = next(iter(sorted(plan.investments.all(), key=lambda i: i.created_at)), None)
        units, owed = plan_totals.get(plan.property.slug, (0, Decimal("0")))
        plan_totals[plan.property.slug] = (
            units + plan_units(plan, inv), owed + remaining_principal(plan)
        )

    for d, tok in zip(data, tokens):
        p = props.get(tok.property_id)
        d["city"] = p.city if p else None
        d["location"] = p.location if p else None
        d["location_ar"] = p.location_ar if p else None
        d["country"] = p.country if p else None
        d["asset_type"] = p.asset_type if p else None
        d["category"] = p.category if p else None
        # Property's expected annual yield (already on Property) — powers the
        # Reports avg-yield + per-property yield. Honest null when unknown.
        d["expected_yield"] = (
            float(p.expected_yield) if p and p.expected_yield is not None else None
        )
        d["image"] = p.hero_image_url(request) if (p and request) else None
        d["images"] = p.gallery_urls(request) if (p and request) else []
        d["construction_progress"] = p.construction_progress if p else None
        d["exit_eligible"] = bool(p.exit_eligible) if p else False
        d["unit_price"] = float(p.token_price) if p else None
        d["launch_price"] = float(p.launch_price or p.token_price) if p else None
        d["price_change_pct"] = float(change_since_launch_pct(p)) if p else None
        at = last_change.get(tok.property_id)
        d["price_updated_at"] = at.isoformat() if at else None
        units, owed = plan_totals.get(tok.property_id, (0, Decimal("0")))
        d["plan_units"] = units
        d["remaining_principal"] = float(owed)
        # Units bought with a Nova certificate, pledged to Nova Finance until its clearance.
        d["nova_pledged_units"] = pledged_units(tok.wallet_id, tok.property_id)
        ac = avg_cost.get(tok.property_id)
        if ac is not None:
            d["avg_cost_per_token"] = float(ac)
            d["invested_usd"] = float(ac * Decimal(tok.token_amount))
        else:
            d["avg_cost_per_token"] = None
            d["invested_usd"] = None
    return data
