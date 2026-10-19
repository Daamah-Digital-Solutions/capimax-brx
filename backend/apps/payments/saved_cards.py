"""
Saved cards (Stripe).

Saving: the browser confirms a SetupIntent created for the user's Stripe Customer (Stripe
handles 3-D Secure); we then read the result from Stripe — never from the browser — and keep
brand, last four and expiry plus the Stripe references, which are never returned to the client.

Paying: a checkout / top-up / installment can name `saved_card_id`; the server attaches that
card to the PaymentIntent and the browser only confirms it (completing 3-D Secure if the bank
asks). Cards are used on-session only: nothing is charged while the investor is away.
"""
from __future__ import annotations

from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.wallets.models import SavedCard, StripeCustomer

from . import stripe_service


def customer_for(user, *, create: bool = True) -> str:
    """The user's Stripe Customer id (created on first use; re-created if it vanished)."""
    rec = StripeCustomer.objects.filter(user=user).first()
    if rec and stripe_service.customer_exists(rec.customer_id):
        return rec.customer_id
    if not create:
        return ""
    cid = stripe_service.create_customer(email=user.email, user_id=str(user.pk))
    StripeCustomer.objects.update_or_create(user=user, defaults={"customer_id": cid})
    return cid


def start_setup(user) -> dict:
    si = stripe_service.create_setup_intent(customer=customer_for(user))
    return {"client_secret": si["client_secret"], "setup_intent_id": si["id"],
            "publishable_key": stripe_service.publishable_key()}


def save_from_setup_intent(user, setup_intent_id: str) -> SavedCard:
    si = stripe_service.retrieve_setup_intent(setup_intent_id)
    rec = StripeCustomer.objects.filter(user=user).first()
    if rec is None or si["customer"] != rec.customer_id:
        raise PermissionDenied("This card setup doesn't belong to you.")
    if si["status"] != "succeeded" or not si["payment_method"]:
        raise ValidationError({"code": "card_setup_incomplete",
                               "detail": "The card wasn't confirmed yet. Please try again."})
    existing = SavedCard.objects.filter(provider_payment_method_id=si["payment_method"]).first()
    if existing is not None:
        if existing.user_id != user.pk:
            raise PermissionDenied("This card setup doesn't belong to you.")
        return existing
    card = stripe_service.retrieve_card(si["payment_method"])
    try:
        with transaction.atomic():
            return SavedCard.objects.create(
                user=user,
                card_brand=card["brand"],
                card_last_four=card["last4"],
                card_expiry_month=card["exp_month"] or 1,
                card_expiry_year=card["exp_year"] or 2000,
                cardholder_name=card["name"] or user.email,
                is_default=not SavedCard.objects.filter(user=user).exists(),
                provider_customer_id=rec.customer_id,
                provider_payment_method_id=si["payment_method"],
            )
    except IntegrityError:  # a concurrent double submit saved it first
        return SavedCard.objects.get(provider_payment_method_id=si["payment_method"])


def remove(card: SavedCard) -> None:
    if card.provider_payment_method_id:
        stripe_service.detach_payment_method(card.provider_payment_method_id)
    was_default = card.is_default
    user = card.user
    card.delete()
    if was_default:
        nxt = SavedCard.objects.filter(user=user).order_by("-created_at").first()
        if nxt:
            nxt.is_default = True
            nxt.save(update_fields=["is_default", "updated_at"])


def charge_kwargs(user, saved_card_id) -> dict:
    """
    Extra PaymentIntent arguments to pay with the saved card `saved_card_id` (its customer and
    payment method). Empty for a new card typed at checkout.
    """
    if not saved_card_id:
        return {}
    card = SavedCard.objects.filter(pk=saved_card_id, user=user).first()
    if card is None:
        raise NotFound("Saved card not found.")
    if not card.chargeable:
        raise ValidationError({"code": "card_not_chargeable",
                               "detail": "This card was saved before card payments were enabled. "
                                         "Please add it again."})
    return {"customer": card.provider_customer_id, "payment_method": card.provider_payment_method_id}
