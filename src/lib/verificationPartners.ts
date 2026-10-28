/**
 * The Verification Center's "Verify Your Documents" list (client's BRX text, 2026-10-28), with an
 * Arabic version of every line:
 *  1. BRX's own ownership certificates — verified by the QR code printed on each certificate,
 *     which opens its verification page on BRX (client: not through CIM Global Financial).
 *  2-5. The designated partners, as on Capimax PropShare.
 *  6-7. The Wyoming Secretary of State's registries: the property-holding SPV and the digital
 *     asset. Their links are the state's search pages; the IDs to search with are per property
 *     (GET /api/properties/registrations/).
 * Links are the client's, as given (tracking parameters removed).
 */
import type { Bilingual } from "@/lib/partners";

export interface VerificationPartner {
  key: string;
  /** "certificate": verified on BRX itself by QR / code; "external": on the provider's site. */
  kind?: "certificate" | "external";
  /** Which per-property registration IDs to list under the card. */
  registry?: "spv" | "digital_asset";
  /** Extra notes shown after the how-to (the client's caveats). */
  notes?: Bilingual[];
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
    key: "certificates",
    kind: "certificate",
    title: { en: "Capimax BRX Ownership Certificates", ar: "شهادات الملكية الصادرة من Capimax BRX" },
    providerLine: { en: "Verified on Capimax BRX by QR code", ar: "يتم التحقق منها على Capimax BRX عبر رمز QR" },
    description: {
      en:
        "Every ownership certificate issued on Capimax BRX carries its own QR code. Scanning it " +
        "opens the certificate's verification page here on the platform, showing whether it is " +
        "authentic and its current status.",
      ar:
        "تحمل كل شهادة ملكية تصدر من Capimax BRX رمز QR خاصًا بها. مسح الرمز يفتح صفحة التحقق " +
        "الخاصة بالشهادة هنا على المنصة، ويوضح صحتها وحالتها الحالية.",
    },
    howTo: {
      en:
        "Scan the QR code printed on the certificate with your phone's camera. Can't scan it? Enter " +
        "the verification code shown beside the QR code below.",
      ar:
        "امسح رمز QR المطبوع على الشهادة بكاميرا هاتفك. إن تعذّر المسح، أدخل رمز التحقق المدوّن " +
        "بجوار رمز QR في الخانة أدناه.",
    },
    action: { en: "Verify Certificate", ar: "تحقق من الشهادة" },
    linkLabel: { en: "Verification code", ar: "رمز التحقق" },
    url: "/verify",
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
  {
    key: "spv",
    registry: "spv",
    title: {
      en: "Property-Holding SPV & Corporate Registration Verification",
      ar: "التحقق من الشركة ذات الغرض الخاص (SPV) المالكة للعقار وتسجيلها التجاري",
    },
    providerLine: {
      en: "Wyoming Secretary of State — Business Entity Search",
      ar: "وزير خارجية ولاية Wyoming — البحث عن الكيانات التجارية",
    },
    description: {
      en:
        "Verify the corporate registration of the Wyoming-incorporated Special Purpose Vehicle " +
        "(SPV) identified in the property's legal documents as the property-holding entity.",
      ar:
        "تحقق من التسجيل التجاري للشركة ذات الغرض الخاص (SPV) المؤسسة في ولاية Wyoming، والمحددة " +
        "في المستندات القانونية للعقار بوصفها الكيان المالك له.",
    },
    howTo: {
      en:
        "Search using the SPV's Legal Company Name or Wyoming Filing ID to view its registration " +
        "details, current entity status, and available corporate filings.",
      ar:
        "ابحث باسم الشركة القانوني أو رقم الإيداع في Wyoming (Filing ID) للاطلاع على بيانات " +
        "تسجيلها وحالة الكيان الحالية والمستندات التجارية المتاحة.",
    },
    notes: [
      {
        en:
          "Corporate registration verification confirms the entity's recorded existence and status. " +
          "Property ownership should be verified separately through the applicable land registry " +
          "and supporting title documents.",
        ar:
          "التحقق من التسجيل التجاري يؤكد وجود الكيان المسجّل وحالته. أما ملكية العقار فيُتحقق منها " +
          "بشكل منفصل من خلال سجل الأراضي المختص ومستندات الملكية الداعمة.",
      },
    ],
    action: { en: "Verify Property-Holding SPV", ar: "تحقق من الشركة المالكة للعقار" },
    linkLabel: { en: "Verify with the Wyoming Secretary of State", ar: "تحقق عبر وزير خارجية ولاية Wyoming" },
    url: "https://wyobiz.wyo.gov/Business/FilingSearch.aspx",
  },
  {
    key: "digital_asset",
    registry: "digital_asset",
    title: {
      en: "Wyoming Digital Asset Registration Verification",
      ar: "التحقق من تسجيل الأصل الرقمي في ولاية Wyoming",
    },
    providerLine: {
      en: "Wyoming Secretary of State — Digital Asset Search",
      ar: "وزير خارجية ولاية Wyoming — البحث عن الأصول الرقمية",
    },
    description: {
      en:
        "Verify the Wyoming registration record for the digital asset associated with the relevant " +
        "BRX property offering, where registered.",
      ar:
        "تحقق من سجل تسجيل الأصل الرقمي المرتبط بطرح عقار BRX المعني في ولاية Wyoming، حيثما كان مسجّلًا.",
    },
    howTo: {
      en:
        "Search using the Wyoming Digital Asset ID, as stated in the asset's registration certificate " +
        "or offering documents, to retrieve the corresponding Registration Certificate PDF. The " +
        "official search page provides the example format DA-000123456.",
      ar:
        "ابحث بمعرّف الأصل الرقمي في Wyoming (Digital Asset ID) المذكور في شهادة تسجيل الأصل أو " +
        "مستندات الطرح، لتحصل على شهادة التسجيل بصيغة PDF. وتعرض صفحة البحث الرسمية مثالًا للصيغة: " +
        "DA-000123456.",
    },
    notes: [
      {
        en:
          "Open the downloaded certificate in a compatible PDF viewer to inspect its cryptographic " +
          "signature. The registry also provides access to a list of current Wyoming Registered " +
          "Digital Assets and applicant information.",
        ar:
          "افتح الشهادة بعد تنزيلها في برنامج PDF متوافق لفحص توقيعها المشفّر. ويتيح السجل أيضًا " +
          "قائمة بالأصول الرقمية المسجّلة حاليًا في Wyoming وبيانات مقدّمي الطلبات.",
      },
      {
        en:
          "Digital asset registration is separate from property title verification, smart contract " +
          "auditing, and approval of an investment offering. It does not guarantee investment " +
          "returns or liquidity.",
        ar:
          "تسجيل الأصل الرقمي منفصل عن التحقق من ملكية العقار وتدقيق العقود الذكية واعتماد الطرح " +
          "الاستثماري، ولا يضمن عوائد الاستثمار أو السيولة.",
      },
    ],
    action: { en: "Verify Digital Asset Registration", ar: "تحقق من تسجيل الأصل الرقمي" },
    linkLabel: { en: "Verify with the Wyoming Digital Asset Registry", ar: "تحقق عبر سجل الأصول الرقمية في Wyoming" },
    url: "https://wyobiz.wyo.gov/Business/DigitalAssets/DigitalAssetSearch.aspx",
  },
];
