"""
Emergency stop for property tokens (audit 2026-10-21, H-2).

    python manage.py chain_pause --slug marina-tower       # pause one property's token
    python manage.py chain_pause --all                     # pause every deployed token
    python manage.py chain_pause --status --all            # show paused / roles, change nothing
    python manage.py chain_pause --unpause --slug x        # restart — only if this server key
                                                           # is the admin (test networks)

Pausing stops every mint and transfer of the token; purchases and market trades of that
property then fail safely until it is restarted. The server (hot) key may pause; only the
admin — the multisig on mainnet — may restart. Tokens deployed before the emergency
controls existed are reported and skipped.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.chain import service
from apps.chain.client import deployer_address
from apps.chain.exceptions import ChainError


class Command(BaseCommand):
    help = "Pause (or, with --unpause, restart) property token contracts."

    def add_arguments(self, parser):
        target = parser.add_mutually_exclusive_group(required=True)
        target.add_argument("--slug", help="Property slug.")
        target.add_argument("--all", action="store_true", help="Every property with a deployed token.")
        parser.add_argument("--unpause", action="store_true", help="Restart instead of pausing.")
        parser.add_argument("--status", action="store_true", help="Only report; change nothing.")

    def handle(self, *args, **opts):
        from django.conf import settings

        from apps.properties.models import TokenMetadata

        qs = TokenMetadata.objects.exclude(deployed_contract_address="").filter(
            deployment_chain_id=int(settings.CHAIN_ID)
        ).select_related("property")
        if opts["slug"]:
            qs = qs.filter(property__slug=opts["slug"])
        metas = list(qs)
        if not metas:
            raise CommandError("No deployed token matches on this chain.")

        me = deployer_address()
        for meta in metas:
            addr, slug = meta.deployed_contract_address, meta.property.slug
            try:
                paused = service.is_paused(addr)
                if paused is None:
                    self.stdout.write(f"{slug}: {addr} predates the emergency controls — skipped.")
                    continue
                if opts["status"]:
                    roles = [r for r in service.ROLES if service.has_role(addr, r, me)]
                    self.stdout.write(f"{slug}: paused={paused}  server key roles={roles or 'none'}")
                    continue
                if opts["unpause"]:
                    if not paused:
                        self.stdout.write(f"{slug}: already running.")
                        continue
                    res = service.unpause(addr)
                    self.stdout.write(self.style.SUCCESS(f"{slug}: restarted — {res['explorer_tx']}"))
                else:
                    if paused:
                        self.stdout.write(f"{slug}: already paused.")
                        continue
                    res = service.pause(addr)
                    self.stdout.write(self.style.WARNING(f"{slug}: PAUSED — {res['explorer_tx']}"))
            except ChainError as exc:
                self.stderr.write(self.style.ERROR(f"{slug}: {exc}"))
