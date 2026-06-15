"""
Load compiled-contract artifacts (ABI + bytecode) produced by Hardhat.

Hardhat writes one JSON per contract under
  backend/blockchain/artifacts/contracts/<File>.sol/<Contract>.json
containing `abi` and `bytecode`. We read them at call time (not import time) so a
missing build surfaces a clear error to the operator instead of breaking import.
"""
from __future__ import annotations

import functools
import json

from django.conf import settings

from .exceptions import ContractArtifactError

# Contract name -> (solidity file, contract name) for artifact path resolution.
_ARTIFACTS = {
    "PropertyTokenFactory": ("PropertyTokenFactory.sol", "PropertyTokenFactory"),
    "PropertyToken": ("PropertyToken.sol", "PropertyToken"),
}


@functools.lru_cache(maxsize=8)
def load_artifact(contract_name: str) -> dict:
    """Return the parsed Hardhat artifact dict for `contract_name` (cached)."""
    try:
        sol_file, name = _ARTIFACTS[contract_name]
    except KeyError as exc:
        raise ContractArtifactError(f"Unknown contract '{contract_name}'.") from exc

    path = settings.BLOCKCHAIN_ARTIFACTS_DIR / sol_file / f"{name}.json"
    if not path.exists():
        raise ContractArtifactError(
            f"Contract artifact not found: {path}. Compile the contracts first:\n"
            f"  cd backend/blockchain && npm install && npx hardhat compile"
        )
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractArtifactError(f"Could not read artifact {path}: {exc}") from exc

    if "abi" not in data or "bytecode" not in data:
        raise ContractArtifactError(f"Artifact {path} is missing abi/bytecode.")
    return data


def get_abi(contract_name: str) -> list:
    return load_artifact(contract_name)["abi"]


def get_bytecode(contract_name: str) -> str:
    return load_artifact(contract_name)["bytecode"]
