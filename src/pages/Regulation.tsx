import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Download,
  Shield,
  Scale,
  FileCheck,
  Globe,
  Users,
  ClipboardList,
  Building2,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Regulation() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      id: "overview",
      icon: Shield,
      titleEn: "Overview of Regulation",
      titleAr: "نظرة عامة على اللوائح",
      contentEn: `Platform operations are subject to local and international financial and digital asset regulations.

Compliance with banking, fintech, and investment laws is mandatory in all jurisdictions of operation.

Key regulatory principles:
• Full transparency in all investment offerings
• Protection of investor rights and interests
• Adherence to international anti-money laundering standards
• Compliance with securities regulations across all operating jurisdictions
• Regular reporting to relevant regulatory authorities`,
      contentAr: `تخضع عمليات المنصة للوائح المالية والأصول الرقمية المحلية والدولية.

الامتثال لقوانين البنوك والتكنولوجيا المالية والاستثمار إلزامي في جميع نطاقات العمل.

المبادئ التنظيمية الرئيسية:
• الشفافية الكاملة في جميع عروض الاستثمار
• حماية حقوق ومصالح المستثمرين
• الالتزام بمعايير مكافحة غسيل الأموال الدولية
• الامتثال للوائح الأوراق المالية في جميع نطاقات التشغيل
• تقديم التقارير المنتظمة للسلطات التنظيمية ذات الصلة`,
    },
    {
      id: "licenses",
      icon: FileCheck,
      titleEn: "Licenses & Regulatory Authorities",
      titleAr: "التراخيص والسلطات التنظيمية",
      contentEn: `The Platform operates under the following regulatory frameworks and licenses:

SECURITIES EXEMPTIONS
• SEC Regulation D (506b/506c): For accredited U.S. investors
• SEC Regulation S: For non-U.S. persons and offshore transactions

FINANCIAL SERVICES
• FinCEN MSB Registration: Money Services Business compliance
• State Money Transmitter Licenses: As applicable per jurisdiction

REGULATORY AUTHORITIES
The Platform is supervised by and reports to:
• Securities and Exchange Commission (SEC) - United States
• Financial Crimes Enforcement Network (FinCEN) - AML/KYC compliance
• Relevant state and local financial regulatory bodies

All licenses are maintained in good standing and subject to regular renewal and audit.`,
      contentAr: `تعمل المنصة وفقًا للأطر التنظيمية والتراخيص التالية:

إعفاءات الأوراق المالية
• لائحة SEC D (506b/506c): للمستثمرين الأمريكيين المعتمدين
• لائحة SEC S: للأشخاص غير الأمريكيين والمعاملات الخارجية

الخدمات المالية
• تسجيل FinCEN MSB: الامتثال لأعمال خدمات المال
• تراخيص ناقل الأموال الحكومية: حسب الاقتضاء لكل ولاية قضائية

السلطات التنظيمية
تخضع المنصة لإشراف وتقدم التقارير إلى:
• هيئة الأوراق المالية والبورصات (SEC) - الولايات المتحدة
• شبكة إنفاذ الجرائم المالية (FinCEN) - الامتثال لـ AML/KYC
• الهيئات التنظيمية المالية المحلية والولائية ذات الصلة

يتم الحفاظ على جميع التراخيص بشكل جيد وتخضع للتجديد والتدقيق المنتظم.`,
    },
    {
      id: "laws",
      icon: Scale,
      titleEn: "Applicable Laws and Rules",
      titleAr: "القوانين والقواعد المعمول بها",
      contentEn: `The Platform operates under and complies with the following legal frameworks:

SECURITIES REGULATIONS
• Securities Act of 1933 - Regulation D exemptions
• Securities Exchange Act of 1934 - Secondary market compliance
• Regulation S - Offshore offerings

FINANCIAL REGULATIONS
• Bank Secrecy Act (BSA) - AML program requirements
• USA PATRIOT Act - Enhanced due diligence
• FATCA - Foreign account reporting

INVESTMENT LAWS
• Investment Company Act of 1940 - Exemptions and compliance
• Investment Advisers Act of 1940 - Regulatory requirements
• State Blue Sky Laws - Per-state compliance

CROSS-BORDER RULES
• OFAC Sanctions - Prohibited jurisdiction screening
• International tax treaties - Reporting obligations
• Foreign investment regulations - Country-specific compliance`,
      contentAr: `تعمل المنصة وتمتثل للأطر القانونية التالية:

لوائح الأوراق المالية
• قانون الأوراق المالية لعام 1933 - إعفاءات اللائحة D
• قانون تداول الأوراق المالية لعام 1934 - الامتثال للسوق الثانوية
• اللائحة S - العروض الخارجية

اللوائح المالية
• قانون سرية البنوك (BSA) - متطلبات برنامج AML
• قانون USA PATRIOT - العناية الواجبة المعززة
• FATCA - الإبلاغ عن الحسابات الأجنبية

قوانين الاستثمار
• قانون شركات الاستثمار لعام 1940 - الإعفاءات والامتثال
• قانون مستشاري الاستثمار لعام 1940 - المتطلبات التنظيمية
• قوانين Blue Sky الحكومية - الامتثال لكل ولاية

القواعد عبر الحدود
• عقوبات OFAC - فحص الولايات القضائية المحظورة
• معاهدات الضرائب الدولية - التزامات الإبلاغ
• لوائح الاستثمار الأجنبي - الامتثال الخاص بكل بلد`,
    },
    {
      id: "user-obligations",
      icon: Users,
      titleEn: "User Obligations under Regulation",
      titleAr: "التزامات المستخدم بموجب اللوائح",
      contentEn: `As a Platform user, you are obligated to:

COMPLIANCE REQUIREMENTS
• Provide accurate and truthful information during registration
• Complete all required KYC/AML verification procedures
• Report any changes to your personal or financial information
• Comply with all applicable investment and reporting regulations

PROHIBITED ACTIVITIES
• Providing false or misleading information
• Attempting to circumvent identity verification
• Engaging in market manipulation or fraud
• Using the Platform from prohibited jurisdictions

REPORTING OBLIGATIONS
• Report suspicious activity if observed
• Maintain records of your investment activities
• Comply with tax reporting requirements in your jurisdiction
• Notify the Platform of any regulatory inquiries

TRANSACTION LIMITS
• Adhere to investment limits based on accreditation status
• Comply with withdrawal and transfer restrictions
• Observe any holding period requirements`,
      contentAr: `كمستخدم للمنصة، أنت ملزم بـ:

متطلبات الامتثال
• تقديم معلومات دقيقة وصادقة أثناء التسجيل
• إكمال جميع إجراءات التحقق من KYC/AML المطلوبة
• الإبلاغ عن أي تغييرات في معلوماتك الشخصية أو المالية
• الامتثال لجميع لوائح الاستثمار والإبلاغ المعمول بها

الأنشطة المحظورة
• تقديم معلومات كاذبة أو مضللة
• محاولة التحايل على التحقق من الهوية
• الانخراط في التلاعب بالسوق أو الاحتيال
• استخدام المنصة من الولايات القضائية المحظورة

التزامات الإبلاغ
• الإبلاغ عن أي نشاط مشبوه إذا لوحظ
• الاحتفاظ بسجلات لأنشطتك الاستثمارية
• الامتثال لمتطلبات الإبلاغ الضريبي في نطاقك القضائي
• إخطار المنصة بأي استفسارات تنظيمية

حدود المعاملات
• الالتزام بحدود الاستثمار بناءً على حالة الاعتماد
• الامتثال لقيود السحب والتحويل
• مراعاة أي متطلبات فترة الاحتفاظ`,
    },
    {
      id: "auditing",
      icon: ClipboardList,
      titleEn: "Auditing and Reporting",
      titleAr: "التدقيق والإبلاغ",
      contentEn: `The Platform maintains rigorous auditing and reporting procedures:

INTERNAL AUDITS
• Quarterly compliance audits
• Annual financial audits by independent auditors
• Regular security and technology audits
• Ongoing AML/KYC program effectiveness reviews

REGULATORY REPORTING
• Periodic reports to SEC as required
• FinCEN suspicious activity reports (SARs) when applicable
• State regulatory filings and renewals
• Annual compliance certifications

INVESTOR TRANSPARENCY
• Quarterly investment performance reports
• Annual audited financial statements for SPVs
• Real-time transaction records and confirmations
• Clear fee disclosure and reporting

RECORD KEEPING
• All transactions recorded and archived
• Investor communications maintained
• Compliance documentation preserved
• Audit trails for all material activities`,
      contentAr: `تحافظ المنصة على إجراءات تدقيق وإبلاغ صارمة:

التدقيق الداخلي
• عمليات تدقيق الامتثال الفصلية
• عمليات التدقيق المالي السنوية من قبل مدققين مستقلين
• عمليات تدقيق الأمان والتكنولوجيا المنتظمة
• مراجعات مستمرة لفعالية برنامج AML/KYC

التقارير التنظيمية
• تقارير دورية إلى SEC حسب الحاجة
• تقارير النشاط المشبوه من FinCEN (SARs) عند الاقتضاء
• الإيداعات والتجديدات التنظيمية الحكومية
• شهادات الامتثال السنوية

شفافية المستثمر
• تقارير أداء الاستثمار الفصلية
• البيانات المالية المدققة السنوية لـ SPVs
• سجلات المعاملات والتأكيدات في الوقت الفعلي
• الإفصاح الواضح عن الرسوم والإبلاغ

حفظ السجلات
• جميع المعاملات مسجلة ومؤرشفة
• الحفاظ على اتصالات المستثمرين
• حفظ وثائق الامتثال
• مسارات التدقيق لجميع الأنشطة الجوهرية`,
    },
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? "rtl" : "ltr"}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Scale className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === "ar" ? "اللوائح التنظيمية" : "Regulation"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === "ar"
              ? "فهم الإطار التنظيمي الذي تعمل بموجبه المنصة"
              : "Understanding the regulatory framework under which the Platform operates"}
          </p>
          <Button variant="outline" className="mt-4">
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تحميل PDF" : "Download PDF"}
          </Button>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Accordion type="multiple" className="space-y-4">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border rounded-lg px-6 bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-semibold text-left">
                        {language === "ar" ? section.titleAr : section.titleEn}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <p className="text-muted-foreground whitespace-pre-line pl-13">
                      {language === "ar" ? section.contentAr : section.contentEn}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* Regulatory References */}
          <Card className="mt-8 bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-primary" />
                {language === "ar" ? "المراجع التنظيمية" : "Regulatory References"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <a
                  href="https://www.sec.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-background rounded-lg hover:bg-muted transition-colors"
                >
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-sm">SEC - Securities and Exchange Commission</span>
                </a>
                <a
                  href="https://www.fincen.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-background rounded-lg hover:bg-muted transition-colors"
                >
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-sm">FinCEN - Financial Crimes Enforcement</span>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="mt-6">
            <CardContent className="py-6 text-center">
              <h3 className="text-lg font-semibold mb-2">
                {language === "ar" ? "استفسارات تنظيمية" : "Regulatory Inquiries"}
              </h3>
              <p className="text-muted-foreground mb-2">
                {language === "ar"
                  ? "للاستفسارات التنظيمية، يرجى التواصل معنا على:"
                  : "For regulatory inquiries, please contact us at:"}
              </p>
              <p className="text-primary font-medium">compliance@capimax.io</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
