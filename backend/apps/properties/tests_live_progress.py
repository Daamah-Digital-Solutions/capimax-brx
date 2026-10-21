"""The marketplace list shows the live funded % and investor count, not only the detail page."""
from decimal import Decimal

from django.test import TestCase

from apps.core.models import User
from apps.investments.models import Investment, PaymentStatus

from .models import Property
from .tests import _valid_property_kwargs


class LiveProgressTests(TestCase):
    def test_list_and_detail_show_real_sales(self):
        prop = Property(**_valid_property_kwargs(slug="live-progress", total_value=Decimal("5872500")))
        prop.save()
        for i, units in enumerate((10, 16)):
            user = User.objects.create_user(email=f"buyer{i}@ex.com", password="pw-12345-strong")
            Investment.objects.create(
                user=user, property=prop, property_name=prop.name, amount_invested=Decimal(units * 100),
                token_amount=units, token_symbol="LIVE", price_per_token=Decimal("100"),
                ownership_percentage=Decimal("0"), payment_method="balance",
                payment_status=PaymentStatus.COMPLETED, tokens_minted=True,
            )
        rows = self.client.get("/api/properties/").json()
        rows = rows.get("results", rows) if isinstance(rows, dict) else rows
        row = next(r for r in rows if r["id"] == "live-progress")
        self.assertEqual(row["investors"], 2)
        self.assertAlmostEqual(row["funded"], 0.04, places=2)  # 26 of 58,725 units — no longer rounded to 0
        detail = self.client.get("/api/properties/live-progress/").json()
        self.assertEqual((detail["investors"], detail["funded"]), (row["investors"], row["funded"]))
