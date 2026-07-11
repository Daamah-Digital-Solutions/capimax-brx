"""
Custodial wallet domain — Phase 3 Wave 1.

A `UserWallet` is the platform-custodied BSC wallet for a user (one per user).
The matching private key is stored — encrypted at rest via the KeyManager — in a
SEPARATE table (`WalletKeyMaterial`) that is never serialized to any API and
never shown in full in the admin. SPEC §3.2.

SAFETY: the private key only ever exists in plaintext transiently inside the
generation service (apps/wallets/services.py). It is encrypted before any DB
write and decrypted only when a signer explicitly needs it. It must NEVER appear
in API responses, serializers, logs, error messages, the admin, or test output.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class WalletNetwork(models.TextChoices):
    # TESTNET ONLY for Wave 1. Mainnet is a separate, audited cutover.
    BSC_TESTNET = "bsc-testnet", _("BSC Testnet")


class WalletType(models.TextChoices):
    CUSTODIAL = "custodial", _("Custodial")


class UserWallet(models.Model):
    """
    The platform-held wallet for a user. Mirrors the frontend `Wallet` shape
    (src/hooks/useUserWallet.ts): id, wallet_address, network, wallet_type,
    created_at — and exposes exactly those, never key material.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    # Checksummed BSC address (public — safe to expose).
    wallet_address = models.CharField(max_length=42, unique=True, db_index=True)
    network = models.CharField(
        max_length=24, choices=WalletNetwork.choices, default=WalletNetwork.BSC_TESTNET
    )
    wallet_type = models.CharField(
        max_length=16, choices=WalletType.choices, default=WalletType.CUSTODIAL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("user wallet")
        verbose_name_plural = _("user wallets")
        ordering = ("-created_at",)

    def __str__(self):
        # Public address only — never key material.
        return f"{self.wallet_address} ({self.user_id})"


class WalletKeyMaterial(models.Model):
    """
    Encrypted private key for a `UserWallet`, isolated in its own table so the
    wallet record can be serialized freely while this never is.

    `encrypted_private_key` is KeyManager ciphertext (authenticated encryption);
    the decryption key lives ONLY in the environment, never here. `key_backend`
    records which KeyManager produced it so secrets can be migrated between
    backends (e.g. fernet-db -> aws-kms) later.

    This model is intentionally NOT exposed by any serializer and is shown in the
    admin without the ciphertext field.
    """

    wallet = models.OneToOneField(
        UserWallet,
        on_delete=models.CASCADE,
        related_name="key_material",
    )
    encrypted_private_key = models.TextField()
    key_backend = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("wallet key material")
        verbose_name_plural = _("wallet key material")

    def __str__(self):
        # NEVER include the ciphertext or any key data in the representation.
        return f"key[{self.key_backend}] for {self.wallet.wallet_address}"


class OwnershipToken(models.Model):
    """
    A holder's position in ONE property's token, held in a wallet. SPEC §3.2
    (`ownership_tokens`). Mutated ONLY by the mint service (additive merge on
    wallet+property, race-safe via select_for_update). Mirrors the frontend
    `OwnershipToken` shape (src/hooks/useOwnershipTokens.ts).

    `property_id` is the frontend string id (Property.slug), `property_name`
    denormalized — matching the frontend's wallet-scoped queries.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        SOLD = "sold", _("Sold")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        UserWallet, on_delete=models.CASCADE, related_name="ownership_tokens"
    )
    property_id = models.CharField(max_length=64, db_index=True)  # Property.slug
    property_name = models.CharField(max_length=200)
    token_symbol = models.CharField(max_length=16)
    # Whole shares (1 token == one $100-nominal share; contract decimals == 0).
    token_amount = models.PositiveIntegerField(default=0)
    # Escrow lock (Phase 6 Wave 2): shares reserved by an ACTIVE market listing so
    # they can't be double-listed or moved while listed. Available-to-trade =
    # token_amount - locked_amount; the lock is released on cancel/expire and
    # consumed (alongside token_amount) when a sale settles on-chain.
    locked_amount = models.PositiveIntegerField(default=0)
    token_value_usd = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    # Computed from the property's real token_supply (NEVER the hardcoded /1000).
    ownership_percentage = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    acquisition_date = models.DateTimeField(auto_now_add=True)
    last_distribution_date = models.DateTimeField(null=True, blank=True)
    total_distributions = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("ownership token")
        verbose_name_plural = _("ownership tokens")
        ordering = ("-token_value_usd",)
        constraints = [
            # One position per (wallet, property) — the mint service merges additively.
            models.UniqueConstraint(
                fields=["wallet", "property_id"], name="uniq_ownership_per_wallet_property"
            )
        ]

    @property
    def available_amount(self) -> int:
        """Whole shares free to trade/transfer (not reserved by an active listing)."""
        return max(0, int(self.token_amount) - int(self.locked_amount))

    def __str__(self):
        return f"{self.token_amount} {self.token_symbol} · {self.wallet.wallet_address}"


class WalletTransaction(models.Model):
    """
    An on-chain transaction observed for a wallet. SPEC §3.2 (`wallet_transactions`).
    Read-only to users. Written only by the mint/transfer services AFTER a confirmed
    on-chain receipt — `tx_hash`/`block_number` are ALWAYS real chain values, never
    fabricated.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        UserWallet, on_delete=models.CASCADE, related_name="transactions"
    )
    tx_hash = models.CharField(max_length=66, db_index=True)  # real 0x… chain hash
    tx_type = models.CharField(max_length=24)  # e.g. "mint", "transfer"
    amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    token_symbol = models.CharField(max_length=16, blank=True)
    status = models.CharField(max_length=16, default="confirmed")
    block_number = models.BigIntegerField(null=True, blank=True)
    chain_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("wallet transaction")
        verbose_name_plural = _("wallet transactions")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.tx_type} {self.tx_hash[:12]}… · {self.wallet.wallet_address}"


class UserBalance(models.Model):
    """
    A per-user internal USD balance — Phase 6 Wave 2. Where a SELLER's net sale
    proceeds land when their tokens sell on the LP market (the buyer pays from their
    LiquidityProvider.current_balance; the seller is credited here). This is the
    investor-side analogue of the LP's `current_balance`, kept per-user so any user
    (not just LPs) can accrue and later withdraw proceeds.

    The balance is a CACHE of the BalanceTransaction ledger (the ledger is the source
    of truth). It is mutated ONLY by the service layer under select_for_update, never
    by a user-writable serializer. Withdrawal of this balance aligns with the existing
    withdrawal mechanism (the investor-withdrawal endpoint is a later wave — the
    balance + ledger built here are the foundation it will draw down).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="balance"
    )
    current_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("user balance")
        verbose_name_plural = _("user balances")

    def __str__(self):
        return f"${self.current_balance} ({self.user_id})"


class BalanceTransaction(models.Model):
    """
    Ledger entry for a `UserBalance` (Phase 6 Wave 2) — the source of truth for the
    cached `current_balance`. Written only by the service layer.
    """

    class EntryType(models.TextChoices):
        CREDIT = "credit", _("Credit")
        DEBIT = "debit", _("Debit")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    balance = models.ForeignKey(
        UserBalance, on_delete=models.CASCADE, related_name="entries"
    )
    entry_type = models.CharField(max_length=8, choices=EntryType.choices)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    # e.g. "lp_market_sale" | "lp_market_purchase" | "withdrawal"
    source = models.CharField(max_length=40)
    reference = models.CharField(max_length=64, blank=True, default="")
    memo = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("balance transaction")
        verbose_name_plural = _("balance transactions")
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.entry_type} {self.amount} [{self.source}] ({self.balance.user_id})"


class Withdrawal(models.Model):
    """
    An investor's request to cash out their internal `UserBalance` — Phase 6 Wave 3.
    Mirrors the LP withdrawal (apps.lp `LPTransaction` tx_type='withdrawal'): created
    `pending`, the balance is debited at request time, and an operator advances the
    status (the actual off-platform payout/rail is an ops/back-office step). This
    closes the Wave-2 gap where sale proceeds were credited but not withdrawable.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        PROCESSING = "processing", _("Processing")
        COMPLETED = "completed", _("Completed")
        FAILED = "failed", _("Failed")

    class Method(models.TextChoices):
        BANK = "bank", _("Bank")
        CRYPTO = "crypto", _("Crypto")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawals"
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=8, default="USD")
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.BANK)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    reference = models.CharField(max_length=64, blank=True, default="")
    notes = models.CharField(max_length=500, blank=True, null=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("withdrawal")
        verbose_name_plural = _("withdrawals")
        ordering = ("-created_at",)

    def __str__(self):
        return f"withdraw {self.amount} {self.currency} [{self.status}] ({self.user_id})"


class Deposit(models.Model):
    """
    A wallet TOP-UP — an external pay-in that CREDITS the user's internal `UserBalance`
    (the inverse of a withdrawal). It is the "what" record for a deposit, exactly as an
    `Investment` is for a buy: a `payments.Payment` references it and the SAME gated
    Stripe/NOW path charges it; on the confirmed webhook/IPN the completion core credits
    the balance (`credit_user_balance(source="deposit")`).

    SETTLEMENT-GATED + IDEMPOTENT: nothing is credited at request time. The credit happens
    only inside the gated completion core, and the `credited` flag guarantees a replayed
    webhook never double-credits. NO tokens are minted — a deposit is not a buy.
    """

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        COMPLETED = "completed", _("Completed")
        FAILED = "failed", _("Failed")

    class Target(models.TextChoices):
        # Which balance a confirmed top-up credits. WALLET is the ordinary internal
        # UserBalance (default, unchanged behaviour). LP funds the caller's Liquidity
        # Provider operating balance (LiquidityProvider.current_balance) so an LP can
        # add funds before buying on the LP market — routed in _credit_deposit.
        WALLET = "wallet", _("Wallet balance")
        LP = "lp", _("Liquidity Provider balance")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="deposits"
    )
    amount = models.DecimalField(max_digits=16, decimal_places=2)  # USD
    payment_method = models.CharField(max_length=16, default="card")  # card | crypto
    # Credit routing (see Target): default wallet keeps every existing deposit identical.
    target = models.CharField(
        max_length=8, choices=Target.choices, default=Target.WALLET, db_index=True
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    # Idempotency guard: flipped true the first (and only) time the balance is credited.
    credited = models.BooleanField(default=False)
    credited_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("deposit")
        verbose_name_plural = _("deposits")
        ordering = ("-created_at",)

    def __str__(self):
        return f"deposit {self.amount} [{self.status}] ({self.user_id})"
