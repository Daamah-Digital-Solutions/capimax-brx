"""
Tests for the `seed_demo` management command — idempotency, role activation, the
ledger-only guarantee (zero chain interaction), and clean --purge. Runs against
Postgres (capimax_brx) like the rest of the suite.
"""
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

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

    def test_on_chain_flag_is_inert(self):
        with self.assertRaises(CommandError):
            call_command("seed_demo", "--yes", "--on-chain")

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
        self.assertEqual(OwnershipToken.objects.filter(wallet__user=investor).count(), 3)
        self.assertEqual(Investment.objects.filter(user=investor).count(), 3)

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
        self.assertEqual(OwnershipToken.objects.filter(wallet__user=investor).count(), 3)
        self.assertEqual(Investment.objects.filter(user=investor).count(), 3)
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
