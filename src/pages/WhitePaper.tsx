import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  Building2, 
  Shield, 
  Coins, 
  Users, 
  Globe, 
  TrendingUp,
  Lock,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Scale,
  Wallet,
  BarChart3,
  Target,
  Layers
} from 'lucide-react';

export default function WhitePaper() {
  const { language, isRTL } = useLanguage();
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة', icon: BookOpen },
    { id: 'platform', labelEn: 'Platform', labelAr: 'المنصة', icon: Building2 },
    { id: 'tokenization', labelEn: 'Tokenization', labelAr: 'الترميز', icon: Coins },
    { id: 'investment', labelEn: 'Investment', labelAr: 'الاستثمار', icon: TrendingUp },
    { id: 'legal', labelEn: 'Legal & SPV', labelAr: 'القانوني', icon: Scale },
    { id: 'security', labelEn: 'Security', labelAr: 'الأمان', icon: Shield },
    { id: 'roadmap', labelEn: 'Roadmap', labelAr: 'خارطة الطريق', icon: Target },
  ];

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4">
            {language === 'ar' ? 'الوثيقة الرسمية' : 'Official Document'}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'الورقة البيضاء' : 'White Paper'}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
            {language === 'ar' 
              ? 'الدليل الشامل لمنصة Capimax BRX للترميز العقاري - الرؤية، التقنية، والهيكل القانوني'
              : 'The comprehensive guide to Capimax BRX Real Estate Tokenization Platform - Vision, Technology, and Legal Framework'}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="gap-2">
              <Download className="h-5 w-5" />
              {language === 'ar' ? 'تحميل PDF (العربية)' : 'Download PDF (English)'}
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <FileText className="h-5 w-5" />
              {language === 'ar' ? 'تحميل PDF (English)' : 'Download PDF (العربية)'}
            </Button>
          </div>
        </div>

        {/* Version Info */}
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">{language === 'ar' ? 'الإصدار:' : 'Version:'}</span>
                <span className="font-medium ml-2">2.0</span>
              </div>
              <div>
                <span className="text-muted-foreground">{language === 'ar' ? 'تاريخ النشر:' : 'Published:'}</span>
                <span className="font-medium ml-2">{language === 'ar' ? 'يناير 2026' : 'January 2026'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{language === 'ar' ? 'الحالة:' : 'Status:'}</span>
                <Badge variant="default" className="ml-2">{language === 'ar' ? 'نشط' : 'Active'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-8">
          <TabsList className="flex flex-wrap justify-center gap-2 h-auto bg-transparent">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {language === 'ar' ? section.labelAr : section.labelEn}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Overview Section */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '1. الملخص التنفيذي' : '1. Executive Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {language === 'ar'
                    ? 'Capimax BRX هي منصة تقنية رائدة تُمكّن المستثمرين من امتلاك حصص في العقارات عالية الجودة من خلال الترميز الرقمي (Tokenization). نقدم حلاً مبتكراً يجمع بين الشفافية، الأمان، وسهولة الوصول للاستثمار العقاري.'
                    : 'Capimax BRX is a pioneering technology platform that enables investors to own shares in high-quality real estate through digital tokenization. We provide an innovative solution that combines transparency, security, and accessibility for real estate investment.'}
                </p>
                
                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <div className="text-3xl font-bold text-primary mb-2">$1,000</div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'الحد الأدنى للاستثمار' : 'Minimum Investment'}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <div className="text-3xl font-bold text-primary mb-2">8-12%</div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'العائد السنوي المتوقع' : 'Expected Annual Yield'}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <div className="text-3xl font-bold text-primary mb-2">100%</div>
                    <div className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'شفافية البلوكتشين' : 'Blockchain Transparency'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '2. الرؤية والرسالة' : '2. Vision & Mission'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'رؤيتنا' : 'Our Vision'}</h4>
                    <p className="text-muted-foreground">
                      {language === 'ar'
                        ? 'أن نكون المنصة الرائدة عالمياً في ترميز الأصول العقارية، مما يجعل الاستثمار العقاري متاحاً للجميع بغض النظر عن حجم رأس المال.'
                        : 'To be the globally leading platform in real estate asset tokenization, making property investment accessible to everyone regardless of capital size.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{language === 'ar' ? 'رسالتنا' : 'Our Mission'}</h4>
                    <p className="text-muted-foreground">
                      {language === 'ar'
                        ? 'توفير منصة آمنة وشفافة تربط بين المستثمرين والفرص العقارية عالية الجودة من خلال تقنية البلوكتشين والترميز الرقمي.'
                        : 'Provide a secure and transparent platform connecting investors with high-quality real estate opportunities through blockchain technology and digital tokenization.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '3. المستثمرون المستهدفون' : '3. Target Investors'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold">{language === 'ar' ? 'المستثمرون الأفراد' : 'Individual Investors'}</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'الباحثون عن تنويع المحفظة' : 'Portfolio diversification seekers'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'المستثمرون بدخل ثابت' : 'Passive income investors'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'المستثمرون الجدد في العقارات' : 'First-time real estate investors'}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold">{language === 'ar' ? 'المستثمرون المؤسسيون' : 'Institutional Investors'}</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'المكاتب العائلية' : 'Family offices'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'صناديق الاستثمار' : 'Investment funds'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'شركات إدارة الثروات' : 'Wealth management firms'}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Platform Section */}
          <TabsContent value="platform" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '4. نظرة عامة على المنصة' : '4. Platform Overview'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {language === 'ar'
                    ? 'Capimax BRX هي منصة تقنية متكاملة تعمل كوسيط بين المستثمرين وفرص الاستثمار العقاري. المنصة لا تعمل كوسيط مالي أو مستشار استثماري، بل توفر البنية التحتية التقنية اللازمة.'
                    : 'Capimax BRX is an integrated technology platform that acts as an intermediary between investors and real estate investment opportunities. The platform does not operate as a financial broker or investment advisor, but provides the necessary technical infrastructure.'}
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-lg border space-y-2">
                    <Globe className="h-8 w-8 text-primary" />
                    <h4 className="font-semibold">{language === 'ar' ? 'وصول عالمي' : 'Global Access'}</h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'متاح للمستثمرين من أكثر من 150 دولة' : 'Available to investors from 150+ countries'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border space-y-2">
                    <Lock className="h-8 w-8 text-primary" />
                    <h4 className="font-semibold">{language === 'ar' ? 'أمان متقدم' : 'Advanced Security'}</h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'تشفير من الدرجة البنكية وتحقق متعدد المستويات' : 'Bank-grade encryption and multi-layer verification'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border space-y-2">
                    <BarChart3 className="h-8 w-8 text-primary" />
                    <h4 className="font-semibold">{language === 'ar' ? 'تقارير شاملة' : 'Comprehensive Reports'}</h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'تقارير أداء وتحليلات في الوقت الفعلي' : 'Real-time performance reports and analytics'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border space-y-2">
                    <Wallet className="h-8 w-8 text-primary" />
                    <h4 className="font-semibold">{language === 'ar' ? 'محفظة رقمية' : 'Digital Wallet'}</h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' ? 'محفظة بلوكتشين تلقائية بعد التحقق' : 'Automatic blockchain wallet after verification'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '5. مكونات المنصة' : '5. Platform Components'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      titleEn: 'Marketplace',
                      titleAr: 'السوق',
                      descEn: 'Browse and invest in verified real estate opportunities',
                      descAr: 'تصفح واستثمر في الفرص العقارية الموثقة'
                    },
                    {
                      titleEn: 'Portfolio Dashboard',
                      titleAr: 'لوحة المحفظة',
                      descEn: 'Track investments, distributions, and performance',
                      descAr: 'تتبع الاستثمارات والتوزيعات والأداء'
                    },
                    {
                      titleEn: 'Secondary Market',
                      titleAr: 'السوق الثانوي',
                      descEn: 'Trade tokens with other investors',
                      descAr: 'تداول التوكنات مع مستثمرين آخرين'
                    },
                    {
                      titleEn: 'Blockchain Wallet',
                      titleAr: 'محفظة البلوكتشين',
                      descEn: 'Secure storage for your tokenized assets',
                      descAr: 'تخزين آمن لأصولك المرمزة'
                    },
                    {
                      titleEn: 'Data Room',
                      titleAr: 'غرفة البيانات',
                      descEn: 'Access all property documents and reports',
                      descAr: 'الوصول لجميع مستندات وتقارير العقارات'
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold">{language === 'ar' ? item.titleAr : item.titleEn}</h4>
                        <p className="text-sm text-muted-foreground">{language === 'ar' ? item.descAr : item.descEn}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tokenization Section */}
          <TabsContent value="tokenization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '6. نموذج الترميز' : '6. Tokenization Model'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {language === 'ar'
                    ? 'يتم ترميز كل عقار من خلال شركة ذات غرض خاص (SPV) تملك العقار قانونياً. يتم تقسيم ملكية الـ SPV إلى توكنات رقمية على البلوكتشين.'
                    : 'Each property is tokenized through a Special Purpose Vehicle (SPV) that legally owns the property. The SPV ownership is divided into digital tokens on the blockchain.'}
                </p>
                
                <div className="p-6 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <h4 className="font-semibold mb-4 text-center">
                    {language === 'ar' ? 'عملية الترميز' : 'Tokenization Process'}
                  </h4>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {[
                      { stepEn: 'Property Acquisition', stepAr: 'شراء العقار' },
                      { stepEn: 'SPV Creation', stepAr: 'إنشاء SPV' },
                      { stepEn: 'Legal Structuring', stepAr: 'الهيكلة القانونية' },
                      { stepEn: 'Token Issuance', stepAr: 'إصدار التوكنات' },
                      { stepEn: 'Investor Allocation', stepAr: 'توزيع للمستثمرين' }
                    ].map((step, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="text-center">
                          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-2">
                            {index + 1}
                          </div>
                          <span className="text-xs">{language === 'ar' ? step.stepAr : step.stepEn}</span>
                        </div>
                        {index < 4 && <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '7. تقنية البلوكتشين' : '7. Blockchain Technology'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold">{language === 'ar' ? 'مزايا البلوكتشين' : 'Blockchain Benefits'}</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'شفافية كاملة وقابلة للتحقق' : 'Full transparency and verifiability'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'سجلات غير قابلة للتعديل' : 'Immutable records'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'تحويلات فورية وآمنة' : 'Instant and secure transfers'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span>{language === 'ar' ? 'عقود ذكية آلية' : 'Automated smart contracts'}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold">{language === 'ar' ? 'المواصفات التقنية' : 'Technical Specifications'}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">{language === 'ar' ? 'الشبكة' : 'Network'}</span>
                        <span className="font-medium">Polygon (MATIC)</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">{language === 'ar' ? 'المعيار' : 'Standard'}</span>
                        <span className="font-medium">ERC-1400</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">{language === 'ar' ? 'نوع العقد' : 'Contract Type'}</span>
                        <span className="font-medium">Security Token</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Investment Section */}
          <TabsContent value="investment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '8. عملية الاستثمار' : '8. Investment Process'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      stepEn: '1. Registration & KYC',
                      stepAr: '1. التسجيل والتحقق',
                      descEn: 'Create account and complete identity verification (KYC/AML)',
                      descAr: 'إنشاء حساب وإكمال التحقق من الهوية (KYC/AML)'
                    },
                    {
                      stepEn: '2. Wallet Creation',
                      stepAr: '2. إنشاء المحفظة',
                      descEn: 'Automatic blockchain wallet created after KYC approval',
                      descAr: 'إنشاء محفظة بلوكتشين تلقائياً بعد موافقة KYC'
                    },
                    {
                      stepEn: '3. Browse Opportunities',
                      stepAr: '3. تصفح الفرص',
                      descEn: 'Explore available properties in the marketplace',
                      descAr: 'استكشاف العقارات المتاحة في السوق'
                    },
                    {
                      stepEn: '4. Due Diligence',
                      stepAr: '4. العناية الواجبة',
                      descEn: 'Review property documents, financials, and reports',
                      descAr: 'مراجعة مستندات العقار والبيانات المالية والتقارير'
                    },
                    {
                      stepEn: '5. Investment',
                      stepAr: '5. الاستثمار',
                      descEn: 'Select amount and complete payment',
                      descAr: 'اختيار المبلغ وإتمام الدفع'
                    },
                    {
                      stepEn: '6. Token Receipt',
                      stepAr: '6. استلام التوكنات',
                      descEn: 'Receive tokens in your blockchain wallet',
                      descAr: 'استلام التوكنات في محفظتك الرقمية'
                    },
                    {
                      stepEn: '7. Distributions',
                      stepAr: '7. التوزيعات',
                      descEn: 'Receive quarterly rental income distributions',
                      descAr: 'استلام توزيعات الدخل الإيجاري ربع السنوية'
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold">{language === 'ar' ? item.stepAr : item.stepEn}</h4>
                        <p className="text-sm text-muted-foreground">{language === 'ar' ? item.descAr : item.descEn}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '9. طرق الدفع' : '9. Payment Methods'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-2xl mb-2">💳</div>
                    <h4 className="font-semibold">{language === 'ar' ? 'بطاقات الائتمان' : 'Credit Cards'}</h4>
                    <p className="text-xs text-muted-foreground mt-1">Visa, Mastercard, AMEX</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-2xl mb-2">🏦</div>
                    <h4 className="font-semibold">{language === 'ar' ? 'تحويل بنكي' : 'Bank Transfer'}</h4>
                    <p className="text-xs text-muted-foreground mt-1">SWIFT, SEPA</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <div className="text-2xl mb-2">₿</div>
                    <h4 className="font-semibold">{language === 'ar' ? 'عملات رقمية' : 'Cryptocurrency'}</h4>
                    <p className="text-xs text-muted-foreground mt-1">BTC, ETH, USDT, USDC</p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <h4 className="font-semibold text-amber-600 mb-2 flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    {language === 'ar' ? 'خصم برونوفا 5%' : 'Pronova 5% Discount'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar'
                      ? 'ادفع باستخدام برونوفا (PRN) واحصل على خصم 5% - ربحك الأول على المنصة! (1 PRN = 1 USD ثابت)'
                      : 'Pay with Pronova (PRN) and get 5% discount - your first profit on the platform! (1 PRN = 1 USD fixed)'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legal Section */}
          <TabsContent value="legal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Scale className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '10. الهيكل القانوني' : '10. Legal Structure'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {language === 'ar'
                    ? 'Capimax BRX LLC هي شركة مسجلة في ولاية وايومنغ، الولايات المتحدة الأمريكية. تعمل كمزود تقنية وبنية تحتية فقط.'
                    : 'Capimax BRX LLC is a company registered in the State of Wyoming, United States of America. It operates as a technology and infrastructure provider only.'}
                </p>
                
                <div className="grid md:grid-cols-2 gap-6 mt-6">
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-semibold mb-3">{language === 'ar' ? 'هيكل SPV' : 'SPV Structure'}</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• {language === 'ar' ? 'كل عقار مملوك من قبل SPV مستقل' : 'Each property owned by independent SPV'}</li>
                      <li>• {language === 'ar' ? 'SPV هي المالك القانوني للأصل' : 'SPV is the legal owner of the asset'}</li>
                      <li>• {language === 'ar' ? 'المستثمرون يملكون حصصاً في الـ SPV' : 'Investors own shares in the SPV'}</li>
                      <li>• {language === 'ar' ? 'حماية قانونية للمستثمرين' : 'Legal protection for investors'}</li>
                    </ul>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-semibold mb-3">{language === 'ar' ? 'الإعفاءات التنظيمية' : 'Regulatory Exemptions'}</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• <strong>Regulation S:</strong> {language === 'ar' ? 'للمستثمرين غير الأمريكيين' : 'For non-U.S. investors'}</li>
                      <li>• <strong>Regulation D:</strong> {language === 'ar' ? 'للمستثمرين الأمريكيين المعتمدين' : 'For accredited U.S. investors'}</li>
                      <li>• {language === 'ar' ? 'لا تعني موافقة SEC' : 'Does not imply SEC approval'}</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '11. شهادات الملكية' : '11. Ownership Certificates'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  {language === 'ar'
                    ? 'يحصل كل مستثمر على شهادة ملكية رقمية تتضمن:'
                    : 'Each investor receives a digital ownership certificate that includes:'}
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { en: 'SPV Company Name', ar: 'اسم شركة SPV' },
                    { en: 'Platform Company Name', ar: 'اسم شركة المنصة' },
                    { en: 'Investor Name', ar: 'اسم المستثمر' },
                    { en: 'Number of Owned Shares', ar: 'عدد الأسهم المملوكة' },
                    { en: 'Certificate Number', ar: 'رقم الشهادة' },
                    { en: 'Issue Date', ar: 'تاريخ الإصدار' },
                    { en: 'Verification QR Code', ar: 'رمز QR للتحقق' },
                    { en: 'Blockchain Reference', ar: 'مرجع البلوكتشين' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{language === 'ar' ? item.ar : item.en}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Section */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '12. الأمان والامتثال' : '12. Security & Compliance'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold">{language === 'ar' ? 'أمان المنصة' : 'Platform Security'}</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Lock className="h-4 w-4 text-primary mt-0.5" />
                        <span>{language === 'ar' ? 'تشفير AES-256 للبيانات' : 'AES-256 data encryption'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock className="h-4 w-4 text-primary mt-0.5" />
                        <span>{language === 'ar' ? 'مصادقة ثنائية (2FA)' : 'Two-factor authentication (2FA)'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock className="h-4 w-4 text-primary mt-0.5" />
                        <span>{language === 'ar' ? 'فحوصات أمنية دورية' : 'Regular security audits'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lock className="h-4 w-4 text-primary mt-0.5" />
                        <span>{language === 'ar' ? 'مراكز بيانات آمنة' : 'Secure data centers'}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold">{language === 'ar' ? 'الامتثال' : 'Compliance'}</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>{language === 'ar' ? 'KYC/AML إلزامي' : 'Mandatory KYC/AML'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>{language === 'ar' ? 'فحص العقوبات' : 'Sanctions screening'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>{language === 'ar' ? 'حماية بيانات GDPR' : 'GDPR data protection'}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>{language === 'ar' ? 'تقارير تنظيمية' : 'Regulatory reporting'}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '13. حماية المستثمر' : '13. Investor Protection'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      titleEn: 'Segregated SPV Structure',
                      titleAr: 'هيكل SPV المنفصل',
                      descEn: 'Each property in its own legal entity, protecting investors from cross-asset risk',
                      descAr: 'كل عقار في كيان قانوني خاص به، مما يحمي المستثمرين من المخاطر المتقاطعة'
                    },
                    {
                      titleEn: 'Third-Party Audits',
                      titleAr: 'تدقيقات الطرف الثالث',
                      descEn: 'Regular audits by licensed accounting and valuation firms',
                      descAr: 'تدقيقات منتظمة من قبل شركات المحاسبة والتقييم المرخصة'
                    },
                    {
                      titleEn: 'Insurance Coverage',
                      titleAr: 'التغطية التأمينية',
                      descEn: 'Properties are insured through leading insurance providers',
                      descAr: 'العقارات مؤمنة من خلال مزودي التأمين الرائدين'
                    },
                    {
                      titleEn: 'Transparent Reporting',
                      titleAr: 'التقارير الشفافة',
                      descEn: 'Quarterly performance reports and real-time portfolio access',
                      descAr: 'تقارير أداء ربع سنوية ووصول فوري للمحفظة'
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-semibold">{language === 'ar' ? item.titleAr : item.titleEn}</h4>
                        <p className="text-sm text-muted-foreground">{language === 'ar' ? item.descAr : item.descEn}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roadmap Section */}
          <TabsContent value="roadmap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  {language === 'ar' ? '14. خارطة الطريق' : '14. Roadmap'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    {
                      phase: 'Q1 2026',
                      titleEn: 'Platform Launch',
                      titleAr: 'إطلاق المنصة',
                      itemsEn: ['Core platform functionality', 'First property listings', 'KYC integration'],
                      itemsAr: ['الوظائف الأساسية للمنصة', 'أول إدراجات العقارات', 'دمج KYC'],
                      status: 'completed'
                    },
                    {
                      phase: 'Q2 2026',
                      titleEn: 'Secondary Market',
                      titleAr: 'السوق الثانوي',
                      itemsEn: ['P2P token trading', 'Liquidity provider integration', 'Mobile app beta'],
                      itemsAr: ['تداول التوكنات P2P', 'دمج مزود السيولة', 'تطبيق الجوال التجريبي'],
                      status: 'in-progress'
                    },
                    {
                      phase: 'Q3 2026',
                      titleEn: 'Global Expansion',
                      titleAr: 'التوسع العالمي',
                      itemsEn: ['European properties', 'Multi-currency support', 'Institutional partnerships'],
                      itemsAr: ['العقارات الأوروبية', 'دعم العملات المتعددة', 'الشراكات المؤسسية'],
                      status: 'upcoming'
                    },
                    {
                      phase: 'Q4 2026',
                      titleEn: 'Advanced Features',
                      titleAr: 'الميزات المتقدمة',
                      itemsEn: ['AI-powered analytics', 'Automated distributions', 'Enhanced mobile app'],
                      itemsAr: ['تحليلات بالذكاء الاصطناعي', 'توزيعات آلية', 'تطبيق جوال محسن'],
                      status: 'upcoming'
                    }
                  ].map((item, index) => (
                    <div key={index} className={`p-6 rounded-lg border ${item.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : item.status === 'in-progress' ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <Badge variant={item.status === 'completed' ? 'default' : item.status === 'in-progress' ? 'secondary' : 'outline'}>
                          {item.phase}
                        </Badge>
                        {item.status === 'completed' && <Badge variant="default" className="bg-green-500">{language === 'ar' ? 'مكتمل' : 'Completed'}</Badge>}
                        {item.status === 'in-progress' && <Badge variant="secondary">{language === 'ar' ? 'جاري' : 'In Progress'}</Badge>}
                      </div>
                      <h4 className="font-semibold text-lg mb-2">{language === 'ar' ? item.titleAr : item.titleEn}</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {(language === 'ar' ? item.itemsAr : item.itemsEn).map((subItem, subIndex) => (
                          <li key={subIndex} className="flex items-center gap-2">
                            <CheckCircle className={`h-3 w-3 ${item.status === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`} />
                            {subItem}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-8 text-center">
                <h3 className="text-2xl font-bold mb-4">
                  {language === 'ar' ? 'ابدأ رحلتك الاستثمارية اليوم' : 'Start Your Investment Journey Today'}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  {language === 'ar'
                    ? 'انضم إلى آلاف المستثمرين الذين يثقون في Capimax BRX للاستثمار العقاري المرمز.'
                    : 'Join thousands of investors who trust Capimax BRX for tokenized real estate investment.'}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button size="lg">
                    {language === 'ar' ? 'استكشف الفرص' : 'Explore Opportunities'}
                  </Button>
                  <Button size="lg" variant="outline">
                    {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
