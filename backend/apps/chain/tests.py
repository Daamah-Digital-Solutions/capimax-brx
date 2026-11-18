"""
Chain-layer tests — Phase 3 Wave 1. These are NETWORK-FREE unit tests (they do not
touch BSC Testnet), so the suite runs offline against Postgres. The real on-chain
deploy/mint/read is exercised by the management commands against testnet (Part D).
"""
from django.test import TestCase, override_settings

from .client import deployer_address, get_deployer_account, get_web3
from .contracts import get_abi, get_bytecode, load_artifact
from .exceptions import ChainConfigError, ContractArtifactError
from . import service
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


class CrossChainRedeployTests(TestCase):
    """Mainnet cutover: a property whose contract is on BSC Testnet gets a new contract on the
    current chain; the testnet one is kept in previous_deployments. Same chain = refused."""

    def _prop(self, chain_id):
        from apps.properties.models import Property, TokenMetadata
        from apps.properties.tests import _valid_property_kwargs

        p = Property(**_valid_property_kwargs(slug=f"cutover-{chain_id}"))
        p.save()
        meta, _ = TokenMetadata.objects.get_or_create(property=p)
        meta.deployed_contract_address = "0x" + "11" * 20
        meta.deployment_chain_id = chain_id
        meta.deployment_network = "bsc-testnet"
        meta.deployment_tx = "0x" + "aa" * 32
        meta.save()
        p.refresh_from_db()
        return p

    def _factory(self, new_addr):
        from unittest import mock

        calls = {"n": 0}

        def token_for_slug(_slug):
            m = mock.Mock()
            calls["n"] += 1
            m.call.return_value = service.ZERO_ADDRESS if calls["n"] == 1 else new_addr
            return m

        f = mock.Mock()
        f.address = "0x" + "fa" * 20
        f.functions.tokenForSlug.side_effect = token_for_slug
        return f

    def test_redeploys_on_another_chain_and_keeps_the_old_one(self):
        from unittest import mock

        from django.test import override_settings

        p = self._prop(97)
        new_addr = "0x" + "22" * 20
        with override_settings(CHAIN_ID=56, WALLET_NETWORK="bsc-mainnet"), \
                mock.patch.object(service, "require_connection"), \
                mock.patch.object(service, "get_deployer_account"), \
                mock.patch.object(service, "_get_factory", return_value=self._factory(new_addr)), \
                mock.patch.object(service, "_transact", return_value={"transactionHash": b"\xbb" * 32}), \
                mock.patch.object(service, "_build"):
            service.deploy_property_token(p)
        meta = p.token_metadata
        meta.refresh_from_db()
        self.assertEqual((meta.deployed_contract_address, meta.deployment_chain_id, meta.deployment_network),
                         (new_addr, 56, "bsc-mainnet"))
        self.assertEqual(meta.previous_deployments[0]["address"], "0x" + "11" * 20)
        self.assertEqual(meta.previous_deployments[0]["chain_id"], 97)

    def test_same_chain_is_refused(self):
        from django.test import override_settings

        from apps.chain.exceptions import AlreadyDeployedError

        p = self._prop(97)
        with override_settings(CHAIN_ID=97), \
                self.assertRaises(AlreadyDeployedError):
            from unittest import mock

            with mock.patch.object(service, "require_connection"), \
                    mock.patch.object(service, "get_deployer_account"), \
                    mock.patch.object(service, "_get_factory", return_value=self._factory("0x" + "33" * 20)):
                service.deploy_property_token(p)
