"""
Backfill BrokerCommission from the pre-existing `broker_commission` BalanceTransaction
rows (Broker Listings Phase 1). DELETE NOTHING for history: every historical commission
credit gets a structured, append-only record tied to its money-moving BalanceTransaction.

The historical RATE is parsed from the memo ("Referral commission (X%): …"); when it can't
be parsed, `rate_applied` is left NULL (displayed as "—"/legacy) — never invented. The
gross is reconstructed exactly from commission/rate when the rate is known, else best-effort
from the investment. `created_at` is set to the original transaction time so the ledger's
ordering + this-month totals are unchanged. No money moves here.
"""
import re
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import migrations

_RATE_RE = re.compile(r"Referral commission \(([\d.]+)%\)")
_BROKER_COMMISSION_SOURCE = "broker_commission"


def backfill(apps, schema_editor):
    BalanceTransaction = apps.get_model("wallets", "BalanceTransaction")
    BrokerProfile = apps.get_model("broker", "BrokerProfile")
    BrokerCommission = apps.get_model("broker", "BrokerCommission")
    Investment = apps.get_model("investments", "Investment")
    Property = apps.get_model("properties", "Property")

    txs = BalanceTransaction.objects.filter(
        source=_BROKER_COMMISSION_SOURCE
    ).select_related("balance")

    for tx in txs:
        # Idempotent: skip a tx already tied to a BrokerCommission (one per money row).
        if BrokerCommission.objects.filter(balance_transaction=tx).exists():
            continue
        broker = BrokerProfile.objects.filter(user_id=tx.balance.user_id).first()
        if broker is None:
            continue

        # Resolve the investment by reference (an Investment UUID for a normal credit, or
        # an installment-payment UUID for a tranche). Be defensive: a non-UUID/legacy
        # reference must NOT crash the backfill — treat it as "no investment".
        inv = None
        if tx.reference:
            try:
                inv = Investment.objects.filter(id=tx.reference).first()
            except (ValueError, ValidationError):
                inv = None
        prop = Property.objects.filter(pk=inv.property_id).first() if (inv and inv.property_id) else None

        # Parse the historical rate from the memo; NEVER invent one.
        match = _RATE_RE.search(tx.memo or "")
        rate = Decimal(match.group(1)) if match else None

        commission = Decimal(tx.amount)
        if rate is not None and rate > 0:
            gross = (commission / (rate / Decimal("100"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        elif inv is not None:
            gross = Decimal(getattr(inv, "amount_invested", 0) or 0)
        else:
            gross = Decimal("0")

        bc = BrokerCommission.objects.create(
            broker=broker,
            investment=inv,
            property_slug=(prop.slug if prop else ""),
            property_name=(inv.property_name if inv else ""),
            gross=gross,
            rate_applied=rate,          # None when unparseable → "—"/legacy in the UI
            commission=commission,      # exact: equals the money row (no money change)
            balance_transaction=tx,
            is_legacy=True,
        )
        # Preserve the ORIGINAL credit time (auto_now_add would otherwise stamp "now"),
        # so the ledger's date/ordering and this-month totals are identical to before.
        BrokerCommission.objects.filter(pk=bc.pk).update(created_at=tx.created_at)


def unbackfill(apps, schema_editor):
    # Reverse: drop only the backfilled (legacy) rows.
    BrokerCommission = apps.get_model("broker", "BrokerCommission")
    BrokerCommission.objects.filter(is_legacy=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("broker", "0002_brokercommission"),
        ("wallets", "0005_deposit"),
        ("investments", "0002_investment_down_payment_amount_and_more"),
        ("properties", "0005_property_broker_commission_rate_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
