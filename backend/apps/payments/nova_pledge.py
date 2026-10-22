"""
Nova Finance pledges on units bought with a Nova Sukuk certificate (see models.NovaPledge).
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.wallets.models import OwnershipToken

from .models import NovaPledge


class PledgeError(Exception):
    pass


def pledge_units(investment, wallet, token, units: int) -> None:
    """Called by mint_investment under its locks: hold `units` for Nova (idempotent)."""
    if units <= 0 or NovaPledge.objects.filter(investment=investment).exists():
        return
    token.locked_amount = int(token.locked_amount) + int(units)
    NovaPledge.objects.create(
        investment=investment, wallet=wallet, property_slug=investment.property.slug, units=units,
    )


def active_pledge(investment):
    return NovaPledge.objects.filter(investment=investment, status=NovaPledge.Status.ACTIVE).first()


def pledged_units(wallet_id, property_slug) -> int:
    return sum(
        NovaPledge.objects.filter(
            wallet_id=wallet_id, property_slug=property_slug, status=NovaPledge.Status.ACTIVE,
        ).values_list("units", flat=True)
    )


def release_pledge(pledge_id, *, reference: str, by=None) -> NovaPledge:
    """Nova issued its clearance: unlock the units and tell the holder."""
    from apps.notifications.services import NotificationType, notify

    reference = (reference or "").strip()
    if not reference:
        raise PledgeError("Enter the Nova Finance clearance reference first.")
    with transaction.atomic():
        pledge = NovaPledge.objects.select_for_update().select_related("investment").get(pk=pledge_id)
        if pledge.status == NovaPledge.Status.RELEASED:
            return pledge
        token = (
            OwnershipToken.objects.select_for_update()
            .filter(wallet_id=pledge.wallet_id, property_id=pledge.property_slug)
            .first()
        )
        if token is not None:
            token.locked_amount = max(0, int(token.locked_amount) - int(pledge.units))
            token.save(update_fields=["locked_amount", "updated_at"])
        pledge.status = NovaPledge.Status.RELEASED
        pledge.release_reference = reference[:120]
        pledge.released_by = by
        pledge.released_at = timezone.now()
        pledge.save(update_fields=["status", "release_reference", "released_by", "released_at"])
        # Clearance received → the ownership certificate becomes final.
        from apps.certificates.services import sync_certificate

        sync_certificate(pledge.investment)
        notify(
            pledge.investment.user, NotificationType.NOVA_PLEDGE_RELEASED,
            params={"property": pledge.investment.property_name, "tokens": pledge.units},
            action_url="/portfolio",
        )
        return pledge
