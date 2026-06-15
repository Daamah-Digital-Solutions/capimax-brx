import { MainLayout } from "@/components/layout/MainLayout";
import { NovaFinancePledgeNotice } from "@/components/legal/NovaFinancePledgeNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  TrendingUp,
  Clock,
  Shield,
  CheckCircle2,
  Info,
  Coins,
  Users,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ExitMechanism() {
  const { isRTL } = useLanguage();

  const lpAdvantages = [
    {
      icon: Zap,
      title: isRTL ? "السرعة" : "Speed",
      description: isRTL 
        ? "تنفيذ فوري دون انتظار مشتري"
        : "Immediate execution without waiting for a buyer",
    },
    {
      icon: Shield,
      title: isRTL ? "سيولة مضمونة" : "Guaranteed Liquidity",
      description: isRTL 
        ? "لا خطر من بقاء الأصول غير مباعة"
        : "No risk of unsold assets",
    },
    {
      icon: CheckCircle2,
      title: isRTL ? "البساطة" : "Simplicity",
      description: isRTL 
        ? "معاملة بنقرة واحدة مباشرة عبر المنصة"
        : "One-click transaction directly through the platform",
    },
  ];

  const secondaryAdvantages = [
    {
      icon: TrendingUp,
      title: isRTL ? "عوائد أعلى محتملة" : "Potential for Higher Returns",
      description: isRTL 
        ? "يمكن تحديد السعر وفقاً لقيمة السوق"
        : "Price can be set according to market value",
    },
    {
      icon: Clock,
      title: isRTL ? "توقيت مرن" : "Flexible Timing",
      description: isRTL 
        ? "يمكنك اختيار وقت الإدراج أو تعديل السعر"
        : "You can choose when to list or adjust the price",
    },
    {
      icon: Users,
      title: isRTL ? "مدفوع بالسوق" : "Market-Driven",
      description: isRTL 
        ? "يشرك مستثمرين آخرين، مما يعكس الطلب الحقيقي"
        : "Engages other investors, reflecting true demand",
    },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="gold" className="mb-4">
            {isRTL ? "آلية التخارج" : "Exit Mechanism"} / Exit Mechanism
          </Badge>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {isRTL ? "آلية التخارج" : "Exit Mechanism"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isRTL 
              ? "توفر منصتنا خيارين مرنين للتخارج لحاملي الأصول، مما يتيح لك بيع استثماراتك بكفاءة مع اختيار الطريقة التي تناسب احتياجاتك"
              : "Our platform provides two flexible exit options for asset holders, allowing you to sell your investments efficiently while choosing the method that best suits your needs."
            }
          </p>
        </div>

        {/* Nova Finance pledge disclosure — exit blocked until clearance */}
        <div className="max-w-3xl mx-auto w-full">
          <NovaFinancePledgeNotice />
        </div>

        {/* Option A: LP Sale */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="gold" className="text-xs">A</Badge>
                  <CardTitle className="text-xl">
                    {isRTL ? "البيع الفوري عبر مزود السيولة (LP)" : "Immediate Sale via Liquidity Provider (LP)"}
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Immediate Sale via Liquidity Provider
                </p>
              </div>
              <Badge variant="outline" className="text-lg font-bold px-4 py-2 border-primary/30">
                1% {isRTL ? "رسوم" : "Fee"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              {isRTL 
                ? "قم ببيع أصولك فوراً من خلال مزودي السيولة لدينا. يتم تنفيذ المعاملات على الفور بسعر محدد مسبقاً، مما يضمن الوصول السريع إلى الأموال."
                : "Sell your assets instantly through our liquidity providers. Transactions are executed immediately at a pre-determined price, ensuring fast access to funds."
              }
            </p>

            {/* Advantages Grid */}
            <div className="grid sm:grid-cols-3 gap-4">
              {lpAdvantages.map((advantage, index) => (
                <div
                  key={index}
                  className="p-4 bg-background/50 rounded-xl border border-primary/10"
                >
                  <advantage.icon className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold text-foreground mb-1">{advantage.title}</h4>
                  <p className="text-sm text-muted-foreground">{advantage.description}</p>
                </div>
              ))}
            </div>

            {/* Availability Notice - ACTIVE */}
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">
                      {isRTL ? "الحالة: نشط" : "Status: Active"}
                    </h4>
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
                      {isRTL ? "متاح الآن" : "Live Now"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "مزودو السيولة المعتمدون متاحون حالياً للشراء الفوري لأصولك. التنفيذ مضمون عند الإدراج."
                      : "Approved Liquidity Providers are currently available for instant purchase of your assets. Execution is guaranteed upon listing."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button asChild size="lg" variant="outline" className="border-primary/30">
                <Link to="/liquidity-provider">
                  {isRTL ? "تعرف على مزودي السيولة" : "Learn About LPs"}
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-gradient-gold hover:opacity-90 shadow-gold">
                <Link to="/lp-market">
                  {isRTL ? "بيع على سوق LP الآن" : "Sell on LP Market Now"}
                  <ArrowRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Option B: Secondary Market */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-xs bg-emerald-500 hover:bg-emerald-600">B</Badge>
                  <CardTitle className="text-xl">
                    {isRTL ? "البيع عبر السوق الثانوي" : "Sale via Secondary Market"}
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sale via Secondary Market
                </p>
              </div>
              <Badge variant="outline" className="text-lg font-bold px-4 py-2 border-emerald-500/30 text-emerald-600">
                0.5% {isRTL ? "رسوم" : "Fee"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              {isRTL 
                ? "أدرج أصولك للبيع في السوق الثانوي، حيث يمكن لمستخدمي المنصة الآخرين شراؤها. يتم البيع بالسعر الذي تختاره أو بناءً على طلب السوق."
                : "List your assets for sale on the Secondary Market, where other platform users can purchase them. The sale occurs at your chosen price or based on market demand."
              }
            </p>

            {/* Advantages Grid */}
            <div className="grid sm:grid-cols-3 gap-4">
              {secondaryAdvantages.map((advantage, index) => (
                <div
                  key={index}
                  className="p-4 bg-background/50 rounded-xl border border-emerald-500/10"
                >
                  <advantage.icon className="w-8 h-8 text-emerald-500 mb-3" />
                  <h4 className="font-semibold text-foreground mb-1">{advantage.title}</h4>
                  <p className="text-sm text-muted-foreground">{advantage.description}</p>
                </div>
              ))}
            </div>

            {/* Availability Notice */}
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {isRTL ? "ملاحظة التوفر" : "Availability Note"}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {isRTL 
                      ? "البيع عبر السوق الثانوي يخضع لوجود مشتري. إذا لم يتوفر مشترون، سيبقى الخيار غير نشط حتى يتم المطابقة."
                      : "Sale via Secondary Market is subject to the presence of a buyer. If no buyers are available, the option will remain inactive until matched."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex justify-end">
              <Button asChild size="lg" variant="outline" className="border-emerald-500/30 hover:bg-emerald-500/10">
                <Link to="/secondary-market">
                  {isRTL ? "استكشف السوق الثانوي" : "Explore Secondary Market"}
                  <ArrowRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comparison Table */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{isRTL ? "مقارنة سريعة" : "Quick Comparison"}</CardTitle>
                <p className="text-sm text-muted-foreground">Quick Comparison</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-start py-3 px-4 font-semibold text-foreground">
                      {isRTL ? "المعيار" : "Criteria"}
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-primary">
                      {isRTL ? "مزود السيولة (LP)" : "LP Sale"}
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-emerald-500">
                      {isRTL ? "السوق الثانوي" : "Secondary Market"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-3 px-4 text-muted-foreground">
                      {isRTL ? "الرسوم" : "Fee"}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-foreground">1%</td>
                    <td className="py-3 px-4 text-center font-semibold text-emerald-500">0.5%</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-3 px-4 text-muted-foreground">
                      {isRTL ? "سرعة التنفيذ" : "Execution Speed"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                        {isRTL ? "فوري" : "Instant"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline">
                        {isRTL ? "يعتمد على السوق" : "Market-dependent"}
                      </Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-3 px-4 text-muted-foreground">
                      {isRTL ? "التحكم بالسعر" : "Price Control"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline">
                        {isRTL ? "سعر محدد مسبقاً" : "Pre-set price"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge className="bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30">
                        {isRTL ? "تحكم كامل" : "Full control"}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-muted-foreground">
                      {isRTL ? "السيولة المضمونة" : "Guaranteed Liquidity"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <CheckCircle2 className="w-5 h-5 text-primary mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-muted-foreground">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Important Notes */}
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-2">
                  {isRTL ? "ملاحظات هامة" : "Important Notes"}
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "يتم تطبيق الرسوم عند اكتمال عملية البيع فقط"
                      : "Fees are applied only when the sale is completed"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "يمكنك تبديل خيار البيع قبل تأكيد المعاملة"
                      : "You can switch sale options before confirming the transaction"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "جميع المعاملات مسجلة ومتاحة في سجل المعاملات الخاص بك"
                      : "All transactions are recorded and available in your transaction history"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "للاستفسارات حول آلية التخارج، يرجى التواصل مع فريق الدعم"
                      : "For inquiries about exit mechanisms, please contact our support team"
                    }
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center py-8">
          <h3 className="text-xl font-bold text-foreground mb-4">
            {isRTL ? "هل لديك أسئلة حول آلية التخارج؟" : "Have questions about exit mechanisms?"}
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/fees">
              <Button variant="outline" size="lg">
                <Coins className="w-4 h-4 mr-2" />
                {isRTL ? "عرض جميع الرسوم" : "View All Fees"}
              </Button>
            </Link>
            <Link to="/support">
              <Button size="lg" className="bg-gradient-gold hover:opacity-90">
                {isRTL ? "تواصل مع الدعم" : "Contact Support"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
