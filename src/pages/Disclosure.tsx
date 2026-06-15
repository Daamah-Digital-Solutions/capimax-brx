import { MainLayout } from '@/components/layout/MainLayout';
import { NovaFinancePledgeNotice } from '@/components/legal/NovaFinancePledgeNotice';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertTriangle, TrendingUp, Building2, Scale, Globe } from 'lucide-react';

export default function Disclosure() {
  const { language, isRTL } = useLanguage();

  const sections = [
    {
      icon: FileText,
      titleEn: '1. General Disclosure',
      titleAr: '1. إفصاح عام',
      contentEn: `All information presented on the Capimax BRX Platform is provided for informational purposes only.

The Platform serves as a technology interface between investors and third-party asset owners, SPVs, developers, and service providers. Information displayed includes:

• Property details and valuations
• Projected returns and yields
• Investment terms and conditions
• Historical performance data
• Market analysis and reports

This information is sourced from third parties and is presented "as is" without independent verification by the Platform unless explicitly stated.`,
      contentAr: `جميع المعلومات المقدمة على منصة Capimax BRX مقدمة لأغراض إعلامية فقط.

تعمل المنصة كواجهة تقنية بين المستثمرين وأصحاب الأصول من الأطراف الثالثة والـ SPVs والمطورين ومزودي الخدمات. تشمل المعلومات المعروضة:

• تفاصيل العقارات والتقييمات
• العوائد والأرباح المتوقعة
• شروط وأحكام الاستثمار
• بيانات الأداء التاريخية
• تحليلات السوق والتقارير

هذه المعلومات مصدرها أطراف ثالثة ويتم تقديمها "كما هي" دون التحقق المستقل من المنصة ما لم يُذكر صراحة.`
    },
    {
      icon: AlertTriangle,
      titleEn: '2. No Investment Advice',
      titleAr: '2. لا تعتبر نصيحة استثمارية',
      contentEn: `IMPORTANT: Nothing on the Platform constitutes:

• Investment advice
• Financial advice
• Legal advice
• Tax advice
• Recommendation to buy or sell

The Platform does not:
• Recommend specific investments
• Provide personalized investment guidance
• Assess suitability for individual investors
• Make investment decisions on behalf of users

Users must seek advice from qualified professionals (financial advisors, lawyers, accountants) before making any investment decisions.

All investment decisions are made solely by the user at their own risk.`,
      contentAr: `هام: لا شيء على المنصة يشكل:

• نصيحة استثمارية
• نصيحة مالية
• نصيحة قانونية
• نصيحة ضريبية
• توصية بالشراء أو البيع

المنصة لا تقوم بـ:
• التوصية باستثمارات محددة
• تقديم إرشادات استثمارية مخصصة
• تقييم الملاءمة للمستثمرين الأفراد
• اتخاذ قرارات الاستثمار نيابة عن المستخدمين

يجب على المستخدمين طلب المشورة من المتخصصين المؤهلين (المستشارين الماليين والمحامين والمحاسبين) قبل اتخاذ أي قرارات استثمارية.

جميع قرارات الاستثمار يتخذها المستخدم وحده على مسؤوليته الخاصة.`
    },
    {
      icon: Building2,
      titleEn: '3. Third-Party Information',
      titleAr: '3. معلومات الطرف الثالث',
      contentEn: `Asset data, valuations, forecasts, and returns are supplied by third parties including:

• Property developers
• Asset owners
• Valuation companies
• Property management firms
• Market data providers

The Platform does not warrant the accuracy, completeness, or reliability of such information.

Users should:
• Conduct their own due diligence
• Verify information independently
• Not rely solely on Platform-displayed data
• Consider consulting professional advisors

Any errors, omissions, or inaccuracies in third-party data are the responsibility of the data provider.`,
      contentAr: `بيانات الأصول والتقييمات والتوقعات والعوائد مقدمة من أطراف ثالثة تشمل:

• مطوري العقارات
• أصحاب الأصول
• شركات التقييم
• شركات إدارة العقارات
• مزودي بيانات السوق

لا تضمن المنصة دقة أو اكتمال أو موثوقية هذه المعلومات.

يجب على المستخدمين:
• إجراء العناية الواجبة الخاصة بهم
• التحقق من المعلومات بشكل مستقل
• عدم الاعتماد فقط على البيانات المعروضة على المنصة
• التفكير في استشارة مستشارين محترفين

أي أخطاء أو إغفالات أو عدم دقة في بيانات الطرف الثالث هي مسؤولية مزود البيانات.`
    },
    {
      icon: TrendingUp,
      titleEn: '4. Risk Disclosure',
      titleAr: '4. الإفصاح عن المخاطر',
      contentEn: `Investments may involve significant risks including but not limited to:

CAPITAL RISK
• You may lose part or all of your invested capital
• Returns are not guaranteed

LIQUIDITY RISK
• Investments may be illiquid
• Exit may be restricted or delayed
• Secondary market availability is not guaranteed

MARKET RISK
• Property values may decline
• Economic conditions may change
• Interest rates may fluctuate

OPERATIONAL RISK
• SPV management failures
• Property management issues
• Technical platform failures

REGULATORY RISK
• Changes in laws or regulations
• Tax law changes
• Cross-border restrictions

PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS.`,
      contentAr: `قد تنطوي الاستثمارات على مخاطر كبيرة تشمل على سبيل المثال لا الحصر:

مخاطر رأس المال
• قد تفقد جزءًا أو كل رأس المال المستثمر
• العوائد غير مضمونة

مخاطر السيولة
• قد تكون الاستثمارات غير سائلة
• قد يكون الخروج مقيدًا أو متأخرًا
• توافر السوق الثانوية غير مضمون

مخاطر السوق
• قد تنخفض قيم العقارات
• قد تتغير الظروف الاقتصادية
• قد تتقلب أسعار الفائدة

المخاطر التشغيلية
• فشل إدارة SPV
• مشاكل إدارة العقارات
• أعطال المنصة التقنية

المخاطر التنظيمية
• التغييرات في القوانين أو اللوائح
• تغييرات قانون الضرائب
• القيود عبر الحدود

الأداء السابق لا يضمن النتائج المستقبلية.`
    },
    {
      icon: Scale,
      titleEn: '5. Regulatory Disclosure',
      titleAr: '5. الإفصاح التنظيمي',
      contentEn: `SECURITIES EXEMPTIONS

Investment opportunities on the Platform may rely on exemptions from registration under U.S. securities laws:

• Regulation S: For non-U.S. persons
• Regulation D: For accredited U.S. investors

These exemptions:
• Do NOT imply SEC approval
• Require compliance with specific conditions
• Are the responsibility of the issuing SPV

The SEC has NOT reviewed, approved, or endorsed any offering on this Platform.

GEOGRAPHIC RESTRICTIONS
• Certain jurisdictions may be restricted
• Users must comply with local laws
• The Platform may block access from prohibited regions`,
      contentAr: `إعفاءات الأوراق المالية

قد تعتمد فرص الاستثمار على المنصة على إعفاءات من التسجيل بموجب قوانين الأوراق المالية الأمريكية:

• اللائحة S: للأشخاص غير الأمريكيين
• اللائحة D: للمستثمرين الأمريكيين المعتمدين

هذه الإعفاءات:
• لا تعني موافقة SEC
• تتطلب الامتثال لشروط محددة
• هي مسؤولية SPV المُصدر

لم تقم SEC بمراجعة أو الموافقة على أو تأييد أي عرض على هذه المنصة.

القيود الجغرافية
• قد تكون بعض المناطق مقيدة
• يجب على المستخدمين الامتثال للقوانين المحلية
• قد تحظر المنصة الوصول من المناطق المحظورة`
    },
    {
      icon: Globe,
      titleEn: '6. Pronova & Nova Disclosure',
      titleAr: '6. إفصاح برونوفا ونوفا',
      contentEn: `PRONOVA CURRENCY
Pronova (PRN) is treated as a fixed-value payment unit on the Platform:
• 1 PRN = 1 USD (fixed rate)
• Not a tradable or speculative asset
• Used for payment purposes only
• 5% discount applies to Pronova payments

NOVA SUKUK FINANCING
Nova financing is provided by Nova Digital Finance (third party):
• Subject to approval
• Shariah-compliant structure
• Restrictions on exit and selling apply
• Yield distribution may be suspended on default
• Governed by separate financing agreement

The Platform does not guarantee approval or terms of Nova financing.`,
      contentAr: `عملة برونوفا
يُعامل برونوفا (PRN) كوحدة دفع ثابتة القيمة على المنصة:
• 1 PRN = 1 USD (سعر ثابت)
• ليس أصلًا قابلًا للتداول أو المضاربة
• يستخدم لأغراض الدفع فقط
• ينطبق خصم 5% على مدفوعات برونوفا

تمويل صكوك نوفا
يتم توفير تمويل نوفا من قبل Nova Digital Finance (طرف ثالث):
• يخضع للموافقة
• هيكل متوافق مع الشريعة
• تنطبق قيود على الخروج والبيع
• قد يتم تعليق توزيع العائد عند التخلف عن السداد
• يخضع لاتفاقية تمويل منفصلة

لا تضمن المنصة الموافقة أو شروط تمويل نوفا.`
    }
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'الإفصاحات' : 'Disclosure'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'آخر تحديث: يناير 2026' : 'Last Updated: January 2026'}
          </p>
          <Button variant="outline" className="mt-4">
            <Download className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تحميل PDF' : 'Download PDF'}
          </Button>
        </div>

        {/* Nova Finance pledge disclosure */}
        <div className="max-w-4xl mx-auto mb-6">
          <NovaFinancePledgeNotice />
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

          {/* User Acknowledgment */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-6 text-center">
              <h3 className="text-lg font-semibold mb-4">
                {language === 'ar' ? 'إقرار المستخدم' : 'User Acknowledgment'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'ar'
                  ? 'باستخدام هذه المنصة، أقر بأنني قرأت وفهمت هذه الإفصاحات، وأنني أتخذ قرارات الاستثمار الخاصة بي بناءً على حكمي الخاص ونصيحة مستشاري المحترفين، وليس بناءً على أي معلومات أو توصية من المنصة.'
                  : 'By using this Platform, I acknowledge that I have read and understood these disclosures, and that I am making my own investment decisions based on my own judgment and advice from my professional advisors, not based on any information or recommendation from the Platform.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
