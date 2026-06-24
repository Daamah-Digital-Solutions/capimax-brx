"""
Family domain services — Wave A (PII masking, allocation-limit validation, record-only
activity log) + Wave B (the AUTO-ALLOCATION engine + internal accrual ledger + the
owner-driven withdrawal). Money discipline lives in Wave B: server-authoritative, atomic,
Decimal-exact, append-only, idempotent — and there is STILL no external bank rail (the
owner withdraws the accrued cash himself via the existing wallet-withdrawal path).
"""
from __future__ import annotations

import uuid
from decimal import ROUND_DOWN, Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from .models import FamilyAccount, FamilyAccountStatus, FamilyAccrual, FamilyTransaction

CENTS = Decimal("0.01")
# BalanceTransaction.source tags (≤40 chars) for the owner's wallet ledger — the carve
# debit and the release-before-withdraw credit, so the owner's history is fully auditable.
FAMILY_CARVE_SOURCE = "family_allocation"
FAMILY_RELEASE_SOURCE = "family_accrual_release"


def mask_tail(value: str | None) -> str:
    """
    Mask a bank account number / IBAN to the last 4 chars (e.g. '****1234'). The FULL value
    is NEVER returned or stored — only this mask is persisted (PII discipline). Returns '' for
    an empty input.
    """
    if not value:
        return ""
    digits = str(value).strip()
    tail = digits[-4:] if len(digits) >= 4 else digits
    return f"****{tail}"


def assert_allocation_within_limit(investor, new_percent, *, exclude_id=None) -> None:
    """
    Enforce that Σ(allocated_returns_percent) across an investor's family members does NOT
    exceed 100%. `exclude_id` omits the account being updated from the existing sum (so a
    PATCH re-using its own slice doesn't double-count). Raises DRF ValidationError on breach.
    """
    new_percent = Decimal(str(new_percent or 0))
    if new_percent < 0 or new_percent > 100:
        raise ValidationError(
            {"allocated_returns_percent": "Allocation must be between 0 and 100."}
        )
    qs = FamilyAccount.objects.filter(investor=investor)
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    others = qs.aggregate(total=Sum("allocated_returns_percent"))["total"] or Decimal("0")
    if others + new_percent > Decimal("100"):
        raise ValidationError(
            {
                "allocated_returns_percent": (
                    f"Total family allocation would be {others + new_percent}% — it cannot "
                    f"exceed 100% (other members already use {others}%)."
                )
            }
        )


def make_reference() -> str:
    """A short, unique-ish family-transaction reference (server-generated)."""
    return f"FT-{uuid.uuid4().hex[:10].upper()}"


def log_transaction(
    account: FamilyAccount, transaction_type: str, *,
    amount=None, currency: str = "USD", bank=None, description: str = "",
    initiated_by=None, reference_number: str = "",
) -> FamilyTransaction:
    """
    Append a RECORD-ONLY activity row. This NEVER moves money or tokens — it is an audit/log
    entry. A 'transfer_initiated' row stays `pending` and is never executed in Wave A.
    """
    return FamilyTransaction.objects.create(
        family_account=account,
        bank_account=bank,
        transaction_type=transaction_type,
        amount=amount,
        currency=currency,
        description=description[:255],
        reference_number=reference_number,
        initiated_by=initiated_by,
    )


# --------------------------------------------------------------------------- #
# Wave B — the auto-allocation engine + internal accrual ledger.
# --------------------------------------------------------------------------- #
def carve_family_accruals(owner, distribution, payout) -> Decimal:
    """
    Carve each ACTIVE family member's allocated slice out of one distribution `payout`
    credited to `owner`, and record it as an internal accrual — debiting the owner by the
    carved total in the SAME atomic block (so the owner keeps only the remainder).

    Called from the distribution credit path (apps/distributions/services), INSIDE its
    `transaction.atomic()`, only on the newly-credited branch — and additionally guarded by
    the unique(distribution, family_account) constraint, so a replayed distribution credit
    can NEVER double-carve (get_or_create returns the existing row, the owner is not
    re-debited). Returns the total carved (Decimal; 0 when the owner has no allocating members).

    THE CARVE (interpretation, per the client decision): the distribution already credited
    the owner the FULL amount; each member's share = floor(allocation_percent × owner_share)
    comes OUT of that — the owner is debited the sum, so they effectively receive the
    remainder. Flooring each share to the cent leaves the owner as the residual claimant of
    any rounding crumbs, so the books are cent-exact with no remainder to redistribute.
    """
    owner_share = Decimal(payout.share_amount_usd or 0).quantize(CENTS)
    if owner_share <= 0:
        return Decimal("0")

    members = list(
        FamilyAccount.objects.filter(
            investor=owner,
            status=FamilyAccountStatus.ACTIVE,
            allocated_returns_percent__gt=0,
        ).order_by("created_at", "id")
    )
    if not members:
        return Decimal("0")

    carved_total = Decimal("0")
    for member in members:
        pct = Decimal(member.allocated_returns_percent or 0)
        amount = (owner_share * pct / Decimal("100")).quantize(CENTS, rounding=ROUND_DOWN)
        if amount <= 0:
            continue
        _accrual, created = FamilyAccrual.objects.get_or_create(
            distribution=distribution,
            family_account=member,
            defaults={
                "investor": owner,
                "entry_type": FamilyAccrual.EntryType.ACCRUAL,
                "amount_usd": amount,
                "source_payout": payout,
                "allocation_percent": pct,
                "owner_share_usd": owner_share,
                "memo": (
                    f"Auto-allocation {distribution.period_label or distribution.pay_date}: "
                    f"{member.member_name} ({pct}% of ${owner_share})"
                )[:255],
            },
        )
        # Only a NEWLY-created accrual moves money (idempotent replay → no re-debit).
        if created:
            carved_total += amount

    if carved_total > 0:
        # Debit the owner the members' total — the credited distribution already added
        # `owner_share` (≥ carved_total since Σ% ≤ 100), so the balance covers it.
        from apps.wallets.services import debit_user_balance

        debit_user_balance(
            owner, carved_total, source=FAMILY_CARVE_SOURCE,
            reference=str(distribution.id),
            memo=f"Family allocation carve · {distribution.property_name or distribution.property_id}",
        )
    return carved_total


def accrual_summary(member: FamilyAccount) -> dict:
    """
    A member's accrual position from the append-only ledger (the source of truth):
    accrued_total (Σ ACCRUAL), withdrawn_total (Σ WITHDRAWAL), and accrued_balance
    (the currently-withdrawable difference). All Decimal, cent-quantized.
    """
    rows = FamilyAccrual.objects.filter(family_account=member).values_list(
        "entry_type", "amount_usd"
    )
    accrued = Decimal("0")
    withdrawn = Decimal("0")
    for entry_type, amount in rows:
        if entry_type == FamilyAccrual.EntryType.ACCRUAL:
            accrued += amount
        else:
            withdrawn += amount
    return {
        "accrued_total": accrued.quantize(CENTS),
        "withdrawn_total": withdrawn.quantize(CENTS),
        "accrued_balance": (accrued - withdrawn).quantize(CENTS),
    }


def accrual_summaries(investor) -> dict:
    """
    Batch {member_id: summary} for ALL of an investor's members in one query — used by the
    list view so each member card shows its real accrued balance without an N+1.
    """
    summaries: dict = {}
    rows = FamilyAccrual.objects.filter(investor=investor).values_list(
        "family_account_id", "entry_type", "amount_usd"
    )
    for member_id, entry_type, amount in rows:
        slot = summaries.setdefault(
            str(member_id),
            {"accrued_total": Decimal("0"), "withdrawn_total": Decimal("0")},
        )
        if entry_type == FamilyAccrual.EntryType.ACCRUAL:
            slot["accrued_total"] += amount
        else:
            slot["withdrawn_total"] += amount
    for slot in summaries.values():
        slot["accrued_balance"] = (slot["accrued_total"] - slot["withdrawn_total"]).quantize(CENTS)
        slot["accrued_total"] = slot["accrued_total"].quantize(CENTS)
        slot["withdrawn_total"] = slot["withdrawn_total"].quantize(CENTS)
    return summaries


def withdraw_family_accrual(owner, member: FamilyAccount, amount=None, *, method="bank", notes=""):
    """
    The OWNER withdraws a member's accrued cash himself, via the EXISTING wallet-withdrawal
    path — there is NO external bank rail (the per-member bank/schedule config stays inert).

    Atomic + ledger-honest. The carve already debited the owner's UserBalance into the
    accrual pool, so to reuse `request_withdrawal` (which debits UserBalance) we first RELEASE
    the accrued amount back into the owner's balance, then withdraw it — net balance change is
    zero, a real `pending` Withdrawal is created, and an append-only WITHDRAWAL ledger row
    records the draw-down. `total_transferred` is refreshed from the ledger (now real).

    `amount` defaults to the full accrued balance; a partial amount must be > 0 and ≤ balance.
    Returns the wallets.Withdrawal. Raises DRF ValidationError on a bad amount.
    """
    from apps.wallets.services import credit_user_balance, request_withdrawal

    with transaction.atomic():
        # Lock this member's ledger rows for the balance computation (race-safe).
        rows = list(
            FamilyAccrual.objects.select_for_update()
            .filter(family_account=member)
            .values_list("entry_type", "amount_usd")
        )
        accrued = sum(
            (a for t, a in rows if t == FamilyAccrual.EntryType.ACCRUAL), Decimal("0")
        )
        withdrawn = sum(
            (a for t, a in rows if t == FamilyAccrual.EntryType.WITHDRAWAL), Decimal("0")
        )
        balance = (accrued - withdrawn).quantize(CENTS)

        amount = balance if amount is None else Decimal(str(amount)).quantize(CENTS)
        if amount <= 0:
            raise ValidationError({"amount": "Withdrawal amount must be positive."})
        if amount > balance:
            raise ValidationError(
                {"amount": f"Amount ${amount} exceeds the accrued balance ${balance}."}
            )

        # Release the accrued cash back into the owner's spendable balance, then withdraw it
        # through the canonical path (debits the balance + creates the pending Withdrawal).
        credit_user_balance(
            owner, amount, source=FAMILY_RELEASE_SOURCE,
            memo=f"Family accrual release · {member.member_name}",
        )
        wd = request_withdrawal(
            owner, amount, method=method,
            notes=notes or f"Family accrual withdrawal · {member.member_name}",
        )

        # Append-only WITHDRAWAL entry (the draw-down record) + refresh the real field.
        FamilyAccrual.objects.create(
            family_account=member,
            investor=owner,
            entry_type=FamilyAccrual.EntryType.WITHDRAWAL,
            amount_usd=amount,
            withdrawal=wd,
            memo=f"Owner withdrawal {wd.reference}"[:255],
        )
        member.total_transferred = (withdrawn + amount).quantize(CENTS)
        member.save(update_fields=["total_transferred", "updated_at"])
        return wd
