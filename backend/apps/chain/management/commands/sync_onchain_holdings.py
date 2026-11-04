"""
Bring holdings recorded in the ledger onto a property's token contract.

A property bought before its contract was deployed settles in the ledger only (OwnershipToken
positions, no mint — investments.services.mint_investment). Once the contract is deployed,
every later move of those units (secondary market, LP market, transfers) is an on-chain transfer
signed by the holder's custodial wallet, so the wallet must actually hold them. This mints, to
each holder's custodial wallet, the units the ledger says they hold and the chain doesn't.

    python manage.py sync_onchain_holdings --slug aethera-coast-studio-residence-507-b
    python manage.py sync_onchain_holdings --all --apply

Dry run by default (reads balances, writes nothing). Idempotent: it mints only the difference
between the position and the wallet's on-chain balance, so a re-run mints nothing. A wallet
holding MORE on chain than the ledger says is reported, never burned. Only real mints are
recorded (WalletTransaction with the real tx hash). Prints counts and amounts, no names.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.chain import service
from apps.chain.exceptions import ChainError
from apps.properties.models import Property
from apps.wallets.models import OwnershipToken, WalletTransaction


class Command(BaseCommand):
    help = "Mint ledger-only holdings of deployed properties to the holders' custodial wallets."

    def add_arguments(self, parser):
        parser.add_argument("--slug", action="append", default=[], help="Property slug (repeatable).")
        parser.add_argument("--all", action="store_true", help="Every property deployed on this chain.")
        parser.add_argument("--apply", action="store_true", help="Mint (default: dry run).")

    def handle(self, *args, **opts):
        if not opts["slug"] and not opts["all"]:
            raise CommandError("Give --slug or --all.")
        props = Property.objects.select_related("token_metadata").filter(
            token_metadata__deployment_chain_id=int(settings.CHAIN_ID),
        ).exclude(token_metadata__deployed_contract_address="")
        if opts["slug"]:
            props = props.filter(slug__in=opts["slug"])
            missing = set(opts["slug"]) - set(props.values_list("slug", flat=True))
            if missing:
                raise CommandError(f"Not deployed on chain {settings.CHAIN_ID}: {', '.join(sorted(missing))}")
        mode = "APPLY" if opts["apply"] else "DRY RUN"
        self.stdout.write(f"{mode} on chain {settings.CHAIN_ID}")
        failed = 0
        for prop in props.order_by("slug"):
            failed += self._sync(prop, opts["apply"])
        if failed:
            raise CommandError(f"{failed} mint(s) failed; re-run to finish (it is idempotent).")

    def _sync(self, prop, apply: bool) -> int:
        address = prop.token_metadata.deployed_contract_address
        positions = list(
            OwnershipToken.objects.select_related("wallet")
            .filter(property_id=prop.slug, token_amount__gt=0)
            .order_by("created_at", "pk")
        )
        plan = []
        extra = 0
        for pos in positions:
            on_chain = service.read_balance(address, pos.wallet.wallet_address)
            diff = int(pos.token_amount) - on_chain
            if diff > 0:
                plan.append((pos.pk, diff))
            elif diff < 0:
                extra += 1
        supply, cap = service.read_total_supply(address), service.read_max_supply(address)
        to_mint = sum(d for _, d in plan)
        ledger = sum(int(p.token_amount) for p in positions)
        self.stdout.write(
            f"{prop.slug}: {len(positions)} holders, {ledger} units in the ledger, "
            f"on chain {supply}/{cap}; to mint {to_mint} units to {len(plan)} wallets"
            + (f"; {extra} wallet(s) hold more on chain than the ledger (left as is)" if extra else "")
        )
        if supply + to_mint > cap:
            self.stdout.write(self.style.ERROR(f"  {prop.slug}: would exceed the supply cap; nothing minted"))
            return 1
        if not apply or not plan:
            return 0

        failed = 0
        price = Decimal(prop.token_price)
        for pk, _diff in plan:
            try:
                with transaction.atomic():
                    pos = OwnershipToken.objects.select_for_update().select_related("wallet").get(pk=pk)
                    # Re-read under the lock: mint only what is still missing.
                    diff = int(pos.token_amount) - service.read_balance(address, pos.wallet.wallet_address)
                    if diff <= 0:
                        continue
                    result = service.mint(address, pos.wallet.wallet_address, diff)
                    WalletTransaction.objects.create(
                        wallet=pos.wallet, tx_hash=result["tx_hash"], tx_type="mint",
                        amount=(Decimal(diff) * price).quantize(Decimal("0.01"), ROUND_HALF_UP),
                        token_symbol=pos.token_symbol, status="confirmed",
                        block_number=result.get("block_number"), chain_id=result.get("chain_id"),
                    )
                self.stdout.write(f"  minted {diff} → tx {result['tx_hash']}")
            except ChainError as exc:
                failed += 1
                self.stdout.write(self.style.ERROR(f"  mint failed for position {pk}: {exc}"))
        return failed
