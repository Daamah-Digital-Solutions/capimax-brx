"""
Family API — Wave A. Self-scoped CRUD for the primary investor's family records +
allocation persistence + a RECORD-ONLY transfer log. Repoints the (last) Supabase domain.

  GET/POST   /api/family/accounts/                 list / add members
  GET/PATCH/DELETE /api/family/accounts/<id>/      member detail / edit (allocation, access) / remove
  GET/POST   /api/family/banks/                    list all / link a bank (MASKED last-4 only)
  GET/POST   /api/family/schedules/                list all / configure an auto-transfer schedule
  GET/POST   /api/family/transactions/             activity log / record a transfer intent (NO money)

SELF-SCOPED: every row is reachable only through `FamilyAccount.investor == request.user`. There is
NO money, NO token, NO payout anywhere — a "transfer" only writes a `pending` FamilyTransaction.
"""
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    FamilyAccount,
    FamilyBankAccount,
    FamilyTransaction,
    FamilyTransferSchedule,
)
from .serializers import (
    FamilyAccountCreateSerializer,
    FamilyAccountUpdateSerializer,
    FamilyBankAccountCreateSerializer,
    FamilyTransactionCreateSerializer,
    FamilyTransferScheduleCreateSerializer,
)
from .services import (
    assert_allocation_within_limit,
    log_transaction,
    make_reference,
    mask_tail,
)


# --------------------------------------------------------------------------- #
# Read shapes (hand-built to match the frontend TS interfaces).
# --------------------------------------------------------------------------- #
def _account_dict(a: FamilyAccount) -> dict:
    return {
        "id": str(a.id),
        "investor_id": str(a.investor_id),
        "member_name": a.member_name,
        "member_email": a.member_email,
        "relationship": a.relationship,
        "status": a.status,
        "access_level": a.access_level,
        "allocated_returns_percent": float(a.allocated_returns_percent),
        "total_transferred": float(a.total_transferred),
        "linked_at": a.linked_at.isoformat(),
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


def _bank_dict(b: FamilyBankAccount) -> dict:
    return {
        "id": str(b.id),
        "family_account_id": str(b.family_account_id),
        "bank_name": b.bank_name,
        "bank_code": b.bank_code or None,
        "account_holder_name": b.account_holder_name,
        "account_number_masked": b.account_number_masked,
        "iban_masked": b.iban_masked or None,
        "currency": b.currency,
        "is_verified": b.is_verified,
        "is_primary": b.is_primary,
        "created_at": b.created_at.isoformat(),
        "updated_at": b.updated_at.isoformat(),
    }


def _schedule_dict(s: FamilyTransferSchedule) -> dict:
    return {
        "id": str(s.id),
        "family_account_id": str(s.family_account_id),
        "bank_account_id": str(s.bank_account_id),
        "schedule_type": s.schedule_type,
        "threshold_amount": float(s.threshold_amount) if s.threshold_amount is not None else None,
        "next_transfer_date": s.next_transfer_date.isoformat() if s.next_transfer_date else None,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


def _transaction_dict(t: FamilyTransaction) -> dict:
    return {
        "id": str(t.id),
        "family_account_id": str(t.family_account_id),
        "bank_account_id": str(t.bank_account_id) if t.bank_account_id else None,
        "transaction_type": t.transaction_type,
        "amount": float(t.amount) if t.amount is not None else None,
        "currency": t.currency,
        "status": t.status,
        "reference_number": t.reference_number or None,
        "description": t.description or None,
        "metadata": t.metadata or None,
        "initiated_by": str(t.initiated_by_id) if t.initiated_by_id else "",
        "created_at": t.created_at.isoformat(),
    }


def _get_owned_account(request, account_id) -> FamilyAccount:
    """Fetch a family account that BELONGS to the caller, or 404 (self-scoping)."""
    return get_object_or_404(FamilyAccount, id=account_id, investor=request.user)


# --------------------------------------------------------------------------- #
# Accounts (members)
# --------------------------------------------------------------------------- #
class FamilyAccountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = FamilyAccount.objects.filter(investor=request.user)
        return Response([_account_dict(a) for a in accounts])

    def post(self, request):
        ser = FamilyAccountCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        account = FamilyAccount.objects.create(
            investor=request.user,
            member_name=data["member_name"],
            member_email=data["member_email"],
            relationship=data["relationship"],
        )
        log_transaction(
            account, "allocation", initiated_by=request.user,
            description=f"Family member {account.member_name} added",
        )
        return Response(_account_dict(account), status=status.HTTP_201_CREATED)


class FamilyAccountDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, account_id):
        return Response(_account_dict(_get_owned_account(request, account_id)))

    def patch(self, request, account_id):
        account = _get_owned_account(request, account_id)
        ser = FamilyAccountUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if "allocated_returns_percent" in data:
            # Σ across the investor's members must stay ≤ 100% (excluding this one's old slice).
            assert_allocation_within_limit(
                request.user, data["allocated_returns_percent"], exclude_id=account.id
            )

        fields = []
        for f in ("member_name", "member_email", "relationship", "status",
                  "access_level", "allocated_returns_percent"):
            if f in data:
                setattr(account, f, data[f])
                fields.append(f)
        if fields:
            fields.append("updated_at")
            account.save(update_fields=fields)
        return Response(_account_dict(account))

    def delete(self, request, account_id):
        account = _get_owned_account(request, account_id)
        account.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Bank accounts (MASKED last-4 only)
# --------------------------------------------------------------------------- #
class FamilyBankAccountsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        banks = FamilyBankAccount.objects.filter(family_account__investor=request.user)
        return Response([_bank_dict(b) for b in banks])

    def post(self, request):
        ser = FamilyBankAccountCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        account = _get_owned_account(request, data["family_account_id"])

        # PII: store ONLY the masked last-4 — the full number/IBAN are never persisted.
        bank = FamilyBankAccount.objects.create(
            family_account=account,
            bank_name=data["bank_name"],
            bank_code=data.get("bank_code", "") or "",
            account_holder_name=data["account_holder_name"],
            account_number_masked=mask_tail(data["account_number"]),
            iban_masked=mask_tail(data.get("iban", "")),
            currency=data.get("currency", "USD") or "USD",
            is_primary=bool(data.get("is_primary", False)),
        )
        log_transaction(
            account, "bank_linked", bank=bank, initiated_by=request.user,
            description=f"Bank account {bank.bank_name} linked",
        )
        return Response(_bank_dict(bank), status=status.HTTP_201_CREATED)


# --------------------------------------------------------------------------- #
# Transfer schedules (config only)
# --------------------------------------------------------------------------- #
class FamilyTransferSchedulesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        schedules = FamilyTransferSchedule.objects.filter(
            family_account__investor=request.user
        )
        return Response([_schedule_dict(s) for s in schedules])

    def post(self, request):
        ser = FamilyTransferScheduleCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        account = _get_owned_account(request, data["family_account_id"])
        # The bank must belong to the SAME family account (self-scoped).
        bank = get_object_or_404(
            FamilyBankAccount, id=data["bank_account_id"], family_account=account
        )
        schedule = FamilyTransferSchedule.objects.create(
            family_account=account,
            bank_account=bank,
            schedule_type=data["schedule_type"],
            threshold_amount=data.get("threshold_amount"),
        )
        log_transaction(
            account, "schedule_created", bank=bank, initiated_by=request.user,
            description=f"Auto-transfer schedule created: {schedule.schedule_type}",
        )
        return Response(_schedule_dict(schedule), status=status.HTTP_201_CREATED)


# --------------------------------------------------------------------------- #
# Transactions (RECORD-ONLY activity log)
# --------------------------------------------------------------------------- #
class FamilyTransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        txns = FamilyTransaction.objects.filter(
            family_account__investor=request.user
        )[:50]
        return Response([_transaction_dict(t) for t in txns])

    def post(self, request):
        """
        Record a transfer INTENT only. Creates a `pending` FamilyTransaction — it does NOT
        move money or tokens, does NOT touch any balance, and does NOT create a Withdrawal
        (Wave A). Real execution is a later, gated wave (member-identity-dependent).
        """
        ser = FamilyTransactionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        account = _get_owned_account(request, data["family_account_id"])

        bank = None
        if data.get("bank_account_id"):
            bank = get_object_or_404(
                FamilyBankAccount, id=data["bank_account_id"], family_account=account
            )

        ttype = data.get("transfer_type", "returns")
        txn = log_transaction(
            account, "transfer_initiated", amount=Decimal(data["amount"]), bank=bank,
            initiated_by=request.user, reference_number=make_reference(),
            description=(data.get("description") or f"{ttype} transfer recorded (not executed)"),
        )
        return Response(_transaction_dict(txn), status=status.HTTP_201_CREATED)
