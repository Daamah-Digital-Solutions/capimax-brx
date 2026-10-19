"""
Gifts / family transfers / inheritance housekeeping (apps/transfers). Run hourly by cron.

  python manage.py process_transfers

Reminds senders a few days before a scheduled gift, delivers what is due (or parks it until
the recipient verifies), and returns gifts / family transfers nobody received in time.
Idempotent — safe to run any number of times.
"""
from django.core.management.base import BaseCommand

from apps.core.alerts import alert_on_failure
from apps.transfers.services import deliver_due, expire_unclaimed, remind_upcoming


class Command(BaseCommand):
    help = "Deliver due gifts and transfers, send reminders, return unclaimed ones."

    @alert_on_failure
    def handle(self, *args, **opts):
        reminded = remind_upcoming()
        due = deliver_due()
        expired = expire_unclaimed()
        self.stdout.write(
            f"reminded={reminded} delivered={due['delivered']} waiting={due['waiting']} "
            f"failed={due['failed']} expired={expired}"
        )
