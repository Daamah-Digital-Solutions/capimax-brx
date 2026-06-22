"""
Family domain services — Wave A. PII masking, allocation-limit validation, and the
record-only activity log. NO money, NO tokens, NO payout here (or anywhere this wave).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from .models import FamilyAccount, FamilyTransaction


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
