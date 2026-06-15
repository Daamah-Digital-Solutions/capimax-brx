"""
Investment + minting services — Phase 3 Wave 2 (SPEC §4.1).

create_investment() ports process-investment; mint_investment() ports mint-tokens.
Token economics follow the LOCKED policy (price per-property, ownership from the real
token_supply). Payment is SIMULATED (flagged); minting is REAL on-chain — we NEVER
record a tx that didn't happen on a chain.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.certificates.services import create_provisional_certificate
from apps.chain import service as chain_service
from apps.chain.exceptions import ChainError
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken, UserWallet, WalletTransaction

from .models import Investment, PaymentStatus

# Sanity bound from SPEC §4.1 step 1 (amount $1–$10M). Min is enforced as >= 1 token.
MAX_AMOUNT_USD = Decimal("10000000")
DEDUP_WINDOW_SECONDS = 60

# Methods whose completion + mint are driven by a real PSP webhook (NOT simulated at
# creation). Phase 5 Wave 1: card (Stripe). Wave 2: crypto (NOW Payments IPN).
WEBHOOK_PAID_METHODS = {"card", "crypto"}


class DuplicateInvestmentError(APIException):
    status_code = 409
    default_detail = "An investment for this property is already in progress."
    default_code = "duplicate_investment"


class OverPurchaseError(APIException):
    status_code = 422
    default_detail = "Requested tokens exceed the property's available supply."
    default_code = "over_purchase"


# --------------------------------------------------------------------------- #
# Availability
# --------------------------------------------------------------------------- #
def sold_tokens(prop: Property) -> int:
    """Tokens already sold for a property = sum over its COMPLETED investments."""
    agg = Investment.objects.filter(
        property=prop, payment_status=PaymentStatus.COMPLETED
    ).aggregate(total=Sum("token_amount"))
    return int(agg["total"] or 0)


def available_tokens(prop: Property) -> int:
    return max(0, int(prop.token_supply or 0) - sold_tokens(prop))


# --------------------------------------------------------------------------- #
# Part A — process-investment
# --------------------------------------------------------------------------- #
def create_investment(*, user, prop: Property, token_amount: int, payment_method: str) -> dict:
    """
    Create an investment per the LOCKED token-economics policy, simulate payment,
    create the provisional certificate, and auto-mint if the user has a wallet.

    Returns {investment, tokens_minted, certificate_generated}.
    Raises ValidationError / DuplicateInvestmentError / OverPurchaseError.
    """
    token_amount = int(token_amount)

    with transaction.atomic():
        # Serialize all investments for THIS property so the available-supply check
        # and creation can't race (prevents overselling the fixed supply).
        locked_prop = Property.objects.select_for_update().get(pk=prop.pk)

        supply = int(locked_prop.token_supply or 0)
        if supply <= 0:
            raise ValidationError(
                {"property": "This property has no token supply configured."}
            )

        # Policy 5: min 1 token, max = available tokens.
        if token_amount < 1:
            raise ValidationError({"token_amount": "Minimum investment is 1 token."})

        available = supply - sold_tokens(locked_prop)
        if token_amount > available:
            raise OverPurchaseError(
                detail=f"Only {available} token(s) remain for this property."
            )

        price = locked_prop.token_price  # Policy 1 & 6: per-property, admin-set
        amount = (Decimal(token_amount) * price).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if amount > MAX_AMOUNT_USD:
            raise ValidationError(
                {"token_amount": f"Investment exceeds the ${MAX_AMOUNT_USD:,.0f} maximum."}
            )

        # Policy 3: ownership from the REAL token_supply (never /1000).
        ownership = (Decimal(token_amount) / Decimal(supply) * Decimal("100")).quantize(
            Decimal("0.000001"), rounding=ROUND_HALF_UP
        )

        # Dedup guard (SPEC §4.1): a second pending/processing within 60s.
        cutoff = timezone.now() - timezone.timedelta(seconds=DEDUP_WINDOW_SECONDS)
        if Investment.objects.filter(
            user=user,
            property=locked_prop,
            payment_status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING],
            created_at__gte=cutoff,
        ).exists():
            raise DuplicateInvestmentError()

        symbol = chain_service.token_symbol_for_slug(locked_prop.slug)

        investment = Investment.objects.create(
            user=user,
            property=locked_prop,
            property_name=locked_prop.name,
            amount_invested=amount,
            token_amount=token_amount,
            token_symbol=symbol,
            price_per_token=price,
            ownership_percentage=ownership,
            payment_method=payment_method,
            payment_status=PaymentStatus.PENDING,
        )

        # Phase 5 Wave 1: REAL payment for the card method. The investment stays
        # PENDING here — a real Stripe charge + SIGNATURE-VERIFIED webhook drives
        # completion + mint (apps/payments). We never mint on a frontend success and
        # never pretend money moved.
        #
        # Other methods keep their interim SIMULATED behaviour this wave (no real PSP
        # yet): marked completed to drive the flow. ⚠️ Still simulated — NOW Payments
        # (crypto) is Wave 2; Pronova/Sukuk remain their manual flows.
        # TODO(Payments Wave 2+): replace the simulated branch per method.
        defer_payment = payment_method in WEBHOOK_PAID_METHODS
        if not defer_payment:
            investment.payment_status = PaymentStatus.COMPLETED
            investment.save(update_fields=["payment_status", "updated_at"])

        # Provisional certificate with REAL property/SPV/fee data (no PDF — Wave 3).
        certificate = create_provisional_certificate(investment)

    # Auto-mint AFTER commit (mint does its own network call + atomic recording).
    # For deferred-payment methods (card) we do NOT mint here — the webhook will,
    # once the real charge is confirmed.
    tokens_minted = False
    if not defer_payment:
        wallet = UserWallet.objects.filter(user=user).first()
        if wallet is not None:
            try:
                result = mint_investment(investment)
                tokens_minted = bool(result.get("minted"))
            except ChainError:
                # Chain unavailable/misconfigured — leave for a later manual mint.
                # NEVER fabricate a tx; tokens_minted stays False.
                tokens_minted = False

    return {
        "investment": investment,
        "tokens_minted": tokens_minted,
        "certificate_generated": certificate is not None,
        "payment_required": defer_payment,
    }


# --------------------------------------------------------------------------- #
# Part B — mint-tokens (REAL on-chain)
# --------------------------------------------------------------------------- #
def _deployed_on_this_chain(prop: Property):
    """Return the deployed contract address IFF it's on the chain we're connected to."""
    meta = getattr(prop, "token_metadata", None)
    if not meta or not meta.deployed_contract_address:
        return None
    if meta.deployment_chain_id != int(settings.CHAIN_ID):
        return None
    return meta.deployed_contract_address


def mint_investment(investment: Investment) -> dict:
    """
    Mint `token_amount` shares to the user's custodial wallet on the property's
    deployed PropertyToken contract. Idempotent; serialized per-investment.

    Returns:
      {"minted": True, "already": True}            already minted
      {"minted": True, "tx_hash": …, "block": …}   minted now (REAL tx)
      {"minted": False, "reason": "<why>"}         pending (no wallet / not deployed)

    Never records a transaction that didn't occur on a chain.
    """
    with transaction.atomic():
        # Lock the investment row → idempotency + no concurrent double-mint of it.
        inv = Investment.objects.select_for_update().select_related("property").get(
            pk=investment.pk
        )
        if inv.tokens_minted:
            return {"minted": True, "already": True}
        if inv.payment_status != PaymentStatus.COMPLETED:
            raise ValidationError(
                {"payment_status": "Investment payment is not completed."}
            )

        wallet = inv.wallet or UserWallet.objects.filter(user=inv.user).first()
        if wallet is None:
            return {"minted": False, "reason": "no_wallet"}

        prop = inv.property
        contract_address = _deployed_on_this_chain(prop)
        if not contract_address:
            # Expected in Wave 2 until the testnet deploy lands. Mark pending; do NOT
            # fabricate a mint. (DECISIONS.md: live testnet deploy is a pending item.)
            return {"minted": False, "reason": "contract_not_deployed"}

        # REAL on-chain mint. Held under the per-investment lock so a concurrent
        # request for the SAME investment blocks rather than double-minting.
        result = chain_service.mint(
            contract_address, wallet.wallet_address, inv.token_amount
        )

        # Record the confirmed on-chain result (race-safe additive upsert).
        UserWallet.objects.select_for_update().get(pk=wallet.pk)  # serialize wallet writes
        supply = int(prop.token_supply or 0)
        token, _created = OwnershipToken.objects.select_for_update().get_or_create(
            wallet=wallet,
            property_id=prop.slug,
            defaults={
                "property_name": prop.name,
                "token_symbol": inv.token_symbol,
                "token_amount": 0,
            },
        )
        token.token_amount = token.token_amount + inv.token_amount
        token.token_value_usd = (Decimal(token.token_amount) * prop.token_price).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        token.ownership_percentage = (
            (Decimal(token.token_amount) / Decimal(supply) * Decimal("100")).quantize(
                Decimal("0.000001"), rounding=ROUND_HALF_UP
            )
            if supply
            else Decimal("0")
        )
        token.property_name = prop.name
        token.token_symbol = inv.token_symbol
        token.save()

        WalletTransaction.objects.create(
            wallet=wallet,
            tx_hash=result["tx_hash"],          # REAL chain hash
            tx_type="mint",
            amount=inv.amount_invested,
            token_symbol=inv.token_symbol,
            status="confirmed",
            block_number=result.get("block_number"),  # REAL block
            chain_id=result.get("chain_id"),
        )

        inv.tokens_minted = True
        inv.minted_at = timezone.now()
        inv.wallet = wallet
        inv.save(update_fields=["tokens_minted", "minted_at", "wallet", "updated_at"])

    return {
        "minted": True,
        "tx_hash": result["tx_hash"],
        "block_number": result.get("block_number"),
        "ownership_token_id": str(token.id),
    }
