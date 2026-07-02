"""
reset_kyc — return a user's KYC to a clean `pending` state (prod-safe, reusable).

Unlike dev_grant_kyc (a DEBUG-only gate bypass), this is an OPS tool meant to run
in production too: it un-sticks an account that landed in `submitted`/`approved`/
`rejected` — e.g. a test submission — WITHOUT deleting the user. It clears the
Sumsub linkage and the state timestamps so the next "Start verification" begins
fresh (a new applicant is created on submit).

It does NOT touch the user, profile, wallet, holdings, or any other data — only
the one UserKYC row. To remove an account entirely, delete the User (admin).

SAFETY
  * Requires --yes to write (so it can run on prod via systemd-run + EnvironmentFile,
    never `source` the .env), consistent with seed_demo.
  * If the user has no KYC record, there is nothing to reset — reported, no-op.
  * Non-destructive: the account and its history remain; only verification state
    is cleared, and the user can simply re-verify.

    python manage.py reset_kyc --email someone@example.com --yes
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.core.models import User
from apps.kyc.models import KYCStatus, UserKYC


class Command(BaseCommand):
    help = (
        "Reset a user's KYC to `pending`: clears the Sumsub applicant id and the "
        "submitted/approved/rejected timestamps + reason. Keeps the account. "
        "Requires --yes."
    )

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="The user's email.")
        parser.add_argument("--yes", action="store_true", help="Confirm the write (required).")

    def handle(self, *args, **options):
        if not options["yes"]:
            raise CommandError("Refusing to run without --yes (this writes to the database).")

        email = options["email"]
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"No user with email '{email}'.")

        kyc = UserKYC.objects.filter(user=user).first()
        if kyc is None:
            self.stdout.write(
                self.style.WARNING(f"No KYC record for {email} — nothing to reset.")
            )
            return

        before = kyc.status
        with transaction.atomic():
            kyc.status = KYCStatus.PENDING
            kyc.submitted_at = None
            kyc.approved_at = None
            kyc.rejected_at = None
            kyc.rejection_reason = ""
            kyc.sumsub_applicant_id = ""
            kyc.sumsub_review_answer = ""
            kyc.save(update_fields=[
                "status", "submitted_at", "approved_at", "rejected_at",
                "rejection_reason", "sumsub_applicant_id", "sumsub_review_answer",
                "updated_at",
            ])

        self.stdout.write(self.style.SUCCESS(
            f"Reset KYC for {email}: {before} -> pending "
            f"(applicant id + timestamps cleared). The user can verify again."
        ))
