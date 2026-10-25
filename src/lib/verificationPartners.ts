/**
 * The Capimax ecosystem's designated verification partners (client's "Verify Your Documents"
 * text), shown on the Verification Center page — the same five, in the same order, as on
 * Capimax PropShare, with an Arabic version of every line. BRX verifies nothing itself: each
 * kind of record is checked on its partner's own site.
 */
import type { Bilingual } from "@/lib/partners";

export interface VerificationPartner {
  key: string;
  title: Bilingual;
  /** The provider line exactly as the client wrote it ("Powered by …" for the first). */
  providerLine: Bilingual;
  description: Bilingual;
  howTo: Bilingual;
  action: Bilingual;
  linkLabel: Bilingual;
  url: string;
}

export const VERIFY_INTRO = {
  title: { en: "Verify Your Documents", ar: "تحقق من مستنداتك" },
  text: {
    en:
      "Independently verify the authenticity, validity and current status of documents, " +
      "certificates and records associated with the Capimax Ecosystem through our designated " +
      "verification partners.",
    ar:
      "تحقّق بشكل مستقل من صحة وسريان والحالة الحالية للمستندات والشهادات والسجلات المرتبطة " +
      "بمنظومة Capimax من خلال شركاء التحقق المعتمدين لدينا.",
  },
};

export const INDEPENDENT_VERIFICATION = {
  title: { en: "Independent Verification", ar: "تحقق مستقل" },
  text: {
    en:
      "Capimax provides direct access to designated third-party verification systems so " +
      "investors, asset owners, developers and partners can independently authenticate relevant " +
      "records and review their verification status directly from the corresponding provider.",
    ar:
      "توفّر Capimax وصولًا مباشرًا إلى أنظمة تحقق معتمدة لدى جهات خارجية، ليتمكن المستثمرون " +
      "وملاك الأصول والمطورون والشركاء من التحقق بأنفسهم من السجلات ذات الصلة ومراجعة حالة " +
      "التحقق منها مباشرة لدى الجهة المختصة.",
  },
};

export const VERIFICATION_PARTNERS: VerificationPartner[] = [
  {
    key: "capimax_documents",
    title: { en: "Capimax Documents & Investment Certificates", ar: "مستندات Capimax وشهادات الاستثمار" },
    providerLine: { en: "Powered by CIM Global Financial", ar: "بتشغيل CIM Global Financial" },
    description: {
      en: "Verify Capimax-issued documents, investment certificates, official records and other ecosystem documents.",
      ar: "تحقق من المستندات الصادرة عن Capimax وشهادات الاستثمار والسجلات الرسمية وسائر مستندات المنظومة.",
    },
    howTo: {
      en:
        "Enter the Verification Number, Record Number, Certificate Number, or scan the QR Code to " +
        "confirm authenticity and current verification status.",
      ar:
        "أدخل رقم التحقق أو رقم السجل أو رقم الشهادة، أو امسح رمز QR، لتأكيد صحة المستند وحالة " +
        "التحقق الحالية.",
    },
    action: { en: "Verify Document / Certificate", ar: "تحقق من المستند / الشهادة" },
    linkLabel: { en: "Open Capimax Verify — CIM Global Financial", ar: "افتح Capimax Verify — CIM Global Financial" },
    url: "https://www.cimglobalfinancial.com/capimax-verify",
  },
  {
    key: "valuation_financial",
    title: { en: "Valuation & Financial Document Verification", ar: "التحقق من التقييمات والمستندات المالية" },
    providerLine: { en: "CIM Global Financial", ar: "CIM Global Financial" },
    description: {
      en:
        "Verify property and unit valuation reports, investment studies, financial analyses, " +
        "accounting records, financial reports, due diligence reports and other financial " +
        "documents associated with Capimax assets and projects.",
      ar:
        "تحقق من تقارير تقييم العقارات والوحدات ودراسات الاستثمار والتحليلات المالية والسجلات " +
        "المحاسبية والتقارير المالية وتقارير العناية الواجبة وسائر المستندات المالية المرتبطة " +
        "بأصول ومشروعات Capimax.",
    },
    howTo: {
      en:
        "Enter the Document Number or Verification ID to authenticate the record and access " +
        "available verified documentation.",
      ar: "أدخل رقم المستند أو معرّف التحقق لتوثيق السجل والاطلاع على المستندات الموثّقة المتاحة.",
    },
    action: { en: "Verify Valuation / Financial Report", ar: "تحقق من تقرير التقييم / التقرير المالي" },
    linkLabel: { en: "Verify with CIM Global Financial", ar: "تحقق عبر CIM Global Financial" },
    url: "https://www.cimglobalfinancial.com/capimax-verify",
  },
  {
    key: "insurance",
    title: { en: "Insurance Certificate Verification", ar: "التحقق من شهادات التأمين" },
    providerLine: { en: "CoverTech Insurance", ar: "CoverTech Insurance" },
    description: {
      en:
        "Verify insurance certificates and insurance-related documents issued for Capimax assets, " +
        "investments, platforms and associated risks.",
      ar:
        "تحقق من شهادات التأمين والمستندات المتعلقة بالتأمين الصادرة لأصول Capimax واستثماراتها " +
        "ومنصاتها والمخاطر المرتبطة بها.",
    },
    howTo: {
      en:
        "Use the verification service to confirm the authenticity, coverage information and " +
        "current status of the relevant insurance certificate or document.",
      ar:
        "استخدم خدمة التحقق لتأكيد صحة شهادة التأمين أو المستند المعني وبيانات التغطية وحالته " +
        "الحالية.",
    },
    action: { en: "Verify Insurance Certificate", ar: "تحقق من شهادة التأمين" },
    linkLabel: { en: "Verify with CoverTech Insurance", ar: "تحقق عبر CoverTech Insurance" },
    url: "https://www.covertechinsurance.com/capimax-ecosystem",
  },
  {
    key: "legal",
    title: { en: "Legal Document & Agreement Verification", ar: "التحقق من المستندات القانونية والاتفاقيات" },
    providerLine: { en: "LexCrest Global", ar: "LexCrest Global" },
    description: {
      en:
        "Verify legal documents, agreements, due diligence documents and other legal records " +
        "associated with Capimax assets, transactions and platforms.",
      ar:
        "تحقق من المستندات القانونية والاتفاقيات ومستندات العناية الواجبة وسائر السجلات القانونية " +
        "المرتبطة بأصول Capimax ومعاملاتها ومنصاتها.",
    },
    howTo: {
      en:
        "Enter the unique Document Number shown on the document to confirm its authenticity. " +
        "Where permitted, public documents may also be previewed or downloaded.",
      ar:
        "أدخل رقم المستند الفريد المدوّن عليه لتأكيد صحته. ويمكن أيضًا معاينة المستندات العامة " +
        "أو تنزيلها حيثما يُسمح بذلك.",
    },
    action: { en: "Verify Legal Document", ar: "تحقق من المستند القانوني" },
    linkLabel: { en: "Open LexCrest Document Center", ar: "افتح مركز مستندات LexCrest" },
    url: "https://lexcrestlegal.xyz/document-center",
  },
  {
    key: "blockchain",
    title: {
      en: "Blockchain, Smart Contract & Digital Asset Verification",
      ar: "التحقق من سجلات البلوكتشين والعقود الذكية والأصول الرقمية",
    },
    providerLine: { en: "Proof Anchor", ar: "Proof Anchor" },
    description: {
      en:
        "Verify blockchain records, smart contracts, tokenized assets, tokens, audit reports and " +
        "digital certificates associated with Capimax blockchain-enabled platforms.",
      ar:
        "تحقق من سجلات البلوكتشين والعقود الذكية والأصول المرمّزة والرموز وتقارير التدقيق " +
        "والشهادات الرقمية المرتبطة بمنصات Capimax العاملة بتقنية البلوكتشين.",
    },
    howTo: {
      en:
        "Search using a Certificate Number, Verification Number, Contract Address, Token Address, " +
        "Asset ID, or Project Name to access the corresponding verification record.",
      ar:
        "ابحث برقم الشهادة أو رقم التحقق أو عنوان العقد أو عنوان الرمز أو معرّف الأصل أو اسم " +
        "المشروع للوصول إلى سجل التحقق المقابل.",
    },
    action: { en: "Verify Blockchain Record", ar: "تحقق من سجل البلوكتشين" },
    linkLabel: { en: "Verify with Proof Anchor", ar: "تحقق عبر Proof Anchor" },
    url: "https://www.proofanchor.io/verify",
  },
];
