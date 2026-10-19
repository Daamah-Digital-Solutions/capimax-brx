"""
Collect due installments from investors' wallets (off-plan model §4). Run hourly by cron.

  python manage.py collect_due_installments            # collect everything due up to today
  python manage.py collect_due_installments --today 2026-12-01

Marks overdue rows "missed" (bookkeeping only — no penalty), then debits every due row
(base + installment fee) from the investor's wallet balance, oldest first per plan. A row the
wallet can't cover stays due; the investor gets ONE reminder and it is retried on the next run
or right after a top-up. Idempotent — safe to run any number of times.
"""
from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.core.alerts import alert_on_failure

from apps.installments.services import (
    collect_due_installments,
    mark_overdue_missed,
    remind_upcoming_installments,
)


class Command(BaseCommand):
    help = "Debit due installments from investors' wallets (no penalty, no forfeiture)."

    def add_arguments(self, parser):
        parser.add_argument("--today", default=None, help="Collect as of this ISO date (YYYY-MM-DD).")

    @alert_on_failure
    def handle(self, *args, **opts):
        today = None
        if opts["today"]:
            try:
                today = date.fromisoformat(opts["today"])
            except ValueError:
                raise CommandError("--today must be an ISO date (YYYY-MM-DD).")
        reminded = remind_upcoming_installments(today=today)
        marked = mark_overdue_missed(today)
        result = collect_due_installments(today=today)
        self.stdout.write(
            f"collect_due_installments: {reminded} reminded, {result['collected']} collected, "
            f"{result['insufficient']} waiting for a top-up, {marked} newly marked overdue."
        )
