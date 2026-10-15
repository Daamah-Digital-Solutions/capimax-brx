"""
Finish paid purchases whose units never arrived (see apps/investments/reconcile.py).
Run hourly by cron; safe to run any number of times.

  python manage.py reconcile_investments            # finish them
  python manage.py reconcile_investments --dry-run  # only count them
"""
from django.core.management.base import BaseCommand

from apps.core.alerts import alert_on_failure
from apps.investments.reconcile import reconcile


class Command(BaseCommand):
    help = "Mint or settle paid purchases that were left without their units."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only report what would be done.")

    @alert_on_failure
    def handle(self, *args, **opts):
        outcomes = reconcile(dry_run=opts["dry_run"])
        summary = ", ".join(f"{k}={v}" for k, v in sorted(outcomes.items())) or "nothing to do"
        self.stdout.write(f"reconcile_investments: {summary}")
