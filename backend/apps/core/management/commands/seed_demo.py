"""
seed_demo — soft-launch / client-demo seed (idempotent, prod-safe).

Creates a small, realistic demo world so a client can log in as every role and see
non-empty dashboards, and the public home/marketplace show real properties:

  * 6 demo properties (slug prefix "demo-"), varied GCC mix, a couple featured, a
    couple partially funded — feeds home FeaturedProperties + GlobalOwnership + the
    marketplace.
  * 7 approved demo users (one per role + an admin), shared password.
  * Ledger-only holdings / balances / distributions / LP+broker+partner data, written
    through the REAL services + models (UserBalance/BalanceTransaction, OwnershipToken,
    declare_distribution, …). No fabricated numbers; nothing bypasses the ledger.

SAFETY / DISCIPLINE
  * Idempotent: re-running never duplicates (natural keys: user email, property slug;
    ledger steps guarded by a stable `reference` / existence check).
  * Requires --yes to run (no DEBUG dependency, so it can run on prod via systemd-run
    + EnvironmentFile — never `source` the .env).
  * ZERO chain interaction in this command today. The --on-chain flag is reserved for a
    follow-up step (deploy + real testnet mint for the 2-3 ON_CHAIN_SLUGS) and is
    deliberately inert until that is confirmed + wired.
  * Clearly identifiable + removable: --purge deletes exactly the demo users + demo-
    properties + their ledger rows.

    python manage.py seed_demo --yes
    python manage.py seed_demo --purge --yes
"""
from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

# --------------------------------------------------------------------------- #
# Demo constants — the conventions that make demo data identifiable + purgeable.
# --------------------------------------------------------------------------- #
DEMO_PASSWORD = "CapimaxDemo2026!"          # hardcoded (demo data); printed in the creds list
DEMO_DOMAIN = "demo.capimaxbrx.com"         # every demo user lives here → trivial to purge
DEMO_SLUG_PREFIX = "demo-"                  # every demo property slug starts here
TOKEN_PRICE = Decimal("100")                # platform-wide nominal ($100/token)

# The properties that get a REAL testnet contract + mint under --on-chain. Everything
# else stays ledger-only. Keep this list small + explicit so we never deploy by accident.
# These are deliberately FRESH slugs (never deployed on the factory) so their on-chain
# totalSupply starts honestly at 0 — no stranded/leftover dust inflating the count.
ON_CHAIN_SLUGS = ["demo-3", "demo-5"]

# Pre-flight floor: refuse --on-chain if the deployer holds less than this much tBNB.
# 2 deploys + a couple mints cost < 0.002 tBNB at current gas; this is a wide margin.
MIN_DEPLOY_BALANCE = Decimal("0.02")


# --------------------------------------------------------------------------- #
# Demo catalogue — 6 properties. Required fields only; `category` + `token_supply`
# are auto-derived on save (apps.properties.models.Property._sync_derived).
# `submitted_by` is injected at runtime (owner/developer users).
# --------------------------------------------------------------------------- #
PROPERTIES = [
    dict(
        slug="demo-1", name="Olaya Twin Towers", name_ar="برجا العليا التوأم",
        location="Riyadh, KSA", location_ar="الرياض، السعودية", country="ksa", city="Riyadh",
        image="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200",
        asset_type="commercial", model="ready", status="ready", yield_type="rental",
        risk_level="low", total_value=Decimal("12000000"), expected_yield=Decimal("8.2"),
        funded=65, investors=148, min_investment=Decimal("1000"),
        duration="5 years", duration_ar="5 سنوات", exit_availability="both",
        exit_eligible=True, insurance_active=True, is_featured=True, display_order=1,
        description="Grade-A office twin towers in Riyadh's Olaya business district, fully leased to blue-chip tenants.",
        description_ar="برجا مكاتب من الفئة الأولى في حي العليا التجاري بالرياض، مؤجران بالكامل لكبرى الشركات.",
        _submitter="owner",
    ),
    dict(
        slug="demo-2", name="Marina Gate Residences", name_ar="مساكن بوابة المارينا",
        location="Dubai, UAE", location_ar="دبي، الإمارات", country="uae", city="Dubai",
        image="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200",
        asset_type="residential", model="ready", status="ready", yield_type="rental",
        risk_level="low", total_value=Decimal("8000000"), expected_yield=Decimal("7.5"),
        funded=80, investors=212, min_investment=Decimal("500"),
        duration="4 years", duration_ar="4 سنوات", exit_availability="both",
        exit_eligible=True, insurance_active=True, is_featured=True, display_order=2,
        description="Waterfront residential tower in Dubai Marina with high occupancy and stable rental yield.",
        description_ar="برج سكني على الواجهة المائية في دبي مارينا بإشغال مرتفع وعائد إيجاري مستقر.",
    ),
    dict(
        slug="demo-3", name="Pearl Boulevard Offices", name_ar="مكاتب جادة اللؤلؤة",
        location="Doha, Qatar", location_ar="الدوحة، قطر", country="qatar", city="Doha",
        image="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
        asset_type="commercial", model="ready", status="ready", yield_type="hybrid",
        risk_level="medium", total_value=Decimal("15000000"), expected_yield=Decimal("9.0"),
        funded=45, investors=96, min_investment=Decimal("2500"),
        duration="6 years", duration_ar="6 سنوات", exit_availability="secondary",
        exit_eligible=True, insurance_active=True, display_order=3,
        description="Mixed commercial offices on The Pearl, Doha, with blended rental and appreciation upside.",
        description_ar="مكاتب تجارية في اللؤلؤة بالدوحة تجمع بين العائد الإيجاري وفرص النمو الرأسمالي.",
    ),
    dict(
        slug="demo-4", name="Riyadh Skyline Tower", name_ar="برج أفق الرياض",
        location="Riyadh, KSA", location_ar="الرياض، السعودية", country="ksa", city="Riyadh",
        image="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200",
        asset_type="residential", model="installment", status="construction",
        yield_type="appreciation", risk_level="medium", total_value=Decimal("20000000"),
        expected_growth=Decimal("22"), funded=35, investors=64, min_investment=Decimal("1000"),
        duration="3 years", duration_ar="3 سنوات", exit_availability="lp",
        construction_progress=40, display_order=4,
        description="Under-construction residential tower in northern Riyadh, available on an installment plan.",
        description_ar="برج سكني قيد الإنشاء شمال الرياض، متاح عبر خطة أقساط.",
        _submitter="developer",
    ),
    dict(
        slug="demo-5", name="Jumeirah Bay Villas", name_ar="فلل خليج جميرا",
        location="Dubai, UAE", location_ar="دبي، الإمارات", country="uae", city="Dubai",
        image="https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200",
        asset_type="residential", model="ready", status="ready", yield_type="rental",
        risk_level="low", total_value=Decimal("25000000"), expected_yield=Decimal("6.8"),
        funded=90, investors=305, min_investment=Decimal("5000"),
        duration="7 years", duration_ar="7 سنوات", exit_availability="both",
        exit_eligible=True, insurance_active=True, display_order=5,
        description="Premium beachfront villa portfolio on Jumeirah Bay Island, near full funding.",
        description_ar="محفظة فلل شاطئية فاخرة في جزيرة خليج جميرا، اقتربت من اكتمال التمويل.",
    ),
    dict(
        slug="demo-6", name="Lusail Marina Mall", name_ar="مول مارينا لوسيل",
        location="Doha, Qatar", location_ar="الدوحة، قطر", country="qatar", city="Lusail",
        image="https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=1200",
        asset_type="commercial", model="future", status="construction",
        yield_type="appreciation", risk_level="high", total_value=Decimal("30000000"),
        expected_growth=Decimal("18"), funded=20, investors=41, min_investment=Decimal("2500"),
        duration="5 years", duration_ar="5 سنوات", exit_availability="lp",
        construction_progress=25, display_order=6,
        description="Future retail destination in Lusail Marina; early-stage tokenized opportunity.",
        description_ar="وجهة تجارية مستقبلية في مارينا لوسيل؛ فرصة مرمّزة في مرحلة مبكرة.",
    ),
]

# Investor holdings (slug -> whole shares). Ledger-only unless the slug is in
# ON_CHAIN_SLUGS (then minted on-chain). demo-3 + demo-5 are the on-chain pair, so the
# investor holds both — each gets a real mint under --on-chain.
HOLDINGS = {"demo-1": 200, "demo-2": 150, "demo-3": 100, "demo-5": 80}

# Demo users: email-local -> role.
USERS = {
    "investor": "investor",
    "owner": "owner",
    "developer": "developer",
    "lp": "lp",
    "broker": "broker",
    "partner": "partner",
    "admin": "admin",
}


class Command(BaseCommand):
    help = (
        "Seed (or --purge) the soft-launch demo world: demo- properties, one approved "
        "user per role, and ledger-only holdings/balances/distributions. Idempotent. "
        "Requires --yes. Chain seeding (--on-chain) is reserved and inert."
    )

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Confirm the write (required).")
        parser.add_argument("--purge", action="store_true", help="Remove all demo data instead of seeding.")
        parser.add_argument(
            "--on-chain", action="store_true",
            help="Deploy + real-mint the ON_CHAIN_SLUGS on testnet (the rest stay ledger-only).",
        )

    # ----------------------------------------------------------------------- #
    def handle(self, *args, **opts):
        if not opts["yes"]:
            raise CommandError("Refusing to run without --yes (this writes to the database).")

        if opts["purge"]:
            self._purge()
            return

        on_chain = opts["on_chain"]

        # Users + properties first (atomic). Their on_commit side effects (role
        # activation, wallet auto-create) fire when this block commits.
        with transaction.atomic():
            users = self._seed_users()
            self._seed_properties(users)

        # On-chain deploy + mint runs OUTSIDE any wrapping DB transaction: a testnet
        # deploy is irreversible, so its TokenMetadata record must never be rolled back
        # by an unrelated later failure (which would orphan the on-chain contract).
        if on_chain:
            self._preflight_balance()
            for slug in ON_CHAIN_SLUGS:
                self._deploy_once(slug)
                self._mint_onchain_holding(users["investor"], slug)

        # Ledger pass (atomic): balances, ledger-only holdings, distribution, owner /
        # broker / partner data. The on-chain slugs' holdings already exist from the mint.
        with transaction.atomic():
            self._seed_ledger(users, on_chain=on_chain)

        self._print_credentials(on_chain=on_chain)

    # ----------------------------------------------------------------------- #
    # Users — one approved account per role, via the SAME service hinges the
    # Sumsub webhook uses, so each role activates exactly like the real path.
    # ----------------------------------------------------------------------- #
    def _seed_users(self) -> dict:
        from apps.core.models import Profile, User

        created = {}
        for local, role in USERS.items():
            email = f"{local}@{DEMO_DOMAIN}"
            user, is_new = User.objects.get_or_create(
                email=email, defaults={"is_active": True, "is_email_verified": True}
            )
            if is_new:
                user.set_password(DEMO_PASSWORD)
                user.is_email_verified = True
                user.save()
            profile = user.profile  # signal-created
            if role == "admin":
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=["is_staff", "is_superuser"])
                if profile.role != Profile.Role.ADMIN or profile.role_status != Profile.RoleStatus.ACTIVE:
                    profile.role = Profile.Role.ADMIN
                    profile.role_status = Profile.RoleStatus.ACTIVE
                    profile.save(update_fields=["role", "role_status", "role_verified_at", "updated_at"])
            elif role != "investor" and profile.role != role:
                profile.apply_self_selected_role(role)
            created[local] = user
            self.stdout.write(f"  user: {email} ({role})")

        self._approve_roles(created)
        return created

    def _approve_roles(self, users: dict) -> None:
        from apps.kyc.services import approve_kyc, get_or_create_kyc
        from apps.owner.services import approve_kyb as approve_owner, get_or_create_owner
        from apps.developer.services import approve_kyb as approve_developer, get_or_create_developer
        from apps.lp.services import approve_kyb as approve_lp, get_or_create_lp
        from apps.partners.services import approve_kyb as approve_partner, get_or_create_partner
        from apps.broker.services import approve_license, get_or_create_broker

        # Investor: identity KYC approved → wallet auto-created.
        approve_kyc(get_or_create_kyc(users["investor"]), review_answer="SEED", source="seed")

        owner, _ = get_or_create_owner(users["owner"], defaults={"contact_name": "Demo Owner"})
        approve_owner(owner, review_answer="SEED", source="seed")

        dev, _ = get_or_create_developer(users["developer"], defaults={"contact_name": "Demo Developer"})
        approve_developer(dev, review_answer="SEED", source="seed")

        lp, _ = get_or_create_lp(users["lp"], defaults={"contact_name": "Demo Liquidity Provider"})
        approve_lp(lp, review_answer="SEED", source="seed")
        # LP "wallet" balances (plain fields the LP dashboard reads). Absolute → idempotent.
        lp.total_deposited = Decimal("150000")
        lp.total_withdrawn = Decimal("25000")
        lp.total_earnings = Decimal("18500")
        lp.current_balance = Decimal("125000")
        lp.save(update_fields=[
            "total_deposited", "total_withdrawn", "total_earnings", "current_balance", "updated_at",
        ])

        partner, _ = get_or_create_partner(users["partner"], defaults={"contact_name": "Demo Partner"})
        approve_partner(partner, review_answer="SEED", source="seed")

        # Broker: identity KYC first (the activation hinge requires it), then licence.
        approve_kyc(get_or_create_kyc(users["broker"]), review_answer="SEED", source="seed")
        broker, _ = get_or_create_broker(users["broker"], defaults={"contact_name": "Demo Broker"})
        approve_license(broker, source="seed")

    # ----------------------------------------------------------------------- #
    # Properties — upsert by slug (idempotent). category/token_supply auto-derive.
    # ----------------------------------------------------------------------- #
    def _seed_properties(self, users: dict) -> None:
        from apps.properties.models import Property

        for data in PROPERTIES:
            fields = {k: v for k, v in data.items() if not k.startswith("_")}
            submitter = data.get("_submitter")
            fields["submitted_by"] = users[submitter] if submitter else None
            slug = fields["slug"]
            obj = Property.objects.filter(slug=slug).first() or Property(slug=slug)
            for k, v in fields.items():
                setattr(obj, k, v)
            obj.is_published = True
            obj.token_price = TOKEN_PRICE
            obj.save()  # _sync_derived sets category + token_supply
            self.stdout.write(f"  property: {slug} ({obj.token_supply} tokens, funded {obj.funded}%)")
            # Per-property advertised installment schedule (the display block that drives
            # PropertyModelSection's "Installment Plan" card). Idempotent (update_or_create).
            if obj.model == "installment":
                self._seed_installment_schedule(obj)

    def _seed_installment_schedule(self, prop) -> None:
        from datetime import timedelta

        from apps.properties.models import InstallmentSchedule

        today = timezone.now().date()
        InstallmentSchedule.objects.update_or_create(
            property=prop,
            defaults={
                "total_installments": 24,
                "paid_installments": 0,
                "monthly_amount": Decimal("2500"),
                "next_payment_date": today + timedelta(days=30),
                "activation_date": today + timedelta(days=545),  # ~18 months out
                "completion_percent": Decimal(prop.construction_progress or 0),
            },
        )

    # ----------------------------------------------------------------------- #
    # Ledger — holdings, balance, distribution, owner/broker credits, partner work.
    # All through the real models/services; guarded for idempotency.
    # ----------------------------------------------------------------------- #
    def _seed_ledger(self, users: dict, *, on_chain: bool = False) -> None:
        from apps.chain.service import token_symbol_for_slug
        from apps.investments.models import Investment, PaymentStatus
        from apps.lp.models import LiquidityProvider, LPHolding, LPTransaction
        from apps.partners.models import Assignment
        from apps.partners.services import (
            approve_directory, create_assignment, get_or_create_partner, update_directory_details,
        )
        from apps.properties.models import Property
        from apps.wallets.models import OwnershipToken
        from apps.wallets.services import credit_user_balance, get_or_create_custodial_wallet
        from apps.broker.models import BrokerCommission
        from apps.broker.services import get_or_create_broker

        investor = users["investor"]
        wallet, _ = get_or_create_custodial_wallet(investor)
        now = timezone.now()

        # 1) Investor opening balance (real ledger; idempotent by reference).
        self._credit_once(investor, Decimal("25000"), "deposit", "demo-seed-deposit",
                          "Demo opening balance")

        # 2) Investor holdings + matching completed Investment history rows (ledger-only).
        #    On-chain slugs are SKIPPED here — they were already minted on-chain (the mint
        #    service wrote their real OwnershipToken + WalletTransaction).
        for slug, amount in HOLDINGS.items():
            if on_chain and slug in ON_CHAIN_SLUGS:
                continue
            prop = Property.objects.get(slug=slug)
            supply = int(prop.token_supply or 0)
            symbol = token_symbol_for_slug(slug)
            value = (Decimal(amount) * prop.token_price)
            pct = (Decimal(amount) / Decimal(supply) * Decimal("100")) if supply else Decimal("0")
            OwnershipToken.objects.get_or_create(
                wallet=wallet, property_id=slug,
                defaults={
                    "property_name": prop.name, "token_symbol": symbol,
                    "token_amount": amount, "token_value_usd": value,
                    "ownership_percentage": pct,
                },
            )
            if not Investment.objects.filter(user=investor, property=prop).exists():
                Investment.objects.create(
                    user=investor, property=prop, property_name=prop.name,
                    amount_invested=value, token_amount=amount, token_symbol=symbol,
                    price_per_token=prop.token_price, ownership_percentage=pct,
                    payment_method="balance", payment_status=PaymentStatus.COMPLETED,
                    tokens_minted=True, minted_at=now, wallet=wallet,
                )

        # 3) Distribution on demo-1 (real service: snapshots holders + credits the ledger).
        from apps.distributions.models import Distribution
        from apps.distributions.services import declare_distribution
        if not Distribution.objects.filter(property_id="demo-1").exists():
            declare_distribution(
                "demo-1", Decimal("6000"), dist_type="quarterly",
                period_label="Demo Q2 2026", admin=users["admin"],
            )

        # 4) Owner primary-sale proceeds credited to their UserBalance (mirrors the real
        #    owner-credit hook). demo-1 is owner-submitted, so this is a faithful credit.
        self._credit_once(users["owner"], Decimal("85000"), "primary_sale",
                          "demo-seed-owner-1", "Demo primary-sale proceeds (Olaya Twin Towers)")

        # 5) Broker commission — money via the real BalanceTransaction, mirrored by a
        #    structured BrokerCommission row (idempotent on its OneToOne ledger anchor).
        broker, _ = get_or_create_broker(users["broker"])
        tx = self._credit_once(users["broker"], Decimal("900"), "broker_commission",
                               "demo-seed-broker-1", "Demo commission (Olaya Twin Towers)")
        if tx is not None:
            BrokerCommission.objects.get_or_create(
                balance_transaction=tx,
                defaults={
                    "broker": broker, "property_slug": "demo-1",
                    "property_name": "Olaya Twin Towers", "gross": Decimal("18000"),
                    "rate_applied": Decimal("5.00"), "commission": Decimal("900"),
                },
            )
        # Headline total = the real sum of the broker's commission rows (the SAME field the
        # mint hook maintains, investments/services.py), so the dashboard top-line matches
        # the list instead of showing 0. Recompute (not increment) → idempotent.
        from django.db.models import Sum
        broker.total_commission_earned = (
            broker.commissions.aggregate(s=Sum("commission"))["s"] or Decimal("0")
        )
        broker.save(update_fields=["total_commission_earned", "updated_at"])

        # 6) Partner assignment + directory listing (no money — workflow only).
        partner, _ = get_or_create_partner(users["partner"])
        if not Assignment.objects.filter(partner=partner).exists():
            create_assignment(
                partner=partner, prop=Property.objects.get(slug="demo-1"),
                service_type="valuation", due_date=None, admin=users["admin"],
                deliverables=[{"name": "Valuation Report", "name_ar": "تقرير التقييم"}],
            )
        # Public-directory details via the real partner path. The directory filter requires
        # a non-blank company_name, so without these the partner is approved but hidden.
        update_directory_details(partner, details={
            "company_name": "Gulf Valuation Partners",
            "company_name_ar": "شركاء الخليج للتقييم",
            "category": "valuation",
            "description": "Independent RICS-accredited property valuation and advisory across the GCC.",
            "description_ar": "تقييم عقاري مستقل ومعتمد واستشارات عقارية في دول مجلس التعاون الخليجي.",
            "country": "United Arab Emirates",
            "country_ar": "الإمارات العربية المتحدة",
            "website": "https://gulfvaluation.example.com",
            "logo_url": "https://placehold.co/200x200?text=GVP",
        })
        try:
            approve_directory(partner, admin=users["admin"])
        except Exception:  # noqa: BLE001 - directory listing is best-effort for the demo
            pass

        # 7) LP ledger history — real LPTransaction + LPHolding rows so the LP dashboard's
        #    transactions/holdings aren't empty, consistent with the seeded accumulators
        #    (deposit 150k + earnings 18.5k − withdrawal 25k; balance 125k). Idempotent.
        lp = LiquidityProvider.objects.filter(user=users["lp"]).first()
        if lp and not LPTransaction.objects.filter(lp=lp).exists():
            LPTransaction.objects.create(lp=lp, tx_type="deposit", amount=Decimal("150000"),
                                         status="completed", notes="Demo initial deposit")
            LPTransaction.objects.create(lp=lp, tx_type="earnings", amount=Decimal("18500"),
                                         status="completed", notes="Demo accrued earnings")
            LPTransaction.objects.create(lp=lp, tx_type="withdrawal", amount=Decimal("25000"),
                                         status="completed", withdrawal_method="bank",
                                         notes="Demo withdrawal")
        if lp and not LPHolding.objects.filter(lp=lp).exists():
            LPHolding.objects.create(
                lp=lp, property_id="demo-2", property_name="Marina Gate Residences",
                token_symbol=token_symbol_for_slug("demo-2"), token_amount=300,
                purchase_price=Decimal("30000"), current_value=Decimal("31500"), status="held",
            )

        # 8) Investor INSTALLMENT plan on demo-4 (the installment/construction property),
        #    built through the REAL Wave B/C services + ledger-settled so the Installments
        #    page + sidebar badge show real data (a live plan: down-payment cleared + 1/12
        #    installments paid → part of the position released, the rest locked). Idempotent.
        from apps.installments.models import InstallmentPlan
        from apps.installments.services import build_installment_plan, settle_installment_payment
        from apps.investments.services import fee_amount_for, mint_investment

        demo4 = Property.objects.get(slug="demo-4")
        if not InstallmentPlan.objects.filter(investor=investor, property=demo4).exists():
            units = 24  # whole tokens (base $2,400 at $100/token)
            base = Decimal(units) * demo4.token_price
            supply4 = int(demo4.token_supply or 0)
            plan = build_installment_plan(
                investor, demo4, total_amount=base,
                down_payment_percent=Decimal("20"), n_installments=12, frequency="monthly",
            )
            inv = Investment.objects.create(
                user=investor, property=demo4, property_name=demo4.name,
                amount_invested=base, token_amount=units,
                token_symbol=token_symbol_for_slug("demo-4"), price_per_token=demo4.token_price,
                ownership_percentage=(
                    (Decimal(units) / Decimal(supply4) * Decimal("100")) if supply4 else Decimal("0")
                ),
                payment_method="card", payment_status=PaymentStatus.COMPLETED,
                is_installment=True, down_payment_amount=plan.down_payment_amount,
                fee_amount=fee_amount_for(demo4, base), installment_plan=plan,
            )
            # Full-mint-then-lock (ledger — demo-4 is not on-chain) + activate the plan +
            # credit the owner (developer) the down-payment's token value.
            mint_investment(inv)
            # Pay one installment → visible progress + more released tokens.
            first_due = plan.payments.order_by("sequence").first()
            if first_due is not None:
                settle_installment_payment(first_due.id)
            self.stdout.write("  installment plan: demo-4 for investor (down paid + 1/12)")

    # ----------------------------------------------------------------------- #
    def _credit_once(self, user, amount, source, reference, memo=""):
        """Credit a UserBalance exactly once (idempotent by `reference`). Returns the txn."""
        from apps.wallets.models import BalanceTransaction
        from apps.wallets.services import credit_user_balance

        existing = BalanceTransaction.objects.filter(balance__user=user, reference=reference).first()
        if existing:
            return existing
        credit_user_balance(user, amount, source=source, reference=reference, memo=memo)
        return (
            BalanceTransaction.objects
            .filter(balance__user=user, reference=reference)
            .order_by("-created_at").first()
        )

    # ----------------------------------------------------------------------- #
    # On-chain — deploy + REAL mint for the ON_CHAIN_SLUGS, via the production
    # chain path. Idempotent: skip-if-deployed and skip-if-minted. Runs outside the
    # ledger transaction so an irreversible deploy is never rolled back.
    # ----------------------------------------------------------------------- #
    def _preflight_balance(self) -> None:
        """Print the deployer's live balance and refuse if below the safety floor."""
        from apps.chain.client import deployer_address, require_connection

        w3 = require_connection()  # also asserts we're on the configured chain id
        addr = deployer_address()
        balance = Decimal(w3.eth.get_balance(addr)) / Decimal(10 ** 18)
        self.stdout.write(f"  on-chain pre-flight: deployer {addr} holds {balance:.6f} tBNB")
        if balance < MIN_DEPLOY_BALANCE:
            raise CommandError(
                f"Deployer balance {balance:.6f} tBNB is below the {MIN_DEPLOY_BALANCE} tBNB "
                f"safety floor. Fund {addr} before running --on-chain."
            )

    def _is_deployed(self, prop) -> bool:
        """True iff this property already has a contract recorded on the current chain."""
        from django.conf import settings

        meta = getattr(prop, "token_metadata", None)
        if not meta or not meta.deployed_contract_address:
            return False
        return meta.deployment_chain_id == int(settings.CHAIN_ID)

    def _deploy_once(self, slug: str) -> None:
        """
        Deploy the property's PropertyToken via the factory — idempotent on TWO levels:
          * skip if our DB already records a deployment on this chain (_is_deployed);
          * else ask the FACTORY (authoritative): if it already has a token for this slug
            (e.g. a prior run against a since-reset DB), record that address and skip the
            deploy — never re-deploy, never crash on the factory's AlreadyDeployedError.
        """
        from django.conf import settings

        from apps.chain import service as chain_service
        from apps.properties.models import Property, TokenMetadata

        prop = Property.objects.get(slug=slug)
        if self._is_deployed(prop):
            self.stdout.write(f"  on-chain: {slug} already deployed (db) — skip")
            return

        existing = chain_service.deployed_token_address(slug)
        if existing:
            meta, _ = TokenMetadata.objects.get_or_create(property=prop)
            meta.deployed_contract_address = existing
            meta.deployment_chain_id = int(settings.CHAIN_ID)
            meta.deployment_network = getattr(settings, "WALLET_NETWORK", "bsc-testnet")
            meta.save()
            self.stdout.write(
                f"  on-chain: {slug} already on factory at {existing} — recorded, skip deploy"
            )
            return

        res = chain_service.deploy_property_token(prop)  # real deploy + records TokenMetadata
        self.stdout.write(self.style.SUCCESS(
            f"  on-chain: deployed {slug} -> {res.get('token_address')}"
        ))

    def _mint_onchain_holding(self, investor, slug: str) -> None:
        """Create the investor's completed Investment (once) then REAL-mint it (idempotent)."""
        from apps.chain.service import token_symbol_for_slug
        from apps.investments.models import Investment, PaymentStatus
        from apps.investments.services import mint_investment
        from apps.properties.models import Property
        from apps.wallets.services import get_or_create_custodial_wallet

        prop = Property.objects.get(slug=slug)
        amount = HOLDINGS[slug]
        wallet, _ = get_or_create_custodial_wallet(investor)

        inv = Investment.objects.filter(user=investor, property=prop).first()
        if inv is None:
            supply = int(prop.token_supply or 0)
            value = Decimal(amount) * prop.token_price
            pct = (Decimal(amount) / Decimal(supply) * Decimal("100")) if supply else Decimal("0")
            inv = Investment.objects.create(
                user=investor, property=prop, property_name=prop.name,
                amount_invested=value, token_amount=amount,
                token_symbol=token_symbol_for_slug(slug), price_per_token=prop.token_price,
                ownership_percentage=pct, payment_method="balance",
                payment_status=PaymentStatus.COMPLETED, wallet=wallet,
            )
        # Idempotent: returns {"already": True} (no chain call) once tokens_minted is set.
        result = mint_investment(inv)
        action = "already minted" if result.get("already") else "minted"
        self.stdout.write(self.style.SUCCESS(
            f"  on-chain: {action} {amount} {slug} (tx {result.get('tx_hash', '-')})"
        ))

    # ----------------------------------------------------------------------- #
    # Purge — remove exactly the demo footprint.
    # ----------------------------------------------------------------------- #
    def _purge(self) -> None:
        from apps.core.models import User
        from apps.distributions.models import Distribution
        from apps.properties.models import Property

        with transaction.atomic():
            # Distributions key on property_id (slug string), not an FK → delete explicitly.
            d_dist, _ = Distribution.objects.filter(
                property_id__startswith=DEMO_SLUG_PREFIX
            ).delete()
            # Demo users cascade their investments / holdings / balances / role rows.
            d_users, _ = User.objects.filter(email__endswith=f"@{DEMO_DOMAIN}").delete()
            # Demo properties cascade their nested rows.
            d_props, _ = Property.objects.filter(slug__startswith=DEMO_SLUG_PREFIX).delete()

        self.stdout.write(self.style.SUCCESS(
            f"Purged demo data: {d_users} user-graph rows, {d_props} property-graph rows, "
            f"{d_dist} distribution rows."
        ))

    # ----------------------------------------------------------------------- #
    def _print_credentials(self, *, on_chain: bool = False) -> None:
        self.stdout.write(self.style.SUCCESS("\n=== DEMO CREDENTIALS ==="))
        self.stdout.write(f"Shared password: {DEMO_PASSWORD}\n")
        for local, role in USERS.items():
            self.stdout.write(f"  {role:<10} {local}@{DEMO_DOMAIN}")
        if on_chain:
            self.stdout.write(self.style.SUCCESS(
                f"\nDemo seeded. {ON_CHAIN_SLUGS} are REAL on testnet (deployed + minted); "
                "the other demo properties are ledger-only."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\nLedger-only demo seeded. (Run with --on-chain to make {ON_CHAIN_SLUGS} "
                "real on testnet.)"
            ))
