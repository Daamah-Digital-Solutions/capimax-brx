// Single source-of-truth catalogue for all marketplace opportunities.
// Each property is classified by its `model` so the marketplace can
// route it to the correct template and the correct category tab.

export type PropertyModel =
  | "ready"
  | "ready_portfolio"
  | "installment"
  | "phasing"
  | "future"
  | "option"
  | "shared"
  | "construction_portfolio";

export type PropertyCategory =
  | "ready"
  | "construction"
  | "ready_portfolio"
  | "construction_portfolio";

export type AssetType =
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed"
  | "hospitality"
  | "land";

export type YieldType = "rental" | "appreciation" | "hybrid";
export type ExitAvailability = "lp" | "secondary" | "both" | "none";
export type RiskLevel = "low" | "medium" | "high";

// ---- model-specific structures ----
export interface InstallmentSchedule {
  totalInstallments: number;
  paidInstallments: number;
  monthlyAmount: number;
  nextPaymentDate: string;
  activationDate: string;
  completionPercent: number;
}

export interface PhaseInfo {
  number: number;
  name: string;
  nameAr: string;
  tokenPrice: number;
  startDate: string;
  endDate: string;
  status: "completed" | "current" | "upcoming";
  progress: number;
}

export interface FutureContract {
  reservationDate: string;
  activationDate: string;
  settlementDate: string;
  reservationPrice: number;
  estimatedFutureValue: number;
  estimatedRoi: number;
}

export interface OptionContract {
  optionPremium: number;
  strikePrice: number;
  expiryDate: string;
  validityMonths: number;
  estimatedFutureValue: number;
  exerciseConditions: string;
  exerciseConditionsAr: string;
}

export interface SharedOwnership {
  investorShare: number; // percentage available to platform investors
  ownerShare: number;    // retained by original owner / developer
  ownerName: string;
  profitSplit: string;   // e.g. "Pro-rata"
  revenueDistribution: "monthly" | "quarterly" | "annual";
  transferProcess: string;
  transferProcessAr: string;
}

export interface PortfolioAsset {
  id: string;
  name: string;
  nameAr: string;
  city: string;
  weight: number; // percentage of portfolio
  assetType: AssetType;
}

// ---- shared structures ----
export interface DeveloperReport {
  date: string;
  title: string;
  titleAr: string;
  progress: number;
}

export interface ValuationReport {
  date: string;
  valuation: number;
  appraiser: string;
}

// ---- main property type ----
export interface Property {
  id: string;
  model: PropertyModel;
  category: PropertyCategory;

  // identity
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  country: string; // uae | ksa | qatar | bahrain | oman
  city: string;
  image: string;
  images?: string[];

  // classification
  assetType: AssetType;
  status: "ready" | "construction" | "sold-out";
  yieldType: YieldType;
  riskLevel: RiskLevel;

  // economics (token price always $100 platform-wide)
  totalValue: number;
  tokenPrice: 100;
  futureTokenPrice?: number;
  expectedYield?: number;     // annual % for income-producing
  expectedGrowth?: number;    // appreciation % for under-construction
  funded: number;             // 0..100
  investors: number;
  minInvestment: number;
  duration: string;
  durationAr: string;

  // exit & liquidity
  exitEligible: boolean;
  exitAvailability: ExitAvailability;
  insuranceActive: boolean;

  // narrative
  description: string;
  descriptionAr: string;

  // model-specific (only one will be populated based on `model`)
  installment?: InstallmentSchedule;
  phases?: PhaseInfo[];
  future?: FutureContract;
  option?: OptionContract;
  shared?: SharedOwnership;
  portfolioAssets?: PortfolioAsset[];

  // reports
  developerReports?: DeveloperReport[];
  valuationReports?: ValuationReport[];

  // construction (for any under-construction model)
  constructionProgress?: number;
}

// =============================================================
// Catalogue
// =============================================================
export const properties: Property[] = [
  // ============= A) READY PROPERTIES =============
  {
    id: "1",
    model: "ready",
    category: "ready",
    name: "Marina Bay Tower",
    nameAr: "برج مارينا باي",
    location: "Dubai, UAE",
    locationAr: "دبي، الإمارات",
    country: "uae",
    city: "dubai",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    assetType: "commercial",
    status: "ready",
    yieldType: "rental",
    riskLevel: "medium",
    totalValue: 5000000,
    tokenPrice: 100,
    expectedYield: 9.5,
    funded: 78,
    investors: 234,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description:
      "A Class-A operational office tower in Dubai Marina with 95% occupancy producing stabilised rental income.",
    descriptionAr:
      "برج مكتبي تشغيلي من الفئة A في دبي مارينا بنسبة إشغال 95% ينتج دخلاً تأجيرياً مستقراً.",
    valuationReports: [
      { date: "2026-01-15", valuation: 5000000, appraiser: "Knight Frank" },
      { date: "2025-07-15", valuation: 4850000, appraiser: "JLL" },
    ],
  },
  {
    id: "3",
    model: "ready",
    category: "ready",
    name: "Industrial Park",
    nameAr: "المجمع الصناعي",
    location: "Riyadh, KSA",
    locationAr: "الرياض، السعودية",
    country: "ksa",
    city: "riyadh",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800",
    assetType: "industrial",
    status: "ready",
    yieldType: "rental",
    riskLevel: "low",
    totalValue: 12000000,
    tokenPrice: 100,
    expectedYield: 11.2,
    funded: 92,
    investors: 89,
    minInvestment: 100,
    duration: "7 years",
    durationAr: "7 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description:
      "Long-lease industrial logistics park anchored by an investment-grade tenant.",
    descriptionAr: "مجمع لوجستي صناعي بعقود إيجار طويلة مع مستأجر من الدرجة الاستثمارية.",
  },

  // ============= B) UNDER CONSTRUCTION — 5 MODELS =============

  // B1 — Installment
  {
    id: "10",
    model: "installment",
    category: "construction",
    name: "Skyline Heights Residences",
    nameAr: "مساكن سكاي لاين هايتس",
    location: "Dubai, UAE",
    locationAr: "دبي، الإمارات",
    country: "uae",
    city: "dubai",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    assetType: "residential",
    status: "construction",
    yieldType: "hybrid",
    riskLevel: "medium",
    totalValue: 8000000,
    tokenPrice: 100,
    expectedGrowth: 28,
    expectedYield: 7.5,
    funded: 45,
    investors: 156,
    minInvestment: 100,
    duration: "3 years",
    durationAr: "3 سنوات",
    exitEligible: false,
    exitAvailability: "lp",
    insuranceActive: true,
    description:
      "Premium residential development funded through scheduled monthly installments. Ownership accrues with each paid milestone.",
    descriptionAr:
      "تطوير سكني فاخر يموَّل عبر أقساط شهرية مجدولة. تتراكم الملكية مع كل دفعة مكتملة.",
    installment: {
      totalInstallments: 24,
      paidInstallments: 11,
      monthlyAmount: 100,
      nextPaymentDate: "2026-06-01",
      activationDate: "2027-03-15",
      completionPercent: 46,
    },
    constructionProgress: 38,
    developerReports: [
      { date: "2026-04-30", title: "Foundation complete", titleAr: "اكتمال الأساسات", progress: 38 },
      { date: "2026-02-28", title: "Site preparation", titleAr: "تجهيز الموقع", progress: 18 },
    ],
  },

  // B2 — Phasing (replaces "Joualat")
  {
    id: "11",
    model: "phasing",
    category: "construction",
    name: "Riyadh Boulevard Phase Project",
    nameAr: "مشروع رياض بوليفارد المرحلي",
    location: "Riyadh, KSA",
    locationAr: "الرياض، السعودية",
    country: "ksa",
    city: "riyadh",
    image: "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800",
    assetType: "mixed",
    status: "construction",
    yieldType: "appreciation",
    riskLevel: "medium",
    totalValue: 22000000,
    tokenPrice: 100,
    futureTokenPrice: 145,
    expectedGrowth: 45,
    funded: 60,
    investors: 312,
    minInvestment: 100,
    duration: "4 years",
    durationAr: "4 سنوات",
    exitEligible: true,
    exitAvailability: "secondary",
    insuranceActive: true,
    description:
      "A multi-phase mixed-use development. Token price re-prices upward at each construction phase, driven by valuation reports and milestone completion.",
    descriptionAr:
      "تطوير متعدد الاستخدامات على مراحل. يُعاد تسعير الرمز صعوداً في كل مرحلة بناء استناداً إلى تقارير التقييم واكتمال المعالم.",
    phases: [
      { number: 1, name: "Site & Foundations", nameAr: "الموقع والأساسات", tokenPrice: 100, startDate: "2025-09-01", endDate: "2026-03-01", status: "completed", progress: 100 },
      { number: 2, name: "Structural Build", nameAr: "البناء الإنشائي", tokenPrice: 120, startDate: "2026-03-01", endDate: "2027-01-01", status: "current", progress: 42 },
      { number: 3, name: "Façade & MEP", nameAr: "الواجهة والأنظمة", tokenPrice: 145, startDate: "2027-01-01", endDate: "2027-09-01", status: "upcoming", progress: 0 },
      { number: 4, name: "Handover", nameAr: "التسليم", tokenPrice: 175, startDate: "2027-09-01", endDate: "2028-01-01", status: "upcoming", progress: 0 },
    ],
    constructionProgress: 42,
    valuationReports: [
      { date: "2026-03-15", valuation: 22000000, appraiser: "CBRE" },
      { date: "2025-09-01", valuation: 18000000, appraiser: "Colliers" },
    ],
  },

  // B3 — Future
  {
    id: "12",
    model: "future",
    category: "construction",
    name: "Doha Bayfront Future Block",
    nameAr: "كتلة دوحة بايفرونت المستقبلية",
    location: "Doha, Qatar",
    locationAr: "الدوحة، قطر",
    country: "qatar",
    city: "doha",
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
    assetType: "residential",
    status: "construction",
    yieldType: "appreciation",
    riskLevel: "high",
    totalValue: 15000000,
    tokenPrice: 100,
    futureTokenPrice: 138,
    expectedGrowth: 38,
    funded: 28,
    investors: 45,
    minInvestment: 100,
    duration: "4 years",
    durationAr: "4 سنوات",
    exitEligible: false,
    exitAvailability: "secondary",
    insuranceActive: false,
    description:
      "Reserve future ownership exposure today at a predefined price structure. Ownership is activated and settled at the contract execution date.",
    descriptionAr:
      "احجز انكشاف ملكية مستقبلية اليوم وفق هيكل تسعير محدد مسبقاً. تُفعَّل الملكية وتُسوّى في تاريخ تنفيذ العقد.",
    future: {
      reservationDate: "2026-05-01",
      activationDate: "2027-12-01",
      settlementDate: "2028-02-01",
      reservationPrice: 100,
      estimatedFutureValue: 138,
      estimatedRoi: 38,
    },
    constructionProgress: 18,
  },

  // B4 — Option
  {
    id: "13",
    model: "option",
    category: "construction",
    name: "Manama Skyline Option Pool",
    nameAr: "مجمع خيارات أفق المنامة",
    location: "Manama, Bahrain",
    locationAr: "المنامة، البحرين",
    country: "bahrain",
    city: "manama",
    image: "https://images.unsplash.com/photo-1570126618953-d437176e8c79?w=800",
    assetType: "commercial",
    status: "construction",
    yieldType: "appreciation",
    riskLevel: "high",
    totalValue: 6000000,
    tokenPrice: 100,
    futureTokenPrice: 130,
    expectedGrowth: 30,
    funded: 22,
    investors: 31,
    minInvestment: 100,
    duration: "18 months",
    durationAr: "18 شهراً",
    exitEligible: false,
    exitAvailability: "none",
    insuranceActive: false,
    description:
      "Purchase the right — but not the obligation — to acquire tokenised shares later at a locked strike price.",
    descriptionAr:
      "اشترِ الحق وليس الالتزام في الحصول على حصص مرمزة لاحقاً بسعر تنفيذ مثبَّت.",
    option: {
      optionPremium: 8,
      strikePrice: 100,
      expiryDate: "2027-11-15",
      validityMonths: 18,
      estimatedFutureValue: 130,
      exerciseConditions:
        "Exercisable any time before expiry. Premium is non-refundable. Subject to KYC and SPV admission.",
      exerciseConditionsAr:
        "قابل للتنفيذ في أي وقت قبل الانتهاء. علاوة الخيار غير قابلة للاسترداد. يخضع لاعتماد الامتثال والدخول إلى الشركة ذات الغرض الخاص.",
    },
  },

  // B5 — Shared with Owner
  {
    id: "14",
    model: "shared",
    category: "construction",
    name: "Muscat Coastal Co-Ownership",
    nameAr: "ملكية مشتركة لساحل مسقط",
    location: "Muscat, Oman",
    locationAr: "مسقط، عمان",
    country: "oman",
    city: "muscat",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
    assetType: "hospitality",
    status: "construction",
    yieldType: "hybrid",
    riskLevel: "medium",
    totalValue: 9500000,
    tokenPrice: 100,
    expectedYield: 8.2,
    expectedGrowth: 18,
    funded: 35,
    investors: 64,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: true,
    exitAvailability: "lp",
    insuranceActive: true,
    description:
      "Co-own a coastal hospitality asset directly with the developer. Investors share revenue pro-rata to their ownership.",
    descriptionAr:
      "شارك في ملكية أصل ضيافة ساحلي مع المطور مباشرة. يتقاسم المستثمرون الإيراد بالتناسب مع نسبة ملكيتهم.",
    shared: {
      investorShare: 60,
      ownerShare: 40,
      ownerName: "Coastal Holdings LLC",
      profitSplit: "Pro-rata to ownership",
      revenueDistribution: "quarterly",
      transferProcess:
        "Transfers require 14-day notice and right-of-first-refusal to existing co-owners.",
      transferProcessAr:
        "تتطلب التحويلات إشعاراً مدته 14 يوماً وحق أولوية للملاك المشاركين الحاليين.",
    },
    constructionProgress: 25,
  },

  // ============= C) READY PORTFOLIOS =============
  {
    id: "20",
    model: "ready_portfolio",
    category: "ready_portfolio",
    name: "GCC Income Portfolio I",
    nameAr: "محفظة دخل دول الخليج الأولى",
    location: "GCC",
    locationAr: "دول الخليج",
    country: "uae",
    city: "multi",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    assetType: "mixed",
    status: "ready",
    yieldType: "rental",
    riskLevel: "low",
    totalValue: 35000000,
    tokenPrice: 100,
    expectedYield: 9.8,
    funded: 64,
    investors: 412,
    minInvestment: 100,
    duration: "6 years",
    durationAr: "6 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description:
      "A diversified portfolio of operational, income-producing assets across the GCC.",
    descriptionAr: "محفظة متنوعة من الأصول التشغيلية المدرّة للدخل عبر دول الخليج.",
    portfolioAssets: [
      { id: "p1-a", name: "Marina Tower", nameAr: "برج مارينا", city: "Dubai", weight: 30, assetType: "commercial" },
      { id: "p1-b", name: "Riyadh Logistics", nameAr: "لوجستيات الرياض", city: "Riyadh", weight: 25, assetType: "industrial" },
      { id: "p1-c", name: "Doha Retail Strip", nameAr: "تجزئة الدوحة", city: "Doha", weight: 20, assetType: "commercial" },
      { id: "p1-d", name: "Abu Dhabi Residences", nameAr: "مساكن أبوظبي", city: "Abu Dhabi", weight: 25, assetType: "residential" },
    ],
  },

  // ============= D) UNDER-CONSTRUCTION PORTFOLIOS =============
  {
    id: "30",
    model: "construction_portfolio",
    category: "construction_portfolio",
    name: "Future Cities Growth Portfolio",
    nameAr: "محفظة نمو مدن المستقبل",
    location: "GCC",
    locationAr: "دول الخليج",
    country: "ksa",
    city: "multi",
    image: "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800",
    assetType: "mixed",
    status: "construction",
    yieldType: "appreciation",
    riskLevel: "high",
    totalValue: 48000000,
    tokenPrice: 100,
    futureTokenPrice: 152,
    expectedGrowth: 52,
    funded: 31,
    investors: 198,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: false,
    exitAvailability: "secondary",
    insuranceActive: true,
    description:
      "A bundle of under-construction developments selected for capital appreciation across emerging GCC growth corridors.",
    descriptionAr:
      "حزمة من التطويرات قيد الإنشاء مختارة لتحقيق نمو رأسمالي عبر ممرات النمو الناشئة في دول الخليج.",
    portfolioAssets: [
      { id: "p2-a", name: "NEOM Edge Block", nameAr: "كتلة نيوم", city: "NEOM", weight: 35, assetType: "mixed" },
      { id: "p2-b", name: "Riyadh Boulevard", nameAr: "رياض بوليفارد", city: "Riyadh", weight: 25, assetType: "mixed" },
      { id: "p2-c", name: "Lusail District", nameAr: "حي لوسيل", city: "Doha", weight: 20, assetType: "residential" },
      { id: "p2-d", name: "Dubai South Hub", nameAr: "محور دبي الجنوب", city: "Dubai", weight: 20, assetType: "commercial" },
    ],
    constructionProgress: 24,
  },

  // ============= MORE READY PROPERTIES =============
  {
    id: "40",
    model: "ready",
    category: "ready",
    name: "Jumeirah Residence Tower",
    nameAr: "برج جميرا السكني",
    location: "Jumeirah, Dubai, UAE",
    locationAr: "جميرا، دبي، الإمارات",
    country: "uae",
    city: "dubai",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800",
    assetType: "residential",
    status: "ready",
    yieldType: "rental",
    riskLevel: "low",
    totalValue: 7800000,
    tokenPrice: 100,
    expectedYield: 8.4,
    funded: 56,
    investors: 187,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "A premium residential tower with 92% occupancy delivering stable monthly rental yield.",
    descriptionAr: "برج سكني فاخر بنسبة إشغال 92% يقدم عائد إيجار شهري مستقر.",
  },
  {
    id: "41",
    model: "ready",
    category: "ready",
    name: "Doha Retail Plaza",
    nameAr: "ساحة الدوحة للتجزئة",
    location: "West Bay, Doha, Qatar",
    locationAr: "الخليج الغربي، الدوحة، قطر",
    country: "qatar",
    city: "doha",
    image: "https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800",
    assetType: "commercial",
    status: "ready",
    yieldType: "rental",
    riskLevel: "medium",
    totalValue: 6400000,
    tokenPrice: 100,
    expectedYield: 10.1,
    funded: 71,
    investors: 142,
    minInvestment: 100,
    duration: "6 years",
    durationAr: "6 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "A flagship retail plaza anchored by international brands in Doha's West Bay.",
    descriptionAr: "ساحة تجزئة رائدة مع علامات تجارية عالمية في الخليج الغربي بالدوحة.",
  },
  {
    id: "42",
    model: "ready",
    category: "ready",
    name: "Manama Boutique Hotel",
    nameAr: "فندق المنامة البوتيكي",
    location: "Seef District, Manama, Bahrain",
    locationAr: "السيف، المنامة، البحرين",
    country: "bahrain",
    city: "manama",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
    assetType: "hospitality",
    status: "ready",
    yieldType: "hybrid",
    riskLevel: "medium",
    totalValue: 9200000,
    tokenPrice: 100,
    expectedYield: 9.8,
    funded: 48,
    investors: 96,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "An award-winning boutique hotel with stabilised ADR and 84% year-round occupancy.",
    descriptionAr: "فندق بوتيكي حائز على جوائز بمتوسط سعر مستقر ونسبة إشغال 84% على مدار السنة.",
  },
  {
    id: "43",
    model: "ready",
    category: "ready",
    name: "Muscat Mixed-Use Complex",
    nameAr: "مجمع مسقط متعدد الاستخدامات",
    location: "Al Qurum, Muscat, Oman",
    locationAr: "القرم، مسقط، عمان",
    country: "oman",
    city: "muscat",
    image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800",
    assetType: "mixed",
    status: "ready",
    yieldType: "rental",
    riskLevel: "low",
    totalValue: 11500000,
    tokenPrice: 100,
    expectedYield: 8.9,
    funded: 63,
    investors: 219,
    minInvestment: 100,
    duration: "7 years",
    durationAr: "7 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "A mixed-use complex combining offices, retail, and serviced apartments under long-term leases.",
    descriptionAr: "مجمع متعدد الاستخدامات يجمع مكاتب وتجزئة وشقق فندقية بعقود إيجار طويلة الأجل.",
  },

  // ============= MORE READY PORTFOLIOS =============
  {
    id: "50",
    model: "ready_portfolio",
    category: "ready_portfolio",
    name: "GCC Commercial Income Portfolio II",
    nameAr: "محفظة الدخل التجاري الخليجي الثانية",
    location: "GCC",
    locationAr: "دول الخليج",
    country: "uae",
    city: "multi",
    image: "https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=800",
    assetType: "commercial",
    status: "ready",
    yieldType: "rental",
    riskLevel: "low",
    totalValue: 42000000,
    tokenPrice: 100,
    expectedYield: 10.4,
    funded: 52,
    investors: 318,
    minInvestment: 100,
    duration: "6 years",
    durationAr: "6 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "A diversified income portfolio of stabilised commercial assets across Tier-1 GCC cities.",
    descriptionAr: "محفظة دخل متنوعة من الأصول التجارية المستقرة عبر مدن الخليج من الفئة الأولى.",
    portfolioAssets: [
      { id: "p3-a", name: "DIFC Office Block", nameAr: "مكاتب DIFC", city: "Dubai", weight: 35, assetType: "commercial" },
      { id: "p3-b", name: "Riyadh Retail Hub", nameAr: "تجزئة الرياض", city: "Riyadh", weight: 25, assetType: "commercial" },
      { id: "p3-c", name: "Doha Business Tower", nameAr: "برج أعمال الدوحة", city: "Doha", weight: 25, assetType: "commercial" },
      { id: "p3-d", name: "Manama Logistics", nameAr: "لوجستيات المنامة", city: "Manama", weight: 15, assetType: "industrial" },
    ],
  },
  {
    id: "51",
    model: "ready_portfolio",
    category: "ready_portfolio",
    name: "Hospitality Yield Portfolio",
    nameAr: "محفظة عائد الضيافة",
    location: "GCC",
    locationAr: "دول الخليج",
    country: "uae",
    city: "multi",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800",
    assetType: "hospitality",
    status: "ready",
    yieldType: "hybrid",
    riskLevel: "medium",
    totalValue: 28000000,
    tokenPrice: 100,
    expectedYield: 11.6,
    funded: 47,
    investors: 241,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "A curated portfolio of operating boutique hotels and serviced residences in major GCC tourism hubs.",
    descriptionAr: "محفظة مختارة من فنادق بوتيك تشغيلية وشقق فندقية في أهم مراكز السياحة الخليجية.",
    portfolioAssets: [
      { id: "p4-a", name: "Dubai Beach Hotel", nameAr: "فندق شاطئ دبي", city: "Dubai", weight: 30, assetType: "hospitality" },
      { id: "p4-b", name: "Jeddah Resort", nameAr: "منتجع جدة", city: "Jeddah", weight: 25, assetType: "hospitality" },
      { id: "p4-c", name: "Doha Marina Suites", nameAr: "أجنحة مارينا الدوحة", city: "Doha", weight: 25, assetType: "hospitality" },
      { id: "p4-d", name: "Muscat Coastal Resort", nameAr: "منتجع ساحل مسقط", city: "Muscat", weight: 20, assetType: "hospitality" },
    ],
  },
  {
    id: "52",
    model: "ready_portfolio",
    category: "ready_portfolio",
    name: "Industrial & Logistics Income Portfolio",
    nameAr: "محفظة دخل الصناعة واللوجستيات",
    location: "KSA & UAE",
    locationAr: "السعودية والإمارات",
    country: "ksa",
    city: "multi",
    image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800",
    assetType: "industrial",
    status: "ready",
    yieldType: "rental",
    riskLevel: "low",
    totalValue: 33000000,
    tokenPrice: 100,
    expectedYield: 10.9,
    funded: 68,
    investors: 287,
    minInvestment: 100,
    duration: "8 years",
    durationAr: "8 سنوات",
    exitEligible: true,
    exitAvailability: "both",
    insuranceActive: true,
    description: "Long-lease logistics warehouses and last-mile fulfilment centres anchored by investment-grade tenants.",
    descriptionAr: "مستودعات لوجستية بعقود طويلة ومراكز توزيع مدعومة بمستأجرين من الدرجة الاستثمارية.",
    portfolioAssets: [
      { id: "p5-a", name: "Riyadh Logistics Hub", nameAr: "محور الرياض اللوجستي", city: "Riyadh", weight: 35, assetType: "industrial" },
      { id: "p5-b", name: "Dubai South Warehouse", nameAr: "مستودع دبي الجنوب", city: "Dubai", weight: 30, assetType: "industrial" },
      { id: "p5-c", name: "Jeddah Cold Storage", nameAr: "تخزين بارد جدة", city: "Jeddah", weight: 20, assetType: "industrial" },
      { id: "p5-d", name: "Sharjah Light Industrial", nameAr: "صناعات خفيفة الشارقة", city: "Sharjah", weight: 15, assetType: "industrial" },
    ],
  },

  // ============= MORE CONSTRUCTION PORTFOLIOS =============
  {
    id: "60",
    model: "construction_portfolio",
    category: "construction_portfolio",
    name: "NEOM Growth Bundle",
    nameAr: "حزمة نمو نيوم",
    location: "NEOM, KSA",
    locationAr: "نيوم، السعودية",
    country: "ksa",
    city: "neom",
    image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800",
    assetType: "mixed",
    status: "construction",
    yieldType: "appreciation",
    riskLevel: "high",
    totalValue: 65000000,
    tokenPrice: 100,
    futureTokenPrice: 168,
    expectedGrowth: 68,
    funded: 38,
    investors: 412,
    minInvestment: 100,
    duration: "6 years",
    durationAr: "6 سنوات",
    exitEligible: false,
    exitAvailability: "secondary",
    insuranceActive: true,
    description: "A bundle of NEOM-zone construction assets across mixed-use, hospitality, and tech corridors.",
    descriptionAr: "حزمة من أصول الإنشاء في منطقة نيوم عبر استخدامات متعددة وضيافة وممرات تقنية.",
    portfolioAssets: [
      { id: "p6-a", name: "The Line Edge", nameAr: "حافة ذا لاين", city: "NEOM", weight: 40, assetType: "mixed" },
      { id: "p6-b", name: "Sindalah Residences", nameAr: "مساكن سندالة", city: "NEOM", weight: 30, assetType: "residential" },
      { id: "p6-c", name: "Trojena Tourism Block", nameAr: "كتلة سياحة تروجينا", city: "NEOM", weight: 20, assetType: "hospitality" },
      { id: "p6-d", name: "Oxagon Industrial", nameAr: "صناعات أوكساجون", city: "NEOM", weight: 10, assetType: "industrial" },
    ],
    constructionProgress: 18,
  },
  {
    id: "61",
    model: "construction_portfolio",
    category: "construction_portfolio",
    name: "UAE Residential Pipeline",
    nameAr: "خط الأنابيب السكني الإماراتي",
    location: "UAE",
    locationAr: "الإمارات",
    country: "uae",
    city: "multi",
    image: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800",
    assetType: "residential",
    status: "construction",
    yieldType: "appreciation",
    riskLevel: "medium",
    totalValue: 38000000,
    tokenPrice: 100,
    futureTokenPrice: 142,
    expectedGrowth: 42,
    funded: 44,
    investors: 256,
    minInvestment: 100,
    duration: "4 years",
    durationAr: "4 سنوات",
    exitEligible: false,
    exitAvailability: "secondary",
    insuranceActive: true,
    description: "A diversified pipeline of UAE residential developments selected for capital growth and post-handover yield.",
    descriptionAr: "خط أنابيب متنوع من المشاريع السكنية الإماراتية مختار لنمو رأس المال وعائد ما بعد التسليم.",
    portfolioAssets: [
      { id: "p7-a", name: "Palm West Tower", nameAr: "برج النخلة الغربي", city: "Dubai", weight: 35, assetType: "residential" },
      { id: "p7-b", name: "Yas Bay Residences", nameAr: "مساكن خليج ياس", city: "Abu Dhabi", weight: 30, assetType: "residential" },
      { id: "p7-c", name: "Sharjah Waterfront", nameAr: "واجهة الشارقة", city: "Sharjah", weight: 20, assetType: "residential" },
      { id: "p7-d", name: "Ras Al Khaimah Coast", nameAr: "ساحل رأس الخيمة", city: "RAK", weight: 15, assetType: "residential" },
    ],
    constructionProgress: 32,
  },
  {
    id: "62",
    model: "construction_portfolio",
    category: "construction_portfolio",
    name: "Saudi Vision 2030 Build Portfolio",
    nameAr: "محفظة بناء رؤية 2030",
    location: "KSA",
    locationAr: "السعودية",
    country: "ksa",
    city: "multi",
    image: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800",
    assetType: "mixed",
    status: "construction",
    yieldType: "hybrid",
    riskLevel: "medium",
    totalValue: 52000000,
    tokenPrice: 100,
    futureTokenPrice: 156,
    expectedGrowth: 56,
    expectedYield: 6.5,
    funded: 41,
    investors: 334,
    minInvestment: 100,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: false,
    exitAvailability: "secondary",
    insuranceActive: true,
    description: "Aligned to Vision 2030 megaprojects, this portfolio combines giga-project exposure with mixed-use yield assets.",
    descriptionAr: "متوافقة مع المشاريع العملاقة لرؤية 2030، تجمع هذه المحفظة بين انكشاف المشاريع العملاقة وأصول العائد متعددة الاستخدامات.",
    portfolioAssets: [
      { id: "p8-a", name: "Diriyah Gate Asset", nameAr: "أصل بوابة الدرعية", city: "Riyadh", weight: 30, assetType: "mixed" },
      { id: "p8-b", name: "Red Sea Resort", nameAr: "منتجع البحر الأحمر", city: "Tabuk", weight: 25, assetType: "hospitality" },
      { id: "p8-c", name: "Qiddiya Entertainment", nameAr: "ترفيه القدية", city: "Riyadh", weight: 25, assetType: "mixed" },
      { id: "p8-d", name: "ROSHN Sedra", nameAr: "روشن سدرة", city: "Riyadh", weight: 20, assetType: "residential" },
    ],
    constructionProgress: 28,
  },
];

// ---- helpers ----
export const propertyById = (id: string) => properties.find((p) => p.id === id);

export const propertyModelMeta: Record<
  PropertyModel,
  { label: string; labelAr: string; category: PropertyCategory }
> = {
  ready: { label: "Ready Property", labelAr: "عقار جاهز", category: "ready" },
  ready_portfolio: { label: "Ready Portfolio", labelAr: "محفظة جاهزة", category: "ready_portfolio" },
  installment: { label: "Installment", labelAr: "بالتقسيط", category: "construction" },
  phasing: { label: "Phasing", labelAr: "مرحلي", category: "construction" },
  future: { label: "Future", labelAr: "مستقبلي", category: "construction" },
  option: { label: "Option", labelAr: "خيار", category: "construction" },
  shared: { label: "Shared with Owner", labelAr: "ملكية مشتركة", category: "construction" },
  construction_portfolio: {
    label: "Construction Portfolio",
    labelAr: "محفظة قيد الإنشاء",
    category: "construction_portfolio",
  },
};
