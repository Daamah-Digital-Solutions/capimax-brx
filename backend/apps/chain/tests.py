"""
Chain-layer tests — Phase 3 Wave 1. These are NETWORK-FREE unit tests (they do not
touch BSC Testnet), so the suite runs offline against Postgres. The real on-chain
deploy/mint/read is exercised by the management commands against testnet (Part D).
"""
from django.test import TestCase, override_settings

from .client import deployer_address, get_deployer_account, get_web3
from .contracts import get_abi, get_bytecode, load_artifact
from .exceptions import ChainConfigError, ContractArtifactError
from .service import _token_symbol

# A fixed funded-style key (value only used to derive a deterministic address).
_TEST_KEY = "0x" + "22" * 32


class ContractArtifactTests(TestCase):
    def test_loads_factory_and_token_artifacts(self):
        for name in ("PropertyTokenFactory", "PropertyToken"):
            art = load_artifact(name)
            self.assertIn("abi", art)
            self.assertIn("bytecode", art)
            self.assertTrue(get_bytecode(name).startswith("0x"))

    def test_token_abi_exposes_required_functions(self):
        fns = {e.get("name") for e in get_abi("PropertyToken") if e.get("type") == "function"}
        for required in ("mint", "totalSupply", "maxSupply", "balanceOf", "decimals"):
            self.assertIn(required, fns)

    def test_factory_abi_exposes_deploy_function(self):
        fns = {
            e.get("name")
            for e in get_abi("PropertyTokenFactory")
            if e.get("type") == "function"
        }
        self.assertIn("deployPropertyToken", fns)
        self.assertIn("tokenForSlug", fns)

    def test_unknown_contract_raises(self):
        with self.assertRaises(ContractArtifactError):
            load_artifact("NotAContract")


class DeployerAccountTests(TestCase):
    @override_settings(DEPLOYER_PRIVATE_KEY=_TEST_KEY)
    def test_returns_account_with_stable_address(self):
        acct = get_deployer_account()
        self.assertTrue(acct.address.startswith("0x"))
        # deployer_address() returns the same public address.
        self.assertEqual(deployer_address(), acct.address)

    @override_settings(DEPLOYER_PRIVATE_KEY="")
    def test_missing_key_raises_config_error(self):
        with self.assertRaises(ChainConfigError):
            get_deployer_account()

    @override_settings(DEPLOYER_PRIVATE_KEY="0xnot-a-key")
    def test_invalid_key_raises_config_error(self):
        with self.assertRaises(ChainConfigError):
            get_deployer_account()

    @override_settings(DEPLOYER_PRIVATE_KEY=_TEST_KEY)
    def test_deployer_repr_does_not_leak_private_key(self):
        acct = get_deployer_account()
        self.assertNotIn(_TEST_KEY, repr(acct))
        self.assertNotIn(_TEST_KEY[2:], repr(acct))


class Web3ClientTests(TestCase):
    def test_get_web3_returns_instance_without_network_call(self):
        # Construction must not require a live node.
        w3 = get_web3()
        self.assertTrue(hasattr(w3, "eth"))


class SymbolDerivationTests(TestCase):
    def test_symbol_is_short_and_alnum(self):
        self.assertEqual(_token_symbol("1"), "BRX1")
        self.assertEqual(_token_symbol("p1-a"), "BRXP1A")
        self.assertLessEqual(len(_token_symbol("a-very-long-slug-name-here")), 11)


class TransferGuardTests(TestCase):
    """
    Network-free guards for the Phase 6 Wave 2 transfer capability. The real
    seller→buyer on-chain transfer is exercised by the testnet command + the manual
    cycle (Part D), exactly like mint — these only assert the non-network invariants.
    """

    def test_non_positive_amount_raises_before_any_network(self):
        from eth_account import Account

        from .service import transfer

        signer = Account.from_key("0x" + "33" * 32)  # no settings/network needed
        with self.assertRaises(ChainConfigError):
            transfer("0x" + "11" * 20, signer, "0x" + "22" * 20, 0)
        with self.assertRaises(ChainConfigError):
            transfer("0x" + "11" * 20, signer, "0x" + "22" * 20, -5)

    @override_settings(DEPLOYER_PRIVATE_KEY=_TEST_KEY)
    def test_transfer_is_exposed(self):
        from . import service

        self.assertTrue(callable(getattr(service, "transfer", None)))
        self.assertTrue(callable(getattr(service, "_fund_gas_if_needed", None)))
