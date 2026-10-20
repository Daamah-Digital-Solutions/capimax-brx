"""
Wallet API — Phase 3 Wave 1.

  POST /api/wallets/      Create the caller's custodial wallet. KYC-GATED.
  GET  /api/wallets/me/   Return the caller's wallet (404 if none).

KYC gate: wallet creation requires an approved KYC record via
`core.permissions.KYCApprovedPermission`. That permission is currently an
always-deny stub (the KYC domain ships in a later phase), so this endpoint is
fully built and correct but returns 403 "KYC approval is required" today —
matching the frontend's create-wallet expectation (SPEC §4.1). When the KYC phase
flips the gate, this endpoint works unchanged.

No endpoint ever exposes private key material.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.shortcuts import get_object_or_404

from apps.core.permissions import KYCApprovedPermission

from .models import (
    BalanceTransaction,
    InvestorBankAccount,
    InvestorCryptoWallet,
    OwnershipToken,
    UserBalance,
    UserWallet,
    WalletTransaction,
    Withdrawal,
)
from .serializers import (
    BalanceTransactionSerializer,
    OwnershipTokenSerializer,
    UserBalanceSerializer,
    UserWalletSerializer,
    WalletTransactionSerializer,
    WithdrawalCreateSerializer,
    WithdrawalSerializer,
)
from .services import (
    InsufficientBalance,
    get_or_create_custodial_wallet,
    request_withdrawal,
)


class WalletCreateView(APIView):
    """Create (or return the existing) custodial wallet for the caller. KYC-gated."""

    permission_classes = [IsAuthenticated, KYCApprovedPermission]

    def post(self, request):
        wallet, created = get_or_create_custodial_wallet(request.user)
        serializer = UserWalletSerializer(wallet)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class MyWalletView(APIView):
    """Return the caller's wallet. Reading your own wallet only needs auth."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = UserWallet.objects.filter(user=request.user).first()
        if wallet is None:
            return Response(
                {"detail": "No wallet found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UserWalletSerializer(wallet).data)


class WalletTokensView(APIView):
    """
    GET /api/wallets/{wallet_id}/tokens/ — the wallet's OwnershipToken positions.
    Owner-only: the wallet must belong to the caller (SPEC §2.2 / §5.2).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, wallet_id):
        from decimal import Decimal

        from django.db.models import Sum

        from apps.investments.models import Investment
        from apps.properties.models import Property

        wallet = get_object_or_404(UserWallet, pk=wallet_id, user=request.user)
        tokens = list(OwnershipToken.objects.filter(wallet=wallet))
        data = OwnershipTokenSerializer(tokens, many=True).data

        # --- Batched Property enrichment (token.property_id == Property.slug; a CharField,
        # not an FK). One query, no N+1. Surfaces the metadata the model doesn't carry:
        # location/type/image + construction_progress + exit_eligible (all already on
        # Property). Missing/unpublished property → honest nulls, never faked. ---
        slugs = {t.property_id for t in tokens}
        props = (
            {
                p.slug: p
                for p in Property.objects.filter(slug__in=slugs).prefetch_related("gallery")
            }
            if slugs
            else {}
        )

        # --- Average cost basis per property from the caller's completed acquisitions.
        # Primary buys (card/crypto/balance/installment) and now secondary/LP buys all
        # record an Investment row, so Σ(amount_invested)/Σ(token_amount) is the real
        # average price/token — invariant to partial sells. ---
        avg_cost = {}
        rows = (
            Investment.objects.filter(user=request.user, tokens_minted=True)
            .values("property__slug")
            .annotate(amt=Sum("amount_invested"), toks=Sum("token_amount"))
        )
        for r in rows:
            if r["toks"]:
                avg_cost[r["property__slug"]] = Decimal(r["amt"]) / Decimal(r["toks"])

        # --- Off-plan §7: the unit price (launch, now, % change, last change) and, for units
        # on a running installment plan, the plan's units + remaining principal — the plan
        # is valued as a position (units × price − remaining) and sold only as a whole. ---
        from django.db.models import Max

        from apps.installments.models import InstallmentPlan, InstallmentPlanStatus
        from apps.installments.position import plan_units, remaining_principal
        from apps.payments.nova_pledge import pledged_units
        from apps.properties.models import PropertyPrice
        from apps.properties.pricing import change_since_launch_pct

        last_change = dict(
            PropertyPrice.objects.filter(property__slug__in=slugs)
            .values("property__slug")
            .annotate(at=Max("created_at"))
            .values_list("property__slug", "at")
        ) if slugs else {}
        plan_totals = {}
        active_plans = (
            InstallmentPlan.objects.filter(
                investor=request.user, status=InstallmentPlanStatus.ACTIVE,
                property__slug__in=slugs,
            )
            .select_related("property")
            .prefetch_related("payments", "investments")
        ) if slugs else []
        for plan in active_plans:
            inv = next(iter(sorted(plan.investments.all(), key=lambda i: i.created_at)), None)
            units, owed = plan_totals.get(plan.property.slug, (0, Decimal("0")))
            plan_totals[plan.property.slug] = (
                units + plan_units(plan, inv), owed + remaining_principal(plan)
            )

        for d, tok in zip(data, tokens):
            p = props.get(tok.property_id)
            d["city"] = p.city if p else None
            d["location"] = p.location if p else None
            d["location_ar"] = p.location_ar if p else None
            d["country"] = p.country if p else None
            d["asset_type"] = p.asset_type if p else None
            d["category"] = p.category if p else None
            # Property's expected annual yield (already on Property) — powers the
            # Reports avg-yield + per-property yield. Honest null when unknown.
            d["expected_yield"] = (
                float(p.expected_yield) if p and p.expected_yield is not None else None
            )
            d["image"] = p.hero_image_url(request) if p else None
            d["images"] = p.gallery_urls(request) if p else []
            d["construction_progress"] = p.construction_progress if p else None
            d["exit_eligible"] = bool(p.exit_eligible) if p else False
            d["unit_price"] = float(p.token_price) if p else None
            d["launch_price"] = float(p.launch_price or p.token_price) if p else None
            d["price_change_pct"] = float(change_since_launch_pct(p)) if p else None
            at = last_change.get(tok.property_id)
            d["price_updated_at"] = at.isoformat() if at else None
            units, owed = plan_totals.get(tok.property_id, (0, Decimal("0")))
            d["plan_units"] = units
            d["remaining_principal"] = float(owed)
            # Units bought with a Nova certificate, pledged to Nova Finance until its clearance.
            d["nova_pledged_units"] = pledged_units(tok.wallet_id, tok.property_id)
            ac = avg_cost.get(tok.property_id)
            if ac is not None:
                d["avg_cost_per_token"] = float(ac)
                d["invested_usd"] = float(ac * Decimal(tok.token_amount))
            else:
                d["avg_cost_per_token"] = None
                d["invested_usd"] = None
        return Response(data)


class WalletTransactionsView(APIView):
    """
    GET /api/wallets/{wallet_id}/transactions/ — the wallet's on-chain transactions
    (most recent first, capped). Owner-only. Backs the frontend's "Recent
    Transactions" card with REAL mint receipts instead of the old Supabase table.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, wallet_id):
        wallet = get_object_or_404(UserWallet, pk=wallet_id, user=request.user)
        txs = WalletTransaction.objects.filter(wallet=wallet)[:50]
        return Response(WalletTransactionSerializer(txs, many=True).data)


class UserBalanceView(APIView):
    """
    GET /api/wallets/balance/ — the caller's internal USD balance (sale proceeds,
    withdrawable). Phase 6 Wave 3. Defaults to 0 when none exists yet.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        balance = UserBalance.objects.filter(user=request.user).first()
        data = {
            "current_balance": float(balance.current_balance) if balance else 0.0,
            "currency": balance.currency if balance else "USD",
        }
        return Response(UserBalanceSerializer(data).data)


class BalanceTransactionsView(APIView):
    """
    GET /api/wallets/balance/transactions/ — the caller's internal-balance ledger
    history (most recent first, capped). Self-scoped: a user only ever sees their OWN
    entries. READ-ONLY — this surfaces the already-recorded credits/debits (distribution
    credits, secondary-sale proceeds, broker commission, withdrawals, …); it never moves
    money. Phase 12 finishing — backs the investor wallet's real transaction history.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        txs = BalanceTransaction.objects.filter(
            balance__user=request.user
        ).select_related("balance")[:100]
        return Response(BalanceTransactionSerializer(txs, many=True).data)


class WithdrawalsView(APIView):
    """
    GET  /api/wallets/withdrawals/ — the caller's withdrawal history.
    POST /api/wallets/withdrawals/ — request a withdrawal (debits the internal
    balance + records a pending request). Mirrors the LP withdrawal. Owner-scoped.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = Withdrawal.objects.filter(user=request.user)
        return Response(WithdrawalSerializer(items, many=True).data)

    def post(self, request):
        from apps.core.permissions import EMAIL_UNVERIFIED, needs_email_verification

        if needs_email_verification(request.user):
            return Response(EMAIL_UNVERIFIED, status=status.HTTP_403_FORBIDDEN)
        serializer = WithdrawalCreateSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        method = serializer.validated_data["method"]

        if serializer.validated_data.get("route") == "auto":
            from .auto_payouts import request_auto_withdrawal

            if method != "bank":
                return Response(
                    {"detail": "Automatic withdrawals go to a bank account.", "code": "auto_bank_only"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                withdrawal = request_auto_withdrawal(
                    request.user, serializer.validated_data["amount"],
                    speed=serializer.validated_data.get("speed") or "standard",
                    notes=serializer.validated_data.get("notes") or "",
                )
            except InsufficientBalance:
                return Response(
                    {"detail": "Insufficient balance.", "code": "insufficient_balance"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            withdrawal.refresh_from_db()
            return Response(WithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED)

        # Resolve the chosen payout destination to one of the caller's OWN saved methods
        # (self-scoped) and require it to match the method type — so a payout is never
        # recorded without a real, owned destination the operator can send to.
        bank_account = None
        crypto_wallet = None
        if method == "bank":
            ba_id = serializer.validated_data.get("bank_account_id")
            bank_account = InvestorBankAccount.objects.filter(
                id=ba_id, user=request.user
            ).first() if ba_id else None
            if bank_account is None:
                return Response(
                    {"detail": "Select a saved bank account to withdraw to.",
                     "code": "destination_required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:  # crypto
            cw_id = serializer.validated_data.get("crypto_wallet_id")
            crypto_wallet = InvestorCryptoWallet.objects.filter(
                id=cw_id, user=request.user
            ).first() if cw_id else None
            if crypto_wallet is None:
                return Response(
                    {"detail": "Select a saved crypto wallet to withdraw to.",
                     "code": "destination_required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            withdrawal = request_withdrawal(
                request.user,
                serializer.validated_data["amount"],
                method=method,
                notes=serializer.validated_data.get("notes") or "",
                bank_account=bank_account,
                crypto_wallet=crypto_wallet,
            )
        except InsufficientBalance:
            return Response(
                {"detail": "Insufficient balance.", "code": "insufficient_balance"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            WithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED
        )


class PayoutOptionsView(APIView):
    """GET /api/wallets/payouts/options/ — what the withdraw form can offer the caller
    (automatic bank payouts, their Stripe payout-account status, instant fee and limits)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .auto_payouts import options

        return Response(options(request.user))


class PayoutConnectView(APIView):
    """
    GET  /api/wallets/payouts/connect/ — the caller's Stripe payout-account status.
    POST /api/wallets/payouts/connect/ — a Stripe-hosted link to set it up (bank account,
    optional debit card for instant payouts). Stripe collects and holds the bank details.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .auto_payouts import options

        return Response({"status": options(request.user)["connect_status"]})

    def post(self, request):
        from apps.core.permissions import EMAIL_UNVERIFIED, needs_email_verification
        from apps.payments.stripe_service import StripeError

        from .auto_payouts import start_onboarding

        if needs_email_verification(request.user):
            return Response(EMAIL_UNVERIFIED, status=status.HTTP_403_FORBIDDEN)
        try:
            url = start_onboarding(request.user, str(request.data.get("country") or ""))
        except StripeError as exc:
            return Response({"detail": str(exc), "code": "stripe_error"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"url": url})
