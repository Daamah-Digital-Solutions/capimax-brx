"""Chain-layer error types, so callers can distinguish config vs. on-chain faults."""


class ChainError(Exception):
    """Base class for all chain-layer failures."""


class ChainConfigError(ChainError):
    """Missing/invalid configuration (RPC URL, deployer key, factory address, ABIs)."""


class ChainConnectionError(ChainError):
    """Could not reach or sync with the configured RPC node."""


class ContractArtifactError(ChainError):
    """A compiled contract artifact (ABI/bytecode) is missing or malformed."""


class TransactionError(ChainError):
    """A transaction failed to send, reverted, or its receipt showed status 0."""


class AlreadyDeployedError(ChainError):
    """A PropertyToken already exists for the property (idempotency guard)."""
