import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Building2,
  Shield,
  Scale,
  Coins,
  Globe,
  FileCheck,
  Lock,
  Wallet,
  Users,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FAQItem {
  question: string;
  questionAr: string;
  answer: string;
  answerAr: string;
}

interface FAQSection {
  id: string;
  icon: React.ElementType;
  titleEn: string;
  titleAr: string;
  items: FAQItem[];
}

export default function FAQ() {
  const { language, isRTL } = useLanguage();

  const faqSections: FAQSection[] = [
    {
      id: "general",
      icon: HelpCircle,
      titleEn: "General Questions",
      titleAr: "أسئلة عامة",
      items: [
        {
          question: "What is real estate tokenization?",
          questionAr: "ما هو ترميز العقارات؟",
          answer: `Real estate tokenization is the process of:
• Converting the economic value of a property into digital tokens
• Each token represents a defined fractional interest or financial right
• Tokens are issued via documented smart contracts

Tokenization enables:
• Fractional ownership
• Easier entry and exit
• Higher liquidity compared to traditional real estate investments`,
          answerAr: `ترميز العقارات هو عملية:
• تحويل القيمة الاقتصادية للعقار إلى رموز رقمية
• كل رمز يمثل حصة جزئية محددة أو حق مالي
• يتم إصدار الرموز عبر عقود ذكية موثقة

يتيح الترميز:
• الملكية الجزئية
• سهولة الدخول والخروج
• سيولة أعلى مقارنة بالاستثمارات العقارية التقليدية`,
        },
        {
          question: "What types of properties are available on the platform?",
          questionAr: "ما أنواع العقارات المتاحة على المنصة؟",
          answer: `The platform supports a wide range of real estate assets, including:
• Residential properties
• Commercial properties
• Office buildings
• Hospitality and tourism assets
• Development projects
• Mixed-use properties

Assets are listed across multiple cities and countries to enhance diversification.`,
          answerAr: `تدعم المنصة مجموعة واسعة من الأصول العقارية، بما في ذلك:
• العقارات السكنية
• العقارات التجارية
• المباني المكتبية
• أصول الضيافة والسياحة
• مشاريع التطوير
• العقارات متعددة الاستخدامات

يتم إدراج الأصول عبر مدن وبلدان متعددة لتعزيز التنويع.`,
        },
        {
          question: "Does the platform operate globally?",
          questionAr: "هل تعمل المنصة عالمياً؟",
          answer: `Yes. The platform operates globally by:
• Establishing a separate SPV for each country
• Complying with local regulations
• Preventing cross-border asset commingling`,
          answerAr: `نعم. تعمل المنصة عالمياً من خلال:
• إنشاء شركة SPV منفصلة لكل دولة
• الامتثال للوائح المحلية
• منع خلط الأصول عبر الحدود`,
        },
        {
          question: "Is the global framework legally regulated?",
          questionAr: "هل الإطار العالمي منظم قانونياً؟",
          answer: `Yes. The framework complies with:
• Local corporate and real estate laws
• Investment regulations
• AML (Anti-Money Laundering) rules
• KYC (Know Your Customer) requirements`,
          answerAr: `نعم. يمتثل الإطار لـ:
• قوانين الشركات والعقارات المحلية
• لوائح الاستثمار
• قواعد مكافحة غسيل الأموال (AML)
• متطلبات اعرف عميلك (KYC)`,
        },
        {
          question: "Are assets and documents reviewed and verified?",
          questionAr: "هل تتم مراجعة الأصول والوثائق والتحقق منها؟",
          answer: `Yes. Each asset undergoes:
• Independent valuation
• Full legal due diligence
• Document verification (ownership, permits, contracts)
• Technical and operational review

Assets are listed only after full approval.`,
          answerAr: `نعم. يخضع كل أصل لـ:
• تقييم مستقل
• العناية القانونية الواجبة الكاملة
• التحقق من الوثائق (الملكية، التصاريح، العقود)
• المراجعة الفنية والتشغيلية

يتم إدراج الأصول فقط بعد الموافقة الكاملة.`,
        },
        {
          question: "Who manages the property and distributes returns?",
          questionAr: "من يدير العقار ويوزع العوائد؟",
          answer: `Property management is handled by:
• Professional asset management companies
• Licensed developers
• Authorized property managers

Returns:
• Flow through dedicated asset accounts
• Are distributed automatically according to smart contract terms`,
          answerAr: `تتم إدارة العقارات من قبل:
• شركات إدارة أصول محترفة
• مطورون مرخصون
• مديرو عقارات معتمدون

العوائد:
• تتدفق عبر حسابات أصول مخصصة
• يتم توزيعها تلقائياً وفقاً لشروط العقد الذكي`,
        },
        {
          question: "What is the role of the smart contract?",
          questionAr: "ما هو دور العقد الذكي؟",
          answer: `The smart contract serves as the core system by:
• Locking investment terms
• Recording digital ownership
• Distributing returns
• Managing exits
• Preventing unauthorized changes

Smart contracts are:
• Transparent
• Tamper-resistant
• Binding on all parties`,
          answerAr: `يعمل العقد الذكي كنظام أساسي من خلال:
• تثبيت شروط الاستثمار
• تسجيل الملكية الرقمية
• توزيع العوائد
• إدارة عمليات الخروج
• منع التغييرات غير المصرح بها

العقود الذكية:
• شفافة
• مقاومة للتلاعب
• ملزمة لجميع الأطراف`,
        },
      ],
    },
    {
      id: "investment-models",
      icon: Coins,
      titleEn: "Investment Models",
      titleAr: "نماذج الاستثمار",
      items: [
        {
          question: "What is the Income Model?",
          questionAr: "ما هو نموذج الدخل؟",
          answer: `This model applies to:
• Completed
• Leased
• Income-generating properties

Investors receive:
• Periodic returns (monthly or quarterly)
• Automatically distributed via smart contracts
• Withdrawable or reinvestable`,
          answerAr: `ينطبق هذا النموذج على:
• العقارات المكتملة
• المؤجرة
• المدرة للدخل

يتلقى المستثمرون:
• عوائد دورية (شهرية أو ربع سنوية)
• موزعة تلقائياً عبر العقود الذكية
• قابلة للسحب أو إعادة الاستثمار`,
        },
        {
          question: "What is the Development Model?",
          questionAr: "ما هو نموذج التطوير؟",
          answer: `This investment model focuses on:
• Early-stage entry at lower prices
• No periodic income
• Capital appreciation through structured development phases

It includes:
• Predefined pricing rounds
• Fixed timelines
• Documented development plans`,
          answerAr: `يركز نموذج الاستثمار هذا على:
• الدخول المبكر بأسعار أقل
• لا يوجد دخل دوري
• زيادة رأس المال من خلال مراحل تطوير منظمة

يشمل:
• جولات تسعير محددة مسبقاً
• جداول زمنية ثابتة
• خطط تطوير موثقة`,
        },
        {
          question: "What is the Installment Model?",
          questionAr: "ما هو نموذج التقسيط؟",
          answer: `This model allows investors to:
• Acquire tokens from the initial stage
• Pay through structured installments
• Without bank interest

Key features:
• Financial flexibility
• Exit at any time
• Transfer of remaining obligations to a new buyer upon resale`,
          answerAr: `يتيح هذا النموذج للمستثمرين:
• الحصول على الرموز من المرحلة الأولية
• الدفع من خلال أقساط منظمة
• بدون فوائد بنكية

الميزات الرئيسية:
• المرونة المالية
• الخروج في أي وقت
• نقل الالتزامات المتبقية إلى مشترٍ جديد عند إعادة البيع`,
        },
      ],
    },
    {
      id: "spv",
      icon: Building2,
      titleEn: "SPV (Special Purpose Vehicle)",
      titleAr: "الشركة ذات الغرض الخاص (SPV)",
      items: [
        {
          question: "What is an SPV?",
          questionAr: "ما هي شركة SPV؟",
          answer: `An SPV (Special Purpose Vehicle) is an independent legal entity established for a single, specific purpose.

Within the Capy Max RT platform, that purpose is to:
• Legally hold a specific real estate asset
• Manage investor rights related to that asset in a legally segregated structure

Each property listed on the platform is linked to a dedicated SPV. Assets and liabilities of one property are never mixed with those of another.`,
          answerAr: `SPV (شركة ذات غرض خاص) هي كيان قانوني مستقل يتم إنشاؤه لغرض واحد محدد.

ضمن منصة Capy Max RT، هذا الغرض هو:
• الاحتفاظ قانونياً بأصل عقاري محدد
• إدارة حقوق المستثمرين المتعلقة بذلك الأصل في هيكل منفصل قانونياً

كل عقار مدرج على المنصة مرتبط بـ SPV مخصصة. لا يتم خلط أصول والتزامات عقار مع عقار آخر.`,
        },
        {
          question: "What is the role of the SPV within the platform?",
          questionAr: "ما هو دور SPV ضمن المنصة؟",
          answer: `The SPV plays a central role in the legal structuring of tokenized real estate investments. Its responsibilities include:
• Legally owning the real estate asset or holding its associated economic rights
• Issuing real estate tokens representing investor shares
• Receiving revenues generated by the property (rental income / sale proceeds)
• Distributing returns to investors in accordance with the Investment Agreement
• Isolating risk, ensuring that liabilities do not transfer between properties or to the platform itself
• Maintaining legal continuity, even if the platform ceases operations`,
          answerAr: `تلعب SPV دوراً محورياً في الهيكلة القانونية لاستثمارات العقارات المرمزة. تشمل مسؤولياتها:
• امتلاك الأصل العقاري قانونياً أو الاحتفاظ بحقوقه الاقتصادية المرتبطة
• إصدار رموز عقارية تمثل حصص المستثمرين
• استلام الإيرادات المتولدة من العقار (دخل الإيجار / عائدات البيع)
• توزيع العوائد على المستثمرين وفقاً لاتفاقية الاستثمار
• عزل المخاطر، مما يضمن عدم انتقال الالتزامات بين العقارات أو إلى المنصة نفسها
• الحفاظ على الاستمرارية القانونية، حتى لو توقفت المنصة عن العمل`,
        },
        {
          question: "What is the relationship between the SPV and the Smart Contract?",
          questionAr: "ما هي العلاقة بين SPV والعقد الذكي؟",
          answer: `The SPV's Investment Agreement is legally linked to the smart contract.

The smart contract executes:
• Ownership registration
• Yield distribution
• Exit conditions

Meanwhile, legal ownership and investor rights remain secured within the SPV, outside the blockchain.

The smart contract is an execution mechanism; the SPV is the legal protection framework.`,
          answerAr: `اتفاقية استثمار SPV مرتبطة قانونياً بالعقد الذكي.

يقوم العقد الذكي بتنفيذ:
• تسجيل الملكية
• توزيع العائد
• شروط الخروج

في الوقت نفسه، تبقى الملكية القانونية وحقوق المستثمرين مؤمنة ضمن SPV، خارج البلوكتشين.

العقد الذكي هو آلية تنفيذ؛ SPV هي إطار الحماية القانونية.`,
        },
        {
          question: "What happens to investor funds if the platform shuts down?",
          questionAr: "ماذا يحدث لأموال المستثمرين إذا توقفت المنصة؟",
          answer: `If the Capy Max RT platform is suspended or shut down for any reason:
• Investor funds are not lost
• Tokens remain owned by the investor
• The SPV remains legally active
• The real estate asset remains owned by the SPV
• Investor rights remain legally enforceable and can be managed outside the platform

Possible outcomes include:
• Appointing a new asset or property manager
• Liquidating the asset and distributing proceeds
• Continuing yield distribution according to the Investment Agreement`,
          answerAr: `إذا تم تعليق أو إغلاق منصة Capy Max RT لأي سبب:
• أموال المستثمرين ليست مفقودة
• تبقى الرموز مملوكة للمستثمر
• تبقى SPV نشطة قانونياً
• يبقى الأصل العقاري مملوكاً لـ SPV
• تبقى حقوق المستثمرين قابلة للتنفيذ قانونياً ويمكن إدارتها خارج المنصة

النتائج المحتملة تشمل:
• تعيين مدير أصول أو عقارات جديد
• تصفية الأصل وتوزيع العائدات
• الاستمرار في توزيع العوائد وفقاً لاتفاقية الاستثمار`,
        },
        {
          question: "Why is the SPV model used instead of direct property ownership?",
          questionAr: "لماذا يتم استخدام نموذج SPV بدلاً من الملكية المباشرة للعقار؟",
          answer: `Using an SPV provides:
• Complete legal separation between the platform, investors, and the underlying property
• Easier regulatory compliance
• Protection of investors from operational risk
• Cross-border investment capability
• Clearer tax and legal treatment`,
          answerAr: `يوفر استخدام SPV:
• فصل قانوني كامل بين المنصة والمستثمرين والعقار الأساسي
• امتثال تنظيمي أسهل
• حماية المستثمرين من المخاطر التشغيلية
• قدرة الاستثمار عبر الحدود
• معاملة ضريبية وقانونية أوضح`,
        },
        {
          question: "What are the key advantages of using an SPV?",
          questionAr: "ما هي المزايا الرئيسية لاستخدام SPV؟",
          answer: `Key benefits include:
🔒 Strong legal protection for investors
🧱 Risk isolation between assets
🌍 Global operability
📑 Clear definition of rights and obligations
🔗 Legal integration with smart contracts
🔁 Flexible exit and ownership transfer
⚖️ Auditability and regulatory readiness`,
          answerAr: `تشمل الفوائد الرئيسية:
🔒 حماية قانونية قوية للمستثمرين
🧱 عزل المخاطر بين الأصول
🌍 قابلية التشغيل العالمي
📑 تعريف واضح للحقوق والالتزامات
🔗 التكامل القانوني مع العقود الذكية
🔁 خروج مرن ونقل الملكية
⚖️ قابلية التدقيق والجاهزية التنظيمية`,
        },
        {
          question: "Is there a separate SPV for each property?",
          questionAr: "هل يوجد SPV منفصل لكل عقار؟",
          answer: `Yes. Each property is represented by a fully independent SPV to ensure:
• No commingling of funds
• No risk contagion between assets
• Full transparency of returns
• Simplified auditing and accounting`,
          answerAr: `نعم. يتم تمثيل كل عقار بـ SPV مستقل تماماً لضمان:
• عدم خلط الأموال
• عدم انتقال المخاطر بين الأصول
• شفافية كاملة للعوائد
• تبسيط التدقيق والمحاسبة`,
        },
        {
          question: "Is the SPV registered and regulated?",
          questionAr: "هل SPV مسجلة ومنظمة؟",
          answer: `Yes. SPVs are incorporated in legally suitable jurisdictions (such as Wyoming, USA) and are subject to:
• Corporate law
• Tax regulations
• Executed Investment Agreements
• Ongoing legal oversight`,
          answerAr: `نعم. يتم تأسيس SPVs في ولايات قضائية مناسبة قانونياً (مثل وايومنغ، الولايات المتحدة) وتخضع لـ:
• قانون الشركات
• اللوائح الضريبية
• اتفاقيات الاستثمار المنفذة
• الرقابة القانونية المستمرة`,
        },
      ],
    },
    {
      id: "legal",
      icon: Scale,
      titleEn: "Legal Questions",
      titleAr: "الأسئلة القانونية",
      items: [
        {
          question: "What is the legal framework under which the platform operates?",
          questionAr: "ما هو الإطار القانوني الذي تعمل بموجبه المنصة؟",
          answer: `The platform operates within a structured legal framework based on:
• The establishment of independent legal entities (Special Purpose Vehicles – SPVs) for each real estate asset or investment project
• Each SPV being governed by the laws of the jurisdiction in which the underlying asset is located
• Full compliance with Anti-Money Laundering (AML) and Know Your Customer (KYC) regulations
• Complete legal segregation between the platform's operational assets and investors' assets`,
          answerAr: `تعمل المنصة ضمن إطار قانوني منظم يستند إلى:
• إنشاء كيانات قانونية مستقلة (شركات ذات غرض خاص - SPVs) لكل أصل عقاري أو مشروع استثماري
• خضوع كل SPV لقوانين الولاية القضائية التي يقع فيها الأصل الأساسي
• الامتثال الكامل للوائح مكافحة غسيل الأموال (AML) واعرف عميلك (KYC)
• الفصل القانوني الكامل بين الأصول التشغيلية للمنصة وأصول المستثمرين`,
        },
        {
          question: "Is my investment linked to the platform or to the underlying asset?",
          questionAr: "هل استثماري مرتبط بالمنصة أم بالأصل الأساسي؟",
          answer: `Your investment is legally linked to the underlying real estate asset or investment project through:
• Your ownership interest in the SPV that holds the asset
• Or through investment tokens that represent defined economic and financial rights in that asset

The platform acts solely as a technical and operational intermediary and does not own or custody investor funds.`,
          answerAr: `استثمارك مرتبط قانونياً بالأصل العقاري الأساسي أو المشروع الاستثماري من خلال:
• حصتك في الملكية في SPV التي تحتفظ بالأصل
• أو من خلال رموز الاستثمار التي تمثل حقوقاً اقتصادية ومالية محددة في ذلك الأصل

تعمل المنصة فقط كوسيط تقني وتشغيلي ولا تمتلك أو تحتفظ بأموال المستثمرين.`,
        },
        {
          question: "What happens if the platform is shut down or ceases operations?",
          questionAr: "ماذا يحدث إذا توقفت المنصة أو أوقفت عملياتها؟",
          answer: `In the event that the platform is shut down for any reason (regulatory, commercial, or strategic):
• Investor funds are not lost
• All assets remain legally owned by the relevant SPV
• Investors retain full legal rights to their ownership interests, any accrued or future returns, and sale or exit rights

One of the following will be implemented:
• Appointment of a replacement manager
• Appointment of a legal trustee or administrator
• Transfer of asset management to another licensed platform or legal entity`,
          answerAr: `في حالة إغلاق المنصة لأي سبب (تنظيمي أو تجاري أو استراتيجي):
• أموال المستثمرين ليست مفقودة
• تبقى جميع الأصول مملوكة قانونياً لـ SPV ذات الصلة
• يحتفظ المستثمرون بالحقوق القانونية الكاملة في حصص ملكيتهم وأي عوائد مستحقة أو مستقبلية وحقوق البيع أو الخروج

سيتم تنفيذ أحد الإجراءات التالية:
• تعيين مدير بديل
• تعيين وصي أو مدير قانوني
• نقل إدارة الأصول إلى منصة أو كيان قانوني مرخص آخر`,
        },
        {
          question: "Can the platform dispose of or control my funds or assets?",
          questionAr: "هل يمكن للمنصة التصرف في أموالي أو أصولي أو التحكم فيها؟",
          answer: `No.
• Investor funds are not included in the platform's operational balance sheet
• Assets are held under independent SPV ownership
• The platform has no legal right to sell the assets, pledge or encumber them, or dispose of them

Except strictly in accordance with the governing contracts and applicable regulatory approvals.`,
          answerAr: `لا.
• لا يتم تضمين أموال المستثمرين في الميزانية العمومية التشغيلية للمنصة
• يتم الاحتفاظ بالأصول تحت ملكية SPV مستقلة
• لا تملك المنصة أي حق قانوني في بيع الأصول أو رهنها أو إثقالها أو التصرف فيها

إلا وفقاً للعقود الحاكمة والموافقات التنظيمية المعمول بها بشكل صارم.`,
        },
        {
          question: "Is the platform responsible for real estate market price fluctuations?",
          questionAr: "هل المنصة مسؤولة عن تقلبات أسعار سوق العقارات؟",
          answer: `The platform:
• Does not guarantee profits
• Does not assume real estate market risk

However, the platform applies multiple risk mitigation mechanisms, including:
• Geographic diversification
• Asset-type diversification (residential, commercial, hospitality, etc.)
• Independent professional valuation
• Legal and technical due diligence
• Diversified portfolio construction models`,
          answerAr: `المنصة:
• لا تضمن الأرباح
• لا تتحمل مخاطر سوق العقارات

ومع ذلك، تطبق المنصة آليات متعددة للتخفيف من المخاطر، بما في ذلك:
• التنويع الجغرافي
• تنويع أنواع الأصول (سكنية، تجارية، ضيافة، إلخ)
• التقييم المهني المستقل
• العناية الواجبة القانونية والفنية
• نماذج بناء المحافظ المتنوعة`,
        },
        {
          question: "What is the legal status of the issued tokens?",
          questionAr: "ما هو الوضع القانوني للرموز المصدرة؟",
          answer: `Tokens issued through the platform:
• Are not speculative cryptocurrencies
• Represent financial rights, economic interests, or usage/profit participation rights
• Are governed by the issuance terms and contractual documentation linked to each asset
• Do not represent equity or ownership in the platform itself`,
          answerAr: `الرموز المصدرة من خلال المنصة:
• ليست عملات مشفرة مضاربة
• تمثل حقوقاً مالية أو مصالح اقتصادية أو حقوق استخدام/مشاركة في الأرباح
• تخضع لشروط الإصدار والوثائق التعاقدية المرتبطة بكل أصل
• لا تمثل حصصاً أو ملكية في المنصة نفسها`,
        },
        {
          question: "Can I transfer my tokens to an external wallet such as MetaMask?",
          questionAr: "هل يمكنني نقل رموزي إلى محفظة خارجية مثل MetaMask؟",
          answer: `This depends on:
• The type of asset
• The token structure
• The applicable regulatory framework

Where permitted:
• Tokens may be transferred to compatible external wallets
• Investors retain full control over their tokens
• Trading is restricted to approved secondary markets or licensed platforms compliant with applicable laws`,
          answerAr: `يعتمد ذلك على:
• نوع الأصل
• هيكل الرمز
• الإطار التنظيمي المعمول به

حيثما كان مسموحاً:
• يمكن نقل الرموز إلى محافظ خارجية متوافقة
• يحتفظ المستثمرون بالسيطرة الكاملة على رموزهم
• يقتصر التداول على الأسواق الثانوية المعتمدة أو المنصات المرخصة المتوافقة مع القوانين المعمول بها`,
        },
        {
          question: "Can I sell my ownership interest outside the platform?",
          questionAr: "هل يمكنني بيع حصتي في الملكية خارج المنصة؟",
          answer: `Direct off-platform sales are not permitted except:
• Through the approved secondary market
• Or with prior legal and regulatory approval

This is to ensure:
• Regulatory compliance
• Protection of other investors
• Prevention of unlawful or non-compliant trading`,
          answerAr: `لا يُسمح بالمبيعات المباشرة خارج المنصة إلا:
• من خلال السوق الثانوي المعتمد
• أو بموافقة قانونية وتنظيمية مسبقة

وذلك لضمان:
• الامتثال التنظيمي
• حماية المستثمرين الآخرين
• منع التداول غير القانوني أو غير المتوافق`,
        },
        {
          question: "What happens if one of the involved parties becomes insolvent?",
          questionAr: "ماذا يحدث إذا أصبح أحد الأطراف المعنية معسراً؟",
          answer: `Each party operates under a separate contractual framework.

Insolvency of any party (Owner, Developer, Broker):
• Does not directly affect investor ownership rights
• Triggers contractual protection mechanisms
• Allows for replacement of the affected party if required
• Assets remain legally held by the SPV`,
          answerAr: `يعمل كل طرف بموجب إطار تعاقدي منفصل.

إعسار أي طرف (مالك، مطور، وسيط):
• لا يؤثر مباشرة على حقوق ملكية المستثمرين
• يُفعّل آليات الحماية التعاقدية
• يسمح باستبدال الطرف المتضرر إذا لزم الأمر
• تبقى الأصول محتفظ بها قانونياً من قبل SPV`,
        },
        {
          question: "How are disputes resolved?",
          questionAr: "كيف يتم حل النزاعات؟",
          answer: `Disputes are resolved in accordance with:
• The governing law of the SPV's jurisdiction
• Or international commercial arbitration
• Or competent courts, as specified in the relevant agreements

This is clearly defined in:
• Terms and Conditions
• Investment Agreements
• Offering documentation`,
          answerAr: `يتم حل النزاعات وفقاً لـ:
• القانون الحاكم لولاية SPV القضائية
• أو التحكيم التجاري الدولي
• أو المحاكم المختصة، كما هو محدد في الاتفاقيات ذات الصلة

هذا محدد بوضوح في:
• الشروط والأحكام
• اتفاقيات الاستثمار
• وثائق العرض`,
        },
        {
          question: "Is the platform subject to regulatory oversight?",
          questionAr: "هل تخضع المنصة للرقابة التنظيمية؟",
          answer: `Yes. Depending on its scope of operation, the platform is subject to:
• Local and international laws
• Financial compliance requirements
• Regulatory authorities governing digital assets or real estate investments

The platform also:
• Regularly updates its legal and compliance policies
• Adapts to future regulatory developments`,
          answerAr: `نعم. اعتماداً على نطاق عملها، تخضع المنصة لـ:
• القوانين المحلية والدولية
• متطلبات الامتثال المالي
• السلطات التنظيمية التي تحكم الأصول الرقمية أو الاستثمارات العقارية

كما تقوم المنصة أيضاً بـ:
• تحديث سياساتها القانونية والامتثال بانتظام
• التكيف مع التطورات التنظيمية المستقبلية`,
        },
        {
          question: "Can investment terms be changed after subscription?",
          questionAr: "هل يمكن تغيير شروط الاستثمار بعد الاشتراك؟",
          answer: `No.
Investment terms for any asset cannot be altered after subscription.

All terms are:
• Fixed
• Documented
• Legally binding on all parties

Any future changes:
• Apply only to newly listed assets
• Do not affect existing investments`,
          answerAr: `لا.
لا يمكن تغيير شروط الاستثمار لأي أصل بعد الاشتراك.

جميع الشروط:
• ثابتة
• موثقة
• ملزمة قانونياً لجميع الأطراف

أي تغييرات مستقبلية:
• تنطبق فقط على الأصول المدرجة حديثاً
• لا تؤثر على الاستثمارات الحالية`,
        },
        {
          question: "Who bears the ultimate legal liability?",
          questionAr: "من يتحمل المسؤولية القانونية النهائية؟",
          answer: `Each SPV bears legal responsibility for its underlying asset.

• Investor liability is strictly limited to the amount invested
• The platform is responsible solely for technology, operations, and platform management
• The platform assumes no liability beyond its legally defined role`,
          answerAr: `تتحمل كل SPV المسؤولية القانونية عن أصلها الأساسي.

• مسؤولية المستثمر محدودة بشكل صارم بالمبلغ المستثمر
• المنصة مسؤولة فقط عن التكنولوجيا والعمليات وإدارة المنصة
• لا تتحمل المنصة أي مسؤولية تتجاوز دورها المحدد قانونياً`,
        },
        {
          question: "Is my investment legally protected in case of global expansion?",
          questionAr: "هل استثماري محمي قانونياً في حالة التوسع العالمي؟",
          answer: `Yes.
• A separate SPV is established for each country
• Full compliance with local laws in each jurisdiction
• No commingling of assets across countries
• Transparent, jurisdiction-specific reporting`,
          answerAr: `نعم.
• يتم إنشاء SPV منفصلة لكل دولة
• امتثال كامل للقوانين المحلية في كل ولاية قضائية
• لا خلط للأصول عبر البلدان
• تقارير شفافة خاصة بكل ولاية قضائية`,
        },
        {
          question: "Can this legal framework be modified in the future?",
          questionAr: "هل يمكن تعديل هذا الإطار القانوني في المستقبل؟",
          answer: `Yes, provided that:
• Changes are required by new laws or regulations
• Existing investor rights are not adversely affected
• Full transparency and prior disclosure are maintained`,
          answerAr: `نعم، بشرط أن:
• تكون التغييرات مطلوبة بموجب قوانين أو لوائح جديدة
• لا تتأثر حقوق المستثمرين الحالية سلباً
• يتم الحفاظ على الشفافية الكاملة والإفصاح المسبق`,
        },
      ],
    },
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? "rtl" : "ltr"}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === "ar"
              ? "اعثر على إجابات لأسئلتك حول ترميز العقارات والاستثمار والإطار القانوني"
              : "Find answers to your questions about real estate tokenization, investment, and legal framework"}
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="max-w-4xl mx-auto space-y-8">
          {faqSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    {language === "ar" ? section.titleAr : section.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <Accordion type="multiple" className="space-y-2">
                    {section.items.map((item, index) => (
                      <AccordionItem
                        key={`${section.id}-${index}`}
                        value={`${section.id}-${index}`}
                        className="border rounded-lg px-4 bg-background"
                      >
                        <AccordionTrigger className="hover:no-underline py-4 text-left">
                          <span className="font-medium text-sm md:text-base">
                            {language === "ar" ? item.questionAr : item.question}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <p className="text-muted-foreground whitespace-pre-line text-sm">
                            {language === "ar" ? item.answerAr : item.answer}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Card */}
        <Card className="max-w-4xl mx-auto mt-8 bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {language === "ar" ? "ملخص" : "Summary"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {language === "ar"
                    ? "SPV هي العمود الفقري القانوني لنموذج Capy Max RT. تضمن أن العقارات المرمزة ليست مجرد رمز رقمي، بل حق استثماري حقيقي وقابل للتنفيذ قانونياً مدعوم بأصل ملموس ومحمي بالقانون."
                    : "The SPV is the legal backbone of the Capy Max RT model. It ensures that tokenized real estate is not merely a digital token, but a real, legally enforceable investment right backed by a tangible asset and protected by law."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="max-w-4xl mx-auto mt-6">
          <CardContent className="py-6 text-center">
            <h3 className="text-lg font-semibold mb-2">
              {language === "ar" ? "هل لديك المزيد من الأسئلة؟" : "Have More Questions?"}
            </h3>
            <p className="text-muted-foreground mb-2">
              {language === "ar"
                ? "تواصل مع فريق الدعم لدينا على:"
                : "Contact our support team at:"}
            </p>
            <p className="text-primary font-medium">support@capimax.io</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
