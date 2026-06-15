"""
BSC Testnet connection + the platform deployer/signer account.

SAFETY:
  * RPC URL and chain id are env-driven (settings). No mainnet is configured here.
  * The deployer private key is read from the environment (settings.DEPLOYER_PRIVATE_KEY)
    only at the moment a signature is needed. It is never logged, printed, returned,
    or stored in the DB. `get_deployer_account()` returns an eth-account object whose
    `.address` is safe to surface; its key never is.
"""
from __future__ import annotations

import functools

from django.conf import settings
from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from .exceptions import ChainConfigError, ChainConnectionError


@functools.lru_cache(maxsize=1)
def get_web3() -> Web3:
    """
    Return a Web3 connected to the configured BSC Testnet RPC.

    BSC is a Proof-of-Authority chain whose block `extraData` exceeds the Ethereum
    default, so the POA middleware is injected to let web3 parse blocks/receipts.
    """
    rpc_url = getattr(settings, "BSC_TESTNET_RPC_URL", "")
    if not rpc_url:
        raise ChainConfigError("BSC_TESTNET_RPC_URL is not configured.")
    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


def require_connection() -> Web3:
    """Return a connected Web3, or raise with a clear message if the node is down."""
    w3 = get_web3()
    try:
        connected = w3.is_connected()
    except Exception as exc:  # network/transport errors
        raise ChainConnectionError(
            f"Could not reach BSC Testnet RPC ({settings.BSC_TESTNET_RPC_URL}): {exc}"
        ) from exc
    if not connected:
        raise ChainConnectionError(
            f"Not connected to BSC Testnet RPC ({settings.BSC_TESTNET_RPC_URL})."
        )
    # Guard against pointing at the wrong network (e.g. mainnet) by mistake.
    expected_chain_id = int(getattr(settings, "CHAIN_ID", 97))
    actual_chain_id = w3.eth.chain_id
    if actual_chain_id != expected_chain_id:
        raise ChainConfigError(
            f"RPC chain id {actual_chain_id} != expected {expected_chain_id}. "
            f"Refusing to operate on the wrong network."
        )
    return w3


def get_deployer_account() -> LocalAccount:
    """
    Return the platform deployer/signer account from the env key.

    The returned object exposes `.address` (safe) and is used internally to sign;
    the underlying private key is never logged or surfaced.
    """
    key = getattr(settings, "DEPLOYER_PRIVATE_KEY", "")
    if not key:
        raise ChainConfigError(
            "DEPLOYER_PRIVATE_KEY is not set. Provide a funded BSC Testnet key in the "
            "environment (never in the repo or the DB)."
        )
    try:
        return Account.from_key(key)
    except (ValueError, Exception) as exc:  # malformed key
        raise ChainConfigError("DEPLOYER_PRIVATE_KEY is not a valid private key.") from exc


def deployer_address() -> str:
    """Public address of the deployer (safe to log/report)."""
    return get_deployer_account().address
