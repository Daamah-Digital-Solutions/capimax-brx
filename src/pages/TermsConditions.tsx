import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, UserCheck, Shield, Ban, DollarSign, Scale, AlertTriangle } from 'lucide-react';

export default function TermsConditions() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      icon: FileText,
      titleEn: '1. Acceptance of Terms',
      titleAr: '1. قبول الشروط',
      contentEn: `By accessing or using the Capimax BRX Platform ("Platform"), you agree to be bound by these Terms & Conditions ("Terms"). If you do not agree to these Terms, you must not access or use the Platform.

These Terms constitute a legally binding agreement between you and Capimax BRX LLC, a company registered in Wyoming, USA.`,
      contentAr: `من خلال الوصول إلى منصة Capimax BRX ("المنصة") أو استخدامها، فإنك توافق على الالتزام بهذه الشروط والأحكام ("الشروط"). إذا كنت لا توافق على هذه الشروط، يجب عليك عدم الوصول إلى المنصة أو استخدامها.

تشكل هذه الشروط اتفاقية ملزمة قانونًا بينك وبين Capimax BRX LLC، وهي شركة مسجلة في وايومنغ، الولايات المتحدة الأمريكية.`
    },
    {
      icon: UserCheck,
      titleEn: '2. Eligibility',
      titleAr: '2. الأهلية',
      contentEn: `To use the Platform, you must:

• Be at least 18 years of age
• Be legally capable of entering into binding agreements
• Not be a resident of a sanctioned jurisdiction
• Comply with all applicable laws in your jurisdiction
• Complete the required KYC verification process

By using the Platform, you represent and warrant that you meet all eligibility requirements.`,
      contentAr: `لاستخدام المنصة، يجب عليك:

• أن تكون قد بلغت 18 عامًا على الأقل
• أن تكون قادرًا قانونيًا على الدخول في اتفاقيات ملزمة
• ألا تكون مقيمًا في منطقة محظورة
• الامتثال لجميع القوانين المعمول بها في منطقتك
• إكمال عملية التحقق من KYC المطلوبة

باستخدام المنصة، فإنك تقر وتضمن أنك تستوفي جميع متطلبات الأهلية.`
    },
    {
      icon: Shield,
      titleEn: '3. Account Responsibilities',
      titleAr: '3. مسؤوليات الحساب',
      contentEn: `You are responsible for:

• Maintaining the confidentiality of your login credentials
• All activities conducted through your account
• Immediately notifying us of any unauthorized access
• Ensuring your account information is accurate and up-to-date
• Securing your blockchain wallet and private keys

The Platform is not liable for any losses resulting from unauthorized access to your account due to your failure to protect your credentials.`,
      contentAr: `أنت مسؤول عن:

• الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك
• جميع الأنشطة التي تتم من خلال حسابك
• إخطارنا فورًا بأي وصول غير مصرح به
• التأكد من دقة معلومات حسابك وتحديثها
• تأمين محفظتك الرقمية ومفاتيحك الخاصة

المنصة غير مسؤولة عن أي خسائر ناتجة عن الوصول غير المصرح به إلى حسابك بسبب فشلك في حماية بيانات اعتمادك.`
    },
    {
      icon: Ban,
      titleEn: '4. Prohibited Activities',
      titleAr: '4. الأنشطة المحظورة',
      contentEn: `You agree not to:

• Use the Platform for any unlawful purpose
• Misrepresent your identity or information
• Attempt to bypass security measures
• Engage in market manipulation or fraud
• Use automated systems without authorization
• Interfere with the Platform's operation
• Violate intellectual property rights
• Transmit malware or harmful code
• Harass or harm other users

Violation of these prohibitions may result in immediate account termination.`,
      contentAr: `توافق على عدم:

• استخدام المنصة لأي غرض غير قانوني
• تحريف هويتك أو معلوماتك
• محاولة تجاوز إجراءات الأمان
• الانخراط في التلاعب بالسوق أو الاحتيال
• استخدام أنظمة آلية بدون إذن
• التدخل في تشغيل المنصة
• انتهاك حقوق الملكية الفكرية
• نقل البرامج الضارة أو الرموز الضارة
• مضايقة أو إيذاء المستخدمين الآخرين

قد يؤدي انتهاك هذه المحظورات إلى إنهاء الحساب فورًا.`
    },
    {
      icon: DollarSign,
      titleEn: '5. Fees & Payments',
      titleAr: '5. الرسوم والمدفوعات',
      contentEn: `The Platform charges fees as disclosed on the Fees Page, including:

• Tokenization Fee: 2%
• Listing Fee: 2%
• Purchase Fee: 2%
• Annual Management Fee: 1%
• Exit Fee: 0.5%
• Installment Property Fees (as applicable)

Fees may vary depending on services and features used. All fees are non-refundable unless otherwise stated.

Pronova payments receive a 5% discount as disclosed on the Platform.`,
      contentAr: `تفرض المنصة رسومًا كما هو موضح في صفحة الرسوم، بما في ذلك:

• رسوم الترميز: 2%
• رسوم الإدراج: 2%
• رسوم الشراء: 2%
• رسوم الإدارة السنوية: 1%
• رسوم الخروج: 0.5%
• رسوم العقارات بالتقسيط (حسب الاقتضاء)

قد تختلف الرسوم حسب الخدمات والميزات المستخدمة. جميع الرسوم غير قابلة للاسترداد ما لم يُذكر خلاف ذلك.

تحصل مدفوعات برونوفا على خصم 5% كما هو موضح على المنصة.`
    },
    {
      icon: Scale,
      titleEn: '6. Third-Party Services',
      titleAr: '6. خدمات الطرف الثالث',
      contentEn: `Certain services are provided by third parties, including:

• Payment processing
• Financing (Nova Sukuk)
• Asset management
• Liquidity provision
• KYC/AML verification

You acknowledge that:
• Such services are governed by separate agreements
• The Platform is not a party to those agreements
• The Platform is not liable for third-party actions or omissions`,
      contentAr: `يتم توفير خدمات معينة من قبل أطراف ثالثة، بما في ذلك:

• معالجة الدفع
• التمويل (صكوك نوفا)
• إدارة الأصول
• توفير السيولة
• التحقق من KYC/AML

أنت تقر بأن:
• هذه الخدمات تخضع لاتفاقيات منفصلة
• المنصة ليست طرفًا في تلك الاتفاقيات
• المنصة غير مسؤولة عن أفعال أو إغفالات الأطراف الثالثة`
    },
    {
      icon: AlertTriangle,
      titleEn: '7. Account Termination',
      titleAr: '7. إنهاء الحساب',
      contentEn: `The Platform reserves the right to suspend or terminate accounts for:

• Breach of these Terms
• Legal or regulatory reasons
• Security concerns
• Fraudulent or suspicious activity
• Failure to complete KYC verification
• Request from law enforcement

Upon termination, your access to the Platform will be revoked. Any pending investments or distributions will be handled according to applicable procedures.`,
      contentAr: `تحتفظ المنصة بالحق في تعليق أو إنهاء الحسابات لـ:

• خرق هذه الشروط
• أسباب قانونية أو تنظيمية
• مخاوف أمنية
• نشاط احتيالي أو مشبوه
• الفشل في إكمال التحقق من KYC
• طلب من جهات إنفاذ القانون

عند الإنهاء، سيتم إلغاء وصولك إلى المنصة. سيتم التعامل مع أي استثمارات أو توزيعات معلقة وفقًا للإجراءات المعمول بها.`
    }
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
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

          {/* Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-primary" />
                {language === 'ar' ? '8. القانون الحاكم' : '8. Governing Law'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">
                {language === 'ar'
                  ? `تخضع هذه الشروط وتفسر وفقًا لقوانين ولاية وايومنغ، الولايات المتحدة الأمريكية. أي نزاع ينشأ عن هذه الشروط أو يتعلق بها سيخضع للاختصاص القضائي الحصري لمحاكم وايومنغ.

توافق على حل أي نزاعات من خلال التحكيم الملزم وفقًا لقواعد جمعية التحكيم الأمريكية.`
                  : `These Terms shall be governed by and construed in accordance with the laws of the State of Wyoming, United States of America. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Wyoming.

You agree to resolve any disputes through binding arbitration in accordance with the rules of the American Arbitration Association.`}
              </p>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                {language === 'ar' ? '9. التغييرات على الشروط' : '9. Changes to Terms'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">
                {language === 'ar'
                  ? `نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم نشر الشروط المحدثة على المنصة مع تاريخ السريان الواضح.

استمرار استخدامك للمنصة بعد أي تغييرات يشكل موافقتك على الشروط المعدلة. ننصحك بمراجعة هذه الشروط بشكل دوري.`
                  : `We reserve the right to modify these Terms at any time. Updated Terms will be published on the Platform with the effective date clearly indicated.

Your continued use of the Platform after any changes constitutes your acceptance of the revised Terms. We encourage you to review these Terms periodically.`}
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center">
              <h3 className="text-lg font-semibold mb-2">
                {language === 'ar' ? 'اتصل بنا' : 'Contact Us'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'ar'
                  ? 'لأي استفسارات تتعلق بهذه الشروط، يرجى الاتصال بنا على:'
                  : 'For any inquiries regarding these Terms, please contact us at:'}
              </p>
              <p className="text-primary font-medium mt-2">legal@capimax.io</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
