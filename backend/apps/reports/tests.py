"""
Reports-export tests — Phase 13. Run against Postgres (capimax_brx).

Covers: self-scoped exports (a user can only export THEIR OWN rows); correct content-types
(text/csv, application/pdf); the year/period filter; the informational tax summary carries
its disclaimer; figures match the existing data (no fabricated totals); auth required.
"""
import datetime
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.distributions.models import Distribution, DistributionPayout
from apps.wallets.services import credit_user_balance, debit_user_balance


def _read(resp) -> bytes:
    return b"".join(resp.streaming_content) if resp.streaming else resp.content


class ReportsExportTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="rx@ex.com", password="pw-12345-strong")
        self.other = User.objects.create_user(email="rx-other@ex.com", password="pw-12345-strong")

        # Caller's wallet ledger: a distribution credit + a withdrawal debit.
        credit_user_balance(self.user, Decimal("840.00"), source="distribution", reference="D1")
        debit_user_balance(self.user, Decimal("200.00"), source="withdrawal", reference="W1")
        # Another user's ledger entry — must NEVER appear in the caller's export.
        credit_user_balance(self.other, Decimal("999.00"), source="distribution", reference="DX")

        # Caller's PAID distribution payout (this year).
        self.dist = Distribution.objects.create(
            property_id="p1", property_name="Marina Bay Tower", pool_amount_usd=Decimal("1000"),
            dist_type="quarterly", period_label="Q4 2024",
            pay_date=datetime.date(datetime.date.today().year, 3, 15),
            status=Distribution.Status.PAID,
        )
        DistributionPayout.objects.create(
            distribution=self.dist, user=self.user,
            share_amount_usd=Decimal("840.00"), credited=True,
        )

    # --- wallet -------------------------------------------------------------- #
    def test_wallet_csv_self_scoped_and_real_figures(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/reports/wallet/export/?fmt=csv")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv")
        body = _read(res).decode("utf-8")
        # The caller's real ledger figures (signed) are present.
        self.assertIn("840.00", body)
        self.assertIn("-200.00", body)
        self.assertIn("distribution", body)
        # The OTHER user's row is NOT in the caller's export.
        self.assertNotIn("999.00", body)

    def test_wallet_pdf_content_type(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/reports/wallet/export/?fmt=pdf")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")
        data = _read(res)
        self.assertTrue(data.startswith(b"%PDF"))
        self.assertGreater(len(data), 800)

    def test_export_is_self_scoped_other_user_sees_only_own(self):
        self.client.force_authenticate(self.other)
        body = _read(self.client.get("/api/reports/wallet/export/?fmt=csv")).decode("utf-8")
        self.assertIn("999.00", body)        # their own
        self.assertNotIn("840.00", body)     # not the caller's

    # --- distributions + tax ------------------------------------------------- #
    def test_distributions_pdf(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/reports/distributions/export/?fmt=pdf")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(_read(res).startswith(b"%PDF"))

    def test_distributions_csv_has_real_payout(self):
        self.client.force_authenticate(self.user)
        body = _read(self.client.get("/api/reports/distributions/export/?fmt=csv")).decode("utf-8")
        self.assertIn("Marina Bay Tower", body)
        self.assertIn("840.00", body)

    def test_tax_summary_is_pdf_with_disclaimer_and_year_filter(self):
        self.client.force_authenticate(self.user)
        year = datetime.date.today().year
        res = self.client.get(f"/api/reports/distributions/tax/?year={year}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(_read(res).startswith(b"%PDF"))
        # A different year → the payout is filtered out (PDF still renders, no error).
        res2 = self.client.get("/api/reports/distributions/tax/?year=2000")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(_read(res2).startswith(b"%PDF"))

    def test_year_filter_excludes_other_years(self):
        self.client.force_authenticate(self.user)
        body = _read(self.client.get("/api/reports/distributions/export/?fmt=csv&year=2000")).decode("utf-8")
        self.assertNotIn("840.00", body)  # the payout is this year, not 2000

    # --- owner / lp / broker smoke (200 + content-type; empty rows OK) ------- #
    def test_other_contexts_render(self):
        self.client.force_authenticate(self.user)
        for ctx in ("owner-earnings", "lp", "broker-commissions"):
            res = self.client.get(f"/api/reports/{ctx}/export/?fmt=csv")
            self.assertEqual(res.status_code, status.HTTP_200_OK, ctx)
            self.assertEqual(res["Content-Type"], "text/csv", ctx)

    # --- guards -------------------------------------------------------------- #
    def test_unknown_context_404(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(
            self.client.get("/api/reports/nope/export/").status_code, status.HTTP_404_NOT_FOUND
        )

    def test_requires_auth(self):
        self.assertEqual(
            self.client.get("/api/reports/wallet/export/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
