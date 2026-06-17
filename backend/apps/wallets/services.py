"""
Custodial wallet generation service — Phase 3 Wave 1.

Creates a real BSC keypair (eth-account), stores the checksummed address, encrypts
the private key via the KeyManager, and persists the two in an atomic transaction.
Returns ONLY the wallet record (which exposes the address, never the key).

SAFETY:
  * The plaintext private key exists only as a local variable here and is encrypted
    before any DB write. It is never logged, printed, returned, or put on the model.
  * Generation is idempotent: at most one wallet per user (returns the existing one).
"""
from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, transaction
from eth_account import Account
from web3 import Web3

from .keys import get_key_manager
from .models import (
    BalanceTransaction,
    UserBalance,
    UserWallet,
    WalletKeyMaterial,
    WalletNetwork,
)


def get_or_create_custodial_wallet(user) -> tuple[UserWallet, bool]:
    """
    Return (wallet, created) for `user`, generating a new custodial BSC wallet if
    none exists. Idempotent — a user can have at most one custodial wallet.

    The private key is generated, encrypted, and stored; only the address is kept
    in plaintext. Never returns or logs the private key.
    """
    existing = UserWallet.objects.filter(user=user).first()
    if existing is not None:
        return existing, False

    # Generate a real BSC-compatible keypair locally (no network call needed).
    account = Account.create()
    address = Web3.to_checksum_address(account.address)
    # 0x-prefixed hex private key — held ONLY in this local for the moment it
    # takes to encrypt it. Deliberately not assigned anywhere persistent/loggable.
    private_key_hex = account.key.hex()
    if not private_key_hex.startswith("0x"):
        private_key_hex = "0x" + private_key_hex

    key_manager = get_key_manager()
    ciphertext = key_manager.encrypt(private_key_hex)

    network = getattr(settings, "WALLET_NETWORK", WalletNetwork.BSC_TESTNET)

    try:
        with transaction.atomic():
            wallet = UserWallet.objects.create(
                user=user,
                wallet_address=address,
                network=network,
                wallet_type="custodial",
            )
            WalletKeyMaterial.objects.create(
                wallet=wallet,
                encrypted_private_key=ciphertext,
                key_backend=key_manager.backend_id,
            )
    except IntegrityError:
        # Lost a race (the OneToOne user constraint fired) — return the winner.
        # The just-generated key was never persisted, so nothing leaks.
        del private_key_hex
        return UserWallet.objects.get(user=user), False

    # Explicitly drop the plaintext reference (defensive; GC would collect it anyway).
    del private_key_hex
    # In-app notification (Phase 10) — only on first creation (this branch). Defensive
    # helper: a notify failure never affects the wallet.
    from apps.notifications.services import NotificationType, notify
    notify(user, NotificationType.WALLET_CREATED, action_url="/wallet")
    return wallet, True


def load_custodial_signer(wallet: UserWallet):
    """
    Return an eth-account signer (LocalAccount) for `wallet`, decrypting its stored
    private key via the KeyManager. Phase 6 Wave 2 — used to sign an on-chain token
    transfer with the SELLER's own custodial key (LP-market settlement).

    SAFETY: the plaintext key exists only transiently inside this function and inside
    the returned signer object; it is never logged, returned as a string, or persisted.
    The caller must use the signer immediately and let it go out of scope.
    """
    from eth_account import Account

    key_material = WalletKeyMaterial.objects.filter(wallet=wallet).first()
    if key_material is None:
        raise ValueError(f"Wallet {wallet.pk} has no key material to sign with.")

    key_manager = get_key_manager()
    private_key_hex = key_manager.decrypt(key_material.encrypted_private_key)
    try:
        signer = Account.from_key(private_key_hex)
    finally:
        del private_key_hex  # drop the plaintext promptly
    return signer


def credit_user_balance(user, amount, *, source: str, reference: str = "", memo: str = ""):
    """
    Credit `amount` USD to a user's internal balance and append a ledger entry, under
    a row lock (race-safe). Phase 6 Wave 2 — a seller's net proceeds land here when
    their tokens sell on the LP market. Returns the updated UserBalance.

    Caller is responsible for running this inside the settlement transaction.
    """
    from decimal import Decimal

    balance, _created = UserBalance.objects.select_for_update().get_or_create(user=user)
    balance.current_balance = (balance.current_balance or Decimal("0")) + Decimal(amount)
    balance.save(update_fields=["current_balance", "updated_at"])
    BalanceTransaction.objects.create(
        balance=balance,
        entry_type=BalanceTransaction.EntryType.CREDIT,
        amount=Decimal(amount),
        source=source,
        reference=reference,
        memo=memo,
    )
    return balance


class InsufficientBalance(Exception):
    """A debit was attempted against a UserBalance that is too low."""


def request_withdrawal(user, amount, *, method: str, notes: str = ""):
    """
    Investor withdrawal — Phase 6 Wave 3. Debits the internal balance and records a
    pending Withdrawal (an operator advances it / runs the off-platform payout),
    mirroring the LP withdrawal. Atomic: a shortfall raises InsufficientBalance and
    nothing is recorded. Returns the Withdrawal.
    """
    import uuid as _uuid

    from .models import Withdrawal

    from apps.notifications.services import NotificationType, notify

    with transaction.atomic():
        debit_user_balance(
            user, amount, source="withdrawal", memo="Withdrawal request"
        )
        wd = Withdrawal.objects.create(
            user=user,
            amount=amount,
            method=method,
            notes=notes or None,
            reference="WD-" + _uuid.uuid4().hex[:10].upper(),
            status=Withdrawal.Status.PENDING,
        )
        notify(
            user, NotificationType.WITHDRAWAL_REQUESTED,
            params={"amount": str(amount), "reference": wd.reference},
            action_url="/wallet",
        )
        return wd


def debit_user_balance(user, amount, *, source: str, reference: str = "", memo: str = ""):
    """
    Debit `amount` USD from a user's internal balance (under a row lock) and append a
    ledger entry. Raises InsufficientBalance if the balance is too low — the caller's
    transaction then rolls back, so nothing moves. Phase 6 Wave 3 (peer-market buyer
    payment + investor withdrawal).
    """
    from decimal import Decimal

    amount = Decimal(amount)
    balance, _created = UserBalance.objects.select_for_update().get_or_create(user=user)
    if (balance.current_balance or Decimal("0")) < amount:
        raise InsufficientBalance()
    balance.current_balance = balance.current_balance - amount
    balance.save(update_fields=["current_balance", "updated_at"])
    BalanceTransaction.objects.create(
        balance=balance,
        entry_type=BalanceTransaction.EntryType.DEBIT,
        amount=amount,
        source=source,
        reference=reference,
        memo=memo,
    )
    return balance
