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
  FileCheck,
  Lock,
  Eye,
  Users,
  ClipboardList,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

export default function Compliance() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      id: "overview",
      icon: Shield,
      titleEn: "Overview of Compliance",
      titleAr: "نظرة عامة على الامتثال",
      contentEn: `The Platform maintains a comprehensive compliance program to ensure adherence to all applicable regulations:

• Continuous monitoring of regulatory developments and requirements
• Proactive compliance with financial regulations and AML/KYC requirements
• Protection of investor assets and platform integrity
• Regular policy updates to reflect regulatory changes
• Dedicated compliance team overseeing all operations

Our compliance framework is designed to protect both investors and the platform while ensuring transparent and lawful operations.`,
      contentAr: `تحافظ المنصة على برنامج امتثال شامل لضمان الالتزام بجميع اللوائح المعمول بها:

• المراقبة المستمرة للتطورات والمتطلبات التنظيمية
• الامتثال الاستباقي للوائح المالية ومتطلبات AML/KYC
• حماية أصول المستثمرين ونزاهة المنصة
• تحديثات السياسات المنتظمة لتعكس التغييرات التنظيمية
• فريق امتثال مخصص يشرف على جميع العمليات

تم تصميم إطار الامتثال لدينا لحماية المستثمرين والمنصة على حد سواء مع ضمان عمليات شفافة وقانونية.`,
    },
    {
      id: "kyc-aml",
      icon: FileCheck,
      titleEn: "KYC / AML Procedures",
      titleAr: "إجراءات KYC / AML",
      contentEn: `Know Your Customer (KYC) and Anti-Money Laundering (AML) procedures are central to our compliance framework:

IDENTITY VERIFICATION
• Government-issued ID verification for all investors
• Proof of address documentation
• Accreditation status verification for U.S. investors
• Enhanced due diligence for high-risk profiles

AML SCREENING
• Sanctions list screening (OFAC, UN, EU)
• Politically Exposed Persons (PEP) checks
• Adverse media screening
• Ongoing monitoring of investor activity

DOCUMENTATION
• Secure storage of all KYC documents
• Regular document refresh and re-verification
• Audit trail maintenance for all verification activities
• Compliance with data protection regulations

RISK ASSESSMENT
• Risk-based approach to customer due diligence
• Enhanced scrutiny for high-risk transactions
• Geographic risk assessment
• Source of funds verification when required`,
      contentAr: `إجراءات اعرف عميلك (KYC) ومكافحة غسيل الأموال (AML) هي محور إطار الامتثال لدينا:

التحقق من الهوية
• التحقق من الهوية الصادرة عن الحكومة لجميع المستثمرين
• وثائق إثبات العنوان
• التحقق من حالة الاعتماد للمستثمرين الأمريكيين
• العناية الواجبة المعززة للملفات عالية المخاطر

فحص AML
• فحص قوائم العقوبات (OFAC، UN، EU)
• فحوصات الأشخاص المعرضين سياسياً (PEP)
• فحص الوسائط السلبية
• المراقبة المستمرة لنشاط المستثمر

التوثيق
• التخزين الآمن لجميع وثائق KYC
• تحديث المستندات وإعادة التحقق بانتظام
• الحفاظ على مسار التدقيق لجميع أنشطة التحقق
• الامتثال للوائح حماية البيانات

تقييم المخاطر
• نهج قائم على المخاطر للعناية الواجبة بالعملاء
• التدقيق المعزز للمعاملات عالية المخاطر
• تقييم المخاطر الجغرافية
• التحقق من مصدر الأموال عند الحاجة`,
    },
    {
      id: "transaction-monitoring",
      icon: Search,
      titleEn: "Transaction Monitoring",
      titleAr: "مراقبة المعاملات",
      contentEn: `Real-time monitoring ensures the integrity of all platform activities:

AUTOMATED MONITORING
• Real-time transaction screening and analysis
• Pattern recognition for unusual activity
• Velocity checks for rapid transactions
• Cross-reference with watchlists and sanctions

ALERT MANAGEMENT
• Tiered alert system based on risk level
• Rapid investigation of flagged transactions
• Documentation of all alert resolutions
• Escalation procedures for high-priority cases

FRAUD PREVENTION
• Multi-factor authentication requirements
• Device fingerprinting and behavioral analysis
• IP monitoring and geographic restrictions
• Account takeover prevention measures

REPORTING
• Suspicious Activity Reports (SARs) filed as required
• Currency Transaction Reports (CTRs) when applicable
• Regular compliance reporting to management
• Regulatory reporting within required timeframes`,
      contentAr: `تضمن المراقبة في الوقت الفعلي نزاهة جميع أنشطة المنصة:

المراقبة الآلية
• فحص وتحليل المعاملات في الوقت الفعلي
• التعرف على الأنماط للنشاط غير العادي
• فحوصات السرعة للمعاملات السريعة
• المقارنة مع قوائم المراقبة والعقوبات

إدارة التنبيهات
• نظام تنبيه متدرج بناءً على مستوى المخاطر
• التحقيق السريع في المعاملات المشتبه بها
• توثيق جميع حلول التنبيهات
• إجراءات التصعيد للحالات ذات الأولوية العالية

منع الاحتيال
• متطلبات المصادقة متعددة العوامل
• بصمة الجهاز والتحليل السلوكي
• مراقبة IP والقيود الجغرافية
• تدابير منع الاستيلاء على الحساب

التقارير
• تقديم تقارير النشاط المشبوه (SARs) حسب الحاجة
• تقارير المعاملات النقدية (CTRs) عند الاقتضاء
• تقارير الامتثال المنتظمة للإدارة
• التقارير التنظيمية ضمن الأطر الزمنية المطلوبة`,
    },
    {
      id: "audit-reporting",
      icon: ClipboardList,
      titleEn: "Audit & Reporting",
      titleAr: "التدقيق والإبلاغ",
      contentEn: `Rigorous audit and reporting procedures ensure ongoing compliance:

INTERNAL AUDITS
• Quarterly compliance program assessments
• Annual independent compliance audits
• Regular testing of controls and procedures
• Gap analysis and remediation tracking

REGULATORY REPORTING
• Timely submission of required regulatory filings
• SEC reporting obligations (as applicable)
• FinCEN reporting requirements
• State regulatory filings and renewals

GOVERNANCE
• Board-level compliance oversight
• Regular compliance committee meetings
• Policy review and approval processes
• Whistleblower program management

DOCUMENTATION
• Comprehensive record retention policies
• Audit trail for all compliance activities
• Training records and certifications
• Regulatory correspondence archives

All audits are conducted in accordance with Reg D, securities regulations, and financial reporting requirements.`,
      contentAr: `إجراءات التدقيق والإبلاغ الصارمة تضمن الامتثال المستمر:

التدقيق الداخلي
• تقييمات برنامج الامتثال الفصلية
• عمليات تدقيق الامتثال المستقلة السنوية
• الاختبار المنتظم للضوابط والإجراءات
• تحليل الفجوات وتتبع المعالجة

التقارير التنظيمية
• التقديم في الوقت المناسب للإيداعات التنظيمية المطلوبة
• التزامات التقارير لـ SEC (حسب الاقتضاء)
• متطلبات التقارير لـ FinCEN
• الإيداعات والتجديدات التنظيمية الحكومية

الحوكمة
• الرقابة على الامتثال على مستوى مجلس الإدارة
• اجتماعات لجنة الامتثال المنتظمة
• عمليات مراجعة واعتماد السياسات
• إدارة برنامج المبلغين عن المخالفات

التوثيق
• سياسات الاحتفاظ بالسجلات الشاملة
• مسار التدقيق لجميع أنشطة الامتثال
• سجلات التدريب والشهادات
• أرشيفات المراسلات التنظيمية

يتم إجراء جميع عمليات التدقيق وفقًا للائحة D ولوائح الأوراق المالية ومتطلبات التقارير المالية.`,
    },
    {
      id: "user-responsibilities",
      icon: Users,
      titleEn: "User Responsibilities",
      titleAr: "مسؤوليات المستخدم",
      contentEn: `Users have specific compliance responsibilities when using the Platform:

ACCURATE INFORMATION
• Provide truthful and complete information during registration
• Update information promptly when changes occur
• Respond to verification requests in a timely manner
• Do not misrepresent identity or qualifications

PLATFORM RULES
• Comply with all Terms and Conditions
• Follow investment guidelines and restrictions
• Respect transaction limits and holding periods
• Report any suspicious activity observed

APPLICABLE LAWS
• Comply with securities laws in your jurisdiction
• Fulfill tax reporting obligations
• Adhere to foreign investment restrictions if applicable
• Report investments as required by local regulations

COOPERATION
• Respond to Platform inquiries promptly
• Provide additional documentation when requested
• Cooperate with compliance reviews and audits
• Report concerns through proper channels`,
      contentAr: `للمستخدمين مسؤوليات امتثال محددة عند استخدام المنصة:

المعلومات الدقيقة
• تقديم معلومات صادقة وكاملة أثناء التسجيل
• تحديث المعلومات فور حدوث التغييرات
• الرد على طلبات التحقق في الوقت المناسب
• عدم تحريف الهوية أو المؤهلات

قواعد المنصة
• الامتثال لجميع الشروط والأحكام
• اتباع إرشادات وقيود الاستثمار
• احترام حدود المعاملات وفترات الاحتفاظ
• الإبلاغ عن أي نشاط مشبوه يتم ملاحظته

القوانين المعمول بها
• الامتثال لقوانين الأوراق المالية في نطاقك القضائي
• الوفاء بالتزامات الإبلاغ الضريبي
• الالتزام بقيود الاستثمار الأجنبي إن وجدت
• الإبلاغ عن الاستثمارات حسب ما تتطلبه اللوائح المحلية

التعاون
• الرد على استفسارات المنصة بسرعة
• تقديم وثائق إضافية عند الطلب
• التعاون في مراجعات وتدقيقات الامتثال
• الإبلاغ عن المخاوف من خلال القنوات المناسبة`,
    },
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? "rtl" : "ltr"}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === "ar" ? "الامتثال" : "Compliance"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {language === "ar"
              ? "كيف تضمن المنصة الامتثال المستمر للمتطلبات التنظيمية والسياسات الداخلية"
              : "How the Platform ensures ongoing compliance with regulatory requirements and internal policies"}
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

          {/* Important Notice */}
          <Card className="mt-8 bg-amber-500/5 border-amber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {language === "ar" ? "إشعار هام" : "Important Notice"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {language === "ar"
                  ? "الامتثال مسؤولية مشتركة. بينما تحافظ المنصة على برنامج امتثال قوي، يجب على المستخدمين أيضًا الوفاء بالتزاماتهم. قد يؤدي عدم الامتثال لمتطلبات المنصة أو القوانين المعمول بها إلى تقييد الحساب أو إنهائه."
                  : "Compliance is a shared responsibility. While the Platform maintains a robust compliance program, users must also fulfill their obligations. Failure to comply with Platform requirements or applicable laws may result in account restriction or termination."}
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="mt-6">
            <CardContent className="py-6 text-center">
              <h3 className="text-lg font-semibold mb-2">
                {language === "ar" ? "فريق الامتثال" : "Compliance Team"}
              </h3>
              <p className="text-muted-foreground mb-2">
                {language === "ar"
                  ? "للاستفسارات المتعلقة بالامتثال أو للإبلاغ عن مخاوف:"
                  : "For compliance-related inquiries or to report concerns:"}
              </p>
              <p className="text-primary font-medium">compliance@capimax.io</p>
              <div className="mt-4">
                <Link to="/regulation">
                  <Button variant="outline" size="sm">
                    {language === "ar" ? "عرض اللوائح التنظيمية" : "View Regulation"}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
