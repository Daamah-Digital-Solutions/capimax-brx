"""
Off-plan unit pricing — the ONE place a live property's unit price changes.

Off-plan model §3 (OFFPLAN_EXIT_MODEL_AR.md): a property has a single current unit price
(`Property.token_price`) that everything reads. Recording a new price, in one transaction:
  1. updates the price and appends an immutable `PropertyPrice` row (+ an admin LogEntry);
  2. moves the offering total (`total_value`) by the price delta on the UNSOLD units only,
     so funded % stays "money in ÷ money the offering will raise" and the supply is fixed;
  3. keeps the minimum investment at the same number of units;
  4. revalues every holder's position at units × new price (portfolio value);
  5. stamps `launch_price` (the old price) on the first change.
Price changes do NOT touch: live installment plans (price locked on the plan's investment),
secondary-market listings (seller's own price), or already-created purchases.

Guards (§3.5): full admins only; published properties only (drafts are priced in the
property editor); price > 0 and different from the current one; a single step above 25%
needs an explicit confirmation (usually a typo — 1100 instead of 110).
"""
from __future__ import annotations

from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Value
from django.utils import timezone

from .models import Property, PropertyCategory, PropertyPrice, TokenMetadata

MAX_STEP_CHANGE = Decimal("0.25")  # §3.5: larger single steps need explicit confirmation
PRICE_DUE_DAYS = 31  # §3.2: flag an under-construction property with no price for 31+ days
_CENT = Decimal("0.01")


class PriceError(Exception):
    """A rejected price change. `code` is stable for the API/admin; message is for humans."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def validate_new_price(prop: Property, new_price, *, by=None, confirm_large: bool = False) -> Decimal:
    """Raise PriceError if `new_price` can't be recorded now; return it as a Decimal."""
    if by is not None and not getattr(by, "is_superuser", False):
        raise PriceError("forbidden", "Only a full admin can record a unit price.")
    if not prop.is_published:
        raise PriceError(
            "unpublished",
            "This property isn't published — set its price in the property editor.",
        )
    try:
        new = Decimal(str(new_price)).quantize(_CENT, rounding=ROUND_HALF_UP)
    except Exception:  # noqa: BLE001 — any unparsable input is a bad price
        raise PriceError("invalid", "Enter a valid price.")
    if new <= 0:
        raise PriceError("invalid", "The price must be greater than zero.")
    old = Decimal(prop.token_price)
    if new == old:
        raise PriceError("same_price", f"The price is already {old}.")
    if old > 0 and abs(new - old) / old > MAX_STEP_CHANGE and not confirm_large:
        pct = ((new - old) / old * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        raise PriceError(
            "large_change",
            f"That is a {pct:+}% change in one step (limit 25%). If it's correct, tick "
            f"“I confirm a change of more than 25%” and save again.",
        )
    return new


def record_price(
    prop: Property,
    new_price,
    *,
    by,
    label: str = "",
    note: str = "",
    confirm_large: bool = False,
) -> PropertyPrice:
    """Record a new unit price for a published property. See the module docstring."""
    from django.contrib.admin.models import CHANGE, LogEntry
    from django.contrib.contenttypes.models import ContentType

    from apps.investments.services import sold_tokens
    from apps.wallets.models import OwnershipToken

    with transaction.atomic():
        p = Property.objects.select_for_update().get(pk=prop.pk)
        new = validate_new_price(p, new_price, by=by, confirm_large=confirm_large)
        old = Decimal(p.token_price)

        unsold = max(0, int(p.token_supply or 0) - sold_tokens(p))
        p.total_value = (Decimal(p.total_value) + (new - old) * unsold).quantize(
            _CENT, rounding=ROUND_HALF_UP
        )
        # Same number of units as before (e.g. 5 units stays 5 units at the new price).
        if old > 0:
            p.min_investment = (Decimal(p.min_investment) / old * new).quantize(
                _CENT, rounding=ROUND_HALF_UP
            )
        if p.launch_price is None:
            p.launch_price = old

        # History row first: it also freezes the supply (Property.price_locked) for the
        # save below, so the price change can never rescale token_supply.
        entry = PropertyPrice.objects.create(
            property=p,
            previous_price=old,
            price=new,
            label=(label or "").strip()[:80],
            note=(note or "").strip()[:280],
            created_by=by,
        )
        p.token_price = new
        p.save(update_fields=["token_price", "total_value", "min_investment", "launch_price", "updated_at"])

        # Keep the data-room display copy of the price in step with the single source.
        TokenMetadata.objects.filter(property=p).update(token_price=new)
        # Every holder's position is worth units × today's price.
        OwnershipToken.objects.filter(property_id=p.slug).update(
            token_value_usd=ExpressionWrapper(
                F("token_amount") * Value(new),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            )
        )

        if by is not None:
            LogEntry.objects.create(
                user_id=by.pk,
                content_type_id=ContentType.objects.get_for_model(Property).pk,
                object_id=str(p.pk),
                object_repr=str(p)[:200],
                action_flag=CHANGE,
                change_message=(
                    f"Unit price {old} → {new}"
                    + (f" ({entry.label})" if entry.label else "")
                ),
            )
    prop.refresh_from_db()
    return entry


# --------------------------------------------------------------------------- #
# Read side
# --------------------------------------------------------------------------- #
def last_price_change(prop: Property):
    return prop.price_history.order_by("-created_at", "-id").first()


def change_since_launch_pct(prop: Property) -> Decimal:
    launch = prop.launch_price or prop.token_price
    if not launch:
        return Decimal("0")
    return ((Decimal(prop.token_price) - Decimal(launch)) / Decimal(launch) * 100).quantize(
        _CENT, rounding=ROUND_HALF_UP
    )


def is_price_due(prop: Property, now=None) -> bool:
    """§3.2: an under-construction property with no new price for more than 31 days."""
    if prop.category not in (PropertyCategory.CONSTRUCTION, PropertyCategory.CONSTRUCTION_PORTFOLIO):
        return False
    if not prop.is_published:
        return False
    last = last_price_change(prop)
    since = last.created_at if last else prop.created_at
    return (now or timezone.now()) - since > timedelta(days=PRICE_DUE_DAYS)


def price_summary(prop: Property) -> dict:
    """Public price block: launch, current, % change, current phase name and every point."""
    history = list(prop.price_history.order_by("created_at", "id"))
    launch = prop.launch_price or prop.token_price
    latest = history[-1] if history else None
    points = [
        {
            "date": prop.created_at.isoformat(),
            "price": str(launch),
            "label": "",
            "note": "",
        }
    ] + [
        {
            "date": h.created_at.isoformat(),
            "price": str(h.price),
            "previousPrice": str(h.previous_price),
            "label": h.label,
            "note": h.note,
        }
        for h in history
    ]
    return {
        "launchPrice": str(launch),
        "currentPrice": str(prop.token_price),
        "changePct": str(change_since_launch_pct(prop)),
        "label": latest.label if latest else "",
        "updatedAt": latest.created_at.isoformat() if latest else None,
        "points": points,
    }
