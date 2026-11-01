"""Documents in the site's language: the text, the dates, the CSV and the ?lang= on the API."""
import ast
import datetime
import pathlib
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.wallets.services import credit_user_balance

from .brand import day, mx, W
from .doc_lang import doc_language, is_rtl, tr, tr_value
from .labels import PROVIDER_LABELS, SOURCE_LABELS

APPS = pathlib.Path(__file__).resolve().parent.parent
TEXT_KEYS = {"title", "note", "empty", "hint", "subtitle"}
LIST_KEYS = {"summary", "columns", "holder_extra"}


def _document_text(path: pathlib.Path) -> set[str]:
    """The fixed English a builder gives a document: headings, titles, notes, labels."""
    found = set()

    def constant(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            found.add(node.value)

    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Call) and getattr(node.func, "name", getattr(node.func, "id", "")) == "Col":
            constant(node.args[1])
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values):
                name = getattr(key, "value", None)
                if name in TEXT_KEYS:
                    constant(value)
                elif name in LIST_KEYS and isinstance(value, ast.List):
                    for item in value.elts:
                        if isinstance(item, ast.Tuple):
                            # columns are (key, header); summary rows are (label, value).
                            constant(item.elts[1 if name == "columns" else 0])
    return found


class TranslationTests(TestCase):
    def test_english_is_untouched_and_an_unknown_language_is_english(self):
        self.assertEqual(tr("Amount (USD)"), "Amount (USD)")
        with doc_language("de"):
            self.assertEqual(tr("Amount (USD)"), "Amount (USD)")
            self.assertFalse(is_rtl())

    def test_exact_text_and_templates_with_known_values(self):
        with doc_language("ar"):
            self.assertEqual(tr("Amount (USD)"), "المبلغ (USD)")
            self.assertEqual(tr("Wallet top-up — credited to your wallet"), "شحن المحفظة — أُضيف إلى محفظتك")
            self.assertTrue(is_rtl())
        with doc_language("fr"):
            self.assertEqual(tr("Page 2 of 5"), "Page 2 sur 5")
            self.assertEqual(tr("Gift TR-1 to a@ex.com"), "Don TR-1 à a@ex.com")
            self.assertFalse(is_rtl())
        self.assertEqual(tr("Amount (USD)"), "Amount (USD)")  # back to English after the block

    def test_raw_status_values_and_data_left_alone(self):
        with doc_language("fr"):
            self.assertEqual(tr_value("paid"), "Payé")
            self.assertEqual(tr_value("Sara Al-Rashid"), "Sara Al-Rashid")
            self.assertEqual(tr_value(Decimal("5")), Decimal("5"))

    def test_dates(self):
        d = datetime.date(2026, 11, 1)
        self.assertEqual(day(d), "01 Nov 2026")
        with doc_language("ar"):
            self.assertEqual(day(d), "01 نوفمبر 2026")
        with doc_language("fr"):
            self.assertEqual(day(d), "01 nov. 2026")

    def test_arabic_mirrors_the_page(self):
        self.assertEqual(mx(100), 100)
        with doc_language("ar"):
            self.assertEqual(mx(100), W - 100)

    def test_every_fixed_document_text_has_arabic_and_french(self):
        texts = set(SOURCE_LABELS.values()) | set(PROVIDER_LABELS.values())
        for rel in ("reports/adapters.py", "reports/receipts.py"):
            texts |= _document_text(APPS / rel)
        self.assertGreater(len(texts), 100)
        for lang in ("ar", "fr"):
            with doc_language(lang):
                # "#" and text that is the same in both languages (e.g. "Date", "Total" in French).
                missing = [t for t in sorted(texts) if t != "#" and tr(t) == t and _not_in_dictionary(t)]
            self.assertEqual(missing, [], lang)


def _not_in_dictionary(text: str) -> bool:
    from .doc_strings import TEXT

    return " ".join(text.split()) not in {" ".join(k.split()) for k in TEXT}


class DocumentLanguageApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="lang@ex.com", password="pw-12345-strong")
        credit_user_balance(self.user, Decimal("100.00"), source="deposit", reference="L1")
        self.client.force_authenticate(self.user)

    def _csv(self, query=""):
        resp = self.client.get(f"/api/reports/wallet/export/?fmt=csv{query}")
        self.assertEqual(resp.status_code, 200)
        return b"".join(resp.streaming_content).decode("utf-8-sig")

    def test_csv_follows_the_language(self):
        self.assertIn("Amount (USD)", self._csv())
        self.assertIn("Wallet top-up", self._csv())
        arabic = self._csv("&lang=ar")
        self.assertIn("المبلغ (USD)", arabic)
        self.assertIn("شحن المحفظة", arabic)
        french = self._csv("&lang=fr")
        self.assertIn("Montant (USD)", french)
        self.assertIn("Recharge du portefeuille", french)

    def test_pdfs_render_in_every_language(self):
        for lang in ("en", "ar", "fr"):
            for url in ("/api/reports/wallet/export/?fmt=pdf", "/api/reports/portfolio/export/?fmt=pdf",
                        "/api/reports/analytics/export/?fmt=pdf", "/api/reports/installments/export/?fmt=pdf",
                        "/api/reports/distributions/tax/?year=2026"):
                resp = self.client.get(f"{url}&lang={lang}")
                self.assertEqual(resp.status_code, 200, url)
                self.assertTrue(b"".join(resp.streaming_content).startswith(b"%PDF"), url)
