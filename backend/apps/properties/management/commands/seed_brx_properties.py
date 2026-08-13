"""
Seed the two real client sample properties onto Capimax BRX:

  - The Kensington Residences  (slug: kensington-residences) — READY, income-producing
  - Thames Bay Residences      (slug: thames-bay-residences)  — UNDER CONSTRUCTION (installment)

Each carries a full description (EN/AR), gallery images, SPV record, financials /
valuation / developer reports, and the COMPLETE data-room document set with real,
downloadable URLs (loaded from brx_documents.json, generated from the client bundle).

Token economics follow the platform standard ($100/token; supply = value / 100).
On-chain token metadata is deliberately NOT seeded — the property page shows an honest
"tokenization pending" state until a real contract is deployed (admin action), never a
fabricated address.

Idempotent: update_or_create by slug + rebuild nested children.

    python manage.py seed_brx_properties
"""
import json
import os
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.properties.models import (
    DeveloperReport,
    InstallmentSchedule,
    Property,
    PropertyDocument,
    PropertyFinancials,
    SPVRecord,
    ValuationReport,
)

# Data-room documents (generated from the client's file bundle → property_docs/<slug>/…).
_DOCS = json.load(
    open(os.path.join(os.path.dirname(__file__), "brx_documents.json"), encoding="utf-8")
)

_SCALAR_FIELDS = {
    "name", "name_ar", "location", "location_ar", "country", "city", "image", "images",
    "asset_type", "model", "status", "yield_type", "risk_level",
    "total_value", "expected_yield", "expected_growth", "funded", "investors",
    "min_investment", "duration", "duration_ar",
    "exit_eligible", "exit_availability", "insurance_active",
    "description", "description_ar", "construction_progress", "is_featured",
}

CATALOGUE = [
    # ------------------------------------------------------------------ READY #
    {
        "slug": "kensington-residences",
        "model": "ready", "status": "ready",
        "name": "The Kensington Residences",
        "name_ar": "ذا كنزينغتون ريزيدنسز",
        "location": "Kensington, London", "location_ar": "كنزينغتون، لندن",
        "country": "uk", "city": "london",
        "image": "/props/kensington-residences/hero.jpg",
        "images": [
            "/props/kensington-residences/g01.jpg",
            "/props/kensington-residences/g02.jpg",
            "/props/kensington-residences/g03.jpg",
            "/props/kensington-residences/g04.jpg",
            "/props/kensington-residences/g05.jpg",
            "/props/kensington-residences/g06.jpg",
            "/props/kensington-residences/g07.jpg",
            "/props/kensington-residences/g08.jpg",
        ],
        "asset_type": "residential", "yield_type": "hybrid", "risk_level": "low",
        "total_value": 5872500,
        "expected_yield": Decimal("8.1"), "expected_growth": Decimal("58"),
        "funded": 0, "investors": 0,
        "min_investment": 100,
        "duration": "7–10 years", "duration_ar": "7–10 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "is_featured": True,
        "description": (
            "The Kensington Residences is an institutional-grade heritage residential "
            "development in the heart of Kensington, one of London's most prestigious "
            "districts — 78 luxury apartments across four meticulously restored "
            "white-stucco buildings on a private garden square. This BRX opportunity is "
            "the flagship Three-Bedroom Residence (Unit 612, 1,975 sq ft): a delivered, "
            "income-producing asset under Crestmark Estate Management with 96% occupancy "
            "and 84% tenant retention. Held through a regulated Special Purpose Vehicle "
            "(SPV) and offered as digital fractions, it combines prime-London capital "
            "preservation with recurring rental income, transparent reporting, and "
            "institutional governance."
        ),
        "description_ar": (
            "ذا كنزينغتون ريزيدنسز مشروع سكني تراثي بمعايير مؤسسية في قلب حي كنزينغتون، "
            "أحد أرقى أحياء لندن — 78 شقة فاخرة موزّعة على أربعة مبانٍ تراثية مُرمّمة بعناية "
            "حول ميدان حديقة خاص. الفرصة المطروحة على BRX هي شقة الثلاث غرف الرئيسية "
            "(وحدة 612، 1,975 قدماً مربعة): أصل مُسلَّم ومُدِرّ للدخل تحت إدارة "
            "Crestmark بنسبة إشغال 96% واحتفاظ بالمستأجرين 84%. يُملَك عبر شركة ذات غرض خاص "
            "(SPV) ويُطرح كحصص رقمية، جامعاً بين الحفاظ على رأس المال في قلب لندن ودخلٍ "
            "إيجاري متكرّر وحوكمة مؤسسية شفافة."
        ),
        "spv": {
            "name": "The Kensington Residences SPV Ltd",
            "jurisdiction": "London, United Kingdom",
            "registration_number": "CRT-LDN-612",
            "established": "2023-11-01",
        },
        "financials": {
            "purchase_price": 5500000, "current_valuation": 5872500,
            "gross_rental_income": 560000, "operating_expenses": 118000,
            "net_operating_income": 442000, "cap_rate": Decimal("7.5"),
            "occupancy_rate": 96,
        },
        "valuation_reports": [
            {"date": "2025-09-01", "valuation": 5872500, "appraiser": "CIM Global Financial"},
            {"date": "2025-03-01", "valuation": 5600000, "appraiser": "CIM Global Financial"},
        ],
        "documents": _DOCS["kensington-residences"],
    },
    # ---------------------------------------------------- UNDER CONSTRUCTION #
    {
        "slug": "thames-bay-residences",
        "model": "installment", "status": "construction",
        "name": "Thames Bay Residences",
        "name_ar": "ثيمز باي ريزيدنسز",
        "location": "Docklands, London", "location_ar": "دوكلاندز، لندن",
        "country": "uk", "city": "london",
        "image": "/props/thames-bay-residences/hero.jpg",
        "images": [
            "/props/thames-bay-residences/g01.jpg",
            "/props/thames-bay-residences/g02.jpg",
            "/props/thames-bay-residences/g03.jpg",
            "/props/thames-bay-residences/g04.jpg",
            "/props/thames-bay-residences/g05.jpg",
        ],
        "asset_type": "residential", "yield_type": "appreciation", "risk_level": "medium",
        "total_value": 2295000,
        "expected_growth": Decimal("56"),
        "funded": 0, "investors": 0,
        "min_investment": 100,
        "duration": "Long-term · handover Q3 2027", "duration_ar": "طويل الأجل · تسليم الربع الثالث 2027",
        "exit_eligible": False, "exit_availability": "lp", "insurance_active": True,
        "is_featured": True,
        "construction_progress": 57,
        "description": (
            "Thames Bay Residences is a landmark waterfront development in London's "
            "Docklands regeneration corridor — 264 premium residences arranged around a "
            "sheltered marina, retail promenade, and direct river-bus connectivity, across "
            "3.8 acres and roughly 428,000 sq ft. Currently 57% built with handover "
            "targeted for Q3 2027, this off-plan opportunity lets investors participate "
            "during construction through a flexible installment structure (10–30% down, up "
            "to 36 months), benefiting from staged capital appreciation as milestones "
            "complete. Independently monitored construction, SPV ownership, escrow "
            "protection (Barclays), and monthly progress reporting underpin the investment."
        ),
        "description_ar": (
            "ثيمز باي ريزيدنسز مشروع رائد على الواجهة المائية في منطقة دوكلاندز بلندن — "
            "264 وحدة سكنية فاخرة حول مارينا محمية وممشى تجاري واتصال مباشر بحافلة النهر، "
            "على مساحة 3.8 فدان ونحو 428,000 قدم مربع. اكتمل الإنشاء بنسبة 57% والتسليم "
            "المستهدف الربع الثالث 2027. تتيح هذه الفرصة على المخطط المشاركةَ أثناء الإنشاء "
            "عبر نظام أقساط مرن (مقدّم 10–30%، حتى 36 شهراً)، مع الاستفادة من ارتفاع القيمة "
            "تدريجياً كلما اكتملت المراحل. يدعم الاستثمارَ مراقبةٌ إنشائية مستقلة وملكيةٌ عبر "
            "SPV وحمايةُ ضمان (Barclays) وتقاريرُ تقدّم شهرية."
        ),
        "installment": {
            "total_installments": 36, "paid_installments": 0, "monthly_amount": 100,
            "next_payment_date": "2026-09-01", "activation_date": "2027-09-30",
            "completion_percent": 0,
        },
        "spv": {
            "name": "Thames Bay Residences SPV Ltd",
            "jurisdiction": "London, United Kingdom",
            "registration_number": "TBR-LDN-001",
            "established": "2022-10-01",
        },
        "valuation_reports": [
            {"date": "2026-03-01", "valuation": 2295000, "appraiser": "CIM Global Financial"},
        ],
        "developer_reports": [
            {"date": "2026-04-30", "title": "Quayside concrete works complete to Level 14",
             "title_ar": "اكتمال أعمال الخرسانة حتى المستوى 14", "progress": 57},
            {"date": "2026-02-28", "title": "River-Bus Pier piling completed",
             "title_ar": "اكتمال ركائز رصيف حافلة النهر", "progress": 50},
            {"date": "2025-12-15", "title": "Off-site show suite construction commenced",
             "title_ar": "بدء إنشاء جناح العرض خارج الموقع", "progress": 44},
        ],
        "documents": _DOCS["thames-bay-residences"],
    },
]


class Command(BaseCommand):
    help = "Seed the two client sample properties (Kensington + Thames Bay) with full data-room docs."

    @transaction.atomic
    def handle(self, *args, **options):
        created = updated = 0
        for order, data in enumerate(CATALOGUE, start=2000):
            c, u = self._upsert(data, display_order=order)
            created += c
            updated += u
        self.stdout.write(
            self.style.SUCCESS(f"BRX seed complete: {created} created, {updated} updated.")
        )

    def _upsert(self, data, display_order):
        d = dict(data)
        slug = d.pop("slug")
        installment = d.pop("installment", None)
        spv = d.pop("spv", None)
        financials = d.pop("financials", None)
        valuation_reports = d.pop("valuation_reports", [])
        developer_reports = d.pop("developer_reports", [])
        documents = d.pop("documents", [])

        scalars = {k: v for k, v in d.items() if k in _SCALAR_FIELDS}
        token_price = Decimal("100")
        scalars["token_price"] = token_price
        scalars["token_supply"] = int(Decimal(str(scalars["total_value"])) / token_price)
        scalars["display_order"] = display_order
        scalars["is_published"] = True

        obj, created = Property.objects.update_or_create(slug=slug, defaults=scalars)

        # rebuild nested children idempotently
        for rel in ("valuation_reports", "developer_reports", "documents"):
            getattr(obj, rel).all().delete()
        for model_cls, payload in (
            (InstallmentSchedule, installment),
            (SPVRecord, spv),
            (PropertyFinancials, financials),
        ):
            model_cls.objects.filter(property=obj).delete()
            if payload:
                model_cls.objects.create(property=obj, **payload)
        for v in valuation_reports:
            ValuationReport.objects.create(property=obj, **v)
        for r in developer_reports:
            DeveloperReport.objects.create(property=obj, **r)
        for doc in documents:
            PropertyDocument.objects.create(property=obj, **doc)

        return (1, 0) if created else (0, 1)
