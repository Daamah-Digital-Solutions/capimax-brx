"""
Installments Wave D — default-detection sweep (the LAST installments wave).

Scans ACTIVE installment plans, marks overdue PENDING installments `missed`, and DEFAULTS
any plan whose earliest unpaid installment is overdue by MORE than the grace period
(settings.INSTALLMENT_DEFAULT_GRACE_DAYS, default 30 days). Defaulting forfeits the LOCKED
(unpaid) tokens, KEEPS the RELEASED (paid) ones, voids the remaining schedule, and refunds
NOTHING (services.default_plan). SAFE TO RUN REPEATEDLY — an already-defaulted plan is a
no-op (no double-forfeit).

This command HOLDS the detection logic and is run manually / in tests today. SCHEDULING it
to run daily (cron / Celery beat) is a PRODUCTION-DEPLOY concern — NOT wired here (see
DECISIONS.md "Installments" deploy items), exactly like the provider keys / mainnet audit.

Usage:
  python manage.py check_installment_defaults
  python manage.py check_installment_defaults --grace-days 14
  python manage.py check_installment_defaults --today 2026-09-01 --dry-run
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
            "--grace-days", type=int, default=None,
            help="Overdue-days grace before default (default: settings.INSTALLMENT_DEFAULT_GRACE_DAYS).",
        )
        parser.add_argument(
            "--today", type=str, default=None,
            help="Override 'today' as YYYY-MM-DD (for testing/backfill). Default: the real date.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Report what WOULD default without changing anything.",
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

        dry_run = opts["dry_run"]

        if dry_run:
            ids = find_defaultable_plan_ids(grace_days, today)
            self.stdout.write(
                f"[dry-run] grace_days={grace_days} → {len(ids)} plan(s) would default: "
                + (", ".join(str(i) for i in ids) or "(none)")
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
