"""
Distribution engine — Phase 9. Snapshot a property's ACTIVE holders at declaration
time, split a money pool PRO-RATA by full token_amount (cent-exact), and credit each
holder's internal UserBalance. Mirrors the proven primary-sale credit pattern
(apps/investments/services._credit_owner_for_primary_sale) but flows the OTHER way —
to HOLDERS, recurring, via a distinct source="distribution".

SAFETY / INVARIANTS:
  * INTERNAL BALANCE ONLY — credit_user_balance, no PropertyToken / on-chain movement.
  * Cent-exact: Σ(rounded shares) == pool_amount (floor each, remainder cent to the
    largest holder).
  * Pro-rata by RELEASED (paid) tokens: full token_amount MINUS the installment-unpaid
    lock (Installments Wave C). Market-listing escrow is NOT subtracted — escrowed tokens
    are paid-for and DO still earn; only installment-UNPAID tokens are excluded (yield is
    on actually-paid ownership). For normal/fully-paid holders the installment lock is 0,
    so earning == token_amount and behaviour is unchanged.
  * Idempotent: one DistributionPayout per (distribution, holder); a re-run skips
    already-credited payouts and never double-credits.
  * Atomic: the whole declare (snapshot + payouts + credits + token-field bumps)
    commits together or not at all.
"""
from __future__ import annotations

from decimal import ROUND_DOWN, Decimal

from django.db import transaction
from django.utils import timezone

from apps.notifications.services import NotificationType, notify
from apps.wallets.models import OwnershipToken
from apps.wallets.services import credit_user_balance

from .models import Distribution, DistributionPayout

CENTS = Decimal("0.01")
DISTRIBUTION_SOURCE = "distribution"  # BalanceTransaction.source — distinct from "primary_sale"


class NoEligibleHolders(Exception):
    """Raised when a property has no ACTIVE holders to distribute to (nothing credited)."""


def declare_distribution(
    property_slug: str,
    pool_amount,
    *,
    dist_type: str = "",
    period_label: str = "",
    pay_date=None,
    admin=None,
) -> Distribution:
    """
    Declare + immediately pay a distribution for `property_slug`.

    Snapshots the property's current ACTIVE holders, splits `pool_amount` pro-rata by
    full token_amount (cent-exact), credits each holder's UserBalance (source=
    "distribution"), bumps OwnershipToken.total_distributions / last_distribution_date,
    and marks the distribution `paid`. Returns the Distribution.

    Raises NoEligibleHolders if the property has no active holders (nothing is written).
    """
    pool = Decimal(pool_amount).quantize(CENTS)
    if pool <= 0:
        raise ValueError("pool_amount must be positive.")

    with transaction.atomic():
        # Property name is denormalized for the read shape; the property may be an
        # admin-seeded one with no submitter — that's fine, distributions don't care.
        property_name = _property_name(property_slug)

        dist = Distribution.objects.create(
            property_id=property_slug,
            property_name=property_name,
            declared_by=admin,
            pool_amount_usd=pool,
            dist_type=dist_type or "",
            period_label=period_label or "",
            pay_date=pay_date or timezone.now().date(),
            status=Distribution.Status.DRAFT,
        )
        credited_total = _build_and_credit_payouts(dist)
        if credited_total is None:
            # No eligible holders — roll back the empty distribution.
            raise NoEligibleHolders(
                f"No active holders for property '{property_slug}'."
            )
        dist.status = Distribution.Status.PAID
        dist.save(update_fields=["status"])
        return dist


def _build_and_credit_payouts(dist: Distribution):
    """
    Snapshot ACTIVE holders, compute the cent-exact pro-rata split, create payout rows
    and credit each holder. Idempotent per payout (skips already-credited rows).

    Returns the total credited (Decimal), or None when there are no eligible holders.
    """
    # Snapshot AT declaration time. Order by token_amount DESC so the rounding remainder
    # deterministically lands on the LARGEST holder. select_related avoids per-holder
    # user lookups; the rows are locked for the duration of the atomic block.
    all_holdings = list(
        OwnershipToken.objects.select_for_update()
        .select_related("wallet__user")
        .filter(
            property_id=dist.property_id,
            status=OwnershipToken.Status.ACTIVE,
            token_amount__gt=0,
        )
        .order_by("-token_amount", "id")
    )
    if not all_holdings:
        return None

    # EARNING tokens = full token_amount − installment-UNPAID lock (Installments Wave C).
    # Market-listing escrow is NOT subtracted (escrowed tokens are paid-for and DO earn);
    # only installment-unpaid tokens are excluded. Computed from the authoritative plan
    # rows — 0 for normal/fully-paid holders, so earning == token_amount for them. Holders
    # whose entire position is still unpaid-locked earn nothing this round (excluded from
    # the split), so re-rank by earning to keep the rounding remainder on the largest EARNER.
    from apps.installments.services import installment_locked_tokens

    earning = {}
    for h in all_holdings:
        locked = installment_locked_tokens(h.wallet.user_id, dist.property_id)
        earning[h.id] = max(0, int(h.token_amount) - int(locked))
    holdings = sorted(
        (h for h in all_holdings if earning[h.id] > 0),
        key=lambda h: (-earning[h.id], str(h.id)),
    )

    total_tokens = sum(earning[h.id] for h in holdings)
    if total_tokens <= 0:
        # No RELEASED (paid) ownership to distribute to — nothing is credited (rolled back).
        return None
    pool = Decimal(dist.pool_amount_usd).quantize(CENTS)

    # Floor each holder's raw share to the cent; the unallocated remainder (always ≥ 0
    # because flooring under-allocates) goes to the largest earner (index 0).
    shares: list[Decimal] = []
    allocated = Decimal("0")
    for h in holdings:
        raw = pool * Decimal(earning[h.id]) / Decimal(total_tokens)
        share = raw.quantize(CENTS, rounding=ROUND_DOWN)
        shares.append(share)
        allocated += share
    remainder = (pool - allocated).quantize(CENTS)
    if remainder != 0:
        shares[0] = (shares[0] + remainder).quantize(CENTS)

    credited_total = Decimal("0")
    now = timezone.now()
    for h, share in zip(holdings, shares):
        user = h.wallet.user
        pct = (
            Decimal(earning[h.id]) / Decimal(total_tokens) * Decimal("100")
        ).quantize(Decimal("0.000001"))

        payout, created = DistributionPayout.objects.get_or_create(
            distribution=dist,
            user=user,
            defaults={
                "holding": h,
                "tokens_at_snapshot": earning[h.id],
                "ownership_pct_at_snapshot": pct,
                "share_amount_usd": share,
                "credited": False,
            },
        )
        # IDEMPOTENCY: a payout already credited (re-run / replay) is left untouched.
        if payout.credited:
            credited_total += payout.share_amount_usd
            continue

        if payout.share_amount_usd > 0:
            credit_user_balance(
                user,
                payout.share_amount_usd,
                source=DISTRIBUTION_SOURCE,
                reference=str(payout.pk),
                memo=(
                    f"Distribution {dist.period_label or dist.pay_date}: "
                    f"{dist.property_name or dist.property_id}"
                ),
            )
            # Bump the holding's distribution accounting (the pre-built seams).
            h.total_distributions = (h.total_distributions or Decimal("0")) + payout.share_amount_usd
            h.last_distribution_date = now
            h.save(update_fields=["total_distributions", "last_distribution_date"])

            # Phase 10: notify the holder (only on the newly-credited path — replay-safe
            # via the `payout.credited` guard above).
            notify(
                user, NotificationType.DISTRIBUTION_CREDITED,
                params={
                    "property": dist.property_name or dist.property_id,
                    "amount": str(payout.share_amount_usd),
                    "period": dist.period_label or dist.pay_date.isoformat(),
                },
                action_url="/distributions",
            )

            # Family Wave B: auto-allocate the holder's distribution to their family members.
            # Runs INSIDE this atomic block, ONLY on the newly-credited branch (idempotent —
            # a replay skips it via the `payout.credited` guard, plus the accrual's own
            # unique(distribution, member) anchor). A holder with no allocating members is a
            # cheap no-op, so the existing non-family distribution behaviour is unchanged.
            from apps.family.services import carve_family_accruals

            carve_family_accruals(user, dist, payout)

        payout.credited = True
        payout.save(update_fields=["credited"])
        credited_total += payout.share_amount_usd

    return credited_total


def _property_name(property_slug: str) -> str:
    """Best-effort denormalized property name for the read shape (empty if unknown)."""
    from apps.properties.models import Property

    prop = Property.objects.filter(slug=property_slug).only("name").first()
    return prop.name if prop else ""
