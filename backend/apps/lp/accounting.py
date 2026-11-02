"""
The LP's own book for the units it bought on the LP market.

An approved LP pays for LP-market units from its LP balance (market_services.purchase_listing),
and the units sit in the LP user's custodial wallet beside any they bought as an investor. The
chain can't tell the two apart, so the LP's open holdings (LPHolding not sold) say how many of a
property's units are LP units. From that:

  * when the LP user sells units of the property (LP market or secondary market), the LP units
    go first: their share of the proceeds returns to the LP balance, the holdings are consumed
    oldest first, and the proceeds over their cost are the LP's earnings (a loss lowers them);
  * a rental distribution's share earned by LP units is paid to the LP balance as earnings.

The rest (the user's own investor units) is paid to the user wallet exactly as before. Callers
run these inside their settlement's atomic block and credit the wallet with what is returned.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from .models import LiquidityProvider, LPHolding, LPTransaction

CENTS = Decimal("0.01")
OPEN = (LPHolding.Status.HELD, LPHolding.Status.LISTED_LP, LPHolding.Status.LISTED_SECONDARY)


def _cents(value) -> Decimal:
    return Decimal(value).quantize(CENTS, ROUND_HALF_UP)


def _locked_lp(user):
    return LiquidityProvider.objects.select_for_update().filter(user=user).first()


def _open_holdings(lp, property_slug, listed_as=None):
    """Open holdings, the ones listed on the selling market first, then held, oldest first."""
    rows = list(
        LPHolding.objects.select_for_update()
        .filter(lp=lp, property_id=property_slug, status__in=OPEN)
        .order_by("purchase_date", "created_at", "id")
    )
    rank = {listed_as: 0, LPHolding.Status.HELD: 1}
    return sorted(rows, key=lambda h: rank.get(h.status, 2))


def book_sale(*, seller, property_slug: str, units: int, proceeds, market: str,
              reference: str = "") -> Decimal:
    """
    Book the LP units among `units` sold for `proceeds` (what the seller receives) on `market`
    ("lp" or "secondary"). Returns the part of `proceeds` left for the seller's user wallet (all
    of it when no LP units were sold). The caller runs sync_listed once the listing is closed.
    """
    proceeds = _cents(proceeds)
    units = int(units)
    if units <= 0 or proceeds <= 0:
        return proceeds
    lp = _locked_lp(seller)
    if lp is None:
        return proceeds
    listed_as = LPHolding.Status.LISTED_LP if market == "lp" else LPHolding.Status.LISTED_SECONDARY
    holdings = _open_holdings(lp, property_slug, listed_as)
    lp_units = min(units, sum(int(h.token_amount) for h in holdings))
    if lp_units <= 0:
        return proceeds

    share = proceeds if lp_units == units else _cents(proceeds * lp_units / units)
    now = timezone.now()
    cost = Decimal("0")
    left, valued = lp_units, Decimal("0")
    for h in holdings:
        if left <= 0:
            break
        take = min(left, int(h.token_amount))
        left -= take
        # The sold units' value: their slice of the share, the last slice takes the rounding.
        value = share - valued if left == 0 else _cents(share * take / lp_units)
        valued += value
        if take == int(h.token_amount):
            sold = h
        else:
            # Part of this holding is sold: the sold part becomes its own (sold) record.
            part_cost = _cents(Decimal(h.purchase_price) * take / int(h.token_amount))
            h.token_amount = int(h.token_amount) - take
            h.purchase_price = Decimal(h.purchase_price) - part_cost
            h.save(update_fields=["token_amount", "purchase_price", "updated_at"])
            sold = LPHolding(
                lp=lp, listing=h.listing, property_id=h.property_id,
                property_name=h.property_name, token_symbol=h.token_symbol,
                token_amount=take, purchase_price=part_cost, purchase_date=h.purchase_date,
                listed_at=h.listed_at,
            )
        cost += Decimal(sold.purchase_price)
        sold.status = LPHolding.Status.SOLD
        sold.current_value = value
        sold.sold_at = now
        sold.save()

    gain = share - cost
    lp.current_balance = Decimal(lp.current_balance) + share
    lp.total_earnings = Decimal(lp.total_earnings) + gain
    lp.save(update_fields=["current_balance", "total_earnings", "updated_at"])
    symbol = holdings[0].token_symbol
    note = f"Sale of {lp_units} {symbol} ({reference})" if reference else f"Sale of {lp_units} {symbol}"
    if gain > 0:
        # The cost comes back as the sale, the profit over it as earnings; together = share.
        _ledger(lp, "sale", cost, note, now)
        _ledger(lp, "earning", gain, f"Profit on the sale of {lp_units} {symbol}", now)
    else:
        _ledger(lp, "sale", share, f"{note}; loss of {-gain}" if gain < 0 else note, now)
    return proceeds - share


def book_distribution(*, user, property_slug: str, earning_units: int, amount, label: str) -> Decimal:
    """
    Pay the LP units' share of a distribution `amount` (earned by `earning_units` of the user's
    units) to the LP balance as earnings. Returns the part left for the user wallet.
    """
    amount = _cents(amount)
    if amount <= 0 or int(earning_units) <= 0:
        return amount
    lp = _locked_lp(user)
    if lp is None:
        return amount
    held = (
        LPHolding.objects.filter(lp=lp, property_id=property_slug, status__in=OPEN)
        .aggregate(n=Sum("token_amount"))["n"] or 0
    )
    lp_units = min(int(earning_units), int(held))
    if lp_units <= 0:
        return amount
    share = amount if lp_units == int(earning_units) else _cents(amount * lp_units / int(earning_units))
    if share <= 0:
        return amount
    lp.current_balance = Decimal(lp.current_balance) + share
    lp.total_earnings = Decimal(lp.total_earnings) + share
    lp.save(update_fields=["current_balance", "total_earnings", "updated_at"])
    _ledger(lp, "earning", share, f"Rental return on {lp_units} units: {label}", timezone.now())
    return amount - share


def sync_listed(user, property_slug: str) -> None:
    """
    A holding marked listed goes back to held once the user has no open listing of the property
    left in either market (the request expired, was cancelled or closed by a price change).
    """
    from apps.secondary_market.models import SecondaryMarketListing

    from .models import LPMarketListing

    lp = LiquidityProvider.objects.filter(user=user).first()
    if lp is None:
        return
    open_lp = LPMarketListing.objects.filter(
        seller=user, property_id=property_slug, status=LPMarketListing.Status.LISTED
    ).exists()
    open_secondary = SecondaryMarketListing.objects.filter(
        seller=user, property_id=property_slug, status=SecondaryMarketListing.Status.LISTED
    ).exists()
    if open_lp and open_secondary:
        return
    stale = Q()
    if not open_lp:
        stale |= Q(status=LPHolding.Status.LISTED_LP)
    if not open_secondary:
        stale |= Q(status=LPHolding.Status.LISTED_SECONDARY)
    LPHolding.objects.filter(stale, lp=lp, property_id=property_slug).update(
        status=LPHolding.Status.HELD, listed_at=None, updated_at=timezone.now()
    )


def unit_prices(slugs) -> dict:
    """{property slug: current unit price} for the given slugs, in one query."""
    from apps.properties.models import Property

    return dict(Property.objects.filter(slug__in=set(slugs)).values_list("slug", "token_price"))


def value_now(holding: LPHolding, prices: dict) -> Decimal:
    """An open holding is worth its units at today's unit price; a sold one what it sold for."""
    price = prices.get(holding.property_id)
    if holding.status == LPHolding.Status.SOLD or price is None:
        return Decimal(holding.current_value)
    return _cents(Decimal(holding.token_amount) * Decimal(price))


def _ledger(lp, tx_type: str, amount, notes: str, when) -> None:
    LPTransaction.objects.create(
        lp=lp, tx_type=tx_type, amount=_cents(amount), currency="USD",
        status=LPTransaction.TxStatus.COMPLETED, notes=notes[:500], processed_at=when,
    )
