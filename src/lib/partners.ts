/**
 * The partners shown on the Partners page: the client's "Partner Content Register" (Capimax BRX
 * Partners Page technical content brief, 2026), section by section and in its order, each with
 * its role, its copy, its market, the link to its own site and its logo. The same register as
 * Capimax PropShare's Partners page, with an Arabic version of every line.
 *
 * Kept as the client wrote it, except (as on PropShare):
 *  - LexCrest's link: the brief gives lexcrestglobal.com, a name that does not exist; the firm's
 *    site is the one the Verification Center links.
 *  - The two newest developers (Singapore, South Africa) came as working notes ("partner entry
 *    for ..."): they are said the way the other developers are, claiming nothing more.
 *  - "Other Approved Banks" is a category that fills as banks are approved, not a company: it
 *    has no site and no role line.
 * The brief's last entry, Proof Anchor, is listed for the ecosystem's tokenization platforms —
 * BRX is one, so here it has its own section.
 *
 * Logos: the brief's own images, sized for the page (src/assets/partners); Stripe, PayPal and
 * NOWPayments carry the companies' own logos (the brief had plain name banners for those).
 */
import aetheraDevelopment from "@/assets/partners/aethera-development.webp";
import assuraxInsurance from "@/assets/partners/assurax-insurance.webp";
import cimGlobalFinancial from "@/assets/partners/cim-global-financial.webp";
import covertechInsurance from "@/assets/partners/covertech-insurance.webp";
import crestmarkGlobal from "@/assets/partners/crestmark-global.webp";
import crownFacilities from "@/assets/partners/crown-facilities.webp";
import elevateProperties from "@/assets/partners/elevate-properties.webp";
import eliteGateProperties from "@/assets/partners/elite-gate-properties.webp";
import lexcrestGlobalLegal from "@/assets/partners/lexcrest-global-legal.webp";
import mercury from "@/assets/partners/mercury.webp";
import novaDigitalFinance from "@/assets/partners/nova-digital-finance.webp";
import nowpayments from "@/assets/partners/nowpayments.webp";
import otherApprovedBanks from "@/assets/partners/other-approved-banks.webp";
import paypal from "@/assets/partners/paypal.webp";
import primeStoneGlobal from "@/assets/partners/prime-stone-global.webp";
import priminnHotels from "@/assets/partners/priminn-hotels.webp";
import proofAnchor from "@/assets/partners/proof-anchor.webp";
import revolutBusiness from "@/assets/partners/revolut-business.webp";
import stripe from "@/assets/partners/stripe.webp";
import sumsub from "@/assets/partners/sumsub.webp";
import valoraEstatesGlobal from "@/assets/partners/valora-estates-global.webp";
import verdeaEstates from "@/assets/partners/verdea-estates.webp";
import westoriaCapitalEstates from "@/assets/partners/westoria-capital-estates.webp";
import wiseBusiness from "@/assets/partners/wise-business.webp";

/** The register's sections: every partner belongs to exactly one. */
export type PartnerSectionKey =
  | "payments"
  | "identity"
  | "banking"
  | "advisory"
  | "insurance"
  | "developers"
  | "operations"
  | "tokenization";

/** One line in both languages. */
export interface Bilingual {
  en: string;
  ar: string;
}

export interface Partner {
  key: string;
  name: string;
  /** What it is to the platform, as the register says ("Integrated payment provider"). */
  role?: Bilingual;
  description: Bilingual;
  /** Where it operates, as the register says ("Global", "United States"). */
  market: Bilingual;
  /** Its own site; none for an entry that is not one company. */
  url?: string;
  logo: string;
}

export interface PartnerSection {
  key: PartnerSectionKey;
  title: Bilingual;
  partners: Partner[];
}

const GLOBAL: Bilingual = { en: "Global", ar: "عالمي" };
const INTERNATIONAL: Bilingual = { en: "International", ar: "دولي" };
const DEVELOPER: Bilingual = { en: "Developer", ar: "مطوّر عقاري" };
const INSURANCE_ROLE: Bilingual = { en: "Insurance and risk", ar: "التأمين والمخاطر" };

export const PARTNER_SECTIONS: PartnerSection[] = [
  {
    key: "payments",
    title: { en: "Payments and Digital Asset Payments", ar: "المدفوعات ومدفوعات الأصول الرقمية" },
    partners: [
      {
        key: "stripe",
        name: "Stripe",
        role: { en: "Integrated payment provider", ar: "مزوّد دفع مدمج" },
        description: {
          en: "Payment infrastructure for card and online payments, checkout, billing and transaction processing.",
          ar: "بنية تحتية للدفع بالبطاقات والمدفوعات الإلكترونية، وإتمام الشراء والفوترة ومعالجة المعاملات.",
        },
        market: GLOBAL,
        url: "https://stripe.com",
        logo: stripe,
      },
      {
        key: "paypal",
        name: "PayPal",
        role: { en: "Integrated payment provider", ar: "مزوّد دفع مدمج" },
        description: {
          en: "Online payment option supporting eligible customer payments and account-based checkout.",
          ar: "خيار دفع إلكتروني يدعم مدفوعات العملاء المؤهلين وإتمام الشراء عبر الحساب.",
        },
        market: GLOBAL,
        url: "https://www.paypal.com",
        logo: paypal,
      },
      {
        key: "nowpayments",
        name: "NOWPayments",
        role: { en: "Crypto payment provider", ar: "مزوّد مدفوعات العملات الرقمية" },
        description: {
          en: "Cryptocurrency payment gateway supporting digital-asset payment acceptance, subject to eligibility and jurisdiction.",
          ar: "بوابة دفع بالعملات الرقمية تدعم قبول المدفوعات بالأصول الرقمية، وفقًا للأهلية والولاية القضائية.",
        },
        market: GLOBAL,
        url: "https://nowpayments.io",
        logo: nowpayments,
      },
    ],
  },
  {
    key: "identity",
    title: { en: "Identity Verification and Compliance", ar: "التحقق من الهوية والامتثال" },
    partners: [
      {
        key: "sumsub",
        name: "Sumsub",
        role: { en: "Compliance integration", ar: "تكامل الامتثال" },
        description: {
          en: "KYC, KYB, identity verification, AML screening and ongoing compliance workflow provider.",
          ar: "مزوّد لخدمات اعرف عميلك (KYC) واعرف نشاطك (KYB) والتحقق من الهوية وفحص مكافحة غسل الأموال وإجراءات الامتثال المستمرة.",
        },
        market: GLOBAL,
        url: "https://sumsub.com",
        logo: sumsub,
      },
    ],
  },
  {
    key: "banking",
    title: { en: "Banking and Treasury Rails", ar: "القنوات البنكية والخزينة" },
    partners: [
      {
        key: "mercury",
        name: "Mercury",
        role: { en: "Business account rail", ar: "قناة حسابات الأعمال" },
        description: {
          en: "US business financial-technology platform used for eligible corporate banking and payment workflows through partner banks.",
          ar: "منصة تقنية مالية أمريكية للأعمال تُستخدم للخدمات البنكية للشركات المؤهلة وإجراءات الدفع عبر بنوك شريكة.",
        },
        market: { en: "United States", ar: "الولايات المتحدة" },
        url: "https://mercury.com",
        logo: mercury,
      },
      {
        key: "revolut-business",
        name: "Revolut Business",
        role: { en: "Business account rail", ar: "قناة حسابات الأعمال" },
        description: {
          en: "Multi-currency business account, payments and treasury-management services, subject to account eligibility.",
          ar: "حساب أعمال متعدد العملات وخدمات المدفوعات وإدارة الخزينة، وفقًا لأهلية الحساب.",
        },
        market: INTERNATIONAL,
        url: "https://www.revolut.com/business",
        logo: revolutBusiness,
      },
      {
        key: "wise-business",
        name: "Wise Business",
        role: { en: "Business payment rail", ar: "قناة مدفوعات الأعمال" },
        description: {
          en: "International business payments, currency conversion and multi-currency account services, subject to availability.",
          ar: "مدفوعات الأعمال الدولية وتحويل العملات وخدمات الحسابات متعددة العملات، وفقًا للتوفر.",
        },
        market: INTERNATIONAL,
        url: "https://wise.com/business",
        logo: wiseBusiness,
      },
      {
        key: "other-approved-banks",
        name: "Other Approved Banks",
        description: {
          en: "Additional banks and payment institutions may be displayed only after onboarding, approval and documentary verification.",
          ar: "قد تُعرض بنوك ومؤسسات دفع إضافية فقط بعد ضمّها واعتمادها والتحقق من مستنداتها.",
        },
        market: { en: "Multiple jurisdictions", ar: "ولايات قضائية متعددة" },
        logo: otherApprovedBanks,
      },
    ],
  },
  {
    key: "advisory",
    title: { en: "Finance, Valuation, Legal and Risk", ar: "التمويل والتقييم والقانون والمخاطر" },
    partners: [
      {
        key: "nova-digital-finance",
        name: "Nova Digital Finance",
        role: { en: "Financing", ar: "التمويل" },
        description: {
          en: "Capimax ecosystem financing workflow supporting eligible real-estate participation and structured payment solutions.",
          ar: "مسار التمويل في منظومة Capimax، يدعم المشاركة العقارية المؤهلة وحلول الدفع المهيكلة.",
        },
        market: { en: "Capimax ecosystem", ar: "منظومة Capimax" },
        url: "https://novadf.com",
        logo: novaDigitalFinance,
      },
      {
        key: "cim-global-financial",
        name: "CIM Global Financial",
        role: { en: "Financial advisory and valuation", ar: "الاستشارات المالية والتقييم" },
        description: {
          en: "Financial studies, asset valuation, risk assessment, due diligence support, reporting and document verification.",
          ar: "الدراسات المالية وتقييم الأصول وتقدير المخاطر ودعم العناية الواجبة وإعداد التقارير والتحقق من المستندات.",
        },
        market: { en: "United Kingdom and United States", ar: "المملكة المتحدة والولايات المتحدة" },
        url: "https://www.cimglobalfinancial.com",
        logo: cimGlobalFinancial,
      },
      {
        key: "lexcrest-global-legal",
        name: "LexCrest Global Legal",
        role: { en: "Legal and due diligence", ar: "الشؤون القانونية والعناية الواجبة" },
        description: {
          en: "Legal structuring, real-estate due diligence, SPV support, contracts, agreements, regulatory review and dispute support.",
          ar: "الهيكلة القانونية والعناية الواجبة العقارية ودعم الشركات ذات الغرض الخاص (SPV) والعقود والاتفاقيات والمراجعة التنظيمية ودعم النزاعات.",
        },
        market: GLOBAL,
        url: "https://lexcrestlegal.xyz",
        logo: lexcrestGlobalLegal,
      },
    ],
  },
  {
    key: "insurance",
    title: { en: "Insurance and Asset Protection", ar: "التأمين وحماية الأصول" },
    partners: [
      {
        key: "covertech-insurance",
        name: "CoverTech Insurance",
        role: INSURANCE_ROLE,
        description: {
          en: "Insurance and risk solutions for real estate assets, platform exposures, digital infrastructure and eligible client-money risks, subject to policy terms.",
          ar: "حلول التأمين وإدارة المخاطر للأصول العقارية ومخاطر المنصات والبنية التحتية الرقمية ومخاطر أموال العملاء المؤهلة، وفقًا لشروط الوثيقة.",
        },
        market: GLOBAL,
        url: "https://www.covertechinsurance.com",
        logo: covertechInsurance,
      },
      {
        key: "assurax-insurance",
        name: "Assurax Insurance",
        role: INSURANCE_ROLE,
        description: {
          en: "Insurance solutions for assets, property, investment projects and eligible client protections, subject to underwriting and policy terms.",
          ar: "حلول تأمين للأصول والعقارات والمشروعات الاستثمارية وحماية العملاء المؤهلين، وفقًا للاكتتاب وشروط الوثيقة.",
        },
        market: INTERNATIONAL,
        url: "https://assuraxinsurance.com",
        logo: assuraxInsurance,
      },
    ],
  },
  {
    key: "developers",
    title: { en: "Real Estate Development Partners", ar: "شركاء التطوير العقاري" },
    partners: [
      {
        key: "westoria-capital-estates",
        name: "Westoria Capital Estates",
        role: DEVELOPER,
        description: {
          en: "Real-estate development and investment partner for selected residential, hospitality, commercial and mixed-use opportunities.",
          ar: "شريك في التطوير والاستثمار العقاري لفرص مختارة سكنية وفندقية وتجارية ومتعددة الاستخدامات.",
        },
        market: { en: "United States", ar: "الولايات المتحدة" },
        url: "https://westoriacapital.com",
        logo: westoriaCapitalEstates,
      },
      {
        key: "crestmark-global",
        name: "Crestmark Global",
        role: DEVELOPER,
        description: {
          en: "Real-estate development and investment partner supporting selected UK opportunities.",
          ar: "شريك في التطوير والاستثمار العقاري يدعم فرصًا مختارة في المملكة المتحدة.",
        },
        market: { en: "United Kingdom", ar: "المملكة المتحدة" },
        url: "https://crestmarkglobal.com",
        logo: crestmarkGlobal,
      },
      {
        key: "valora-estates-global",
        name: "Valora Estates Global",
        role: DEVELOPER,
        description: {
          en: "Real-estate development and investment partner supporting selected opportunities in Spain.",
          ar: "شريك في التطوير والاستثمار العقاري يدعم فرصًا مختارة في إسبانيا.",
        },
        market: { en: "Spain", ar: "إسبانيا" },
        url: "https://valoraestatesglobal.com",
        logo: valoraEstatesGlobal,
      },
      {
        key: "verdea-estates",
        name: "Verdea Estates",
        role: DEVELOPER,
        description: {
          en: "Real-estate development and investment partner supporting selected opportunities in Georgia.",
          ar: "شريك في التطوير والاستثمار العقاري يدعم فرصًا مختارة في جورجيا.",
        },
        market: { en: "Georgia", ar: "جورجيا" },
        url: "https://verdeaestates.com",
        logo: verdeaEstates,
      },
      {
        key: "aethera-development",
        name: "Aethera Development",
        role: DEVELOPER,
        description: {
          en: "Real-estate development and investment partner supporting selected opportunities in Greece.",
          ar: "شريك في التطوير والاستثمار العقاري يدعم فرصًا مختارة في اليونان.",
        },
        market: { en: "Greece", ar: "اليونان" },
        url: "https://aetheradevelopment.com",
        logo: aetheraDevelopment,
      },
      {
        key: "elevate-properties",
        name: "Elevate Properties Pte. Ltd",
        role: DEVELOPER,
        description: {
          en: "Real-estate development partner supporting selected opportunities in Singapore.",
          ar: "شريك في التطوير العقاري يدعم فرصًا مختارة في سنغافورة.",
        },
        market: { en: "Singapore", ar: "سنغافورة" },
        url: "https://elevateproperties.world",
        logo: elevateProperties,
      },
      {
        key: "prime-stone-global",
        name: "Prime Stone Global",
        role: DEVELOPER,
        description: {
          en: "Real-estate development partner supporting selected opportunities in South Africa.",
          ar: "شريك في التطوير العقاري يدعم فرصًا مختارة في جنوب أفريقيا.",
        },
        market: { en: "South Africa", ar: "جنوب أفريقيا" },
        url: "https://primestoneglobal.dev",
        logo: primeStoneGlobal,
      },
    ],
  },
  {
    key: "operations",
    title: { en: "Hospitality, Property and Facility Management", ar: "الضيافة وإدارة العقارات والمرافق" },
    partners: [
      {
        key: "priminn-hotels",
        name: "Priminn Hotels",
        role: { en: "Hospitality operator", ar: "مشغّل فندقي" },
        description: {
          en: "Hospitality operating partner for hotel operations, serviced accommodation, leasing and property-level guest management.",
          ar: "شريك تشغيل فندقي لعمليات الفنادق والشقق المخدومة والتأجير وإدارة النزلاء على مستوى العقار.",
        },
        market: INTERNATIONAL,
        url: "https://priminnhotels.com",
        logo: priminnHotels,
      },
      {
        key: "elite-gate-properties",
        name: "Elite Gate Properties",
        role: { en: "Property management", ar: "إدارة العقارات" },
        description: {
          en: "Property management and leasing partner supporting tenant administration, collections and day-to-day asset operations.",
          ar: "شريك في إدارة العقارات والتأجير يدعم إدارة المستأجرين والتحصيل والتشغيل اليومي للأصول.",
        },
        market: INTERNATIONAL,
        url: "https://elitegateproperties.com",
        logo: eliteGateProperties,
      },
      {
        key: "crown-facilities",
        name: "Crown Facilities",
        role: { en: "Facility management", ar: "إدارة المرافق" },
        description: {
          en: "Integrated facility and property management partner supporting maintenance, engineering, building operations and asset services.",
          ar: "شريك متكامل لإدارة المرافق والعقارات يدعم الصيانة والهندسة وتشغيل المباني وخدمات الأصول.",
        },
        market: GLOBAL,
        url: "https://crownfm.online",
        logo: crownFacilities,
      },
    ],
  },
  {
    key: "tokenization",
    title: { en: "Tokenization and Verification", ar: "الترميز والتحقق" },
    partners: [
      {
        key: "proof-anchor",
        name: "Proof Anchor",
        description: {
          en: "Proof Anchor provides independent verification, security, and certification for blockchain, digital assets, smart contracts, and real-world investments.",
          ar: "توفّر Proof Anchor التحقق المستقل والأمان والاعتماد للبلوكتشين والأصول الرقمية والعقود الذكية والاستثمارات في الأصول الحقيقية.",
        },
        market: GLOBAL,
        url: "https://www.proofanchor.io",
        logo: proofAnchor,
      },
    ],
  },
];

/** Every entry of the register, in its order. */
export const PARTNERS: Partner[] = PARTNER_SECTIONS.flatMap((section) => section.partners);

/** "example.com/path" for showing where a link goes. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
