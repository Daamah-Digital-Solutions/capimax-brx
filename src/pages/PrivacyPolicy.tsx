import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Shield, Lock, Eye, Database, Globe, UserCheck } from 'lucide-react';

export default function PrivacyPolicy() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      icon: Shield,
      titleEn: '1. Introduction',
      titleAr: '1. مقدمة',
      contentEn: `This Privacy Policy explains how Capimax BRX ("Platform", "we", "us", "our") collects, uses, stores, and protects personal data. We are committed to ensuring that your privacy is protected and that we comply with applicable data protection laws and regulations.`,
      contentAr: `توضح سياسة الخصوصية هذه كيف تقوم Capimax BRX ("المنصة"، "نحن"، "لنا") بجمع واستخدام وتخزين وحماية البيانات الشخصية. نحن ملتزمون بضمان حماية خصوصيتك والامتثال لقوانين ولوائح حماية البيانات المعمول بها.`
    },
    {
      icon: Database,
      titleEn: '2. Data Collected',
      titleAr: '2. البيانات المجمعة',
      contentEn: `The Platform may collect the following types of personal data:
      
• Personal identification data (name, nationality, ID documents, passport)
• Contact details (email address, phone number, physical address)
• Account and authentication data (username, encrypted passwords)
• Transactional and usage data (investment history, platform interactions)
• KYC/AML documentation (identity verification documents, proof of address)
• Financial information (bank account details for distributions)
• Device and browser information (IP address, browser type, operating system)`,
      contentAr: `قد تجمع المنصة الأنواع التالية من البيانات الشخصية:

• بيانات التعريف الشخصية (الاسم، الجنسية، وثائق الهوية، جواز السفر)
• تفاصيل الاتصال (عنوان البريد الإلكتروني، رقم الهاتف، العنوان الفعلي)
• بيانات الحساب والمصادقة (اسم المستخدم، كلمات المرور المشفرة)
• البيانات المعاملاتية وبيانات الاستخدام (تاريخ الاستثمار، التفاعلات على المنصة)
• وثائق KYC/AML (وثائق التحقق من الهوية، إثبات العنوان)
• المعلومات المالية (تفاصيل الحساب البنكي للتوزيعات)
• معلومات الجهاز والمتصفح (عنوان IP، نوع المتصفح، نظام التشغيل)`
    },
    {
      icon: Eye,
      titleEn: '3. Purpose of Data Use',
      titleAr: '3. الغرض من استخدام البيانات',
      contentEn: `We use your personal data for the following purposes:

• Account creation, management, and maintenance
• Identity verification (KYC/AML compliance)
• Processing transactions and investments
• Platform functionality, security, and fraud prevention
• Communication and notifications about your account and investments
• Compliance with legal and regulatory obligations
• Improving our services and user experience
• Generating anonymized analytics and reports`,
      contentAr: `نستخدم بياناتك الشخصية للأغراض التالية:

• إنشاء الحساب وإدارته وصيانته
• التحقق من الهوية (الامتثال لـ KYC/AML)
• معالجة المعاملات والاستثمارات
• وظائف المنصة والأمان ومنع الاحتيال
• التواصل والإشعارات حول حسابك واستثماراتك
• الامتثال للالتزامات القانونية والتنظيمية
• تحسين خدماتنا وتجربة المستخدم
• إنشاء تحليلات وتقارير مجهولة المصدر`
    },
    {
      icon: Globe,
      titleEn: '4. Data Sharing',
      titleAr: '4. مشاركة البيانات',
      contentEn: `Your data may be shared with:

• KYC/AML service providers for identity verification
• Payment processors for transaction processing
• SPV entities for investment management
• Regulatory or law enforcement authorities when required by law
• Third-party service providers who assist in platform operations

Important: The Platform does not sell personal data to third parties.

All third-party providers are contractually obligated to protect your data and use it only for the specified purposes.`,
      contentAr: `قد تتم مشاركة بياناتك مع:

• مزودي خدمات KYC/AML للتحقق من الهوية
• معالجي الدفع لمعالجة المعاملات
• كيانات SPV لإدارة الاستثمار
• السلطات التنظيمية أو تنفيذ القانون عند الحاجة بموجب القانون
• مزودي الخدمات من الأطراف الثالثة الذين يساعدون في عمليات المنصة

هام: لا تبيع المنصة البيانات الشخصية لأطراف ثالثة.

جميع مزودي الخدمات ملزمون تعاقديًا بحماية بياناتك واستخدامها فقط للأغراض المحددة.`
    },
    {
      icon: Lock,
      titleEn: '5. Data Storage & Security',
      titleAr: '5. تخزين البيانات والأمان',
      contentEn: `We implement comprehensive security measures to protect your data:

• Data is stored securely using industry-standard encryption (AES-256)
• Access is restricted based on roles and authorization levels
• Signed links and encryption are used for document access
• Regular security audits and penetration testing
• Secure data centers with physical access controls
• Employee training on data protection and security protocols

Data retention: We retain your data for as long as necessary to fulfill the purposes outlined in this policy, or as required by law.`,
      contentAr: `نطبق تدابير أمنية شاملة لحماية بياناتك:

• يتم تخزين البيانات بشكل آمن باستخدام تشفير قياسي (AES-256)
• الوصول مقيد بناءً على الأدوار ومستويات التفويض
• استخدام روابط موقعة وتشفير للوصول إلى المستندات
• عمليات تدقيق أمنية منتظمة واختبار الاختراق
• مراكز بيانات آمنة مع ضوابط الوصول المادي
• تدريب الموظفين على بروتوكولات حماية البيانات والأمان

الاحتفاظ بالبيانات: نحتفظ ببياناتك طالما كان ذلك ضروريًا لتحقيق الأغراض الموضحة في هذه السياسة، أو كما يتطلب القانون.`
    },
    {
      icon: UserCheck,
      titleEn: '6. Your Rights',
      titleAr: '6. حقوقك',
      contentEn: `You have the following rights regarding your personal data:

• Right to Access: Request a copy of your personal data
• Right to Rectification: Request correction of inaccurate data
• Right to Erasure: Request deletion of your data (subject to legal obligations)
• Right to Restriction: Request limitation of data processing
• Right to Portability: Request transfer of your data
• Right to Object: Object to certain types of data processing
• Right to Withdraw Consent: Withdraw consent where applicable

To exercise any of these rights, please contact us at privacy@capimax.io`,
      contentAr: `لديك الحقوق التالية فيما يتعلق ببياناتك الشخصية:

• حق الوصول: طلب نسخة من بياناتك الشخصية
• حق التصحيح: طلب تصحيح البيانات غير الدقيقة
• حق الحذف: طلب حذف بياناتك (مع مراعاة الالتزامات القانونية)
• حق التقييد: طلب تقييد معالجة البيانات
• حق النقل: طلب نقل بياناتك
• حق الاعتراض: الاعتراض على أنواع معينة من معالجة البيانات
• حق سحب الموافقة: سحب الموافقة عند الاقتضاء

لممارسة أي من هذه الحقوق، يرجى الاتصال بنا على privacy@capimax.io`
    }
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'آخر تحديث: يناير 2026' : 'Last Updated: January 2026'}
          </p>
          <Button variant="outline" className="mt-4">
            <Download className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
          </Button>
        </div>

        {/* Sections */}
        <div className="space-y-6 max-w-4xl mx-auto">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    {language === 'ar' ? section.titleAr : section.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {language === 'ar' ? section.contentAr : section.contentEn}
                  </p>
                </CardContent>
              </Card>
            );
          })}

          {/* Cookies Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                {language === 'ar' ? '7. ملفات تعريف الارتباط' : '7. Cookies'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">
                {language === 'ar'
                  ? `تستخدم المنصة ملفات تعريف الارتباط (Cookies) للأغراض التالية:

• ملفات تعريف الارتباط الضرورية: لتشغيل الوظائف الأساسية
• ملفات تعريف الارتباط التحليلية: لفهم كيفية استخدام المنصة
• ملفات تعريف الارتباط الوظيفية: لتذكر تفضيلاتك

يمكنك إدارة تفضيلات ملفات تعريف الارتباط من خلال إعدادات المتصفح.`
                  : `The Platform uses cookies for the following purposes:

• Essential Cookies: To operate core functionality
• Analytics Cookies: To understand how the platform is used
• Functional Cookies: To remember your preferences

You can manage cookie preferences through your browser settings.`}
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center">
              <h3 className="text-lg font-semibold mb-2">
                {language === 'ar' ? 'اتصل بنا' : 'Contact Us'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'ar'
                  ? 'لأي استفسارات تتعلق بالخصوصية، يرجى الاتصال بنا على:'
                  : 'For any privacy-related inquiries, please contact us at:'}
              </p>
              <p className="text-primary font-medium mt-2">privacy@capimax.io</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
