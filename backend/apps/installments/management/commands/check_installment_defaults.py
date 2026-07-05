"""
Installments Wave D — default-detection sweep (the LAST installments wave).

Scans ACTIVE installment plans, marks overdue PENDING installments `missed`, and DEFAULTS
any plan whose earliest unpaid installment is overdue by MORE than the grace period
(settings.INSTALLMENT_DEFAULT_GRACE_DAYS, default 30 days). Defaulting forfeits the LOCKED
(unpaid) tokens, KEEPS the RELEASED (paid) ones, voids the remaining schedule, and refunds
NOTHING (services.default_plan). SAFE TO RUN REPEATEDLY — an already-defaulted plan is a
no-op (no double-forfeit).

TRIGGER (deliberate + safe): this is a MANUAL, gated management command. It is NOT wired to
any auto-scheduler — nothing forfeits tokens on its own. Because the apply path is
DESTRUCTIVE (forfeits unpaid tokens), it refuses to write unless you pass `--yes`; run with
no flags to PREVIEW exactly which plans would default (writes nothing). Scheduling it (cron /
systemd-timer / Celery beat calling it with `--yes`) is a conscious PRODUCTION-DEPLOY
decision — see DECISIONS.md "Installments" — not something this code does silently.

Usage:
  python manage.py check_installment_defaults                     # PREVIEW (no writes)
  python manage.py check_installment_defaults --dry-run           # PREVIEW (explicit)
  python manage.py check_installment_defaults --yes               # APPLY (mark missed + default)
  python manage.py check_installment_defaults --yes --grace-days 14
  python manage.py check_installment_defaults --today 2026-09-01  # PREVIEW at a date
"""
from datetime import date

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.installments.services import (
    default_plan,
    find_defaultable_plan_ids,
    mark_overdue_missed,
)


class Command(BaseCommand):
    help = "Mark overdue installments missed + default plans past the grace period (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes", action="store_true",
            help="APPLY the sweep (mark overdue missed + default plans past grace, forfeiting "
                 "unpaid tokens). WITHOUT this flag the command only PREVIEWS — it writes nothing.",
        )
        parser.add_argument(
            "--grace-days", type=int, default=None,
            help="Overdue-days grace before default (default: settings.INSTALLMENT_DEFAULT_GRACE_DAYS).",
        )
        parser.add_argument(
            "--today", type=str, default=None,
            help="Override 'today' as YYYY-MM-DD (for testing/backfill). Default: the real date.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Force preview even with --yes (report what WOULD default; change nothing).",
        )

    def handle(self, *args, **opts):
        grace_days = opts["grace_days"]
        if grace_days is None:
            grace_days = int(getattr(settings, "INSTALLMENT_DEFAULT_GRACE_DAYS", 30))
        if grace_days < 0:
            raise CommandError("--grace-days must be >= 0.")

        today = None
        if opts["today"]:
            try:
                today = date.fromisoformat(opts["today"])
            except ValueError:
                raise CommandError("--today must be an ISO date (YYYY-MM-DD).")

        # SAFE BY DEFAULT: only --yes (and not --dry-run) actually writes. Any other
        # invocation previews what WOULD default and forfeits nothing — so a stray/scheduled
        # run without the explicit flag can never silently destroy tokens.
        apply = bool(opts["yes"]) and not opts["dry_run"]

        if not apply:
            ids = find_defaultable_plan_ids(grace_days, today)
            self.stdout.write(
                f"[preview] grace_days={grace_days} -> {len(ids)} plan(s) would default: "
                + (", ".join(str(i) for i in ids) or "(none)")
            )
            self.stdout.write(
                "No changes written. Re-run with --yes to APPLY "
                "(destructive: forfeits unpaid tokens)."
            )
            return

        # 1) Lifecycle bookkeeping: overdue pending rows → missed.
        marked = mark_overdue_missed(today)
        # 2) Default the plans past grace (recompute the id list AFTER marking missed).
        ids = find_defaultable_plan_ids(grace_days, today)

        defaulted = 0
        total_forfeited = 0
        for plan_id in ids:
            result = default_plan(plan_id)
            if result.get("defaulted"):
                defaulted += 1
                total_forfeited += int(result.get("forfeited") or 0)
                self.stdout.write(
                    f"  defaulted plan {plan_id}: kept {result.get('kept')} / "
                    f"forfeited {result.get('forfeited')} tokens"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"check_installment_defaults: grace_days={grace_days}, "
                f"{marked} installment(s) marked missed, {defaulted} plan(s) defaulted, "
                f"{total_forfeited} token(s) forfeited."
            )
        )
