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
"""
from __future__ import annotations

import re

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .client import get_deployer_account, get_web3, require_connection
from .contracts import get_abi, get_bytecode
from .exceptions import (
    AlreadyDeployedError,
    ChainConfigError,
    TransactionError,
)

NOMINAL_PRICE_USD = 100  # $100 per token (platform-wide token economics, SPEC §7C.6)
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
_RECEIPT_TIMEOUT = 180  # seconds to wait for a tx receipt


# --------------------------------------------------------------------------- #
# Low-level: sign + send + confirm a built transaction
# --------------------------------------------------------------------------- #
def _send(w3, account, tx) -> dict:
    """Sign `tx` with `account`, broadcast, wait for the receipt, verify success."""
    try:
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    except Exception as exc:
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


def _build(w3, account, fn_or_constructor) -> dict:
    """Build a tx from a contract function/constructor, estimating gas with a buffer."""
    params = _base_tx_params(w3, account)
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
    Deploy the PropertyTokenFactory, owned by the platform deployer. Returns
    {factory_address, tx_hash, explorer_*}. Set PROPERTY_TOKEN_FACTORY_ADDRESS to
    the returned address afterward.
    """
    w3 = require_connection()
    account = get_deployer_account()
    contract = w3.eth.contract(abi=get_abi("PropertyTokenFactory"),
                               bytecode=get_bytecode("PropertyTokenFactory"))
    tx = _build(w3, account, contract.constructor(account.address))
    receipt = _send(w3, account, tx)
    factory_address = receipt["contractAddress"]
    tx_hash = _hexstr(receipt["transactionHash"])
    return {
        "factory_address": factory_address,
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
    tx = _build(w3, account, fn)
    receipt = _send(w3, account, tx)
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
    token = _token(w3, token_address)
    fn = token.functions.mint(w3.to_checksum_address(to_address), int(amount))
    tx = _build(w3, account, fn)
    receipt = _send(w3, account, tx)
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
    funding_tx = {
        "from": deployer.address,
        "to": recipient,
        "value": topup,
        "nonce": w3.eth.get_transaction_count(deployer.address, "pending"),
        "chainId": int(settings.CHAIN_ID),
        "gasPrice": w3.eth.gas_price,
        "gas": _NATIVE_TRANSFER_GAS,
    }
    return _send(w3, deployer, funding_tx)


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

    # FUND the seller's gas FIRST (a 0-BNB custodial sender makes eth_estimate_gas
    # revert), then build with an EXPLICIT gas limit so building never estimates.
    gas_price = int(w3.eth.gas_price)
    needed = gas_price * _ERC20_TRANSFER_GAS * _GAS_TOPUP_BUFFER_NUM // _GAS_TOPUP_BUFFER_DEN
    _fund_gas_if_needed(w3, from_account.address, needed)

    params = _base_tx_params(w3, from_account)
    params["gas"] = _ERC20_TRANSFER_GAS  # explicit → build_transaction skips estimation
    fn = token.functions.transfer(to_checksummed, int(amount))
    try:
        tx = fn.build_transaction(params)
    except Exception as exc:
        raise TransactionError(f"Failed to build transfer transaction: {exc}") from exc

    receipt = _send(w3, from_account, tx)
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
