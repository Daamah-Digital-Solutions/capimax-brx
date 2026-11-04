"""sync_onchain_holdings: ledger-only holdings of a newly deployed property are minted once."""
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from apps.lp.tests import _deployed_property, _seller_with_tokens
from apps.wallets.models import WalletTransaction


class SyncOnchainHoldingsTests(TestCase):
    def setUp(self):
        self.prop = _deployed_property("sync-1")
        self.a, self.wa = _seller_with_tokens("sync-a@ex.com", self.prop, 7)
        self.b, self.wb = _seller_with_tokens("sync-b@ex.com", self.prop, 3)
        self.chain = {}  # wallet address -> on-chain balance

        def mint(_token, to, amount):
            self.chain[to] = self.chain.get(to, 0) + amount
            return {"tx_hash": "0x" + "cd" * 32, "block_number": 9, "chain_id": 97}

        patches = {
            "read_balance": mock.patch("apps.chain.service.read_balance",
                                       side_effect=lambda _t, who: self.chain.get(who, 0)),
            "read_total_supply": mock.patch("apps.chain.service.read_total_supply",
                                            side_effect=lambda _t: sum(self.chain.values())),
            "read_max_supply": mock.patch("apps.chain.service.read_max_supply", return_value=50000),
            "mint": mock.patch("apps.chain.service.mint", side_effect=mint),
        }
        self.m = {k: p.start() for k, p in patches.items()}
        for p in patches.values():
            self.addCleanup(p.stop)

    def _run(self, *args):
        out = StringIO()
        call_command("sync_onchain_holdings", "--slug", self.prop.slug, *args, stdout=out)
        return out.getvalue()

    def test_dry_run_writes_nothing(self):
        out = self._run()
        self.assertIn("to mint 10 units to 2 wallets", out)
        self.m["mint"].assert_not_called()

    def test_apply_mints_the_missing_units_once(self):
        self.chain[self.wb.wallet_address] = 1  # one unit already there
        self._run("--apply")
        self.assertEqual(self.chain[self.wa.wallet_address], 7)
        self.assertEqual(self.chain[self.wb.wallet_address], 3)
        self.assertEqual(WalletTransaction.objects.filter(tx_type="mint").count(), 2)
        self.assertIn("to mint 0 units", self._run("--apply"))  # idempotent
        self.assertEqual(self.m["mint"].call_count, 2)

    def test_never_past_the_cap(self):
        self.m["read_max_supply"].return_value = 5
        out = StringIO()
        with self.assertRaises(Exception):
            call_command("sync_onchain_holdings", "--slug", self.prop.slug, "--apply", stdout=out)
        self.m["mint"].assert_not_called()
