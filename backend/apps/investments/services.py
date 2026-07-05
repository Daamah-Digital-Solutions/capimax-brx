"""
Investment + minting services — Phase 3 Wave 2 (SPEC §4.1).

create_investment() ports process-investment; mint_investment() ports mint-tokens.
Token economics follow the LOCKED policy (price per-property, ownership from the real
token_supply). Payment is SIMULATED (flagged); minting is REAL on-chain — we NEVER
record a tx that didn't happen on a chain.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.certificates.services import create_provisional_certificate
from apps.chain import service as chain_service
from apps.chain.exceptions import ChainError
from apps.notifications.services import NotificationType, notify
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken, UserWallet, WalletTransaction

from .models import Investment, PaymentStatus

# Sanity bound from SPEC §4.1 step 1 (amount $1–$10M). Min is enforced as >= 1 token.
MAX_AMOUNT_USD = Decimal("10000000")
DEDUP_WINDOW_SECONDS = 60

# Methods whose completion + mint are driven by a real PSP webhook (NOT simulated at
# creation). Phase 5 Wave 1: card (Stripe). Wave 2: crypto (NOW Payments IPN).
WEBHOOK_PAID_METHODS = {"card", "crypto"}

# Reinvestment funding: spend the investor's accrued internal balance (distribution /
# sale yield in UserBalance) instead of a PSP charge. NOT webhook-gated — settlement IS
# the successful in-ledger debit, so it takes the same auto-complete + auto-mint path as
# a settled buy. Same price/fees/owner/broker as a normal buy — NO bonus/discount
# (deferred product decision; DECISIONS.md "Reinvestments").
BALANCE_METHOD = "balance"
REINVESTMENT_SOURCE = "reinvestment"

# Nova certificate (Sukuk) funding: the buyer uploads a certificate; settlement is gated
# on ADMIN approval (apps.payments.sukuk_service), NOT a PSP webhook and NOT the simulated
# auto-complete. So a sukuk buy is DEFERRED at creation (stays PENDING, no mint) exactly
# like a card/crypto buy, then settled by approve_certificate → settle_investment.
SUKUK_METHOD = "sukuk"


class DuplicateInvestmentError(APIException):
    status_code = 409
    default_detail = "An investment for this property is already in progress."
    default_code = "duplicate_investment"


class OverPurchaseError(APIException):
    status_code = 422
    default_detail = "Requested tokens exceed the property's available supply."
    default_code = "over_purchase"


# --------------------------------------------------------------------------- #
# Fees — buyer-borne (Option A). The platform + management fee is charged to the BUYER
# on top of the token value, from the property's ADMIN-SET rates (Property.fee_platform
# + fee_management, apps/properties/models.py:186-188, editable in the Django admin).
# The owner receives the full token value (NO fee carve); the fee is the platform's.
# --------------------------------------------------------------------------- #
def fee_amount_for(prop: Property, base_amount) -> Decimal:
    """
    The buyer-borne platform + management fee for a token-value `base_amount`.

    Each fee is quantised to cents INDEPENDENTLY (platform, then management) and summed —
    mirroring the checkout display (src/pages/Checkout.tsx) EXACTLY, so the amount charged
    equals the amount shown. Reads the per-property admin rates (never hardcoded).
    """
    # Coerce via str() — the model's numeric defaults are Python floats on an unsaved
    # instance, and Decimal * float raises; Decimal(str(x)) is exact for both float + Decimal.
    base = Decimal(str(base_amount))
    platform_rate = Decimal(str(prop.fee_platform or "0"))
    management_rate = Decimal(str(prop.fee_management or "0"))
    platform = (base * platform_rate / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    management = (base * management_rate / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return platform + management


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
def create_investment(
    *,
    user,
    prop: Property,
    token_amount: int,
    payment_method: str,
    is_installment: bool = False,
    down_payment_percent=None,
    n_installments=None,
    frequency="monthly",
) -> dict:
    """
    Create an investment per the LOCKED token-economics policy, simulate payment,
    create the provisional certificate, and auto-mint if the user has a wallet.

    INSTALLMENTS (Wave B): when `is_installment`, the FULL position is still recorded
    (token_amount + ownership from the full price), but the investment carries the
    installment plan + the DOWN-PAYMENT (`down_payment_amount`) — and `charge_amount`
    (the gated charge + the owner/broker credit basis) becomes the down-payment, not the
    full price. Installments are ALWAYS settlement-gated (card/crypto only); the full
    mint-then-LOCK + plan activation happen on the confirmed webhook (mint_investment).

    Returns {investment, tokens_minted, certificate_generated, payment_required}.
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

        # Buyer-borne fee (Option A): platform + management fee on the token value, from
        # the property's admin rates. Charged to the buyer ON TOP (settlement_amount);
        # the owner still receives the full token value. Same fee for a normal buy and an
        # installment (charged once, with the down-payment).
        fee_amount = fee_amount_for(locked_prop, amount)

        # Installments (Wave B): build the plan + resolve the DOWN-PAYMENT. The full
        # `amount` above stays the position value (token_amount × price); the gated
        # charge is the down-payment. Installments are settlement-gated ONLY (the
        # FULL-MINT-THEN-LOCK happens on the confirmed webhook), so they require a
        # real PSP method — never the simulated branch.
        installment_plan = None
        down_payment_amount = None
        if is_installment:
            if payment_method not in WEBHOOK_PAID_METHODS:
                raise ValidationError(
                    {"payment_method": "Installments require a card or crypto payment."}
                )
            if locked_prop.model != "installment":
                raise ValidationError(
                    {"property": "This property is not an installment-model property."}
                )
            if down_payment_percent is None or n_installments is None:
                raise ValidationError(
                    {"installment": "down_payment_percent and n_installments are required."}
                )
            from apps.installments.services import build_installment_plan

            installment_plan = build_installment_plan(
                user, locked_prop,
                total_amount=amount,  # the FULL position value is the plan total
                down_payment_percent=down_payment_percent,
                n_installments=n_installments,
                frequency=frequency,
            )
            down_payment_amount = installment_plan.down_payment_amount

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
            is_installment=is_installment,
            down_payment_amount=down_payment_amount,
            fee_amount=fee_amount,
            installment_plan=installment_plan,
        )

        # Reinvestment (internal-balance funding): debit the investor's UserBalance for the
        # full price INSIDE this atomic block, so an insufficient balance rolls the whole
        # creation back (nothing moves). The successful debit IS the settlement — no PSP, no
        # webhook — so the buy then takes the same auto-complete + auto-mint path below.
        # Same price/fees/owner/broker as a normal buy (it IS a normal buy, balance-funded).
        if payment_method == BALANCE_METHOD:
            from apps.wallets.services import InsufficientBalance, debit_user_balance

            # Debit the full settlement (token value + buyer-borne fee) so a reinvestment
            # is charged the SAME displayed total as a card/crypto buy. Inside this atomic
            # block: an insufficient balance rolls the whole creation back (nothing moves).
            try:
                debit_user_balance(
                    user, investment.settlement_amount, source=REINVESTMENT_SOURCE,
                    reference=str(investment.id),
                    memo=f"Reinvestment: {token_amount} {symbol} of {locked_prop.slug}",
                )
            except InsufficientBalance:
                raise ValidationError(
                    {"payment_method": "Insufficient balance to reinvest this amount."}
                )

        # Phase 5 Wave 1: REAL payment for the card method. The investment stays
        # PENDING here — a real Stripe charge + SIGNATURE-VERIFIED webhook drives
        # completion + mint (apps/payments). We never mint on a frontend success and
        # never pretend money moved.
        #
        # Other methods keep their interim SIMULATED behaviour this wave (no real PSP
        # yet): marked completed to drive the flow. ⚠️ Still simulated — Apple/Google/
        # Pronova remain their manual flows.
        # TODO(Payments Wave 2+): replace the simulated branch per method.
        # Installments are ALWAYS gated (real money; full-mint-then-lock on the webhook),
        # so they never take the simulated auto-complete/auto-mint branch. The Nova
        # certificate (sukuk) is admin-gated → deferred here, settled on approval.
        defer_payment = (
            (payment_method in WEBHOOK_PAID_METHODS)
            or is_installment
            or payment_method == SUKUK_METHOD
        )
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
# Owner earnings — Phase 7 Wave D.
# On a COMPLETED primary token sale, credit the property OWNER's internal balance
# (UserBalance) with the NET proceeds = gross − (platform + management fees), reusing
# the same balance/ledger stack investors & LPs use. Runs inside the mint atomic block
# so the credit commits with the mint. Idempotent (one credit per investment) and safe
# when the property has no linked owner (admin-seeded properties).
# --------------------------------------------------------------------------- #
OWNER_PRIMARY_SALE_SOURCE = "primary_sale"


def credit_owner_share(inv: Investment, prop: Property, *, gross, reference, memo=None):
    """
    Reusable owner-credit core: credit the property owner for one `gross` tranche of the
    token value, exactly once (idempotent on (source="primary_sale", `reference`)).

    Buyer-borne fees (Option A): the platform + management fee is charged to the BUYER at
    settlement, NOT carved out of the owner — so the owner is credited the FULL `gross`
    (the token value actually paid at this tranche). Returns the amount credited, or None
    when skipped (no linked owner / already credited / non-positive).

    Two callers share this core, each with a DISTINCT reference so their idempotency keys
    never collide: the down-payment/full-purchase path keys on the investment id; each
    installment (Wave C) keys on its InstallmentPayment id. So credits accrue as money
    actually arrives, tranche by tranche.
    """
    from apps.wallets.models import BalanceTransaction
    from apps.wallets.services import credit_user_balance

    # LOCKED #5: admin-seeded property with no owner → credit no one (skip safely).
    # (No platform-account routing this wave — flagged in DECISIONS.md.)
    if not prop.submitted_by_id:
        return None

    # Keyed idempotency guard: a given (source, reference) can only ever write ONE
    # primary_sale credit, even on webhook replay.
    if BalanceTransaction.objects.filter(
        source=OWNER_PRIMARY_SALE_SOURCE, reference=reference
    ).exists():
        return None

    # Option A (buyer-borne fees): the platform + management fee is charged to the BUYER
    # at settlement (Investment.fee_amount), so the owner receives the FULL token value —
    # no fee is carved out of the owner's proceeds here. The property's fee rates now drive
    # only the buyer's surcharge (services.fee_amount_for), not an owner deduction.
    net = Decimal(gross).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if net <= 0:
        return None

    credit_user_balance(
        prop.submitted_by, net,
        source=OWNER_PRIMARY_SALE_SOURCE,
        reference=reference,
        memo=memo or f"Primary sale: {inv.token_amount} {inv.token_symbol} of {prop.slug}",
    )
    return net


def _credit_owner_for_primary_sale(inv: Investment, prop: Property):
    """
    Credit the owner's net for the amount ACTUALLY PAID at this settlement: the full price
    for a normal buy, the DOWN-PAYMENT for an installment (`charge_amount`). Keyed on the
    investment id. Unchanged for normal buys (charge_amount == amount_invested). Wave C
    credits each later installment via `credit_owner_share` keyed on the installment id.
    """
    return credit_owner_share(
        inv, prop, gross=inv.charge_amount, reference=str(inv.id)
    )


# --------------------------------------------------------------------------- #
# Broker commission — Phase 12 Wave B.
# On a COMPLETED primary sale by an investor who was REFERRED by a broker, credit that
# broker a configurable % (BrokerProfile.commission_rate, default 5) of the GROSS amount.
# PLATFORM-BORNE + ADDITIVE: this does NOT reduce the investor's tokens or the owner's net
# (it's an extra, separately-funded credit). Runs inside the SAME mint atomic block as the
# owner credit, idempotent (one credit per investment), safe when there's no referring
# broker / the broker isn't active. NO platform-account debit is modeled in v1 (flagged in
# DECISIONS.md, like the null-owner primary-sale case).
# --------------------------------------------------------------------------- #
BROKER_COMMISSION_SOURCE = "broker_commission"


def credit_broker_share(inv: Investment, *, gross, reference, memo=None):
    """
    Reusable broker-commission core: credit the investor's referring broker their
    commission on one `gross` tranche, exactly once (idempotent on
    (source="broker_commission", `reference`)).

    Returns (broker, commission) when credited, or None when skipped (no referring broker /
    broker not approved / already credited / non-positive). PLATFORM-BORNE + ADDITIVE —
    NEVER touches the investor's tokens or the owner's net. As with the owner credit, the
    down-payment/full path keys on the investment id and each installment (Wave C) keys on
    its InstallmentPayment id, so the broker accrues commission as money actually arrives.
    """
    from apps.broker.models import BrokerCommission, BrokerProfile, BrokerStatus
    from apps.wallets.models import BalanceTransaction
    from apps.wallets.services import credit_user_balance

    # LOCKED #2a/#6: only when the investing user was referred by a broker.
    profile = getattr(inv.user, "profile", None)
    if profile is None or profile.referred_by_broker_id is None:
        return None

    # LOCKED #2b/#6: the referring broker must be currently APPROVED/active.
    broker = BrokerProfile.objects.filter(pk=profile.referred_by_broker_id).first()
    if broker is None or broker.status != BrokerStatus.APPROVED:
        return None

    # LOCKED #3: keyed idempotency — one broker_commission credit per (source, reference),
    # even on webhook/mint replay (mirrors the owner-credit guard exactly).
    if BalanceTransaction.objects.filter(
        source=BROKER_COMMISSION_SOURCE, reference=reference
    ).exists():
        return None

    # RATE RESOLUTION (Broker Listings): the PER-PROPERTY rate first
    # (Property.broker_commission_rate), falling back to the broker's OWN rate
    # (BrokerProfile.commission_rate) when the property's is null — NOT a platform setting.
    prop = inv.property
    prop_rate = getattr(prop, "broker_commission_rate", None)
    rate = Decimal(prop_rate if prop_rate is not None else (broker.commission_rate or 0))

    # LOCKED #1: commission = paid amount × rate% — platform-borne + additive, off the
    # amount ACTUALLY PAID this tranche, independent of the owner's fee math.
    gross = Decimal(gross)
    commission = (gross * rate / Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if commission <= 0:
        return None

    credit_user_balance(
        broker.user, commission,
        source=BROKER_COMMISSION_SOURCE,
        reference=reference,
        memo=memo or f"Referral commission ({rate}%): {inv.token_symbol} of {prop.slug}",
    )

    # STAMP the structured, append-only commission record in the SAME atomic block. The
    # money-moving BalanceTransaction we just wrote is unique on (source, reference) by the
    # guard above, so fetch THAT row and tie the record to it (the idempotency anchor).
    # `rate_applied` is frozen at THIS rate — a later Property/broker rate change never
    # rewrites it.
    money_tx = BalanceTransaction.objects.filter(
        balance__user=broker.user, source=BROKER_COMMISSION_SOURCE, reference=reference,
    ).order_by("-created_at").first()
    BrokerCommission.objects.create(
        broker=broker,
        investment=inv,
        property_slug=prop.slug,
        property_name=prop.name,
        gross=gross,
        rate_applied=rate,
        commission=commission,
        balance_transaction=money_tx,
    )

    # LOCKED #4: bump the broker's accumulator in the SAME transaction (row-locked).
    locked = BrokerProfile.objects.select_for_update().get(pk=broker.pk)
    locked.total_commission_earned = (
        Decimal(locked.total_commission_earned or 0) + commission
    )
    locked.save(update_fields=["total_commission_earned", "updated_at"])
    return broker, commission


def _credit_broker_commission(inv: Investment):
    """
    Credit the referring broker on the amount ACTUALLY PAID at this settlement (full price
    normally, the down-payment for an installment — `charge_amount`), keyed on the
    investment id. Wave C credits each later installment via `credit_broker_share` keyed on
    the installment id.
    """
    return credit_broker_share(inv, gross=inv.charge_amount, reference=str(inv.id))


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
    Issue `token_amount` shares to the user's custodial wallet. Idempotent;
    serialized per-investment.

    Settlement follows the property: a property deployed on THIS chain gets a REAL
    on-chain mint (+ a WalletTransaction with the real tx hash); a ledger-only
    property settles the SAME OwnershipToken + owner/broker credits in our ledger,
    WITHOUT an on-chain tx — so buying ANY property produces a visible holding.

    Returns:
      {"minted": True, "already": True}                  already issued
      {"minted": True, "on_chain": True,  "tx_hash": …}  minted now (REAL tx)
      {"minted": True, "on_chain": False, "tx_hash": None} settled in the ledger
      {"minted": False, "reason": "no_wallet"}           pending (no custodial wallet)

    Never records a WalletTransaction that didn't occur on a chain.
    """
    with transaction.atomic():
        # Lock the investment row → idempotency + no concurrent double-mint of it.
        # NOTE: only select_related the NON-nullable `property` here — adding the
        # nullable `installment_plan` would LEFT-JOIN it and Postgres forbids
        # `FOR UPDATE` on the nullable side of an outer join. The plan is lazy-loaded
        # below, only on the installment path.
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

        # A property deployed on THIS chain gets a REAL on-chain mint. A ledger-only
        # property (no deployed contract yet) settles the SAME way in our ledger —
        # the OwnershipToken + owner/broker credits below — but WITHOUT an on-chain tx,
        # so buying ANY property produces a visible holding (and pays owner/broker).
        # `result` is the chain receipt (on-chain) or None (ledger-only). Held under the
        # per-investment lock so a concurrent request for the SAME investment blocks
        # rather than double-minting.
        result = (
            chain_service.mint(contract_address, wallet.wallet_address, inv.token_amount)
            if contract_address
            else None
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

        # FULL-MINT-THEN-LOCK (Installments Wave B): the FULL token_amount is minted in
        # ONE on-chain tx (above), but for an installment purchase only the DOWN-PAYMENT's
        # proportional share is RELEASED — the unpaid remainder is held LOCKED (reusing the
        # SAME OwnershipToken.locked_amount the LP/secondary markets honour, so locked
        # tokens can't be listed/sold). released = floor(down_paid / total × token_amount);
        # FLOOR so we NEVER release tokens that aren't paid for. Later installments (Wave C)
        # release the rest. A normal purchase locks nothing (released == token_amount).
        if inv.is_installment and inv.installment_plan_id:
            plan_total = Decimal(inv.installment_plan.total_amount)
            paid_now = Decimal(inv.charge_amount)
            released = (
                int((paid_now / plan_total * Decimal(inv.token_amount)).to_integral_value(rounding=ROUND_DOWN))
                if plan_total > 0
                else 0
            )
            released = max(0, min(int(inv.token_amount), released))
            locked_share = int(inv.token_amount) - released
            token.locked_amount = int(token.locked_amount) + locked_share

        token.save()

        # Only an on-chain mint records a WalletTransaction — its tx_hash/block are
        # ALWAYS real chain values (wallets/models). A ledger-only settlement has no
        # tx to record; the OwnershipToken + Investment + BalanceTransaction are the
        # trail (the same shape seed_demo produces for ledger holdings).
        if result is not None:
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

        # Installments Wave B: a CONFIRMED down-payment activates the plan (status active +
        # down_paid_at). In the SAME atomic block as the mint; idempotent (no-op if already
        # settled) and only reached once per investment (the tokens_minted guard above).
        if inv.is_installment and inv.installment_plan_id:
            from apps.installments.services import mark_down_payment_settled

            mark_down_payment_settled(inv.installment_plan)

        # Phase 7 Wave D: a COMPLETED primary sale → credit the property owner the token
        # value actually paid at this settlement (the full price for a normal buy, the
        # down-payment for an installment). Buyer-borne fees (Option A): the fee was
        # charged to the buyer, so the owner receives the FULL token value (no fee carve).
        # SAME atomic block so the credit commits with the mint. Idempotent + null-safe.
        owner_net = _credit_owner_for_primary_sale(inv, prop)

        # Phase 12 Wave B: if this investor was referred by an active broker, credit the
        # broker their commission — ADDITIVE + platform-borne, in the SAME atomic block, so
        # it commits with the mint. Idempotent + null-safe. Does NOT alter `owner_net` or
        # the investor's tokens (computed/credited entirely independently above).
        broker_result = _credit_broker_commission(inv)

        # Phase 10: in-app notifications, inside the mint's atomic block so they commit
        # with it. Only reached once per investment (the `tokens_minted` guard above).
        notify(
            inv.user, NotificationType.INVESTMENT_MINTED,
            params={"property": prop.name, "slug": prop.slug, "tokens": inv.token_amount},
            action_url="/portfolio",
        )
        if owner_net is not None and prop.submitted_by_id:
            notify(
                prop.submitted_by, NotificationType.EARNINGS_CREDITED,
                params={"property": prop.name, "slug": prop.slug, "amount": str(owner_net)},
                action_url="/owner-wallet",
            )
        if broker_result is not None:
            broker, commission = broker_result
            notify(
                broker.user, NotificationType.BROKER_COMMISSION_CREDITED,
                params={"property": prop.name, "slug": prop.slug, "amount": str(commission)},
                action_url="/broker-dashboard",
            )

    return {
        "minted": True,
        "on_chain": result is not None,
        "tx_hash": result["tx_hash"] if result is not None else None,
        "block_number": result.get("block_number") if result is not None else None,
        "ownership_token_id": str(token.id),
        "owner_credited": None if owner_net is None else str(owner_net),
        "broker_credited": None if broker_result is None else str(broker_result[1]),
    }


def settle_investment(investment: Investment) -> dict:
    """
    Settle a COMPLETED buy: mark the investment `completed` (idempotent, row-locked) then
    mint. This is the SINGLE shared settlement step every non-simulated rail funnels
    through, so tokens, owner/broker credit, and the buyer-borne fee behave IDENTICALLY
    regardless of how the money arrived:
      * a confirmed PSP webhook/IPN  → apps.payments.services._complete_payment (card/crypto
        buy + installment down-payment),
      * an ADMIN-approved Nova certificate → apps.payments.sukuk_service.approve_certificate.
    Returns `mint_investment`'s result (mint is itself idempotent + null-safe on no-wallet).
    """
    with transaction.atomic():
        inv = Investment.objects.select_for_update().get(pk=investment.pk)
        if inv.payment_status != PaymentStatus.COMPLETED:
            inv.payment_status = PaymentStatus.COMPLETED
            inv.save(update_fields=["payment_status", "updated_at"])
    return mint_investment(inv)


def record_acquisition_cost(
    *, user, property_slug, property_name, token_symbol, token_amount,
    amount_paid, wallet=None, source,
):
    """
    Record a COST-BASIS row (a completed `Investment`) for tokens acquired on the
    SECONDARY / LP market, so the portfolio's average-cost and return% are correct for
    ALL holdings — not only primary buys. Primary buys already create an Investment via
    `create_investment`; secondary/LP buys previously credited only an OwnershipToken.

    This does NOT move money or mint: the on-chain transfer + balance settlement already
    happened in the caller; this only RECORDS the price the buyer already paid. Idempotency
    is the caller's (settlement is guarded by the listing's completed-status check, so a
    re-run returns before reaching here). Returns the row, or None if the property/amount
    is unusable.
    """
    amount = Decimal(amount_paid)
    qty = int(token_amount)
    if qty <= 0 or amount <= 0:
        return None
    prop = Property.objects.filter(slug=property_slug).first()
    if prop is None:
        return None
    return Investment.objects.create(
        user=user,
        property=prop,
        property_name=property_name,
        amount_invested=amount,
        token_amount=qty,
        token_symbol=token_symbol,
        price_per_token=(amount / Decimal(qty)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        ownership_percentage=Decimal("0"),
        payment_method=source,
        payment_status=PaymentStatus.COMPLETED,
        tokens_minted=True,
        minted_at=timezone.now(),
        wallet=wallet,
    )
