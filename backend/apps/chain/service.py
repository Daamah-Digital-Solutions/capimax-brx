"""
Chain service — the bridge between the Django app and the on-chain contracts.

Wave 1 scope:
  * deploy_factory()                 -> deploy the PropertyTokenFactory (platform infra)
  * deploy_property_token(property)  -> deploy ONE PropertyToken for a property via the factory
  * read_total_supply / read_max_supply / read_balance  -> read-only contract views
  * mint(...)                        -> DEFINED + unit-tested, but NOT wired to any user
                                        action in Wave 1. Wave 2 calls it on a confirmed
                                        investment.

Robustness: every state-changing call signs locally, sends the raw tx, waits for the
receipt, and verifies `status == 1` (reverts raise TransactionError). DB writes that
record on-chain results are wrapped in transaction.atomic() and only run AFTER the
chain has confirmed, so we never persist a half-deployed state.

One signer, one transaction at a time (audit 2026-10-21, H-3): every send goes through
`_transact`, which holds a Postgres advisory lock per signing address from reading the
nonce until the receipt — so the API workers and the cron jobs never race on a nonce —
and retries once if the node still rejects the nonce.

Emergency controls on tokens deployed by the new factory (H-2): `pause` (the hot key may
pull it), `unpause` (admin only), `clawback` (controller only; to address(0) = burn).
Older testnet tokens have none of these; the helpers detect that and say so.
"""
from __future__ import annotations

import contextlib
import logging
import re

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone
from web3 import Web3

from .client import admin_address, get_deployer_account, get_web3, require_connection
from .contracts import get_abi, get_bytecode
from .exceptions import (
    AlreadyDeployedError,
    ChainConfigError,
    NonceConflictError,
    TokenPausedError,
    TransactionError,
)

log = logging.getLogger(__name__)

NOMINAL_PRICE_USD = 100  # $100 per token (platform-wide token economics, SPEC §7C.6)
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
_RECEIPT_TIMEOUT = 180  # seconds to wait for a tx receipt

# Token roles (bytes32), as defined in PropertyToken.sol.
DEFAULT_ADMIN_ROLE = b"\x00" * 32
MINTER_ROLE = Web3.keccak(text="MINTER_ROLE")
PAUSER_ROLE = Web3.keccak(text="PAUSER_ROLE")
CONTROLLER_ROLE = Web3.keccak(text="CONTROLLER_ROLE")
ROLES = {"admin": DEFAULT_ADMIN_ROLE, "minter": MINTER_ROLE, "pauser": PAUSER_ROLE,
         "controller": CONTROLLER_ROLE}

# What nodes say when a nonce was already used / is being replaced.
_NONCE_ERRORS = ("nonce too low", "already known", "replacement transaction underpriced",
                 "nonce has already been used", "invalid nonce")


# --------------------------------------------------------------------------- #
# Low-level: sign + send + confirm a built transaction
# --------------------------------------------------------------------------- #
def _send(w3, account, tx) -> dict:
    """Sign `tx` with `account`, broadcast, wait for the receipt, verify success."""
    try:
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    except Exception as exc:
        if any(m in str(exc).lower() for m in _NONCE_ERRORS):
            raise NonceConflictError(f"Nonce rejected: {exc}") from exc
        raise TransactionError(f"Failed to broadcast transaction: {exc}") from exc

    try:
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=_RECEIPT_TIMEOUT)
    except Exception as exc:
        raise TransactionError(
            f"Timed out waiting for receipt of {tx_hash.hex()}: {exc}"
        ) from exc

    if receipt.get("status") != 1:
        raise TransactionError(
            f"Transaction {tx_hash.hex()} reverted on-chain (status 0)."
        )
    return receipt


def _base_tx_params(w3, account) -> dict:
    """Common tx fields: sender, nonce (incl. pending), chain id, gas price."""
    return {
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address, "pending"),
        "chainId": int(settings.CHAIN_ID),
        "gasPrice": w3.eth.gas_price,
    }


@contextlib.contextmanager
def _signer_lock(address: str):
    """Hold a database-wide lock for `address` so only one process signs with it at a time.
    Session-level and released in `finally`, independent of any open transaction."""
    if connection.vendor != "postgresql":
        yield
        return
    key = f"chain-signer:{address.lower()}"
    with connection.cursor() as cur:
        cur.execute("SELECT pg_advisory_lock(hashtext(%s))", [key])
    try:
        yield
    finally:
        with connection.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", [key])


def _transact(w3, account, make_tx) -> dict:
    """Build (with a fresh nonce), sign, send and confirm one transaction while holding the
    signer's lock. `make_tx(params)` returns the tx dict. Retries once on a nonce conflict."""
    with _signer_lock(account.address):
        for attempt in (1, 2):
            tx = make_tx(_base_tx_params(w3, account))
            try:
                return _send(w3, account, tx)
            except NonceConflictError:
                if attempt == 2:
                    raise
                log.warning("Nonce conflict for %s — rebuilding the transaction once.", account.address)
    raise TransactionError("unreachable")  # pragma: no cover


def _build(w3, account, fn_or_constructor, params: dict | None = None) -> dict:
    """Build a tx from a contract function/constructor, estimating gas with a buffer."""
    params = params if params is not None else _base_tx_params(w3, account)
    try:
        tx = fn_or_constructor.build_transaction(params)
    except Exception as exc:
        # Most commonly a gas-estimation revert (e.g. a require() would fail).
        raise TransactionError(f"Failed to build/estimate transaction: {exc}") from exc
    # 20% gas headroom over the estimate build_transaction produced.
    if "gas" in tx:
        tx["gas"] = int(tx["gas"] * 12 // 10)
    return tx


def _hexstr(value) -> str:
    """Normalize a HexBytes/bytes/str tx hash to a 0x-prefixed lowercase hex string."""
    if hasattr(value, "hex"):
        h = value.hex()
    else:
        h = str(value)
    h = h.lower()
    return h if h.startswith("0x") else "0x" + h


def _explorer(path: str) -> str:
    return f"https://testnet.bscscan.com/{path}"


# --------------------------------------------------------------------------- #
# Factory
# --------------------------------------------------------------------------- #
def deploy_factory() -> dict:
    """
    Deploy the PropertyTokenFactory. Owner = CHAIN_ADMIN_ADDRESS (the multisig; the
    deployer itself when unset); the deployer key is the hot minter and the operator that
    deploys property tokens. Returns {factory_address, owner, minter, tx_hash, explorer_*}.
    Set PROPERTY_TOKEN_FACTORY_ADDRESS to the returned address afterward.
    """
    w3 = require_connection()
    account = get_deployer_account()
    owner = admin_address()
    contract = w3.eth.contract(abi=get_abi("PropertyTokenFactory"),
                               bytecode=get_bytecode("PropertyTokenFactory"))
    ctor = contract.constructor(owner, account.address, account.address)
    receipt = _transact(w3, account, lambda p: _build(w3, account, ctor, p))
    factory_address = receipt["contractAddress"]
    tx_hash = _hexstr(receipt["transactionHash"])
    return {
        "factory_address": factory_address,
        "owner": owner,
        "minter": account.address,
        "operator": account.address,
        "tx_hash": tx_hash,
        "explorer_address": _explorer(f"address/{factory_address}"),
        "explorer_tx": _explorer(f"tx/{tx_hash}"),
    }


def _get_factory(w3):
    address = getattr(settings, "PROPERTY_TOKEN_FACTORY_ADDRESS", "")
    if not address:
        raise ChainConfigError(
            "PROPERTY_TOKEN_FACTORY_ADDRESS is not set. Deploy the factory first "
            "(management command `deploy_factory` or blockchain/scripts/deploy.js) "
            "and put its address in the environment."
        )
    return w3.eth.contract(
        address=w3.to_checksum_address(address), abi=get_abi("PropertyTokenFactory")
    )


# --------------------------------------------------------------------------- #
# Per-property token
# --------------------------------------------------------------------------- #
def _token_symbol(slug: str) -> str:
    """Derive a short, valid ERC20 symbol from a property slug (<= 11 chars)."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", slug).upper()
    return ("BRX" + cleaned)[:11]


def token_symbol_for_slug(slug: str) -> str:
    """Public: the ERC20 symbol the factory uses for a property (matches on-chain)."""
    return _token_symbol(slug)


def deploy_property_token(property_obj) -> dict:
    """
    Deploy ONE PropertyToken for `property_obj` via the factory, then record the
    deployment on its TokenMetadata (after on-chain confirmation, atomically).

    Idempotent: raises AlreadyDeployedError if this property already has a deployed
    contract (checked both off-chain on TokenMetadata and on-chain via the factory).
    """
    from apps.properties.models import TokenMetadata

    slug = property_obj.slug
    max_supply = int(property_obj.token_supply or 0)
    if max_supply <= 0:
        raise ChainConfigError(
            f"Property '{slug}' has token_supply={max_supply}; cannot deploy a "
            f"fixed-supply contract with no supply."
        )

    w3 = require_connection()
    account = get_deployer_account()
    factory = _get_factory(w3)

    # Off-chain idempotency: already linked?
    meta = getattr(property_obj, "token_metadata", None)
    if meta and meta.deployed_contract_address:
        raise AlreadyDeployedError(
            f"Property '{slug}' already linked to {meta.deployed_contract_address}."
        )
    # On-chain idempotency: factory already has a token for this slug?
    existing = factory.functions.tokenForSlug(slug).call()
    if existing and existing != ZERO_ADDRESS:
        raise AlreadyDeployedError(
            f"Factory already deployed a token for '{slug}' at {existing}."
        )

    name = f"Capimax BRX - {property_obj.name}"[:60]
    symbol = _token_symbol(slug)

    fn = factory.functions.deployPropertyToken(
        name, symbol, max_supply, NOMINAL_PRICE_USD, slug
    )
    receipt = _transact(w3, account, lambda p: _build(w3, account, fn, p))
    tx_hash = _hexstr(receipt["transactionHash"])

    # Resolve the freshly deployed address from the factory registry.
    token_address = factory.functions.tokenForSlug(slug).call()
    if not token_address or token_address == ZERO_ADDRESS:
        raise TransactionError(
            f"Deployment tx {tx_hash} confirmed but factory has no token for '{slug}'."
        )

    # Record on-chain truth AFTER confirmation, atomically. Display fields untouched.
    factory_address = factory.address
    chain_id = int(settings.CHAIN_ID)
    with transaction.atomic():
        meta, _ = TokenMetadata.objects.get_or_create(property=property_obj)
        meta.deployed_contract_address = token_address
        meta.deployment_tx = tx_hash
        meta.deployed_at = timezone.now()
        meta.deployment_chain_id = chain_id
        meta.deployment_network = getattr(settings, "WALLET_NETWORK", "bsc-testnet")
        meta.factory_address = factory_address
        meta.save(update_fields=[
            "deployed_contract_address", "deployment_tx", "deployed_at",
            "deployment_chain_id", "deployment_network", "factory_address",
        ])

    return {
        "property_slug": slug,
        "token_address": token_address,
        "factory_address": factory_address,
        "max_supply": max_supply,
        "tx_hash": tx_hash,
        "explorer_token": _explorer(f"address/{token_address}"),
        "explorer_tx": _explorer(f"tx/{tx_hash}"),
    }


# --------------------------------------------------------------------------- #
# Read-only views
# --------------------------------------------------------------------------- #
def deployed_token_address(slug: str) -> str | None:
    """
    The factory's recorded PropertyToken address for `slug`, or None if the factory has
    none. Read-only (no tx). Lets callers reconcile on-chain truth with the DB — e.g. a
    contract deployed in a prior run against a since-reset database.
    """
    w3 = require_connection()
    factory = _get_factory(w3)
    addr = factory.functions.tokenForSlug(slug).call()
    if not addr or addr == ZERO_ADDRESS:
        return None
    return w3.to_checksum_address(addr)


def _token(w3, token_address):
    return w3.eth.contract(
        address=w3.to_checksum_address(token_address), abi=get_abi("PropertyToken")
    )


def read_total_supply(token_address: str) -> int:
    w3 = require_connection()
    return int(_token(w3, token_address).functions.totalSupply().call())


def read_max_supply(token_address: str) -> int:
    w3 = require_connection()
    return int(_token(w3, token_address).functions.maxSupply().call())


def read_balance(token_address: str, holder_address: str) -> int:
    w3 = require_connection()
    return int(
        _token(w3, token_address)
        .functions.balanceOf(w3.to_checksum_address(holder_address))
        .call()
    )


# --------------------------------------------------------------------------- #
# Mint — DEFINED for Wave 2. Not wired to any user action in Wave 1.
# --------------------------------------------------------------------------- #
def mint(token_address: str, to_address: str, amount: int) -> dict:
    """
    Mint `amount` whole shares of the property token at `token_address` to
    `to_address`, signed by the platform deployer (which holds MINTER_ROLE).

    WAVE 1: this is built and unit-tested on testnet but is NOT called from any
    user-facing flow. Wave 2 invokes it on a confirmed user investment.
    """
    if int(amount) <= 0:
        raise ChainConfigError("Mint amount must be a positive integer.")
    w3 = require_connection()
    account = get_deployer_account()
    if is_paused(token_address):
        raise TokenPausedError(f"Token {token_address} is paused — minting is stopped.")
    token = _token(w3, token_address)
    fn = token.functions.mint(w3.to_checksum_address(to_address), int(amount))
    receipt = _transact(w3, account, lambda p: _build(w3, account, fn, p))
    tx_hash = _hexstr(receipt["transactionHash"])
    return {
        "token_address": token_address,
        "to": w3.to_checksum_address(to_address),
        "amount": int(amount),
        "tx_hash": tx_hash,
        "block_number": int(receipt.get("blockNumber")) if receipt.get("blockNumber") is not None else None,
        "chain_id": int(settings.CHAIN_ID),
        "explorer_tx": _explorer(f"tx/{tx_hash}"),
    }


# --------------------------------------------------------------------------- #
# Transfer — Phase 6 Wave 2 (LP secondary-market settlement).
# Moves whole shares between two CUSTODIAL wallets, signed with the SELLER's key.
# --------------------------------------------------------------------------- #
# Custodial wallets are generated empty (0 tBNB), so a seller-signed tx would
# revert for want of gas. Since we custody both ends, the platform deployer tops up
# just enough native gas for the one transfer before the seller signs it. This keeps
# settlement a DIRECT seller-signed `transfer()` (no approval/transferFrom) while
# remaining operationally real. Mainnet would use a funded relayer / gas station —
# the seam is this one helper. (DECISIONS.md "Phase 6 Wave 2".)
_GAS_TOPUP_BUFFER_NUM = 15  # +50% headroom over the gas cost (covers gas-price drift)
_GAS_TOPUP_BUFFER_DEN = 10
_NATIVE_TRANSFER_GAS = 21000
# A fixed gas limit for an ERC20 `transfer` (decimals==0). Real cost is ~35–55k; 100k
# is a safe ceiling. We set it explicitly so building the tx does NOT call
# `eth_estimate_gas`, which on BSC reverts with "insufficient funds" when the
# (custodial) sender has 0 native BNB — we must FUND the gas BEFORE building/sending.
_ERC20_TRANSFER_GAS = 100000


def _fund_gas_if_needed(w3, recipient_address: str, needed_wei: int) -> dict | None:
    """
    Ensure `recipient_address` holds at least `needed_wei` native BNB to pay for one
    transaction, topping it up from the platform deployer if not. Returns the funding
    receipt (or None if no funding was required). Never logs key material.
    """
    recipient = w3.to_checksum_address(recipient_address)
    balance = w3.eth.get_balance(recipient)
    if balance >= needed_wei:
        return None

    deployer = get_deployer_account()
    topup = int(needed_wei - balance)
    return _transact(w3, deployer, lambda p: {
        **p, "to": recipient, "value": topup, "gas": _NATIVE_TRANSFER_GAS,
    })


def transfer(token_address: str, from_account, to_address: str, amount: int) -> dict:
    """
    Transfer `amount` whole shares of the property token at `token_address` from
    `from_account` (a signer holding the tokens — the SELLER's custodial account) to
    `to_address` (the BUYER's wallet). Signs with `from_account`'s key.

    Custodial gas: the seller's wallet is topped up from the deployer with exactly the
    gas this one transfer needs, so a direct seller-signed `transfer()` can be sent
    (we custody both wallets; no approval/transferFrom dance).

    Returns the REAL on-chain result (tx hash + block). A revert (e.g. insufficient
    token balance) raises TransactionError and writes NOTHING. Idempotency is the
    caller's responsibility (the settlement service guards it under a row lock) — this
    is the raw capability, exactly like `mint`.
    """
    if int(amount) <= 0:
        raise ChainConfigError("Transfer amount must be a positive integer.")

    w3 = require_connection()
    to_checksummed = w3.to_checksum_address(to_address)
    token = _token(w3, token_address)
    if is_paused(token_address):
        raise TokenPausedError(f"Token {token_address} is paused — transfers are stopped.")

    # FUND the seller's gas FIRST (a 0-BNB custodial sender makes eth_estimate_gas
    # revert), then build with an EXPLICIT gas limit so building never estimates.
    gas_price = int(w3.eth.gas_price)
    needed = gas_price * _ERC20_TRANSFER_GAS * _GAS_TOPUP_BUFFER_NUM // _GAS_TOPUP_BUFFER_DEN
    _fund_gas_if_needed(w3, from_account.address, needed)

    fn = token.functions.transfer(to_checksummed, int(amount))

    def make(params):
        params["gas"] = _ERC20_TRANSFER_GAS  # explicit → build_transaction skips estimation
        try:
            return fn.build_transaction(params)
        except Exception as exc:
            raise TransactionError(f"Failed to build transfer transaction: {exc}") from exc

    receipt = _transact(w3, from_account, make)
    tx_hash = _hexstr(receipt["transactionHash"])
    return {
        "token_address": token_address,
        "from": w3.to_checksum_address(from_account.address),
        "to": to_checksummed,
        "amount": int(amount),
        "tx_hash": tx_hash,
        "block_number": int(receipt.get("blockNumber")) if receipt.get("blockNumber") is not None else None,
        "chain_id": int(settings.CHAIN_ID),
        "explorer_tx": _explorer(f"tx/{tx_hash}"),
    }



# --------------------------------------------------------------------------- #
# Emergency controls (tokens from the new factory — audit 2026-10-21, H-1 / H-2)
# --------------------------------------------------------------------------- #
def has_role(token_address: str, role: str, address: str) -> bool:
    """Does `address` hold `role` (admin | minter | pauser | controller) on the token?"""
    w3 = require_connection()
    try:
        return bool(_token(w3, token_address).functions.hasRole(
            ROLES[role], w3.to_checksum_address(address)).call())
    except KeyError:
        raise ChainConfigError(f"Unknown role '{role}'.")


def is_paused(token_address: str) -> bool | None:
    """True / False, or None for an older token that has no pause switch."""
    w3 = require_connection()
    try:
        return bool(_token(w3, token_address).functions.paused().call())
    except Exception:  # noqa: BLE001 — function absent on pre-2026-10 tokens
        return None


def _role_call(token_address: str, role: str, build):
    """Send a role-gated call signed by the server key, after checking it holds `role`."""
    w3 = require_connection()
    account = get_deployer_account()
    if is_paused(token_address) is None:
        raise ChainConfigError(
            f"Token {token_address} predates the emergency controls (no pause / clawback)."
        )
    if not has_role(token_address, role, account.address):
        raise ChainConfigError(
            f"The server key {account.address} does not hold the {role} role on {token_address}; "
            "this action must be signed by the platform multisig."
        )
    fn = build(w3, _token(w3, token_address))
    receipt = _transact(w3, account, lambda p: _build(w3, account, fn, p))
    tx_hash = _hexstr(receipt["transactionHash"])
    return {"token_address": token_address, "tx_hash": tx_hash, "explorer_tx": _explorer(f"tx/{tx_hash}")}


def pause(token_address: str) -> dict:
    """Stop every mint and transfer of the token (hot key or admin)."""
    return _role_call(token_address, "pauser", lambda w3, t: t.functions.pause())


def unpause(token_address: str) -> dict:
    """Restart the token. Needs the admin role — on mainnet that is the multisig."""
    return _role_call(token_address, "admin", lambda w3, t: t.functions.unpause())


def clawback(token_address: str, from_address: str, to_address: str | None, amount: int,
             reason: str) -> dict:
    """Forced move of `amount` units from `from_address` to `to_address`, or a BURN when
    `to_address` is None (frees the supply cap). Controller role only; works while paused."""
    if int(amount) <= 0:
        raise ChainConfigError("Clawback amount must be a positive integer.")
    return _role_call(token_address, "controller", lambda w3, t: t.functions.clawback(
        w3.to_checksum_address(from_address),
        w3.to_checksum_address(to_address) if to_address else ZERO_ADDRESS,
        int(amount), (reason or "")[:200],
    ))
