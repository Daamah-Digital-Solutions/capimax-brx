"""
Gifts, family transfers and inheritance — the engine behind UnitTransfer (see models.py).

  create    validate, hold what is given (lock units / debit the wallet), and — when it is
            due today — deliver right after commit.
  deliver   if the recipient has a verified email and approved KYC: move the units (on-chain
            when the property's token is deployed, otherwise the custodial positions) or credit
            the amount, record their cost basis, notify both. Otherwise it waits and the
            recipient is invited; it is handed over the moment they verify (release_waiting).
  close     cancelled / expired / failed: the hold goes back to the sender, once.

Fixes over PropShare: a pending gift can be cancelled, an unclaimed one expires and returns,
a failed delivery returns everything, you can't gift yourself, and the instant a recipient
verifies their waiting transfers are delivered (no admin step).
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from types import SimpleNamespace

from django.conf import settings
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.chain.exceptions import ChainError
from apps.notifications.services import NotificationType, notify
from apps.wallets.models import BalanceTransaction, OwnershipToken, UserBalance, UserWallet, WalletTransaction
from apps.wallets.services import (
    InsufficientBalance,
    credit_user_balance,
    debit_user_balance,
    get_or_create_custodial_wallet,
)

from .models import Beneficiary, EstateCertificate, EstateClaim, UnitTransfer

log = logging.getLogger(__name__)

# Investment.payment_method of the recipient's cost-basis row (see RESALE_PAYMENT_METHODS).
COST_SOURCE = {"gift": "gift", "family": "family_transfer", "estate": "estate"}
KIND_LABEL = {"gift": "gift", "family": "family transfer", "estate": "inheritance"}
CENT = Decimal("0.01")


class DeliveryError(Exception):
    """The units could not be moved (e.g. the sender's position changed)."""


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _user_model():
    from apps.core.models import User

    return User


def recipient_ready(user) -> bool:
    """A recipient can receive once their email is verified and their KYC approved."""
    from apps.kyc.models import UserKYC

    if user is None or not user.is_active or not getattr(user, "is_email_verified", False):
        return False
    return UserKYC.objects.filter(user=user, status="approved").exists()


def display_name(user) -> str:
    profile = getattr(user, "profile", None)
    return (getattr(profile, "full_name", "") or "") or user.email


def describe(t: UnitTransfer) -> str:
    if t.asset == UnitTransfer.Asset.UNITS:
        return f"{t.units} unit{'s' if t.units != 1 else ''} of {t.property_name}"
    return f"${t.amount:,.2f}"


def _wallet_position(user, slug, *, lock=False):
    wallet = UserWallet.objects.filter(user=user).first()
    if wallet is None:
        return None, None
    qs = OwnershipToken.objects.filter(wallet=wallet, property_id=slug)
    if lock:
        qs = qs.select_for_update()
    return wallet, qs.first()


def free_units(user, slug, position=None) -> int:
    """Units the holder can give: held − locked (escrow, plan, pledges, holds) − paid units
    of running installment plans (those move only with the whole plan)."""
    from apps.installments.position import plan_bound_released

    if position is None:
        _w, position = _wallet_position(user, slug)
    if position is None:
        return 0
    return max(0, int(position.token_amount) - int(position.locked_amount)
               - plan_bound_released(user.pk, slug))


def average_cost(user, slug) -> Decimal:
    """The holder's average cost per unit (falls back to the current unit price)."""
    from apps.investments.models import Investment, PaymentStatus
    from apps.properties.models import Property

    agg = Investment.objects.filter(
        user=user, property__slug=slug, payment_status=PaymentStatus.COMPLETED,
    ).aggregate(amount=Sum("amount_invested"), units=Sum("token_amount"))
    if agg["units"]:
        return (Decimal(agg["amount"] or 0) / Decimal(agg["units"])).quantize(CENT, ROUND_HALF_UP)
    prop = Property.objects.filter(slug=slug).only("token_price").first()
    return Decimal(prop.token_price) if prop else Decimal("0")


def hamilton(total: int, percents: list[Decimal]) -> list[int]:
    """Split `total` whole units by `percents` (largest remainder). With shares under 100%
    only that share of the total is split; the rest stays undistributed."""
    pct_sum = sum(percents, Decimal("0"))
    if total <= 0 or pct_sum <= 0:
        return [0] * len(percents)
    target = total if pct_sum >= 100 else int(Decimal(total) * pct_sum / 100)
    quotas = [Decimal(total) * p / 100 for p in percents]
    shares = [int(q) for q in quotas]
    order = sorted(range(len(percents)), key=lambda i: quotas[i] - shares[i], reverse=True)
    for i in order[: max(0, target - sum(shares))]:
        shares[i] += 1
    return shares


def _send_invite(t: UnitTransfer, user) -> None:
    from apps.core.event_emails import send_event_email

    target = user or SimpleNamespace(email=t.recipient_email, pk=None)
    params = {"sender": display_name(t.sender), "what": describe(t), "kind": KIND_LABEL[t.kind]}
    transaction.on_commit(lambda: send_event_email(target, "transfer_invite", params))


# --------------------------------------------------------------------------- #
# Create + hold
# --------------------------------------------------------------------------- #
def _hold(t: UnitTransfer) -> None:
    if t.asset == UnitTransfer.Asset.UNITS:
        _w, pos = _wallet_position(t.sender, t.property_slug, lock=True)
        if pos is None or free_units(t.sender, t.property_slug, pos) < t.units:
            raise ValidationError({"code": "not_enough_units",
                                   "detail": "You don't have that many free units of this property."})
        pos.locked_amount = int(pos.locked_amount) + t.units
        pos.save(update_fields=["locked_amount", "updated_at"])
        charge = t.fee_amount
    else:
        charge = t.amount + t.fee_amount
    if charge > 0:
        try:
            debit_user_balance(t.sender, charge, source=f"{t.kind}_sent", reference=str(t.pk),
                               memo=f"{KIND_LABEL[t.kind].capitalize()} {t.reference} to {t.recipient_email}")
        except InsufficientBalance:
            raise ValidationError({"code": "insufficient_balance", "detail": "Insufficient wallet balance."})


def _release_hold(t: UnitTransfer) -> None:
    if t.asset == UnitTransfer.Asset.UNITS:
        _w, pos = _wallet_position(t.sender, t.property_slug, lock=True)
        if pos is not None:
            pos.locked_amount = max(0, int(pos.locked_amount) - t.units)
            pos.save(update_fields=["locked_amount", "updated_at"])
        back = t.fee_amount
    else:
        back = t.amount + t.fee_amount
    source = f"{t.kind}_returned"
    if back > 0 and not BalanceTransaction.objects.filter(source=source, reference=str(t.pk)).exists():
        credit_user_balance(t.sender, back, source=source, reference=str(t.pk),
                            memo=f"{KIND_LABEL[t.kind].capitalize()} {t.reference} returned")


def create_transfer(
    *, kind, asset, sender, recipient_email, recipient_name="", property_slug="", units=0,
    amount=0, fee_percent=0.0, deliver_on=None, message="", occasion="",
    family_account=None, estate_claim=None,
) -> UnitTransfer:
    email = (recipient_email or "").strip().lower()
    if not email:
        raise ValidationError({"recipient_email": "Enter the recipient's email."})
    if kind != UnitTransfer.Kind.ESTATE and email == (sender.email or "").lower():
        raise ValidationError({"code": "self_transfer", "detail": "You can't send this to yourself."})
    today = timezone.localdate()
    deliver_on = deliver_on or today
    if deliver_on < today:
        raise ValidationError({"deliver_on": "The date can't be in the past."})
    if (deliver_on - today).days > int(settings.GIFT_MAX_DAYS_AHEAD):
        raise ValidationError({"deliver_on": f"Schedule at most {settings.GIFT_MAX_DAYS_AHEAD} days ahead."})

    fields = {}
    if asset == UnitTransfer.Asset.UNITS:
        units = int(units or 0)
        if units <= 0:
            raise ValidationError({"units": "Enter how many units."})
        _w, pos = _wallet_position(sender, property_slug)
        if pos is None:
            raise ValidationError({"code": "not_enough_units", "detail": "You don't hold this property."})
        value = (average_cost(sender, property_slug) * units).quantize(CENT, ROUND_HALF_UP)
        fields = {"property_slug": property_slug, "property_name": pos.property_name,
                  "token_symbol": pos.token_symbol, "units": units, "amount": value}
    else:
        value = Decimal(str(amount or 0)).quantize(CENT, ROUND_HALF_UP)
        if value <= 0:
            raise ValidationError({"amount": "Enter an amount."})
        fields = {"amount": value}
    fee = (value * Decimal(str(fee_percent or 0)) / 100).quantize(CENT, ROUND_HALF_UP)

    with transaction.atomic():
        t = UnitTransfer.objects.create(
            kind=kind, asset=asset, sender=sender,
            recipient=_user_model().objects.filter(email__iexact=email).first(),
            recipient_email=email, recipient_name=(recipient_name or "")[:120],
            fee_amount=fee, message=(message or "")[:500], occasion=(occasion or "")[:40],
            deliver_on=deliver_on, family_account=family_account, estate_claim=estate_claim,
            reference="TR-" + uuid.uuid4().hex[:10].upper(), **fields,
        )
        _hold(t)
        if deliver_on <= today:
            transaction.on_commit(lambda: deliver_safely(t.pk))
    return t


def create_gift(sender, *, recipient_email, recipient_name="", asset, property_slug="", units=0,
                amount=0, deliver_on=None, message="", occasion="") -> UnitTransfer:
    return create_transfer(
        kind=UnitTransfer.Kind.GIFT, asset=asset, sender=sender, recipient_email=recipient_email,
        recipient_name=recipient_name, property_slug=property_slug, units=units, amount=amount,
        fee_percent=settings.GIFT_FEE_PERCENT, deliver_on=deliver_on, message=message,
        occasion=occasion,
    )


def create_family_transfer(owner, *, family_account_id, asset, property_slug="", units=0,
                           amount=0, message="") -> UnitTransfer:
    from apps.family.models import FamilyAccount
    from apps.family.services import log_transaction

    account = FamilyAccount.objects.filter(pk=family_account_id, investor=owner).first()
    if account is None:
        raise NotFound("Family member not found.")
    if not account.member_email:
        raise ValidationError({"code": "member_email_required",
                               "detail": "Add this family member's email first."})
    with transaction.atomic():
        t = create_transfer(
            kind=UnitTransfer.Kind.FAMILY, asset=asset, sender=owner,
            recipient_email=account.member_email, recipient_name=account.member_name,
            property_slug=property_slug, units=units, amount=amount,
            fee_percent=settings.FAMILY_TRANSFER_FEE_PERCENT, message=message,
            family_account=account,
        )
        log_transaction(account, "transfer_initiated", amount=t.amount, initiated_by=owner,
                        description=f"{describe(t)} ({t.reference})", reference_number=t.reference)
    return t


# --------------------------------------------------------------------------- #
# Deliver
# --------------------------------------------------------------------------- #
def _move_units(t: UnitTransfer, recipient) -> str:
    from apps.chain import service as chain_service
    from apps.investments.services import record_acquisition_cost
    from apps.lp.market_services import NotDeployedError, _deployed_contract, _recompute_position
    from apps.wallets.services import load_custodial_signer

    sender_wallet, pos = _wallet_position(t.sender, t.property_slug, lock=True)
    if pos is None or int(pos.locked_amount) < t.units or int(pos.token_amount) < t.units:
        raise DeliveryError("The sender no longer holds these units.")
    recipient_wallet, _c = get_or_create_custodial_wallet(recipient)

    try:
        contract = _deployed_contract(t.property_slug)
    except NotDeployedError:
        tx_hash = f"offchain:{t.pk}"
        block = chain_id = None
    else:
        signer = load_custodial_signer(sender_wallet)
        try:
            result = chain_service.transfer(contract, signer, recipient_wallet.wallet_address, t.units)
        finally:
            del signer
        tx_hash, block, chain_id = result["tx_hash"], result.get("block_number"), result.get("chain_id")

    pos.token_amount = int(pos.token_amount) - t.units
    pos.locked_amount = max(0, int(pos.locked_amount) - t.units)
    _recompute_position(pos, t.property_slug)
    if pos.token_amount == 0:
        pos.status = OwnershipToken.Status.SOLD
    pos.save()

    rpos, _c = OwnershipToken.objects.select_for_update().get_or_create(
        wallet=recipient_wallet, property_id=t.property_slug,
        defaults={"property_name": t.property_name, "token_symbol": t.token_symbol, "token_amount": 0},
    )
    rpos.token_amount = int(rpos.token_amount) + t.units
    rpos.status = OwnershipToken.Status.ACTIVE
    _recompute_position(rpos, t.property_slug)
    rpos.save()

    record_acquisition_cost(
        user=recipient, property_slug=t.property_slug, property_name=t.property_name,
        token_symbol=t.token_symbol, token_amount=t.units, amount_paid=t.amount,
        wallet=recipient_wallet, source=COST_SOURCE[t.kind],
    )
    for w in (sender_wallet, recipient_wallet):
        WalletTransaction.objects.create(
            wallet=w, tx_hash=tx_hash, tx_type="transfer", amount=t.amount,
            token_symbol=t.token_symbol, status="confirmed", block_number=block, chain_id=chain_id,
        )
    return tx_hash


def deliver(transfer_id) -> str:
    """Hand a due transfer over (or park it until the recipient verifies). Returns its status."""
    User = _user_model()
    with transaction.atomic():
        t = UnitTransfer.objects.select_for_update().select_related("sender").get(pk=transfer_id)
        if t.status not in UnitTransfer.OPEN:
            return t.status
        if t.deliver_on > timezone.localdate():
            return t.status
        recipient = t.recipient or User.objects.filter(email__iexact=t.recipient_email).first()
        if recipient is not None and recipient.pk != t.recipient_id:
            t.recipient = recipient
            t.save(update_fields=["recipient", "updated_at"])
        if recipient is not None and recipient.pk == t.sender_id:
            failed = "The recipient is the sender."
        elif not recipient_ready(recipient):
            if t.status != UnitTransfer.Status.WAITING:
                t.status = UnitTransfer.Status.WAITING
                if t.kind != UnitTransfer.Kind.ESTATE:
                    t.expires_at = timezone.now() + timedelta(days=int(settings.TRANSFER_CLAIM_DAYS))
                t.invited_at = timezone.now()
                t.save(update_fields=["status", "expires_at", "invited_at", "updated_at"])
                notify(t.sender, NotificationType.TRANSFER_WAITING,
                       params={"what": describe(t), "kind": KIND_LABEL[t.kind],
                               "recipient": t.recipient_name or t.recipient_email,
                               "days": settings.TRANSFER_CLAIM_DAYS},
                       action_url="/family-investment")
                _send_invite(t, recipient)
            return t.status
        else:
            failed = ""
            try:
                with transaction.atomic():
                    if t.asset == UnitTransfer.Asset.UNITS:
                        t.tx_hash = _move_units(t, recipient)
                    else:
                        credit_user_balance(
                            recipient, t.amount, source=f"{t.kind}_received", reference=str(t.pk),
                            memo=f"{KIND_LABEL[t.kind].capitalize()} {t.reference} from {display_name(t.sender)}",
                        )
                    t.status = UnitTransfer.Status.DELIVERED
                    t.delivered_at = timezone.now()
                    t.save(update_fields=["status", "delivered_at", "tx_hash", "updated_at"])
                    _after_delivery(t, recipient)
            except (ChainError, DeliveryError) as exc:
                log.exception("Transfer %s could not be delivered", t.reference)
                failed = str(exc) or "The transfer could not be completed."
        if failed:
            t.refresh_from_db()
            _close(t, UnitTransfer.Status.FAILED, failed)
        return t.status


def _after_delivery(t: UnitTransfer, recipient) -> None:
    params = {"what": describe(t), "kind": KIND_LABEL[t.kind], "sender": display_name(t.sender),
              "recipient": t.recipient_name or t.recipient_email, "message": t.message or ""}
    notify(recipient, NotificationType.TRANSFER_RECEIVED, params=params,
           action_url="/portfolio" if t.asset == UnitTransfer.Asset.UNITS else "/wallet")
    if t.kind != UnitTransfer.Kind.ESTATE:
        notify(t.sender, NotificationType.TRANSFER_DELIVERED, params=params, action_url="/family-investment")
    if t.family_account_id:
        from apps.family.models import FamilyAccount, FamilyTransaction

        FamilyAccount.objects.filter(pk=t.family_account_id).update(
            total_transferred=F("total_transferred") + t.amount)
        FamilyTransaction.objects.filter(reference_number=t.reference).update(status="completed")


def deliver_safely(transfer_id) -> str:
    try:
        return deliver(transfer_id)
    except Exception:
        log.exception("Delivering transfer %s crashed; it stays open for the next run", transfer_id)
        return "error"


def _close(t: UnitTransfer, status: str, reason: str) -> None:
    """Cancel / expire / fail an open transfer and return the hold to the sender (once)."""
    with transaction.atomic():
        t = UnitTransfer.objects.select_for_update().get(pk=t.pk)
        if t.status not in UnitTransfer.OPEN:
            return
        _release_hold(t)
        t.status = status
        t.closed_reason = reason[:300]
        t.save(update_fields=["status", "closed_reason", "updated_at"])
        if t.family_account_id:
            from apps.family.models import FamilyTransaction

            FamilyTransaction.objects.filter(reference_number=t.reference).update(status="failed")
        if t.kind != UnitTransfer.Kind.ESTATE:
            notify(t.sender, NotificationType.TRANSFER_RETURNED,
                   params={"what": describe(t), "kind": KIND_LABEL[t.kind],
                           "recipient": t.recipient_name or t.recipient_email, "reason": reason},
                   action_url="/family-investment")


def cancel(transfer_id, user) -> UnitTransfer:
    t = UnitTransfer.objects.filter(pk=transfer_id, sender=user).first()
    if t is None:
        raise NotFound("Transfer not found.")
    if t.kind == UnitTransfer.Kind.ESTATE:
        raise PermissionDenied("An inheritance can't be cancelled.")
    if t.status not in UnitTransfer.OPEN:
        raise ValidationError({"code": "not_open", "detail": "This transfer is already closed."})
    _close(t, UnitTransfer.Status.CANCELLED, "Cancelled by the sender.")
    t.refresh_from_db()
    return t


def release_waiting(user) -> int:
    """The user just verified their email or KYC: deliver what is waiting for them."""
    if not recipient_ready(user):
        return 0
    ids = list(UnitTransfer.objects.filter(
        status=UnitTransfer.Status.WAITING, recipient_email__iexact=user.email,
    ).values_list("pk", flat=True))
    return sum(1 for pk in ids if deliver_safely(pk) == UnitTransfer.Status.DELIVERED)


def release_waiting_on_commit(user) -> None:
    transaction.on_commit(lambda: release_waiting(user))


# --------------------------------------------------------------------------- #
# Cron (manage.py process_transfers)
# --------------------------------------------------------------------------- #
def remind_upcoming(today=None) -> int:
    today = today or timezone.localdate()
    horizon = today + timedelta(days=int(settings.GIFT_REMINDER_DAYS))
    n = 0
    for t in UnitTransfer.objects.filter(
        status=UnitTransfer.Status.SCHEDULED, kind=UnitTransfer.Kind.GIFT,
        reminder_sent_at__isnull=True, deliver_on__gt=today, deliver_on__lte=horizon,
    ).select_related("sender"):
        notify(t.sender, NotificationType.GIFT_REMINDER,
               params={"what": describe(t), "recipient": t.recipient_name or t.recipient_email,
                       "date": t.deliver_on.isoformat()},
               action_url="/family-investment")
        UnitTransfer.objects.filter(pk=t.pk).update(reminder_sent_at=timezone.now())
        n += 1
    return n


def deliver_due(today=None) -> dict:
    today = today or timezone.localdate()
    out = {"delivered": 0, "waiting": 0, "failed": 0}
    for pk in UnitTransfer.objects.filter(
        status__in=UnitTransfer.OPEN, deliver_on__lte=today,
    ).values_list("pk", flat=True):
        st = deliver_safely(pk)
        if st in out:
            out[st] += 1
    return out


def expire_unclaimed(now=None) -> int:
    now = now or timezone.now()
    n = 0
    for t in UnitTransfer.objects.filter(
        status=UnitTransfer.Status.WAITING, expires_at__lt=now,
    ).exclude(kind=UnitTransfer.Kind.ESTATE):
        _close(t, UnitTransfer.Status.EXPIRED,
               f"Not received within {settings.TRANSFER_CLAIM_DAYS} days — returned to you.")
        n += 1
    return n


# --------------------------------------------------------------------------- #
# Inheritance
# --------------------------------------------------------------------------- #
_CERT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_certificate_number() -> str:
    while True:
        raw = "".join(secrets.choice(_CERT_ALPHABET) for _ in range(8))
        number = f"CPB-{raw[:4]}-{raw[4:]}"
        if not EstateCertificate.objects.filter(number=number).exists():
            return number


def set_beneficiaries(holder, rows: list[dict]) -> list[Beneficiary]:
    """Replace the holder's beneficiaries (shares must total 100% or less)."""
    clean, seen, total = [], set(), Decimal("0")
    for r in rows:
        email = (r.get("email") or "").strip().lower()
        name = (r.get("full_name") or "").strip()
        pct = Decimal(str(r.get("percent") or 0)).quantize(CENT)
        if not email or not name:
            raise ValidationError({"beneficiaries": "Each beneficiary needs a name and an email."})
        if email == holder.email.lower():
            raise ValidationError({"beneficiaries": "You can't name yourself."})
        if email in seen:
            raise ValidationError({"beneficiaries": f"{email} is listed twice."})
        if pct <= 0:
            raise ValidationError({"beneficiaries": "Each share must be above 0%."})
        seen.add(email)
        total += pct
        clean.append(Beneficiary(holder=holder, full_name=name[:120], email=email,
                                 relationship=(r.get("relationship") or "")[:40], percent=pct))
    if total > 100:
        raise ValidationError({"beneficiaries": "The shares add up to more than 100%."})
    with transaction.atomic():
        if EstateClaim.objects.filter(holder=holder, status=EstateClaim.Status.SUBMITTED).exists():
            raise ValidationError({"beneficiaries": "An inheritance claim is under review."})
        Beneficiary.objects.filter(holder=holder).delete()
        Beneficiary.objects.bulk_create(clean)
        cert = EstateCertificate.objects.filter(holder=holder).first()
        if clean and cert is None:
            EstateCertificate.objects.create(holder=holder, number=_new_certificate_number())
        elif cert is not None:
            cert.save(update_fields=["updated_at"])
    return list(Beneficiary.objects.filter(holder=holder))


def certificate_pdf(holder) -> tuple[str, bytes]:
    from apps.reports.pdf import render_statement_pdf

    cert = EstateCertificate.objects.filter(holder=holder).first()
    if cert is None:
        raise NotFound("Add your beneficiaries first.")
    rows = [{"name": b.full_name, "email": b.email, "relationship": b.relationship or "—",
             "share": f"{b.percent}%"} for b in holder.beneficiaries.all()]
    pdf = render_statement_pdf(
        title="Beneficiary Designation Certificate",
        period=f"Certificate {cert.number}",
        columns=[("name", "Beneficiary"), ("email", "Email"),
                 ("relationship", "Relationship"), ("share", "Share")],
        rows=rows,
        meta=[("Certificate number", cert.number), ("Holder", display_name(holder)),
              ("Holder email", holder.email),
              ("Last updated", timezone.localtime(cert.updated_at).strftime("%Y-%m-%d"))],
        disclaimer=("A beneficiary submits a claim with this number and an official death "
                    "certificate. After review, the holder's free property units and wallet "
                    "balance are divided in the shares above."),
    )
    return cert.number, pdf


def submit_claim(claimant, *, certificate_number, death_certificate, date_of_death=None,
                 notes="") -> EstateClaim:
    from apps.notifications.admin_alerts import notify_admins

    if not recipient_ready(claimant):
        raise PermissionDenied("Verify your email and identity (KYC) before submitting a claim.")
    cert = EstateCertificate.objects.filter(number__iexact=(certificate_number or "").strip()).first()
    if cert is None or not Beneficiary.objects.filter(
        holder=cert.holder, email__iexact=claimant.email,
    ).exists() or cert.holder_id == claimant.pk:
        raise NotFound("No beneficiary designation matches this certificate number and your email.")
    if EstateClaim.objects.filter(holder=cert.holder, status=EstateClaim.Status.SUBMITTED).exists():
        raise ValidationError({"code": "claim_open", "detail": "A claim for this holder is already under review."})
    claim = EstateClaim.objects.create(
        holder=cert.holder, claimant=claimant, certificate_number=cert.number,
        death_certificate=death_certificate, date_of_death=date_of_death, notes=(notes or "")[:1000],
    )
    notify_admins("estate_claim", obj=claim,
                  summary=f"{claimant.email} submitted an inheritance claim on {cert.number}.")
    return claim


def approve_claim(claim_id, admin) -> EstateClaim:
    """Distribute the holder's free units and wallet to the beneficiaries, then close the account."""
    with transaction.atomic():
        claim = EstateClaim.objects.select_for_update().select_related("holder").get(pk=claim_id)
        if claim.status != EstateClaim.Status.SUBMITTED:
            raise ValidationError({"detail": f"This claim is already {claim.status}."})
        holder = claim.holder
        bens = list(Beneficiary.objects.filter(holder=holder))
        if not bens:
            raise ValidationError({"detail": "The holder has no beneficiaries."})
        pcts = [b.percent for b in bens]
        kept = []
        wallet = UserWallet.objects.filter(user=holder).first()
        positions = list(OwnershipToken.objects.filter(
            wallet=wallet, status=OwnershipToken.Status.ACTIVE, token_amount__gt=0,
        )) if wallet else []
        for pos in positions:
            free = free_units(holder, pos.property_id, pos)
            shares = hamilton(free, pcts)
            for b, n in zip(bens, shares):
                if n > 0:
                    create_transfer(kind=UnitTransfer.Kind.ESTATE, asset=UnitTransfer.Asset.UNITS,
                                    sender=holder, recipient_email=b.email, recipient_name=b.full_name,
                                    property_slug=pos.property_id, units=n, estate_claim=claim)
            left = int(pos.token_amount) - sum(shares)
            if left:
                kept.append(f"{left} unit(s) of {pos.property_name}")
        bal = UserBalance.objects.filter(user=holder).first()
        cents = int((Decimal(bal.current_balance or 0) * 100)) if bal else 0
        cash_shares = hamilton(cents, pcts)
        for b, c in zip(bens, cash_shares):
            if c > 0:
                create_transfer(kind=UnitTransfer.Kind.ESTATE, asset=UnitTransfer.Asset.CASH,
                                sender=holder, recipient_email=b.email, recipient_name=b.full_name,
                                amount=Decimal(c) / 100, estate_claim=claim)
        if cents - sum(cash_shares):
            kept.append(f"${Decimal(cents - sum(cash_shares)) / 100:,.2f} of the wallet")
        holder.is_active = False
        holder.save(update_fields=["is_active"])
        claim.status = EstateClaim.Status.APPROVED
        claim.decided_by = admin
        claim.decided_at = timezone.now()
        claim.decision_note = ("Not distributed (locked in plans/listings, or shares under 100%): "
                               + "; ".join(kept)) if kept else "Fully distributed."
        claim.save(update_fields=["status", "decided_by", "decided_at", "decision_note"])
        notify(claim.claimant, NotificationType.ESTATE_CLAIM_DECIDED,
               params={"decision": "approved", "number": claim.certificate_number, "note": ""},
               action_url="/portfolio")
    return claim


def reject_claim(claim_id, admin, note="") -> EstateClaim:
    with transaction.atomic():
        claim = EstateClaim.objects.select_for_update().get(pk=claim_id)
        if claim.status != EstateClaim.Status.SUBMITTED:
            raise ValidationError({"detail": f"This claim is already {claim.status}."})
        claim.status = EstateClaim.Status.REJECTED
        claim.decided_by = admin
        claim.decided_at = timezone.now()
        claim.decision_note = (note or claim.decision_note or "")[:1000]
        claim.save(update_fields=["status", "decided_by", "decided_at", "decision_note"])
        notify(claim.claimant, NotificationType.ESTATE_CLAIM_DECIDED,
               params={"decision": "rejected", "number": claim.certificate_number,
                       "note": claim.decision_note or ""},
               action_url="/family-investment")
    return claim
