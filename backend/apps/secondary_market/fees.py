"""
Trading fees — the client's fee schedule for the secondary market and the liquidity provider
(LP) market (Capimax_Market_Fees_AR, 2026-11). Every percentage is of the value of the units
sold, and the platform's share is what is left of the fees after the LP's share.

    deal                                   seller   buyer   platform   LP's share
    ordinary sale on the secondary market   0.5 %   1.5 %     2 %         —
    an LP buys on the LP market             1.5 %   0 %       1 %       0.5 % (from the seller's fee)
    an LP resells its LP-market units       0 %     1.5 %     1 %       0.5 % (from the buyer's fee)
      on the secondary market

An LP selling to another LP on the LP market is the same deal as an investor selling to an LP.
"LP units" are the units an LP bought on the LP market and still holds (its open LPHolding
rows, apps/lp/accounting.py); a secondary sale that mixes them with the seller's own investor
units is split by units. The LP's share is paid into its LP balance once the deal settles, in
the same atomic settlement, so it is booked exactly once and never if the deal does not happen.

The rates live in settings (SECONDARY_MARKET_FEE_PERCENT = buyer, SECONDARY_MARKET_SELLER_FEE_
PERCENT, LP_MARKET_FEE_PERCENT = LP-market seller, LP_FEE_SHARE_PERCENT) so they can be changed
without a deploy. Pure arithmetic — nothing here writes.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings

CENT = Decimal("0.01")
HUNDRED = Decimal("100")


def _q(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def _pct(name: str, default) -> Decimal:
    return Decimal(str(getattr(settings, name, default)))


def buyer_pct() -> Decimal:
    return _pct("SECONDARY_MARKET_FEE_PERCENT", "1.5")


def seller_pct() -> Decimal:
    return _pct("SECONDARY_MARKET_SELLER_FEE_PERCENT", "0.5")


def lp_market_pct() -> Decimal:
    return _pct("LP_MARKET_FEE_PERCENT", "1.5")


def lp_share_pct() -> Decimal:
    return _pct("LP_FEE_SHARE_PERCENT", "0.5")


def secondary(total, units: int = 0, lp_units: int = 0) -> dict:
    """
    A secondary-market sale of `units` worth `total`, `lp_units` of them the seller's LP units.
    The buyer pays the fee on every unit; the seller pays its fee on its own investor units only;
    the LP's share comes out of the buyer's fee on the LP units.
    """
    total = _q(total)
    units, lp_units = int(units or 0), max(0, min(int(lp_units or 0), int(units or 0)))
    lp_value = total if units and lp_units == units else _q(total * lp_units / units) if units else Decimal("0")
    own_value = total - lp_value
    buyer_fee = _q(total * buyer_pct() / HUNDRED)
    seller_fee = _q(own_value * seller_pct() / HUNDRED)
    lp_share = _q(lp_value * lp_share_pct() / HUNDRED)
    return {
        "total": total,
        "units": units,
        "lp_units": lp_units,
        "lp_value": lp_value,
        "buyer_fee_percent": buyer_pct(),
        "buyer_fee": buyer_fee,
        "buyer_total": total + buyer_fee,
        "seller_fee_percent": seller_pct() if own_value else Decimal("0"),
        "seller_fee": seller_fee,
        "seller_net": total - seller_fee,
        "lp_share_percent": lp_share_pct() if lp_value else Decimal("0"),
        "lp_share": lp_share,
        "platform": buyer_fee + seller_fee - lp_share,
    }


def plan_sale(cash, units: int = 0, lp_units: int = 0) -> dict:
    """An installment plan (or part of one) sold on the secondary market: the fees are on the
    cash paid for the paid-up share, split like any secondary sale."""
    return secondary(cash, units, lp_units)


def lp_market(total) -> dict:
    """An LP buys on the LP market: the seller pays the fee, the buying LP gets its share of it."""
    total = _q(total)
    seller_fee = _q(total * lp_market_pct() / HUNDRED)
    lp_share = _q(total * lp_share_pct() / HUNDRED)
    return {
        "total": total,
        "seller_fee_percent": lp_market_pct(),
        "seller_fee": seller_fee,
        "seller_net": total - seller_fee,
        "buyer_total": total,
        "lp_share_percent": lp_share_pct(),
        "lp_share": lp_share,
        "platform": seller_fee - lp_share,
    }


def schedule() -> dict:
    """The fee schedule for the API and the UI."""
    return {
        "secondary_buyer_fee_percent": float(buyer_pct()),
        "secondary_seller_fee_percent": float(seller_pct()),
        "lp_market_seller_fee_percent": float(lp_market_pct()),
        "lp_fee_share_percent": float(lp_share_pct()),
        "platform_secondary_percent": float(buyer_pct() + seller_pct()),
        "platform_lp_percent": float(lp_market_pct() - lp_share_pct()),
    }
