"""
Close platform-priced LP exit requests that lapsed or whose unit price moved (off-plan
decision 6). Run hourly by cron; the market also closes them whenever it is read, and a
stale request is never funded, so this only keeps the listings tidy and frees the units.

  python manage.py close_stale_lp_requests
"""
from django.core.management.base import BaseCommand

from apps.core.alerts import alert_on_failure

from apps.lp.market_services import close_stale_requests


class Command(BaseCommand):
    help = "Close lapsed or re-priced LP exit requests and free their units."

    @alert_on_failure
    def handle(self, *args, **opts):
        closed = close_stale_requests()
        self.stdout.write(f"close_stale_lp_requests: {closed} closed.")
