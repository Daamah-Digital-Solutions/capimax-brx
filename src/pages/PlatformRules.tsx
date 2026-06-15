import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Users, Coins, ArrowRightLeft, Clock, Shield, AlertTriangle } from 'lucide-react';

export default function PlatformRules() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      icon: Users,
      titleEn: '1. General Conduct',
      titleAr: '1. السلوك العام',
      contentEn: `All users must:

• Act honestly and in good faith
• Comply with all applicable laws and regulations
• Respect other platform users
• Provide accurate and truthful information
• Maintain confidentiality of account credentials
• Report suspicious activities

Users must NOT:
• Engage in fraudulent or deceptive practices
• Misrepresent identity or qualifications
• Harass or abuse other users
• Attempt to manipulate markets or prices
• Use the Platform for money laundering
• Violate intellectual property rights`,
      contentAr: `يجب على جميع المستخدمين:

• التصرف بصدق وحسن نية
• الامتثال لجميع القوانين واللوائح المعمول بها
• احترام مستخدمي المنصة الآخرين
• تقديم معلومات دقيقة وصادقة
• الحفاظ على سرية بيانات اعتماد الحساب
• الإبلاغ عن الأنشطة المشبوهة

يجب على المستخدمين عدم:
• الانخراط في ممارسات احتيالية أو خادعة
• تحريف الهوية أو المؤهلات
• مضايقة أو إساءة استخدام المستخدمين الآخرين
• محاولة التلاعب بالأسواق أو الأسعار
• استخدام المنصة لغسل الأموال
• انتهاك حقوق الملكية الفكرية`
    },
    {
      icon: Coins,
      titleEn: '2. Investment Rules',
      titleAr: '2. قواعد الاستثمار',
      contentEn: `INVESTMENT RESTRICTIONS
• Minimum investment amounts may apply per property
• Maximum investment limits may be enforced
• KYC verification required before investing
• Certain investments may be restricted by jurisdiction

INVESTMENT TYPES
• Fractional ownership
• Tokenized ownership
• SPV share ownership

LOCK-UP PERIODS
• Under-construction properties: 6-month lock-up from investment date
• Specific properties may have custom lock-up periods
• Lock-up details disclosed on each property page

NOVA SUKUK FINANCED INVESTMENTS
• Exit and selling restricted until Nova approval
• Yields suspended on payment default
• Investment in USD only (not affected by Pronova)`,
      contentAr: `قيود الاستثمار
• قد تنطبق الحد الأدنى من مبالغ الاستثمار لكل عقار
• قد يتم فرض حدود قصوى للاستثمار
• التحقق من KYC مطلوب قبل الاستثمار
• قد تكون بعض الاستثمارات مقيدة حسب المنطقة

أنواع الاستثمار
• الملكية الجزئية
• الملكية المرمزة
• ملكية أسهم SPV

فترات الإغلاق
• العقارات قيد الإنشاء: إغلاق لمدة 6 أشهر من تاريخ الاستثمار
• قد يكون للعقارات المحددة فترات إغلاق مخصصة
• تفاصيل الإغلاق موضحة في كل صفحة عقار

الاستثمارات الممولة بصكوك نوفا
• الخروج والبيع مقيدان حتى موافقة نوفا
• تعليق العوائد عند التخلف عن السداد
• الاستثمار بالدولار فقط (لا يتأثر ببرونوفا)`
    },
    {
      icon: ArrowRightLeft,
      titleEn: '3. Currency Rules',
      titleAr: '3. قواعد العملة',
      contentEn: `PRONOVA CURRENCY (PRN)
Pronova is treated as a fixed-value payment unit:

• 1 Pronova = 1 USD (fixed, non-fluctuating)
• No price speculation allowed
• No market-based pricing
• No volatility
• No trading on the Platform

PRONOVA USAGE
• Payment for investments
• Platform fee payments
• 5% discount on all Pronova payments

FIAT CURRENCIES
• USD is the primary currency
• Other currencies converted at prevailing rates
• Currency risk applies to non-USD payments

CRYPTOCURRENCY
• Crypto payments accepted (BTC, ETH, USDT, USDC)
• Converted to USD at time of payment
• Network fees apply`,
      contentAr: `عملة برونوفا (PRN)
يُعامل برونوفا كوحدة دفع ثابتة القيمة:

• 1 برونوفا = 1 دولار أمريكي (ثابت، غير متقلب)
• لا يسمح بالمضاربة على الأسعار
• لا تسعير قائم على السوق
• لا تقلب
• لا تداول على المنصة

استخدام برونوفا
• الدفع للاستثمارات
• دفع رسوم المنصة
• خصم 5% على جميع مدفوعات برونوفا

العملات الورقية
• الدولار الأمريكي هو العملة الأساسية
• العملات الأخرى محولة بالأسعار السائدة
• ينطبق مخاطر العملة على المدفوعات غير الدولارية

العملات المشفرة
• تُقبل مدفوعات العملات المشفرة (BTC، ETH، USDT، USDC)
• محولة إلى دولار أمريكي في وقت الدفع
• تنطبق رسوم الشبكة`
    },
    {
      icon: Clock,
      titleEn: '4. Exit Rules',
      titleAr: '4. قواعد الخروج',
      contentEn: `SECONDARY MARKET
• Investor-to-investor trading
• Button color: Green
• Subject to availability
• Platform fees apply
• May be restricted for certain properties

INSTANT EXIT (Liquidity Provider)
• Direct sale to liquidity provider
• Button color: Red
• Higher fees apply
• Available after 6 months from platform launch
• Status before activation: "Coming Soon"
• Subject to liquidity availability

UNDER-CONSTRUCTION PROPERTIES
• Exit disabled for first 6 months
• Secondary market enabled after lock-up
• Instant exit subject to same 6-month rule

NOVA SUKUK FINANCED
• Exit blocked until Nova approval
• Must settle financing first
• Admin can override with audit trail`,
      contentAr: `السوق الثانوية
• التداول بين المستثمرين
• لون الزر: أخضر
• يخضع للتوافر
• تنطبق رسوم المنصة
• قد يكون مقيدًا لعقارات معينة

الخروج الفوري (مزود السيولة)
• البيع المباشر لمزود السيولة
• لون الزر: أحمر
• تنطبق رسوم أعلى
• متاح بعد 6 أشهر من إطلاق المنصة
• الحالة قبل التفعيل: "قريبًا"
• يخضع لتوافر السيولة

العقارات قيد الإنشاء
• الخروج معطل لأول 6 أشهر
• السوق الثانوية متاحة بعد فترة الإغلاق
• الخروج الفوري يخضع لنفس قاعدة 6 أشهر

الممول بصكوك نوفا
• الخروج محظور حتى موافقة نوفا
• يجب تسوية التمويل أولاً
• يمكن للمسؤول التجاوز مع سجل التدقيق`
    },
    {
      icon: Shield,
      titleEn: '5. KYC & Verification Rules',
      titleAr: '5. قواعد KYC والتحقق',
      contentEn: `MANDATORY VERIFICATION
All users must complete KYC before:
• Making investments
• Receiving distributions
• Accessing blockchain wallet
• Trading on secondary market

VERIFICATION LEVELS
• Basic: Personal information, ID document
• Enhanced: Proof of address, source of funds
• Accredited: Additional documentation for U.S. investors

ONGOING MONITORING
• Periodic re-verification may be required
• Additional documents may be requested
• Failure to comply may result in account restrictions

SANCTIONS SCREENING
• All users screened against sanctions lists
• Restricted jurisdictions blocked
• Suspicious activity reported to authorities`,
      contentAr: `التحقق الإلزامي
يجب على جميع المستخدمين إكمال KYC قبل:
• إجراء الاستثمارات
• استلام التوزيعات
• الوصول إلى المحفظة الرقمية
• التداول في السوق الثانوية

مستويات التحقق
• أساسي: المعلومات الشخصية، وثيقة الهوية
• معزز: إثبات العنوان، مصدر الأموال
• معتمد: وثائق إضافية للمستثمرين الأمريكيين

المراقبة المستمرة
• قد يكون إعادة التحقق الدورية مطلوبة
• قد يُطلب مستندات إضافية
• الفشل في الامتثال قد يؤدي إلى قيود على الحساب

فحص العقوبات
• يتم فحص جميع المستخدمين مقابل قوائم العقوبات
• المناطق المقيدة محظورة
• يتم الإبلاغ عن النشاط المشبوه للسلطات`
    },
    {
      icon: AlertTriangle,
      titleEn: '6. Compliance Enforcement',
      titleAr: '6. إنفاذ الامتثال',
      contentEn: `VIOLATION CONSEQUENCES
Violation of Platform Rules may result in:

• Warning notification
• Temporary account suspension
• Permanent account termination
• Transaction reversal
• Forfeiture of pending distributions
• Reporting to regulatory authorities
• Legal action

APPEAL PROCESS
• Users may appeal enforcement actions
• Appeals reviewed within 30 days
• Decision is final and binding

COOPERATION WITH AUTHORITIES
The Platform will cooperate with:
• Law enforcement agencies
• Regulatory bodies
• Court orders
• International investigations

All enforcement actions are logged for audit purposes.`,
      contentAr: `عواقب الانتهاك
قد يؤدي انتهاك قواعد المنصة إلى:

• إشعار تحذير
• تعليق مؤقت للحساب
• إنهاء دائم للحساب
• عكس المعاملات
• مصادرة التوزيعات المعلقة
• الإبلاغ إلى السلطات التنظيمية
• الإجراءات القانونية

عملية الاستئناف
• يمكن للمستخدمين استئناف إجراءات الإنفاذ
• تتم مراجعة الاستئنافات خلال 30 يومًا
• القرار نهائي وملزم

التعاون مع السلطات
ستتعاون المنصة مع:
• وكالات إنفاذ القانون
• الهيئات التنظيمية
• أوامر المحكمة
• التحقيقات الدولية

يتم تسجيل جميع إجراءات الإنفاذ لأغراض التدقيق.`
    }
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'قواعد المنصة' : 'Platform Rules'}
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

          {/* Updates Notice */}
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <h3 className="text-lg font-semibold mb-2">
                {language === 'ar' ? 'التحديثات والتعديلات' : 'Updates & Amendments'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'ar'
                  ? 'قد يتم تحديث هذه القواعد من وقت لآخر. سيتم إخطار المستخدمين بالتغييرات الجوهرية. الاستخدام المستمر للمنصة يشكل قبول القواعد المحدثة.'
                  : 'These rules may be updated from time to time. Users will be notified of material changes. Continued use of the Platform constitutes acceptance of the updated rules.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
