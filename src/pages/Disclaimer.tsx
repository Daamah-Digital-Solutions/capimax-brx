import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, Building2, TrendingDown, Globe, Shield, Ban } from 'lucide-react';

export default function Disclaimer() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      icon: Building2,
      titleEn: '1. Platform Role',
      titleAr: '1. دور المنصة',
      contentEn: `Capimax BRX ("Platform") is a technology-only platform that provides digital infrastructure, tools, and interfaces.

The Platform:
• Does not act as an investment manager, broker, advisor, or custodian
• Does not provide financial, legal, or tax advice
• Does not guarantee returns or performance
• Provides technical tools only to facilitate interactions between users and third-party asset owners, developers, financing providers, and data providers

All investment opportunities, financial data, projections, and returns are provided by third-party SPVs, asset owners, developers, or service providers.`,
      contentAr: `Capimax BRX ("المنصة") هي منصة تقنية فقط توفر البنية التحتية الرقمية والأدوات والواجهات.

المنصة:
• لا تعمل كمدير استثمار أو وسيط أو مستشار أو أمين حفظ
• لا تقدم نصائح مالية أو قانونية أو ضريبية
• لا تضمن العوائد أو الأداء
• توفر أدوات تقنية فقط لتسهيل التفاعلات بين المستخدمين وأصحاب الأصول والمطورين ومزودي التمويل ومزودي البيانات من الأطراف الثالثة

جميع فرص الاستثمار والبيانات المالية والتوقعات والعوائد مقدمة من الأطراف الثالثة (SPVs وأصحاب الأصول والمطورين أو مزودي الخدمات).`
    },
    {
      icon: AlertTriangle,
      titleEn: '2. No Guarantees',
      titleAr: '2. عدم وجود ضمانات',
      contentEn: `The Platform makes no representations or warranties regarding:

• Profitability of any investment
• Returns or yields
• Asset performance
• Investment outcomes
• Accuracy of third-party information
• Future market conditions

PAST PERFORMANCE IS NOT INDICATIVE OF FUTURE RESULTS.

All investments involve risk, including the potential loss of principal. You should only invest amounts you can afford to lose.`,
      contentAr: `لا تقدم المنصة أي تمثيلات أو ضمانات بشأن:

• ربحية أي استثمار
• العوائد أو الأرباح
• أداء الأصول
• نتائج الاستثمار
• دقة معلومات الأطراف الثالثة
• ظروف السوق المستقبلية

الأداء السابق لا يشير إلى النتائج المستقبلية.

جميع الاستثمارات تنطوي على مخاطر، بما في ذلك الخسارة المحتملة لرأس المال. يجب أن تستثمر فقط المبالغ التي يمكنك تحمل خسارتها.`
    },
    {
      icon: TrendingDown,
      titleEn: '3. Investment Risks',
      titleAr: '3. مخاطر الاستثمار',
      contentEn: `Investments may involve significant risks including but not limited to:

• Loss of Capital: You may lose part or all of your invested capital
• Liquidity Risk: Investments may be illiquid and difficult to exit
• Market Risk: Property values may decline
• Operational Risk: SPV or asset management failures
• Regulatory Risk: Changes in laws may impact investments
• Currency Risk: Exchange rate fluctuations
• Construction Risk: Delays or cost overruns for under-construction properties
• Counterparty Risk: Third-party defaults or failures

You are solely responsible for evaluating the risks of any investment.`,
      contentAr: `قد تنطوي الاستثمارات على مخاطر كبيرة بما في ذلك على سبيل المثال لا الحصر:

• خسارة رأس المال: قد تفقد جزءًا أو كل رأس المال المستثمر
• مخاطر السيولة: قد تكون الاستثمارات غير سائلة ويصعب الخروج منها
• مخاطر السوق: قد تنخفض قيم العقارات
• المخاطر التشغيلية: فشل SPV أو إدارة الأصول
• المخاطر التنظيمية: التغييرات في القوانين قد تؤثر على الاستثمارات
• مخاطر العملة: تقلبات أسعار الصرف
• مخاطر البناء: التأخيرات أو تجاوزات التكاليف للعقارات قيد الإنشاء
• مخاطر الطرف المقابل: تخلف أو فشل الأطراف الثالثة

أنت وحدك المسؤول عن تقييم مخاطر أي استثمار.`
    },
    {
      icon: Shield,
      titleEn: '4. Limitation of Liability',
      titleAr: '4. تحديد المسؤولية',
      contentEn: `To the maximum extent permitted by law, the Platform shall not be liable for:

• Financial losses from investments
• Investment decisions made by users
• Third-party actions or omissions
• Data inaccuracies provided by third parties
• SPV performance or failures
• Market conditions or economic factors
• Technical failures or interruptions
• Unauthorized access to user accounts
• Force majeure events

IN NO EVENT SHALL THE PLATFORM'S LIABILITY EXCEED THE FEES PAID BY THE USER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.`,
      contentAr: `إلى أقصى حد يسمح به القانون، لن تكون المنصة مسؤولة عن:

• الخسائر المالية من الاستثمارات
• قرارات الاستثمار التي يتخذها المستخدمون
• أفعال أو إغفالات الأطراف الثالثة
• عدم دقة البيانات المقدمة من الأطراف الثالثة
• أداء أو فشل SPV
• ظروف السوق أو العوامل الاقتصادية
• الأعطال أو الانقطاعات التقنية
• الوصول غير المصرح به لحسابات المستخدمين
• أحداث القوة القاهرة

لن تتجاوز مسؤولية المنصة في أي حال من الأحوال الرسوم التي دفعها المستخدم في الاثني عشر (12) شهرًا السابقة للمطالبة.`
    },
    {
      icon: Globe,
      titleEn: '5. External Links',
      titleAr: '5. الروابط الخارجية',
      contentEn: `The Platform may contain links to third-party websites, including:

• Partner websites
• News sources
• Regulatory bodies
• Educational resources

The Platform is not responsible for:
• The content of external websites
• Privacy practices of third parties
• Accuracy of information on external sites
• Any damages resulting from use of external links

Inclusion of any link does not imply endorsement by the Platform.`,
      contentAr: `قد تحتوي المنصة على روابط لمواقع الأطراف الثالثة، بما في ذلك:

• مواقع الشركاء
• مصادر الأخبار
• الهيئات التنظيمية
• الموارد التعليمية

المنصة غير مسؤولة عن:
• محتوى المواقع الخارجية
• ممارسات الخصوصية للأطراف الثالثة
• دقة المعلومات على المواقع الخارجية
• أي أضرار ناتجة عن استخدام الروابط الخارجية

لا يعني إدراج أي رابط موافقة المنصة.`
    },
    {
      icon: Ban,
      titleEn: '6. Force Majeure',
      titleAr: '6. القوة القاهرة',
      contentEn: `The Platform shall not be liable for delays or failures caused by events beyond its reasonable control, including but not limited to:

• Natural disasters
• Wars or armed conflicts
• Terrorist attacks
• Pandemics or epidemics
• Government actions or regulations
• Power outages
• Internet or telecommunications failures
• Cyberattacks
• Labor disputes

During force majeure events, the Platform's obligations may be suspended until the event is resolved.`,
      contentAr: `لن تكون المنصة مسؤولة عن التأخيرات أو الإخفاقات الناجمة عن أحداث خارجة عن سيطرتها المعقولة، بما في ذلك على سبيل المثال لا الحصر:

• الكوارث الطبيعية
• الحروب أو النزاعات المسلحة
• الهجمات الإرهابية
• الأوبئة أو الجوائح
• الإجراءات أو اللوائح الحكومية
• انقطاع التيار الكهربائي
• أعطال الإنترنت أو الاتصالات
• الهجمات الإلكترونية
• النزاعات العمالية

خلال أحداث القوة القاهرة، قد يتم تعليق التزامات المنصة حتى يتم حل الحدث.`
    }
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'إخلاء المسؤولية' : 'Disclaimer'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'آخر تحديث: يناير 2026' : 'Last Updated: January 2026'}
          </p>
          <Button variant="outline" className="mt-4">
            <Download className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
          </Button>
        </div>

        {/* Important Notice */}
        <Card className="mb-8 border-destructive/50 bg-destructive/5">
          <CardContent className="py-6">
            <p className="text-center font-medium">
              {language === 'ar'
                ? 'هام: يرجى قراءة إخلاء المسؤولية هذا بعناية قبل استخدام المنصة. استخدامك للمنصة يشكل موافقتك على هذا الإخلاء.'
                : 'IMPORTANT: Please read this Disclaimer carefully before using the Platform. Your use of the Platform constitutes your acceptance of this Disclaimer.'}
            </p>
          </CardContent>
        </Card>

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

          {/* Final Statement */}
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <p className="font-medium mb-4">
                {language === 'ar'
                  ? 'البيان الختامي'
                  : 'Final Statement'}
              </p>
              <p className="text-muted-foreground">
                {language === 'ar'
                  ? 'هذه المنصة هي مزود تقنية وبنية تحتية فقط. لا تقدم نصائح استثمارية أو خدمات مالية. جميع العوائد والبيانات المالية والتوقعات والمعلومات المتعلقة بالاستثمار مقدمة من أصحاب العقارات أو المطورين أو مزودي البيانات من الأطراف الثالثة. المنصة لا تتحمل أي مسؤولية عن نتائج الاستثمار.'
                  : 'This platform is a technology and infrastructure provider only. It does not provide investment advice or financial services. All returns, financial data, projections, and investment-related information are provided by property owners, developers, or third-party data providers. The platform bears no responsibility for investment outcomes.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
