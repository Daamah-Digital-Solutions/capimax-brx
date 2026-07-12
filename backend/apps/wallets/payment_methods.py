"""
Payment-method (payout instrument) API — client-feedback note 11.

Replaces the DEAD Supabase-backed frontend managers (bank accounts, crypto wallets,
saved cards) with real, self-scoped Django endpoints. Every route is IsAuthenticated
and strictly scoped to request.user (no cross-user access).

SAFETY (real money): full bank account numbers / IBANs are masked HERE and the raw
value is never persisted; saved cards carry only brand + last four + expiry + holder
name (no PAN — the frontend never sends one). Crypto addresses are public by nature.

Mounted under /api/wallets/payment-methods/ (see urls.py).
"""
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.shortcuts import get_object_or_404

from .models import (
    InvestorBankAccount,
    InvestorCryptoWallet,
    PaymentMethodAuditLog,
    SavedCard,
)


# --- masking (raw values never persisted) ----------------------------------- #
def mask_account_number(raw: str) -> str:
    raw = (raw or "").strip()
    if len(raw) <= 4:
        return "****"
    return "*" * (len(raw) - 4) + raw[-4:]


def mask_iban(raw: str) -> str:
    raw = (raw or "").strip()
    if len(raw) <= 6:
        return "****"
    return raw[:4] + "*" * (len(raw) - 8) + raw[-4:]


def _log_audit(user, action, method_type, method_id, details=None):
    PaymentMethodAuditLog.objects.create(
        user=user, action=action, method_type=method_type,
        method_id=method_id, details=details or {},
    )


def _first_becomes_default(model, user) -> bool:
    """The first method a user adds is their default (mirrors the old client logic)."""
    return not model.objects.filter(user=user).exists()


def _set_only_default(model, user, obj):
    model.objects.filter(user=user).update(is_default=False)
    obj.is_default = True
    obj.save(update_fields=["is_default", "updated_at"])


# --- serializers (mirror the frontend interfaces exactly) ------------------- #
class BankAccountSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = InvestorBankAccount
        fields = (
            "id", "user_id", "bank_name", "bank_code", "account_holder_name",
            "account_number_masked", "iban_masked", "swift_code", "country",
            "currency", "is_verified", "is_default", "verified_at",
            "created_at", "updated_at",
        )
        read_only_fields = fields


class CryptoWalletSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = InvestorCryptoWallet
        fields = (
            "id", "user_id", "wallet_address", "wallet_label", "network",
            "is_verified", "is_default", "verified_at", "created_at", "updated_at",
        )
        read_only_fields = fields


class SavedCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedCard
        fields = (
            "id", "card_brand", "card_last_four", "card_expiry_month",
            "card_expiry_year", "cardholder_name", "is_default",
        )
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = PaymentMethodAuditLog
        fields = ("id", "user_id", "action", "method_type", "method_id", "details", "created_at")
        read_only_fields = fields


# --- Bank accounts ----------------------------------------------------------- #
class BankAccountListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = InvestorBankAccount.objects.filter(user=request.user)
        return Response(BankAccountSerializer(qs, many=True).data)

    def post(self, request):
        d = request.data
        required = ["bank_name", "account_holder_name", "account_number", "country", "currency"]
        if not all(str(d.get(k) or "").strip() for k in required):
            return Response(
                {"detail": "bank_name, account_holder_name, account_number, country and "
                           "currency are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj = InvestorBankAccount.objects.create(
            user=request.user,
            bank_name=str(d["bank_name"]).strip(),
            bank_code=(str(d.get("bank_code") or "").strip() or None),
            account_holder_name=str(d["account_holder_name"]).strip(),
            account_number_masked=mask_account_number(str(d["account_number"])),
            iban_masked=(mask_iban(str(d["iban"])) if str(d.get("iban") or "").strip() else None),
            swift_code=(str(d.get("swift_code") or "").strip() or None),
            country=str(d["country"]).strip(),
            currency=str(d["currency"]).strip(),
            is_default=_first_becomes_default(InvestorBankAccount, request.user),
        )
        _log_audit(request.user, "add", "bank", obj.id,
                   {"bank_name": obj.bank_name, "country": obj.country})
        return Response(BankAccountSerializer(obj).data, status=status.HTTP_201_CREATED)


class BankAccountDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        return get_object_or_404(InvestorBankAccount, pk=pk, user=request.user)

    def patch(self, request, pk):
        obj = self._get(request, pk)
        d = request.data
        if d.get("bank_name"):
            obj.bank_name = str(d["bank_name"]).strip()
        if "bank_code" in d:
            obj.bank_code = str(d.get("bank_code") or "").strip() or None
        if d.get("account_holder_name"):
            obj.account_holder_name = str(d["account_holder_name"]).strip()
        if d.get("account_number"):
            obj.account_number_masked = mask_account_number(str(d["account_number"]))
        if "iban" in d:
            obj.iban_masked = mask_iban(str(d["iban"])) if str(d.get("iban") or "").strip() else None
        if "swift_code" in d:
            obj.swift_code = str(d.get("swift_code") or "").strip() or None
        if d.get("country"):
            obj.country = str(d["country"]).strip()
        if d.get("currency"):
            obj.currency = str(d["currency"]).strip()
        obj.save()
        _log_audit(request.user, "edit", "bank", obj.id, {})
        return Response(BankAccountSerializer(obj).data)

    def delete(self, request, pk):
        obj = self._get(request, pk)
        oid = obj.id
        obj.delete()
        _log_audit(request.user, "delete", "bank", oid, {})
        return Response(status=status.HTTP_204_NO_CONTENT)


class BankAccountSetDefaultView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        obj = get_object_or_404(InvestorBankAccount, pk=pk, user=request.user)
        _set_only_default(InvestorBankAccount, request.user, obj)
        return Response(BankAccountSerializer(obj).data)


# --- Crypto wallets ---------------------------------------------------------- #
class CryptoWalletListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = InvestorCryptoWallet.objects.filter(user=request.user)
        return Response(CryptoWalletSerializer(qs, many=True).data)

    def post(self, request):
        d = request.data
        if not str(d.get("wallet_address") or "").strip() or not str(d.get("network") or "").strip():
            return Response(
                {"detail": "wallet_address and network are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj = InvestorCryptoWallet.objects.create(
            user=request.user,
            wallet_address=str(d["wallet_address"]).strip(),
            wallet_label=(str(d.get("wallet_label") or "").strip() or None),
            network=str(d["network"]).strip(),
            is_default=_first_becomes_default(InvestorCryptoWallet, request.user),
        )
        _log_audit(request.user, "add", "crypto", obj.id, {"network": obj.network})
        return Response(CryptoWalletSerializer(obj).data, status=status.HTTP_201_CREATED)


class CryptoWalletDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, pk):
        return get_object_or_404(InvestorCryptoWallet, pk=pk, user=request.user)

    def patch(self, request, pk):
        obj = self._get(request, pk)
        d = request.data
        if d.get("wallet_address"):
            obj.wallet_address = str(d["wallet_address"]).strip()
        if "wallet_label" in d:
            obj.wallet_label = str(d.get("wallet_label") or "").strip() or None
        if d.get("network"):
            obj.network = str(d["network"]).strip()
        obj.save()
        _log_audit(request.user, "edit", "crypto", obj.id, {})
        return Response(CryptoWalletSerializer(obj).data)

    def delete(self, request, pk):
        obj = self._get(request, pk)
        oid = obj.id
        obj.delete()
        _log_audit(request.user, "delete", "crypto", oid, {})
        return Response(status=status.HTTP_204_NO_CONTENT)


class CryptoWalletSetDefaultView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        obj = get_object_or_404(InvestorCryptoWallet, pk=pk, user=request.user)
        _set_only_default(InvestorCryptoWallet, request.user, obj)
        return Response(CryptoWalletSerializer(obj).data)


# --- Saved cards (no PAN — brand/last4/expiry/holder only) ------------------- #
class SavedCardListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SavedCard.objects.filter(user=request.user)
        return Response(SavedCardSerializer(qs, many=True).data)

    def post(self, request):
        d = request.data
        try:
            month = int(d.get("card_expiry_month"))
            year = int(d.get("card_expiry_year"))
        except (TypeError, ValueError):
            return Response({"detail": "Valid expiry month and year are required."},
                            status=status.HTTP_400_BAD_REQUEST)
        last4 = "".join(ch for ch in str(d.get("card_last_four") or "") if ch.isdigit())[-4:]
        if not str(d.get("card_brand") or "").strip() or not last4 or not str(d.get("cardholder_name") or "").strip():
            return Response({"detail": "card_brand, card_last_four and cardholder_name are required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not 1 <= month <= 12:
            return Response({"detail": "Invalid expiry month."}, status=status.HTTP_400_BAD_REQUEST)
        obj = SavedCard.objects.create(
            user=request.user,
            card_brand=str(d["card_brand"]).strip(),
            card_last_four=last4,
            card_expiry_month=month,
            card_expiry_year=year,
            cardholder_name=str(d["cardholder_name"]).strip(),
            is_default=_first_becomes_default(SavedCard, request.user),
        )
        _log_audit(request.user, "add", "card", obj.id, {"brand": obj.card_brand})
        return Response(SavedCardSerializer(obj).data, status=status.HTTP_201_CREATED)


class SavedCardDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        obj = get_object_or_404(SavedCard, pk=pk, user=request.user)
        oid = obj.id
        obj.delete()
        _log_audit(request.user, "delete", "card", oid, {})
        return Response(status=status.HTTP_204_NO_CONTENT)


class SavedCardSetDefaultView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        obj = get_object_or_404(SavedCard, pk=pk, user=request.user)
        _set_only_default(SavedCard, request.user, obj)
        return Response(SavedCardSerializer(obj).data)


# --- Audit log (read-only, self-scoped) ------------------------------------- #
class PaymentMethodAuditLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = PaymentMethodAuditLog.objects.filter(user=request.user)[:200]
        return Response(AuditLogSerializer(qs, many=True).data)
