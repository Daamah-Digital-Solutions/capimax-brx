"""Audit 2026-10-21 fixes: one transaction at a time per signer, emergency controls,
the admin (multisig) / hot-key split, and the on-chain forfeiture burn."""
from unittest.mock import MagicMock, patch

from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from eth_account import Account
from web3 import Web3

from . import service
from .client import admin_address
from .contracts import get_abi
from .exceptions import ChainConfigError, NonceConflictError, TokenPausedError, TransactionError

KEY = "0x" + "11" * 32
ACCOUNT = Account.from_key(KEY)
TOKEN = "0x" + "ab" * 20


class SignerLockTests(TestCase):
    def test_lock_is_taken_and_released_around_the_send(self):
        with CaptureQueriesContext(connection) as q:
            with service._signer_lock(ACCOUNT.address):
                pass
        sql = " ".join(x["sql"] for x in q.captured_queries)
        self.assertIn("pg_advisory_lock", sql)
        self.assertIn("pg_advisory_unlock", sql)

    def test_lock_is_released_even_when_the_send_fails(self):
        with CaptureQueriesContext(connection) as q:
            with self.assertRaises(RuntimeError):
                with service._signer_lock(ACCOUNT.address):
                    raise RuntimeError("boom")
        self.assertIn("pg_advisory_unlock", q.captured_queries[-1]["sql"])


class TransactRetryTests(TestCase):
    def setUp(self):
        self.nonces = iter(range(7, 20))
        p = patch.object(service, "_base_tx_params",
                         side_effect=lambda w3, acc: {"from": acc.address, "nonce": next(self.nonces)})
        p.start()
        self.addCleanup(p.stop)

    def test_retries_once_with_a_fresh_nonce(self):
        built = []

        def make(params):
            built.append(params["nonce"])
            return params

        receipt = {"status": 1}
        with patch.object(service, "_send", side_effect=[NonceConflictError("nonce too low"), receipt]):
            self.assertEqual(service._transact(MagicMock(), ACCOUNT, make), receipt)
        self.assertEqual(built, [7, 8])

    def test_gives_up_after_the_second_conflict(self):
        with patch.object(service, "_send", side_effect=NonceConflictError("nonce too low")):
            with self.assertRaises(NonceConflictError):
                service._transact(MagicMock(), ACCOUNT, lambda p: p)

    def test_other_errors_are_not_retried(self):
        with patch.object(service, "_send", side_effect=TransactionError("reverted")) as send:
            with self.assertRaises(TransactionError):
                service._transact(MagicMock(), ACCOUNT, lambda p: p)
        self.assertEqual(send.call_count, 1)

    def test_node_nonce_messages_become_nonce_conflicts(self):
        w3 = MagicMock()
        w3.eth.send_raw_transaction.side_effect = ValueError({"message": "nonce too low: next nonce 9"})
        acc = MagicMock()
        with self.assertRaises(NonceConflictError):
            service._send(w3, acc, {})
        w3.eth.send_raw_transaction.side_effect = ValueError({"message": "insufficient funds"})
        with self.assertRaises(TransactionError) as ctx:
            service._send(w3, acc, {})
        self.assertNotIsInstance(ctx.exception, NonceConflictError)


class EmergencyControlTests(TestCase):
    def setUp(self):
        for name, value in (("require_connection", MagicMock()), ("get_deployer_account", ACCOUNT)):
            p = patch.object(service, name, return_value=value)
            p.start()
            self.addCleanup(p.stop)

    def test_mint_refuses_a_paused_token(self):
        with patch.object(service, "is_paused", return_value=True), \
                patch.object(service, "_transact") as tx:
            with self.assertRaises(TokenPausedError):
                service.mint(TOKEN, ACCOUNT.address, 1)
        tx.assert_not_called()

    def test_role_actions_need_the_role_on_the_server_key(self):
        with patch.object(service, "is_paused", return_value=False), \
                patch.object(service, "has_role", return_value=False), \
                patch.object(service, "_transact") as tx:
            with self.assertRaises(ChainConfigError) as ctx:
                service.clawback(TOKEN, ACCOUNT.address, None, 3, "x")
        self.assertIn("multisig", str(ctx.exception))
        tx.assert_not_called()

    def test_older_tokens_are_reported_not_called(self):
        with patch.object(service, "is_paused", return_value=None), \
                patch.object(service, "_transact") as tx:
            with self.assertRaises(ChainConfigError) as ctx:
                service.pause(TOKEN)
        self.assertIn("predates", str(ctx.exception))
        tx.assert_not_called()

    def test_clawback_rejects_a_non_positive_amount(self):
        with self.assertRaises(ChainConfigError):
            service.clawback(TOKEN, ACCOUNT.address, None, 0, "x")


class RoleSplitTests(TestCase):
    def test_role_ids_match_the_contract(self):
        self.assertEqual(service.MINTER_ROLE, Web3.keccak(text="MINTER_ROLE"))
        self.assertEqual(service.CONTROLLER_ROLE, Web3.keccak(text="CONTROLLER_ROLE"))
        self.assertEqual(service.DEFAULT_ADMIN_ROLE, b"\x00" * 32)

    def test_abis_carry_the_new_controls(self):
        token = {f["name"] for f in get_abi("PropertyToken") if f.get("type") == "function"}
        self.assertTrue({"pause", "unpause", "paused", "clawback", "hasRole", "mint"} <= token)
        factory = get_abi("PropertyTokenFactory")
        ctor = next(f for f in factory if f["type"] == "constructor")
        self.assertEqual([i["name"] for i in ctor["inputs"]], ["owner_", "minter_", "operator_"])
        names = {f.get("name") for f in factory}
        self.assertTrue({"setOperator", "setMinter", "acceptOwnership", "deployPropertyToken"} <= names)

    @override_settings(DEPLOYER_PRIVATE_KEY=KEY, CHAIN_ADMIN_ADDRESS="")
    def test_admin_defaults_to_the_deployer_on_a_test_network(self):
        self.assertEqual(admin_address(), ACCOUNT.address)

    @override_settings(DEPLOYER_PRIVATE_KEY=KEY, CHAIN_ADMIN_ADDRESS="0x" + "cd" * 20)
    def test_admin_is_the_configured_multisig(self):
        self.assertEqual(admin_address(), Web3.to_checksum_address("0x" + "cd" * 20))

    @override_settings(DEPLOYER_PRIVATE_KEY=KEY, CHAIN_ADMIN_ADDRESS="not-an-address")
    def test_invalid_admin_is_refused(self):
        with self.assertRaises(ChainConfigError):
            admin_address()


class ForfeitBurnTests(TestCase):
    def setUp(self):
        from apps.core.models import User
        from apps.installments.tests import _make_property
        from apps.properties.models import TokenMetadata
        from apps.wallets.models import UserWallet

        self.prop = _make_property("burn-prop")
        TokenMetadata.objects.update_or_create(property=self.prop, defaults={
            "deployed_contract_address": TOKEN, "deployment_chain_id": 97,
        })
        self.prop.refresh_from_db()
        user = User.objects.create_user(email="burn@ex.com", password="pw-12345-strong")
        self.wallet = UserWallet.objects.create(user=user, wallet_address="0x" + "ef" * 20)

    @override_settings(CHAIN_ID=97, DEPLOYER_PRIVATE_KEY=KEY)
    def test_burns_when_the_server_key_is_controller(self):
        from apps.installments.services import _burn_forfeited_on_chain

        with patch.object(service, "is_paused", return_value=False), \
                patch.object(service, "has_role", return_value=True), \
                patch.object(service, "clawback") as claw:
            _burn_forfeited_on_chain(self.prop, self.wallet.pk, 40, "plan-1")
        claw.assert_called_once_with(TOKEN, self.wallet.wallet_address, None, 40, "installment-forfeit:plan-1")

    @override_settings(CHAIN_ID=97, DEPLOYER_PRIVATE_KEY=KEY)
    def test_leaves_it_to_the_multisig_otherwise(self):
        from apps.installments.services import _burn_forfeited_on_chain

        with patch.object(service, "is_paused", return_value=False), \
                patch.object(service, "has_role", return_value=False), \
                patch.object(service, "clawback") as claw, \
                self.assertLogs("apps.installments.services", level="WARNING"):
            _burn_forfeited_on_chain(self.prop, self.wallet.pk, 40, "plan-1")
        claw.assert_not_called()

    @override_settings(CHAIN_ID=56, DEPLOYER_PRIVATE_KEY=KEY)
    def test_ignores_a_token_on_another_chain(self):
        from apps.installments.services import _burn_forfeited_on_chain

        with patch.object(service, "clawback") as claw:
            _burn_forfeited_on_chain(self.prop, self.wallet.pk, 40, "plan-1")
        claw.assert_not_called()
