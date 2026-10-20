// Display labels (EN / AR) for the property codes the API returns (asset type, yield type,
// risk level, exit availability, country, city). Unknown values are shown title-cased.

type Pair = { en: string; ar: string };

const LABELS: Record<string, Pair> = {
  // asset type
  residential: { en: "Residential", ar: "سكني" },
  commercial: { en: "Commercial", ar: "تجاري" },
  industrial: { en: "Industrial", ar: "صناعي" },
  mixed: { en: "Mixed Use", ar: "متعدد الاستخدامات" },
  hospitality: { en: "Hospitality", ar: "فندقي" },
  land: { en: "Land", ar: "أرض" },
  // category / status
  ready: { en: "Ready", ar: "جاهز" },
  construction: { en: "Under Construction", ar: "قيد الإنشاء" },
  ready_portfolio: { en: "Ready Portfolio", ar: "محفظة جاهزة" },
  construction_portfolio: { en: "Construction Portfolio", ar: "محفظة قيد الإنشاء" },
  // listing status
  listed: { en: "Listed", ar: "معروض" },
  sold: { en: "Sold", ar: "مُباع" },
  completed: { en: "Completed", ar: "مكتمل" },
  cancelled: { en: "Cancelled", ar: "ملغى" },
  expired: { en: "Expired", ar: "منتهي" },
  pending: { en: "Pending", ar: "قيد الانتظار" },
  funded: { en: "Funded", ar: "مُموَّل" },
  open: { en: "Open", ar: "مفتوح" },
  // yield type
  rental: { en: "Rental", ar: "إيجاري" },
  appreciation: { en: "Appreciation", ar: "نمو رأس المال" },
  hybrid: { en: "Hybrid", ar: "مختلط" },
  // exit availability
  lp: { en: "Liquidity Provider", ar: "مزوّد السيولة" },
  secondary: { en: "Secondary Market", ar: "السوق الثانوي" },
  both: { en: "Liquidity Provider & Secondary Market", ar: "مزوّد السيولة والسوق الثانوي" },
  none: { en: "Not available", ar: "غير متاح" },
  // risk level
  low: { en: "Low", ar: "منخفض" },
  medium: { en: "Medium", ar: "متوسط" },
  high: { en: "High", ar: "مرتفع" },
  // country
  uae: { en: "UAE", ar: "الإمارات" },
  ksa: { en: "Saudi Arabia", ar: "السعودية" },
  qatar: { en: "Qatar", ar: "قطر" },
  bahrain: { en: "Bahrain", ar: "البحرين" },
  oman: { en: "Oman", ar: "عُمان" },
  uk: { en: "United Kingdom", ar: "المملكة المتحدة" },
  // city
  dubai: { en: "Dubai", ar: "دبي" },
  abudhabi: { en: "Abu Dhabi", ar: "أبوظبي" },
  riyadh: { en: "Riyadh", ar: "الرياض" },
  jeddah: { en: "Jeddah", ar: "جدة" },
  doha: { en: "Doha", ar: "الدوحة" },
  manama: { en: "Manama", ar: "المنامة" },
  muscat: { en: "Muscat", ar: "مسقط" },
  neom: { en: "NEOM", ar: "نيوم" },
  london: { en: "London", ar: "لندن" },
  multi: { en: "Multiple cities", ar: "عدة مدن" },
};

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The label for a property code in the current language. */
export function propertyLabel(value: string | null | undefined, isAr: boolean): string {
  if (!value) return "—";
  const hit = LABELS[String(value).toLowerCase().replace(/\s+/g, "")] ?? LABELS[String(value).toLowerCase()];
  if (hit) return isAr ? hit.ar : hit.en;
  return titleCase(String(value));
}

/** A record's property name in the site language (the API sends `property_name_ar` when it has one). */
export function localName(
  o: { property_name?: string | null; property_name_ar?: string | null } | null | undefined,
  language: string,
): string {
  if (!o) return "";
  return (language === "ar" && o.property_name_ar) || o.property_name || "";
}
