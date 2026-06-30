"""
Tests for the `seed_demo` management command — idempotency, role activation, the
ledger-only guarantee (zero chain interaction), and clean --purge. Runs against
Postgres (capimax_brx) like the rest of the suite.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from apps.broker.models import BrokerCommission
from apps.core.models import Profile, User
from apps.distributions.models import Distribution
from apps.investments.models import Investment
from apps.partners.models import Assignment
from apps.properties.models import Property
from apps.wallets.models import BalanceTransaction, OwnershipToken, WalletTransaction

DOMAIN = "demo.capimaxbrx.com"


class SeedDemoTests(TestCase):
    def _seed(self):
        # The role-activation + wallet-create side effects fire on transaction.on_commit;
        # execute them here so the test mirrors a real (committed) prod run.
        with self.captureOnCommitCallbacks(execute=True):
            call_command("seed_demo", "--yes")

    # --- guard ----------------------------------------------------------- #
    def test_requires_yes(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo")
        self.assertEqual(User.objects.filter(email__endswith=f"@{DOMAIN}").count(), 0)

    # --- world ----------------------------------------------------------- #
    def test_seeds_full_world(self):
        self._seed()

        # 6 demo properties, all published; exactly 2 featured; some partly funded.
        props = Property.objects.filter(slug__startswith="demo-")
        self.assertEqual(props.count(), 6)
        self.assertTrue(all(p.is_published for p in props))
        self.assertEqual(props.filter(is_featured=True).count(), 2)
        self.assertTrue(props.filter(funded__lt=100, funded__gt=0).exists())
        # token_supply auto-derived (total_value / 100).
        d1 = Property.objects.get(slug="demo-1")
        self.assertEqual(d1.token_supply, 120000)
        self.assertEqual(d1.category, "ready")
        self.assertEqual(Property.objects.get(slug="demo-4").category, "construction")

        # 7 approved users, one per role.
        self.assertEqual(User.objects.filter(email__endswith=f"@{DOMAIN}").count(), 7)
        admin = User.objects.get(email=f"admin@{DOMAIN}")
        self.assertTrue(admin.is_staff and admin.is_superuser)

        # Roles fully activated (gate = profile status == approved + role_status active).
        for local in ("owner", "developer", "lp", "partner", "broker"):
            u = User.objects.get(email=f"{local}@{DOMAIN}")
            self.assertEqual(u.profile.role_status, Profile.RoleStatus.ACTIVE, local)
        self.assertEqual(User.objects.get(email=f"lp@{DOMAIN}").liquidity_provider.status, "approved")
        self.assertEqual(User.objects.get(email=f"owner@{DOMAIN}").owner_profile.status, "approved")
        self.assertEqual(User.objects.get(email=f"developer@{DOMAIN}").developer_profile.status, "approved")
        self.assertEqual(User.objects.get(email=f"partner@{DOMAIN}").partner_profile.status, "approved")
        self.assertEqual(User.objects.get(email=f"broker@{DOMAIN}").broker_profile.status, "approved")

        # Investor: KYC approved (wallet auto-created), 3 holdings, 3 completed buys.
        investor = User.objects.get(email=f"investor@{DOMAIN}")
        self.assertEqual(investor.kyc.status, "approved")
        self.assertEqual(OwnershipToken.objects.filter(wallet__user=investor).count(), 4)
        self.assertEqual(Investment.objects.filter(user=investor).count(), 4)

        # Distribution paid on demo-1 → investor (sole holder) credited; balance > deposit.
        self.assertTrue(Distribution.objects.filter(property_id="demo-1", status="paid").exists())
        bal = investor.balance.current_balance
        self.assertGreater(bal, Decimal("25000"))

        # Owner proceeds + broker commission landed via the real ledger.
        self.assertTrue(
            BalanceTransaction.objects.filter(
                balance__user=User.objects.get(email=f"owner@{DOMAIN}"), source="primary_sale"
            ).exists()
        )
        self.assertEqual(BrokerCommission.objects.count(), 1)

        # Partner has an assignment (workflow only).
        self.assertEqual(Assignment.objects.count(), 1)

    def test_ledger_only_no_chain(self):
        """No mint occurred: no on-chain deploy recorded, no mint WalletTransaction."""
        self._seed()
        # Demo properties have no deployed contract recorded.
        from apps.properties.models import TokenMetadata
        self.assertFalse(
            TokenMetadata.objects.filter(
                property__slug__startswith="demo-"
            ).exclude(deployed_contract_address="").exists()
        )
        # The mint path writes a 'mint' WalletTransaction; ledger-only writes none.
        self.assertEqual(WalletTransaction.objects.filter(tx_type="mint").count(), 0)

    # --- idempotency ----------------------------------------------------- #
    def test_idempotent_rerun(self):
        self._seed()
        self._seed()  # second run must not duplicate anything

        self.assertEqual(User.objects.filter(email__endswith=f"@{DOMAIN}").count(), 7)
        self.assertEqual(Property.objects.filter(slug__startswith="demo-").count(), 6)
        investor = User.objects.get(email=f"investor@{DOMAIN}")
        self.assertEqual(OwnershipToken.objects.filter(wallet__user=investor).count(), 4)
        self.assertEqual(Investment.objects.filter(user=investor).count(), 4)
        self.assertEqual(Distribution.objects.filter(property_id="demo-1").count(), 1)
        self.assertEqual(BrokerCommission.objects.count(), 1)
        self.assertEqual(Assignment.objects.count(), 1)
        # The opening deposit credited exactly once.
        self.assertEqual(
            BalanceTransaction.objects.filter(
                balance__user=investor, reference="demo-seed-deposit"
            ).count(),
            1,
        )

    # --- purge ----------------------------------------------------------- #
    def test_purge_removes_everything(self):
        self._seed()
        call_command("seed_demo", "--purge", "--yes")

        self.assertEqual(User.objects.filter(email__endswith=f"@{DOMAIN}").count(), 0)
        self.assertEqual(Property.objects.filter(slug__startswith="demo-").count(), 0)
        self.assertEqual(Distribution.objects.filter(property_id__startswith="demo-").count(), 0)
        # User-cascade cleared the investor's holdings + ledger.
        self.assertEqual(OwnershipToken.objects.count(), 0)
        self.assertEqual(Investment.objects.count(), 0)
        self.assertEqual(BrokerCommission.objects.count(), 0)
        self.assertEqual(Assignment.objects.count(), 0)


class SeedDemoOnChainTests(TestCase):
    """The --on-chain path, with the chain mocked: deploy + mint happen for exactly the
    two ON_CHAIN_SLUGS, once, with a balance pre-check, and never re-run on a second pass."""

    def _wire(self, m_deploy, m_mint, m_conn, *, balance="0.298"):
        from apps.properties.models import TokenMetadata

        def fake_deploy(prop):
            meta, _ = TokenMetadata.objects.get_or_create(property=prop)
            meta.deployed_contract_address = "0xC0FFEE" + prop.slug.replace("-", "")
            meta.deployment_chain_id = int(settings.CHAIN_ID)
            meta.deployment_tx = "0xdeploy"
            meta.deployed_at = timezone.now()
            meta.save()
            return {"token_address": meta.deployed_contract_address}

        m_deploy.side_effect = fake_deploy
        m_mint.return_value = {
            "tx_hash": "0xmint", "block_number": 1, "chain_id": int(settings.CHAIN_ID),
        }
        w3 = MagicMock()
        w3.eth.get_balance.return_value = int(Decimal(balance) * (10 ** 18))
        m_conn.return_value = w3

    def _run(self):
        with self.captureOnCommitCallbacks(execute=True):
            call_command("seed_demo", "--yes", "--on-chain")

    @patch("apps.chain.service.deployed_token_address", return_value=None)
    @patch("apps.chain.client.deployer_address", return_value="0xDEPLOYER")
    @patch("apps.chain.client.require_connection")
    @patch("apps.chain.service.mint")
    @patch("apps.chain.service.deploy_property_token")
    def test_deploys_and_mints_only_on_chain_slugs(self, m_deploy, m_mint, m_conn, m_addr, m_factory):
        self._wire(m_deploy, m_mint, m_conn)
        self._run()

        # Pre-flight checked the balance; deploy + mint each ran once per ON_CHAIN_SLUG.
        m_conn.return_value.eth.get_balance.assert_called()
        self.assertEqual(m_deploy.call_count, 2)
        self.assertEqual(m_mint.call_count, 2)

        # Exactly the 2 on-chain properties got a contract; the other 4 did not.
        from apps.properties.models import TokenMetadata
        self.assertEqual(
            TokenMetadata.objects.filter(property__slug__startswith="demo-")
            .exclude(deployed_contract_address="").count(),
            2,
        )
        # 4 holdings total: demo-3 + demo-5 minted on-chain, demo-1 + demo-2 ledger-only.
        investor = User.objects.get(email=f"investor@{DOMAIN}")
        self.assertEqual(OwnershipToken.objects.filter(wallet__user=investor).count(), 4)
        # The mint path wrote a real 'mint' WalletTransaction for each of the 2.
        self.assertEqual(WalletTransaction.objects.filter(tx_type="mint").count(), 2)

    @patch("apps.chain.service.deployed_token_address", return_value=None)
    @patch("apps.chain.client.deployer_address", return_value="0xDEPLOYER")
    @patch("apps.chain.client.require_connection")
    @patch("apps.chain.service.mint")
    @patch("apps.chain.service.deploy_property_token")
    def test_idempotent_no_redeploy_no_remint(self, m_deploy, m_mint, m_conn, m_addr, m_factory):
        self._wire(m_deploy, m_mint, m_conn)
        self._run()
        self._run()  # second pass must not touch the chain again

        # skip-if-deployed: deploy not called a 3rd/4th time. skip-if-minted: mint guard
        # short-circuits before any new chain call.
        self.assertEqual(m_deploy.call_count, 2)
        self.assertEqual(m_mint.call_count, 2)
        investor = User.objects.get(email=f"investor@{DOMAIN}")
        self.assertEqual(OwnershipToken.objects.filter(wallet__user=investor).count(), 4)
        self.assertEqual(WalletTransaction.objects.filter(tx_type="mint").count(), 2)
        self.assertEqual(Investment.objects.filter(user=investor).count(), 4)

    @patch("apps.chain.service.deployed_token_address", return_value=None)
    @patch("apps.chain.client.deployer_address", return_value="0xDEPLOYER")
    @patch("apps.chain.client.require_connection")
    @patch("apps.chain.service.mint")
    @patch("apps.chain.service.deploy_property_token")
    def test_preflight_aborts_below_floor(self, m_deploy, m_mint, m_conn, m_addr, m_factory):
        self._wire(m_deploy, m_mint, m_conn, balance="0.001")  # below the 0.02 floor
        with self.assertRaises(CommandError):
            self._run()
        # Aborted before any deploy/mint.
        self.assertEqual(m_deploy.call_count, 0)
        self.assertEqual(m_mint.call_count, 0)
