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
    Amenity,
    DeveloperInfo,
    DeveloperReport,
    InstallmentSchedule,
    InsuranceInfo,
    Landmark,
    MarketData,
    Property,
    PropertyDocument,
    PropertyFAQ,
    PropertyFinancials,
    RiskFactor,
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
        "developer": {
            "name": "Crestmark Estate Management",
            "name_ar": "كرِستمارك لإدارة العقارات",
            "overview": "A heritage-led London developer and estate manager specialising in the restoration and operation of prime central-London residential assets — combining conservation-grade craftsmanship with fully managed, income-producing buildings.",
            "overview_ar": "مطوّر ومدير عقاري في لندن متخصص في ترميم وتشغيل الأصول السكنية الراقية في وسط لندن، يجمع بين حِرفية الحفاظ على التراث ومبانٍ مُدارة بالكامل ومدرّة للدخل.",
            "years_experience": 18,
            "completed_projects": 26,
            "ongoing_projects": 4,
            "rating": 4.8,
            "location": "Kensington, London, United Kingdom",
            "location_ar": "كنزينغتون، لندن، المملكة المتحدة",
            "email": "info@capimaxbrx.com",
            "phone": "+1 (207) 977-2889",
            "related_projects": [
                {"en": "The Kensington Residences — One Bedroom", "ar": "ذا كنزينغتون — شقة غرفة واحدة"},
                {"en": "The Kensington Residences — Two Bedroom", "ar": "ذا كنزينغتون — شقة غرفتين"},
                {"en": "Chelsea Heritage Collection", "ar": "مجموعة تشيلسي التراثية"},
            ],
        },
        "insurance": {
            "provider": "CoverTech Insurance",
            "policy_number": "CT-LDN-KEN-612",
            "coverage_amount": 5872500,
            "reinsurer": "Lloyd's of London",
            "valuation_firm": "CIM Global Financial",
        },
        "market": {
            "cap_rate": "4.2%", "city_growth": "+5.8%", "vacancy_rate": "2.0%", "rent_index": "128",
            "price_index_history": [
                {"year": "2021", "value": 100}, {"year": "2022", "value": 106},
                {"year": "2023", "value": 113}, {"year": "2024", "value": 121},
                {"year": "2025", "value": 130}, {"year": "2026", "value": 138},
            ],
        },
        "amenities": [
            {"name_en": "24/7 Concierge & Doorman", "name_ar": "كونسيرج وبوّاب على مدار الساعة"},
            {"name_en": "Residents' Wellness Spa", "name_ar": "سبا وعافية للسكان"},
            {"name_en": "Rooftop Garden Lounge", "name_ar": "صالة حديقة على السطح"},
            {"name_en": "Wine Cellar & Tasting Room", "name_ar": "قبو نبيذ وغرفة تذوّق"},
            {"name_en": "Private Cinema", "name_ar": "سينما خاصة"},
            {"name_en": "EV Underground Parking", "name_ar": "موقف سفلي بشحن للسيارات الكهربائية"},
            {"name_en": "Smart-Home Integration", "name_ar": "تكامل المنزل الذكي"},
            {"name_en": "Secure Cycle Store", "name_ar": "مخزن دراجات آمن"},
        ],
        "landmarks": [
            {"name_en": "Hyde Park — 6 min walk", "name_ar": "هايد بارك — 6 دقائق سيراً"},
            {"name_en": "Harrods — 9 min walk", "name_ar": "هارودز — 9 دقائق سيراً"},
            {"name_en": "South Kensington Tube — 5 min", "name_ar": "مترو ساوث كنزينغتون — 5 دقائق"},
            {"name_en": "V&A Museum — 8 min walk", "name_ar": "متحف V&A — 8 دقائق سيراً"},
            {"name_en": "Imperial College London — 10 min", "name_ar": "إمبريال كوليدج لندن — 10 دقائق"},
        ],
        "risk_factors": [
            {"text_en": "Prime central-London values can be sensitive to macroeconomic and FX movements.", "text_ar": "قد تتأثر قيم وسط لندن الراقية بالعوامل الاقتصادية الكلية وأسعار الصرف."},
            {"text_en": "Rental income depends on sustained occupancy and tenant retention.", "text_ar": "يعتمد الدخل الإيجاري على استمرار الإشغال والاحتفاظ بالمستأجرين."},
            {"text_en": "Secondary-market liquidity may vary with demand.", "text_ar": "قد تتفاوت سيولة السوق الثانوي حسب الطلب."},
            {"text_en": "Past performance does not guarantee future returns.", "text_ar": "الأداء السابق لا يضمن النتائج المستقبلية."},
        ],
        "faqs": [
            {"question_en": "How is ownership recorded?", "question_ar": "كيف تُسجّل الملكية؟", "answer_en": "Each token is recorded on-chain and backed 1:1 by a beneficial interest in the asset-owning SPV, with records reconciled regularly.", "answer_ar": "كل توكن مسجّل على البلوكشين ومدعوم 1:1 بحق انتفاع في الشركة المالكة للأصل، مع مطابقة دورية للسجلات."},
            {"question_en": "When are distributions paid?", "question_ar": "متى تُدفع التوزيعات؟", "answer_en": "This is a delivered, income-producing asset; rental distributions follow the offering schedule (typically quarterly) to your platform wallet.", "answer_ar": "هذا أصل مُسلَّم ومُدِرّ للدخل؛ تتبع التوزيعات الإيجارية جدول العرض (ربع سنوي غالباً) إلى محفظتك على المنصة."},
            {"question_en": "Can I exit before the horizon?", "question_ar": "هل يمكنني التخارج قبل نهاية المدة؟", "answer_en": "Subject to availability, you may exit via the LP Market (1% fee) or the Secondary Market (0.5% fee).", "answer_ar": "حسب التوفر، يمكنك التخارج عبر سوق LP (رسوم 1%) أو السوق الثانوي (رسوم 0.5%)."},
            {"question_en": "Who manages the property?", "question_ar": "من يدير العقار؟", "answer_en": "The asset is professionally managed by Crestmark Estate Management, with independent valuation by CIM Global Financial.", "answer_ar": "يُدار الأصل باحترافية من Crestmark، مع تقييم مستقل من CIM Global Financial."},
        ],
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
        "developer": {
            "name": "Crestmark Developments",
            "name_ar": "كرِستمارك للتطوير",
            "overview": "The delivery arm behind Thames Bay Residences, developing large-scale waterfront regeneration schemes in London's Docklands with tier-one partners — main contractor Sir Robert McAlpine, engineer Arup, and PLP Architecture.",
            "overview_ar": "الذراع التنفيذية وراء ثيمز باي ريزيدنسز، تطوّر مشاريع تجديد ضخمة على الواجهة المائية في دوكلاندز بلندن مع شركاء من الطراز الأول — المقاول Sir Robert McAlpine والمهندس Arup ومكتب PLP للعمارة.",
            "years_experience": 20,
            "completed_projects": 15,
            "ongoing_projects": 6,
            "rating": 4.7,
            "location": "Docklands, London, United Kingdom",
            "location_ar": "دوكلاندز، لندن، المملكة المتحدة",
            "email": "info@capimaxbrx.com",
            "phone": "+1 (207) 977-2889",
            "related_projects": [
                {"en": "Thames Bay Residences — Marina Phase", "ar": "ثيمز باي — مرحلة المارينا"},
                {"en": "Greenwich Reach Waterfront", "ar": "واجهة غرينتش ريتش المائية"},
                {"en": "Royal Docks Regeneration", "ar": "تجديد رويال دوكس"},
            ],
        },
        "insurance": {
            "provider": "CoverTech Insurance",
            "policy_number": "CT-LDN-TBR-001",
            "coverage_amount": 2295000,
            "reinsurer": "Lloyd's of London",
            "valuation_firm": "CIM Global Financial",
        },
        "market": {
            "cap_rate": "5.1%", "city_growth": "+9.2%", "vacancy_rate": "3.5%", "rent_index": "118",
            "price_index_history": [
                {"year": "2021", "value": 100}, {"year": "2022", "value": 109},
                {"year": "2023", "value": 119}, {"year": "2024", "value": 129},
                {"year": "2025", "value": 140}, {"year": "2026", "value": 152},
            ],
        },
        "amenities": [
            {"name_en": "Sheltered Marina", "name_ar": "مارينا محمية"},
            {"name_en": "Riverfront Promenade", "name_ar": "ممشى على ضفة النهر"},
            {"name_en": "Sky Lounge", "name_ar": "صالة سماوية (Sky Lounge)"},
            {"name_en": "Wellness Suite", "name_ar": "جناح عافية"},
            {"name_en": "24/7 Concierge", "name_ar": "كونسيرج على مدار الساعة"},
            {"name_en": "Underground Secure Parking", "name_ar": "موقف سيارات سفلي آمن"},
            {"name_en": "Smart Building Infrastructure", "name_ar": "بنية مبنى ذكية"},
            {"name_en": "Premium Retail Promenade", "name_ar": "ممشى تجاري راقٍ"},
        ],
        "landmarks": [
            {"name_en": "Canary Wharf — 8 min", "name_ar": "كناري وارف — 8 دقائق"},
            {"name_en": "The O2 Arena — 10 min", "name_ar": "ذا O2 أرينا — 10 دقائق"},
            {"name_en": "Greenwich — 12 min", "name_ar": "غرينتش — 12 دقيقة"},
            {"name_en": "London City Airport — 14 min", "name_ar": "مطار لندن سيتي — 14 دقيقة"},
            {"name_en": "Direct River-Bus Pier", "name_ar": "رصيف حافلة نهرية مباشر"},
        ],
        "risk_factors": [
            {"text_en": "This is an off-plan asset — construction and completion timelines carry delivery risk.", "text_ar": "هذا أصل على المخطط — جداول الإنشاء والإنجاز تحمل مخاطر تسليم."},
            {"text_en": "Valuations update with construction milestones and may move up or down.", "text_ar": "تتحدّث التقييمات مع مراحل الإنشاء وقد ترتفع أو تنخفض."},
            {"text_en": "Liquidity may be limited prior to the operational phase.", "text_ar": "قد تكون السيولة محدودة قبل مرحلة التشغيل."},
            {"text_en": "Returns are subject to market conditions and currency movements.", "text_ar": "العوائد عرضة لظروف السوق وحركة العملات."},
        ],
        "faqs": [
            {"question_en": "How is construction monitored?", "question_ar": "كيف تُراقَب أعمال الإنشاء؟", "answer_en": "Progress is independently monitored through certified engineering inspections and milestone verification, published in periodic investor reports.", "answer_ar": "تُراقَب أعمال الإنشاء بشكل مستقل عبر عمليات تفتيش هندسية معتمدة والتحقق من المراحل، وتُنشر في تقارير دورية للمستثمرين."},
            {"question_en": "When is handover?", "question_ar": "متى التسليم؟", "answer_en": "Practical completion and handover are targeted for Q3 2027, subject to construction progress and approvals.", "answer_ar": "الإنجاز الفعلي والتسليم مستهدفان في الربع الثالث من 2027، رهناً بتقدّم الإنشاء والموافقات."},
            {"question_en": "How does the installment plan work?", "question_ar": "كيف تعمل خطة الأقساط؟", "answer_en": "You choose a down payment (10–30%) and pay the balance over up to 36 months; the schedule is calculated and shown before you confirm.", "answer_ar": "تختار دفعة مقدّمة (10–30%) وتسدّد الباقي على مدى 36 شهراً؛ يُحسب الجدول ويُعرض قبل التأكيد."},
            {"question_en": "Can I exit before completion?", "question_ar": "هل يمكنني التخارج قبل الاكتمال؟", "answer_en": "Subject to platform functionality and regulations, interests may be transferable via the secondary marketplace based on updated valuations.", "answer_ar": "رهناً بوظائف المنصة واللوائح، قد تكون الحصص قابلة للتحويل عبر السوق الثانوي بناءً على التقييمات المحدّثة."},
        ],
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
        developer = d.pop("developer", None)
        insurance = d.pop("insurance", None)
        market = d.pop("market", None)
        amenities = d.pop("amenities", [])
        landmarks = d.pop("landmarks", [])
        risk_factors = d.pop("risk_factors", [])
        faqs = d.pop("faqs", [])

        scalars = {k: v for k, v in d.items() if k in _SCALAR_FIELDS}
        token_price = Decimal("100")
        scalars["token_price"] = token_price
        scalars["token_supply"] = int(Decimal(str(scalars["total_value"])) / token_price)
        scalars["display_order"] = display_order
        scalars["is_published"] = True

        obj, created = Property.objects.update_or_create(slug=slug, defaults=scalars)

        # rebuild nested children idempotently
        for rel in (
            "valuation_reports", "developer_reports", "documents",
            "amenities", "landmarks", "risk_factors", "faqs",
        ):
            getattr(obj, rel).all().delete()
        for model_cls, payload in (
            (InstallmentSchedule, installment),
            (SPVRecord, spv),
            (PropertyFinancials, financials),
            (DeveloperInfo, developer),
            (InsuranceInfo, insurance),
            (MarketData, market),
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
        for a in amenities:
            Amenity.objects.create(property=obj, **a)
        for lm in landmarks:
            Landmark.objects.create(property=obj, **lm)
        for rf in risk_factors:
            RiskFactor.objects.create(property=obj, **rf)
        for fq in faqs:
            PropertyFAQ.objects.create(property=obj, **fq)

        return (1, 0) if created else (0, 1)
