"""
Seed the property catalogue from the real frontend data.

This migrates the ACTUAL entries from `src/data/properties.ts` (all 8 model types)
into Postgres, so the platform shows the same catalogue it shows today — now served
from the DB. Also seeds the 6 closed deals from `FundedProperties.tsx` and the rich
SPV / token / financials / documents for "1" (from PropertyDetail.tsx's inline data).

Idempotent: re-running update_or_create's by `slug` and rebuilds nested children.

    python manage.py seed_properties
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.properties.models import (
    DeveloperReport,
    FutureContract,
    InstallmentSchedule,
    OptionContract,
    PortfolioAsset,
    Property,
    PropertyDocument,
    PropertyFinancials,
    PropertyPhase,
    SharedOwnership,
    SPVRecord,
    TokenMetadata,
    ValuationReport,
)

# Top-level (scalar) columns we copy straight onto Property.
_SCALAR_FIELDS = {
    "name", "name_ar", "location", "location_ar", "country", "city", "image",
    "asset_type", "model", "category", "status", "yield_type", "risk_level",
    "total_value", "future_token_price", "expected_yield", "expected_growth",
    "funded", "investors", "min_investment", "duration", "duration_ar",
    "exit_eligible", "exit_availability", "insurance_active",
    "description", "description_ar", "construction_progress", "funded_date",
    "is_featured", "display_order",
}

# --------------------------------------------------------------------------- #
# Catalogue — verbatim from src/data/properties.ts (lines 168-881)
# --------------------------------------------------------------------------- #
CATALOGUE = [
    # ---- A) READY ----
    {
        "slug": "1", "model": "ready", "category": "ready",
        "name": "Marina Bay Tower", "name_ar": "برج مارينا باي",
        "location": "Dubai, UAE", "location_ar": "دبي، الإمارات",
        "country": "uae", "city": "dubai",
        "image": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
        "asset_type": "commercial", "status": "ready", "yield_type": "rental", "risk_level": "medium",
        "total_value": 5000000, "expected_yield": 9.5, "funded": 78, "investors": 234,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A Class-A operational office tower in Dubai Marina with 95% occupancy producing stabilised rental income.",
        "description_ar": "برج مكتبي تشغيلي من الفئة A في دبي مارينا بنسبة إشغال 95% ينتج دخلاً تأجيرياً مستقراً.",
        "valuation_reports": [
            {"date": "2026-01-15", "valuation": 5000000, "appraiser": "Knight Frank"},
            {"date": "2025-07-15", "valuation": 4850000, "appraiser": "JLL"},
        ],
        # Rich detail (PropertyDetail.tsx inline propertyDatabase["1"]) for the data room.
        "spv": {"name": "Marina Bay Tower SPV Ltd", "jurisdiction": "DIFC, Dubai", "registration_number": "SPV-2024-001234", "established": "2024-01-15"},
        # total_supply / tokenized_units MUST equal Property.token_supply (50,000 =
        # 5,000,000 / 100). TokenMetadata.save() force-syncs these (Wave 2 policy #4);
        # set them correctly here too so the seed isn't self-contradictory.
        "token_metadata": {"contract_address": "0x7a23f4c8b9d2e1a0c3b4d5e6f7a8b9c0d1e2f3a4", "network": "Ethereum", "network_icon": "⟠", "standard": "ERC-1155", "total_supply": 50000, "tokenized_units": 50000, "token_price": 100, "verified": True, "deployed_date": "2024-01-15", "explorer_url": "https://etherscan.io/address/0x7a23f4c8b9d2e1a0c3b4d5e6f7a8b9c0d1e2f3a4"},
        "financials": {"purchase_price": 4500000, "current_valuation": 5000000, "gross_rental_income": 475000, "operating_expenses": 95000, "net_operating_income": 380000, "cap_rate": 8.44, "occupancy_rate": 95},
        "documents": [
            {"name": "تقرير التقييم", "name_en": "Valuation Report", "date": "2024-12-01", "doc_type": "valuation"},
            {"name": "عقد الملكية", "name_en": "Title Deed", "date": "2024-01-15", "doc_type": "legal"},
            {"name": "شهادة التأمين", "name_en": "Insurance Certificate", "date": "2024-11-01", "doc_type": "insurance"},
            {"name": "البيانات المالية", "name_en": "Financial Statements", "date": "2024-12-15", "doc_type": "financial"},
        ],
    },
    {
        "slug": "3", "model": "ready", "category": "ready",
        "name": "Industrial Park", "name_ar": "المجمع الصناعي",
        "location": "Riyadh, KSA", "location_ar": "الرياض، السعودية",
        "country": "ksa", "city": "riyadh",
        "image": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800",
        "asset_type": "industrial", "status": "ready", "yield_type": "rental", "risk_level": "low",
        "total_value": 12000000, "expected_yield": 11.2, "funded": 92, "investors": 89,
        "min_investment": 100, "duration": "7 years", "duration_ar": "7 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "Long-lease industrial logistics park anchored by an investment-grade tenant.",
        "description_ar": "مجمع لوجستي صناعي بعقود إيجار طويلة مع مستأجر من الدرجة الاستثمارية.",
    },
    # ---- B) UNDER CONSTRUCTION (5 models) ----
    {
        "slug": "10", "model": "installment", "category": "construction",
        "name": "Skyline Heights Residences", "name_ar": "مساكن سكاي لاين هايتس",
        "location": "Dubai, UAE", "location_ar": "دبي، الإمارات",
        "country": "uae", "city": "dubai",
        "image": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
        "asset_type": "residential", "status": "construction", "yield_type": "hybrid", "risk_level": "medium",
        "total_value": 8000000, "expected_growth": 28, "expected_yield": 7.5, "funded": 45, "investors": 156,
        "min_investment": 100, "duration": "3 years", "duration_ar": "3 سنوات",
        "exit_eligible": False, "exit_availability": "lp", "insurance_active": True,
        "description": "Premium residential development funded through scheduled monthly installments. Ownership accrues with each paid milestone.",
        "description_ar": "تطوير سكني فاخر يموَّل عبر أقساط شهرية مجدولة. تتراكم الملكية مع كل دفعة مكتملة.",
        "construction_progress": 38,
        "installment": {"total_installments": 24, "paid_installments": 11, "monthly_amount": 100, "next_payment_date": "2026-06-01", "activation_date": "2027-03-15", "completion_percent": 46},
        "developer_reports": [
            {"date": "2026-04-30", "title": "Foundation complete", "title_ar": "اكتمال الأساسات", "progress": 38},
            {"date": "2026-02-28", "title": "Site preparation", "title_ar": "تجهيز الموقع", "progress": 18},
        ],
    },
    {
        "slug": "11", "model": "phasing", "category": "construction",
        "name": "Riyadh Boulevard Phase Project", "name_ar": "مشروع رياض بوليفارد المرحلي",
        "location": "Riyadh, KSA", "location_ar": "الرياض، السعودية",
        "country": "ksa", "city": "riyadh",
        "image": "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800",
        "asset_type": "mixed", "status": "construction", "yield_type": "appreciation", "risk_level": "medium",
        "total_value": 22000000, "future_token_price": 145, "expected_growth": 45, "funded": 60, "investors": 312,
        "min_investment": 100, "duration": "4 years", "duration_ar": "4 سنوات",
        "exit_eligible": True, "exit_availability": "secondary", "insurance_active": True,
        "description": "A multi-phase mixed-use development. Token price re-prices upward at each construction phase, driven by valuation reports and milestone completion.",
        "description_ar": "تطوير متعدد الاستخدامات على مراحل. يُعاد تسعير الرمز صعوداً في كل مرحلة بناء استناداً إلى تقارير التقييم واكتمال المعالم.",
        "construction_progress": 42,
        "phases": [
            {"number": 1, "name": "Site & Foundations", "name_ar": "الموقع والأساسات", "token_price": 100, "start_date": "2025-09-01", "end_date": "2026-03-01", "status": "completed", "progress": 100},
            {"number": 2, "name": "Structural Build", "name_ar": "البناء الإنشائي", "token_price": 120, "start_date": "2026-03-01", "end_date": "2027-01-01", "status": "current", "progress": 42},
            {"number": 3, "name": "Façade & MEP", "name_ar": "الواجهة والأنظمة", "token_price": 145, "start_date": "2027-01-01", "end_date": "2027-09-01", "status": "upcoming", "progress": 0},
            {"number": 4, "name": "Handover", "name_ar": "التسليم", "token_price": 175, "start_date": "2027-09-01", "end_date": "2028-01-01", "status": "upcoming", "progress": 0},
        ],
        "valuation_reports": [
            {"date": "2026-03-15", "valuation": 22000000, "appraiser": "CBRE"},
            {"date": "2025-09-01", "valuation": 18000000, "appraiser": "Colliers"},
        ],
    },
    {
        "slug": "12", "model": "future", "category": "construction",
        "name": "Doha Bayfront Future Block", "name_ar": "كتلة دوحة بايفرونت المستقبلية",
        "location": "Doha, Qatar", "location_ar": "الدوحة، قطر",
        "country": "qatar", "city": "doha",
        "image": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
        "asset_type": "residential", "status": "construction", "yield_type": "appreciation", "risk_level": "high",
        "total_value": 15000000, "future_token_price": 138, "expected_growth": 38, "funded": 28, "investors": 45,
        "min_investment": 100, "duration": "4 years", "duration_ar": "4 سنوات",
        "exit_eligible": False, "exit_availability": "secondary", "insurance_active": False,
        "description": "Reserve future ownership exposure today at a predefined price structure. Ownership is activated and settled at the contract execution date.",
        "description_ar": "احجز انكشاف ملكية مستقبلية اليوم وفق هيكل تسعير محدد مسبقاً. تُفعَّل الملكية وتُسوّى في تاريخ تنفيذ العقد.",
        "construction_progress": 18,
        "future": {"reservation_date": "2026-05-01", "activation_date": "2027-12-01", "settlement_date": "2028-02-01", "reservation_price": 100, "estimated_future_value": 138, "estimated_roi": 38},
    },
    {
        "slug": "13", "model": "option", "category": "construction",
        "name": "Manama Skyline Option Pool", "name_ar": "مجمع خيارات أفق المنامة",
        "location": "Manama, Bahrain", "location_ar": "المنامة، البحرين",
        "country": "bahrain", "city": "manama",
        "image": "https://images.unsplash.com/photo-1570126618953-d437176e8c79?w=800",
        "asset_type": "commercial", "status": "construction", "yield_type": "appreciation", "risk_level": "high",
        "total_value": 6000000, "future_token_price": 130, "expected_growth": 30, "funded": 22, "investors": 31,
        "min_investment": 100, "duration": "18 months", "duration_ar": "18 شهراً",
        "exit_eligible": False, "exit_availability": "none", "insurance_active": False,
        "description": "Purchase the right — but not the obligation — to acquire tokenised shares later at a locked strike price.",
        "description_ar": "اشترِ الحق وليس الالتزام في الحصول على حصص مرمزة لاحقاً بسعر تنفيذ مثبَّت.",
        "option": {"option_premium": 8, "strike_price": 100, "expiry_date": "2027-11-15", "validity_months": 18, "estimated_future_value": 130, "exercise_conditions": "Exercisable any time before expiry. Premium is non-refundable. Subject to KYC and SPV admission.", "exercise_conditions_ar": "قابل للتنفيذ في أي وقت قبل الانتهاء. علاوة الخيار غير قابلة للاسترداد. يخضع لاعتماد الامتثال والدخول إلى الشركة ذات الغرض الخاص."},
    },
    {
        "slug": "14", "model": "shared", "category": "construction",
        "name": "Muscat Coastal Co-Ownership", "name_ar": "ملكية مشتركة لساحل مسقط",
        "location": "Muscat, Oman", "location_ar": "مسقط، عمان",
        "country": "oman", "city": "muscat",
        "image": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
        "asset_type": "hospitality", "status": "construction", "yield_type": "hybrid", "risk_level": "medium",
        "total_value": 9500000, "expected_yield": 8.2, "expected_growth": 18, "funded": 35, "investors": 64,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": True, "exit_availability": "lp", "insurance_active": True,
        "description": "Co-own a coastal hospitality asset directly with the developer. Investors share revenue pro-rata to their ownership.",
        "description_ar": "شارك في ملكية أصل ضيافة ساحلي مع المطور مباشرة. يتقاسم المستثمرون الإيراد بالتناسب مع نسبة ملكيتهم.",
        "construction_progress": 25,
        "shared": {"investor_share": 60, "owner_share": 40, "owner_name": "Coastal Holdings LLC", "profit_split": "Pro-rata to ownership", "revenue_distribution": "quarterly", "transfer_process": "Transfers require 14-day notice and right-of-first-refusal to existing co-owners.", "transfer_process_ar": "تتطلب التحويلات إشعاراً مدته 14 يوماً وحق أولوية للملاك المشاركين الحاليين."},
    },
    # ---- C) READY PORTFOLIOS ----
    {
        "slug": "20", "model": "ready_portfolio", "category": "ready_portfolio",
        "name": "GCC Income Portfolio I", "name_ar": "محفظة دخل دول الخليج الأولى",
        "location": "GCC", "location_ar": "دول الخليج", "country": "uae", "city": "multi",
        "image": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
        "asset_type": "mixed", "status": "ready", "yield_type": "rental", "risk_level": "low",
        "total_value": 35000000, "expected_yield": 9.8, "funded": 64, "investors": 412,
        "min_investment": 100, "duration": "6 years", "duration_ar": "6 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A diversified portfolio of operational, income-producing assets across the GCC.",
        "description_ar": "محفظة متنوعة من الأصول التشغيلية المدرّة للدخل عبر دول الخليج.",
        "portfolio_assets": [
            {"asset_slug": "p1-a", "name": "Marina Tower", "name_ar": "برج مارينا", "city": "Dubai", "weight": 30, "asset_type": "commercial"},
            {"asset_slug": "p1-b", "name": "Riyadh Logistics", "name_ar": "لوجستيات الرياض", "city": "Riyadh", "weight": 25, "asset_type": "industrial"},
            {"asset_slug": "p1-c", "name": "Doha Retail Strip", "name_ar": "تجزئة الدوحة", "city": "Doha", "weight": 20, "asset_type": "commercial"},
            {"asset_slug": "p1-d", "name": "Abu Dhabi Residences", "name_ar": "مساكن أبوظبي", "city": "Abu Dhabi", "weight": 25, "asset_type": "residential"},
        ],
    },
    # ---- D) UNDER-CONSTRUCTION PORTFOLIO ----
    {
        "slug": "30", "model": "construction_portfolio", "category": "construction_portfolio",
        "name": "Future Cities Growth Portfolio", "name_ar": "محفظة نمو مدن المستقبل",
        "location": "GCC", "location_ar": "دول الخليج", "country": "ksa", "city": "multi",
        "image": "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800",
        "asset_type": "mixed", "status": "construction", "yield_type": "appreciation", "risk_level": "high",
        "total_value": 48000000, "future_token_price": 152, "expected_growth": 52, "funded": 31, "investors": 198,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": False, "exit_availability": "secondary", "insurance_active": True,
        "description": "A bundle of under-construction developments selected for capital appreciation across emerging GCC growth corridors.",
        "description_ar": "حزمة من التطويرات قيد الإنشاء مختارة لتحقيق نمو رأسمالي عبر ممرات النمو الناشئة في دول الخليج.",
        "construction_progress": 24,
        "portfolio_assets": [
            {"asset_slug": "p2-a", "name": "NEOM Edge Block", "name_ar": "كتلة نيوم", "city": "NEOM", "weight": 35, "asset_type": "mixed"},
            {"asset_slug": "p2-b", "name": "Riyadh Boulevard", "name_ar": "رياض بوليفارد", "city": "Riyadh", "weight": 25, "asset_type": "mixed"},
            {"asset_slug": "p2-c", "name": "Lusail District", "name_ar": "حي لوسيل", "city": "Doha", "weight": 20, "asset_type": "residential"},
            {"asset_slug": "p2-d", "name": "Dubai South Hub", "name_ar": "محور دبي الجنوب", "city": "Dubai", "weight": 20, "asset_type": "commercial"},
        ],
    },
    # ---- MORE READY ----
    {
        "slug": "40", "model": "ready", "category": "ready",
        "name": "Jumeirah Residence Tower", "name_ar": "برج جميرا السكني",
        "location": "Jumeirah, Dubai, UAE", "location_ar": "جميرا، دبي، الإمارات",
        "country": "uae", "city": "dubai",
        "image": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800",
        "asset_type": "residential", "status": "ready", "yield_type": "rental", "risk_level": "low",
        "total_value": 7800000, "expected_yield": 8.4, "funded": 56, "investors": 187,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A premium residential tower with 92% occupancy delivering stable monthly rental yield.",
        "description_ar": "برج سكني فاخر بنسبة إشغال 92% يقدم عائد إيجار شهري مستقر.",
    },
    {
        "slug": "41", "model": "ready", "category": "ready",
        "name": "Doha Retail Plaza", "name_ar": "ساحة الدوحة للتجزئة",
        "location": "West Bay, Doha, Qatar", "location_ar": "الخليج الغربي، الدوحة، قطر",
        "country": "qatar", "city": "doha",
        "image": "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800",
        "asset_type": "commercial", "status": "ready", "yield_type": "rental", "risk_level": "medium",
        "total_value": 6400000, "expected_yield": 10.1, "funded": 71, "investors": 142,
        "min_investment": 100, "duration": "6 years", "duration_ar": "6 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A flagship retail plaza anchored by international brands in Doha's West Bay.",
        "description_ar": "ساحة تجزئة رائدة مع علامات تجارية عالمية في الخليج الغربي بالدوحة.",
    },
    {
        "slug": "42", "model": "ready", "category": "ready",
        "name": "Manama Boutique Hotel", "name_ar": "فندق المنامة البوتيكي",
        "location": "Seef District, Manama, Bahrain", "location_ar": "السيف، المنامة، البحرين",
        "country": "bahrain", "city": "manama",
        "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        "asset_type": "hospitality", "status": "ready", "yield_type": "hybrid", "risk_level": "medium",
        "total_value": 9200000, "expected_yield": 9.8, "funded": 48, "investors": 96,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "An award-winning boutique hotel with stabilised ADR and 84% year-round occupancy.",
        "description_ar": "فندق بوتيكي حائز على جوائز بمتوسط سعر مستقر ونسبة إشغال 84% على مدار السنة.",
    },
    {
        "slug": "43", "model": "ready", "category": "ready",
        "name": "Muscat Mixed-Use Complex", "name_ar": "مجمع مسقط متعدد الاستخدامات",
        "location": "Al Qurum, Muscat, Oman", "location_ar": "القرم، مسقط، عمان",
        "country": "oman", "city": "muscat",
        "image": "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800",
        "asset_type": "mixed", "status": "ready", "yield_type": "rental", "risk_level": "low",
        "total_value": 11500000, "expected_yield": 8.9, "funded": 63, "investors": 219,
        "min_investment": 100, "duration": "7 years", "duration_ar": "7 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A mixed-use complex combining offices, retail, and serviced apartments under long-term leases.",
        "description_ar": "مجمع متعدد الاستخدامات يجمع مكاتب وتجزئة وشقق فندقية بعقود إيجار طويلة الأجل.",
    },
    # ---- MORE READY PORTFOLIOS ----
    {
        "slug": "50", "model": "ready_portfolio", "category": "ready_portfolio",
        "name": "GCC Commercial Income Portfolio II", "name_ar": "محفظة الدخل التجاري الخليجي الثانية",
        "location": "GCC", "location_ar": "دول الخليج", "country": "uae", "city": "multi",
        "image": "https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=800",
        "asset_type": "commercial", "status": "ready", "yield_type": "rental", "risk_level": "low",
        "total_value": 42000000, "expected_yield": 10.4, "funded": 52, "investors": 318,
        "min_investment": 100, "duration": "6 years", "duration_ar": "6 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A diversified income portfolio of stabilised commercial assets across Tier-1 GCC cities.",
        "description_ar": "محفظة دخل متنوعة من الأصول التجارية المستقرة عبر مدن الخليج من الفئة الأولى.",
        "portfolio_assets": [
            {"asset_slug": "p3-a", "name": "DIFC Office Block", "name_ar": "مكاتب DIFC", "city": "Dubai", "weight": 35, "asset_type": "commercial"},
            {"asset_slug": "p3-b", "name": "Riyadh Retail Hub", "name_ar": "تجزئة الرياض", "city": "Riyadh", "weight": 25, "asset_type": "commercial"},
            {"asset_slug": "p3-c", "name": "Doha Business Tower", "name_ar": "برج أعمال الدوحة", "city": "Doha", "weight": 25, "asset_type": "commercial"},
            {"asset_slug": "p3-d", "name": "Manama Logistics", "name_ar": "لوجستيات المنامة", "city": "Manama", "weight": 15, "asset_type": "industrial"},
        ],
    },
    {
        "slug": "51", "model": "ready_portfolio", "category": "ready_portfolio",
        "name": "Hospitality Yield Portfolio", "name_ar": "محفظة عائد الضيافة",
        "location": "GCC", "location_ar": "دول الخليج", "country": "uae", "city": "multi",
        "image": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
        "asset_type": "hospitality", "status": "ready", "yield_type": "hybrid", "risk_level": "medium",
        "total_value": 28000000, "expected_yield": 11.6, "funded": 47, "investors": 241,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "A curated portfolio of operating boutique hotels and serviced residences in major GCC tourism hubs.",
        "description_ar": "محفظة مختارة من فنادق بوتيك تشغيلية وشقق فندقية في أهم مراكز السياحة الخليجية.",
        "portfolio_assets": [
            {"asset_slug": "p4-a", "name": "Dubai Beach Hotel", "name_ar": "فندق شاطئ دبي", "city": "Dubai", "weight": 30, "asset_type": "hospitality"},
            {"asset_slug": "p4-b", "name": "Jeddah Resort", "name_ar": "منتجع جدة", "city": "Jeddah", "weight": 25, "asset_type": "hospitality"},
            {"asset_slug": "p4-c", "name": "Doha Marina Suites", "name_ar": "أجنحة مارينا الدوحة", "city": "Doha", "weight": 25, "asset_type": "hospitality"},
            {"asset_slug": "p4-d", "name": "Muscat Coastal Resort", "name_ar": "منتجع ساحل مسقط", "city": "Muscat", "weight": 20, "asset_type": "hospitality"},
        ],
    },
    {
        "slug": "52", "model": "ready_portfolio", "category": "ready_portfolio",
        "name": "Industrial & Logistics Income Portfolio", "name_ar": "محفظة دخل الصناعة واللوجستيات",
        "location": "KSA & UAE", "location_ar": "السعودية والإمارات", "country": "ksa", "city": "multi",
        "image": "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800",
        "asset_type": "industrial", "status": "ready", "yield_type": "rental", "risk_level": "low",
        "total_value": 33000000, "expected_yield": 10.9, "funded": 68, "investors": 287,
        "min_investment": 100, "duration": "8 years", "duration_ar": "8 سنوات",
        "exit_eligible": True, "exit_availability": "both", "insurance_active": True,
        "description": "Long-lease logistics warehouses and last-mile fulfilment centres anchored by investment-grade tenants.",
        "description_ar": "مستودعات لوجستية بعقود طويلة ومراكز توزيع مدعومة بمستأجرين من الدرجة الاستثمارية.",
        "portfolio_assets": [
            {"asset_slug": "p5-a", "name": "Riyadh Logistics Hub", "name_ar": "محور الرياض اللوجستي", "city": "Riyadh", "weight": 35, "asset_type": "industrial"},
            {"asset_slug": "p5-b", "name": "Dubai South Warehouse", "name_ar": "مستودع دبي الجنوب", "city": "Dubai", "weight": 30, "asset_type": "industrial"},
            {"asset_slug": "p5-c", "name": "Jeddah Cold Storage", "name_ar": "تخزين بارد جدة", "city": "Jeddah", "weight": 20, "asset_type": "industrial"},
            {"asset_slug": "p5-d", "name": "Sharjah Light Industrial", "name_ar": "صناعات خفيفة الشارقة", "city": "Sharjah", "weight": 15, "asset_type": "industrial"},
        ],
    },
    # ---- MORE CONSTRUCTION PORTFOLIOS ----
    {
        "slug": "60", "model": "construction_portfolio", "category": "construction_portfolio",
        "name": "NEOM Growth Bundle", "name_ar": "حزمة نمو نيوم",
        "location": "NEOM, KSA", "location_ar": "نيوم، السعودية", "country": "ksa", "city": "neom",
        "image": "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800",
        "asset_type": "mixed", "status": "construction", "yield_type": "appreciation", "risk_level": "high",
        "total_value": 65000000, "future_token_price": 168, "expected_growth": 68, "funded": 38, "investors": 412,
        "min_investment": 100, "duration": "6 years", "duration_ar": "6 سنوات",
        "exit_eligible": False, "exit_availability": "secondary", "insurance_active": True,
        "description": "A bundle of NEOM-zone construction assets across mixed-use, hospitality, and tech corridors.",
        "description_ar": "حزمة من أصول الإنشاء في منطقة نيوم عبر استخدامات متعددة وضيافة وممرات تقنية.",
        "construction_progress": 18,
        "portfolio_assets": [
            {"asset_slug": "p6-a", "name": "The Line Edge", "name_ar": "حافة ذا لاين", "city": "NEOM", "weight": 40, "asset_type": "mixed"},
            {"asset_slug": "p6-b", "name": "Sindalah Residences", "name_ar": "مساكن سندالة", "city": "NEOM", "weight": 30, "asset_type": "residential"},
            {"asset_slug": "p6-c", "name": "Trojena Tourism Block", "name_ar": "كتلة سياحة تروجينا", "city": "NEOM", "weight": 20, "asset_type": "hospitality"},
            {"asset_slug": "p6-d", "name": "Oxagon Industrial", "name_ar": "صناعات أوكساجون", "city": "NEOM", "weight": 10, "asset_type": "industrial"},
        ],
    },
    {
        "slug": "61", "model": "construction_portfolio", "category": "construction_portfolio",
        "name": "UAE Residential Pipeline", "name_ar": "خط الأنابيب السكني الإماراتي",
        "location": "UAE", "location_ar": "الإمارات", "country": "uae", "city": "multi",
        "image": "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800",
        "asset_type": "residential", "status": "construction", "yield_type": "appreciation", "risk_level": "medium",
        "total_value": 38000000, "future_token_price": 142, "expected_growth": 42, "funded": 44, "investors": 256,
        "min_investment": 100, "duration": "4 years", "duration_ar": "4 سنوات",
        "exit_eligible": False, "exit_availability": "secondary", "insurance_active": True,
        "description": "A diversified pipeline of UAE residential developments selected for capital growth and post-handover yield.",
        "description_ar": "خط أنابيب متنوع من المشاريع السكنية الإماراتية مختار لنمو رأس المال وعائد ما بعد التسليم.",
        "construction_progress": 32,
        "portfolio_assets": [
            {"asset_slug": "p7-a", "name": "Palm West Tower", "name_ar": "برج النخلة الغربي", "city": "Dubai", "weight": 35, "asset_type": "residential"},
            {"asset_slug": "p7-b", "name": "Yas Bay Residences", "name_ar": "مساكن خليج ياس", "city": "Abu Dhabi", "weight": 30, "asset_type": "residential"},
            {"asset_slug": "p7-c", "name": "Sharjah Waterfront", "name_ar": "واجهة الشارقة", "city": "Sharjah", "weight": 20, "asset_type": "residential"},
            {"asset_slug": "p7-d", "name": "Ras Al Khaimah Coast", "name_ar": "ساحل رأس الخيمة", "city": "RAK", "weight": 15, "asset_type": "residential"},
        ],
    },
    {
        "slug": "62", "model": "construction_portfolio", "category": "construction_portfolio",
        "name": "Saudi Vision 2030 Build Portfolio", "name_ar": "محفظة بناء رؤية 2030",
        "location": "KSA", "location_ar": "السعودية", "country": "ksa", "city": "multi",
        "image": "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800",
        "asset_type": "mixed", "status": "construction", "yield_type": "hybrid", "risk_level": "medium",
        "total_value": 52000000, "future_token_price": 156, "expected_growth": 56, "expected_yield": 6.5, "funded": 41, "investors": 334,
        "min_investment": 100, "duration": "5 years", "duration_ar": "5 سنوات",
        "exit_eligible": False, "exit_availability": "secondary", "insurance_active": True,
        "description": "Aligned to Vision 2030 megaprojects, this portfolio combines giga-project exposure with mixed-use yield assets.",
        "description_ar": "متوافقة مع المشاريع العملاقة لرؤية 2030، تجمع هذه المحفظة بين انكشاف المشاريع العملاقة وأصول العائد متعددة الاستخدامات.",
        "construction_progress": 28,
        "portfolio_assets": [
            {"asset_slug": "p8-a", "name": "Diriyah Gate Asset", "name_ar": "أصل بوابة الدرعية", "city": "Riyadh", "weight": 30, "asset_type": "mixed"},
            {"asset_slug": "p8-b", "name": "Red Sea Resort", "name_ar": "منتجع البحر الأحمر", "city": "Tabuk", "weight": 25, "asset_type": "hospitality"},
            {"asset_slug": "p8-c", "name": "Qiddiya Entertainment", "name_ar": "ترفيه القدية", "city": "Riyadh", "weight": 25, "asset_type": "mixed"},
            {"asset_slug": "p8-d", "name": "ROSHN Sedra", "name_ar": "روشن سدرة", "city": "Riyadh", "weight": 20, "asset_type": "residential"},
        ],
    },
]

# --------------------------------------------------------------------------- #
# Closed deals — verbatim from FundedProperties.tsx inline `fundedProperties`
# (modeled as funded=100, sold-out, with funded_date). Excluded from Marketplace
# by its own `funded >= 100` client filter; surfaced via /api/properties/funded/.
# --------------------------------------------------------------------------- #
FUNDED = [
    {"slug": "fp-1", "name": "Tech Hub Warehouse", "name_ar": "مستودع المركز التقني", "location": "Dubai, UAE", "location_ar": "دبي، الإمارات", "image": "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800", "asset_type": "industrial", "funded_date": "2024-11-15", "total_value": 9000000, "investors": 312, "expected_yield": 10.5, "duration": "6 years", "duration_ar": "6 سنوات", "city": "dubai", "country": "uae"},
    {"slug": "fp-2", "name": "Marina Heights Residences", "name_ar": "مساكن مارينا هايتس", "location": "Abu Dhabi, UAE", "location_ar": "أبوظبي، الإمارات", "image": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800", "asset_type": "residential", "funded_date": "2024-10-28", "total_value": 12500000, "investors": 487, "expected_yield": 8.8, "duration": "5 years", "duration_ar": "5 سنوات", "city": "abudhabi", "country": "uae"},
    {"slug": "fp-3", "name": "Business Bay Tower", "name_ar": "برج بزنس باي", "location": "Dubai, UAE", "location_ar": "دبي، الإمارات", "image": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800", "asset_type": "commercial", "funded_date": "2024-09-12", "total_value": 18000000, "investors": 652, "expected_yield": 9.2, "duration": "7 years", "duration_ar": "7 سنوات", "city": "dubai", "country": "uae"},
    {"slug": "fp-4", "name": "Riyadh Logistics Center", "name_ar": "مركز الرياض اللوجستي", "location": "Riyadh, KSA", "location_ar": "الرياض، السعودية", "image": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800", "asset_type": "industrial", "funded_date": "2024-08-05", "total_value": 7500000, "investors": 198, "expected_yield": 11.5, "duration": "5 years", "duration_ar": "5 سنوات", "city": "riyadh", "country": "ksa"},
    {"slug": "fp-5", "name": "Jeddah Medical Complex", "name_ar": "مجمع جدة الطبي", "location": "Jeddah, KSA", "location_ar": "جدة، السعودية", "image": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800", "asset_type": "commercial", "funded_date": "2024-07-20", "total_value": 22000000, "investors": 834, "expected_yield": 8.5, "duration": "10 years", "duration_ar": "10 سنوات", "city": "jeddah", "country": "ksa"},
    {"slug": "fp-6", "name": "Qatar Pearl Villas", "name_ar": "فلل لؤلؤة قطر", "location": "Doha, Qatar", "location_ar": "الدوحة، قطر", "image": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", "asset_type": "residential", "funded_date": "2024-06-18", "total_value": 15000000, "investors": 423, "expected_yield": 7.8, "duration": "4 years", "duration_ar": "4 سنوات", "city": "doha", "country": "qatar"},
]


class Command(BaseCommand):
    help = "Seed the property catalogue (and closed deals) from the real frontend data."

    @transaction.atomic
    def handle(self, *args, **options):
        created = updated = 0
        for order, data in enumerate(CATALOGUE):
            c, u = self._upsert(data, display_order=order)
            created += c
            updated += u
        for order, data in enumerate(FUNDED, start=1000):
            fd = dict(data)
            fd.setdefault("model", "ready")
            fd.setdefault("category", "ready")
            fd.setdefault("status", "sold-out")
            fd.setdefault("yield_type", "rental")
            fd.setdefault("risk_level", "medium")
            fd.setdefault("exit_eligible", True)
            fd.setdefault("exit_availability", "both")
            fd.setdefault("insurance_active", True)
            fd.setdefault("funded", 100)
            fd.setdefault("description", f"{fd['name']} — fully funded.")
            fd.setdefault("description_ar", f"{fd['name_ar']} — تم تمويله بالكامل.")
            c, u = self._upsert(fd, display_order=order)
            created += c
            updated += u

        total = Property.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {created} created, {updated} updated. {total} properties total."
            )
        )

    def _upsert(self, data, display_order):
        d = dict(data)
        slug = d.pop("slug")
        # nested blocks
        installment = d.pop("installment", None)
        future = d.pop("future", None)
        option = d.pop("option", None)
        shared = d.pop("shared", None)
        phases = d.pop("phases", [])
        portfolio_assets = d.pop("portfolio_assets", [])
        developer_reports = d.pop("developer_reports", [])
        valuation_reports = d.pop("valuation_reports", [])
        spv = d.pop("spv", None)
        token_metadata = d.pop("token_metadata", None)
        financials = d.pop("financials", None)
        documents = d.pop("documents", [])

        scalars = {k: v for k, v in d.items() if k in _SCALAR_FIELDS}
        token_price = Decimal("100")
        scalars["token_price"] = token_price
        scalars["token_supply"] = int(Decimal(str(scalars["total_value"])) / token_price)
        scalars["display_order"] = display_order

        obj, created = Property.objects.update_or_create(slug=slug, defaults=scalars)

        # rebuild nested children idempotently
        for rel in (
            "phases", "portfolio_assets", "developer_reports", "valuation_reports", "documents",
        ):
            getattr(obj, rel).all().delete()
        for model_cls, payload in (
            (InstallmentSchedule, installment),
            (FutureContract, future),
            (OptionContract, option),
            (SharedOwnership, shared),
            (SPVRecord, spv),
            (TokenMetadata, token_metadata),
            (PropertyFinancials, financials),
        ):
            model_cls.objects.filter(property=obj).delete()
            if payload:
                model_cls.objects.create(property=obj, **payload)

        for p in phases:
            PropertyPhase.objects.create(property=obj, **p)
        for a in portfolio_assets:
            PortfolioAsset.objects.create(property=obj, **a)
        for r in developer_reports:
            DeveloperReport.objects.create(property=obj, **r)
        for v in valuation_reports:
            ValuationReport.objects.create(property=obj, **v)
        for doc in documents:
            PropertyDocument.objects.create(property=obj, **doc)

        return (1, 0) if created else (0, 1)
