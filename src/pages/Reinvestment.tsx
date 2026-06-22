import { useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Percent,
  TrendingUp,
  ArrowRight,
  Coins,
  ShoppingCart,
  Gift,
  Shield,
  CheckCircle,
  Info,
  Wallet,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/layout/MainLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useReinvestments } from "@/hooks/useReinvestments";
import { cn } from "@/lib/utils";

export default function Reinvestment() {
  const { language, isRTL } = useLanguage();
  const { reinvestments, isLoading, availableBalance, totalReinvested, pendingReinvestments } =
    useReinvestments();

  // REAL available returns = the investor's internal balance (accrued distribution / sale
  // yield in UserBalance). Replaces the old mock $5000. Reinvesting spends this at the SAME
  // price/fees as a normal buy — the 5%/2%/Pronova bonuses are DEFERRED (a product decision;
  // no backend/Pronova exists). REINVESTMENTS_SURFACE.md.
  const availableReturns = availableBalance;

  // The reinvestment buy is funded from balance at checkout (payment_method="balance").
  const compoundBenefits = [
    {
      icon: Wallet,
      title: language === "ar" ? "ادفع من رصيدك" : "Pay from Your Balance",
      description: language === "ar"
        ? "أعد استثمار عوائدك المتراكمة مباشرةً دون دفع جديد بالبطاقة"
        : "Reinvest your accrued returns directly — no new card charge",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: TrendingUp,
      title: language === "ar" ? "نمو مضاعف" : "Compound Growth",
      description: language === "ar"
        ? "ضاعف عوائدك من خلال إعادة الاستثمار المستمر"
        : "Multiply your returns through continuous reinvestment",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-gradient-gold rounded-2xl flex items-center justify-center shadow-gold">
              <RefreshCw className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {language === "ar" ? "إعادة الاستثمار" : "Reinvestment"}
              </h1>
              <p className="text-muted-foreground">
                {language === "ar" 
                  ? "ضاعف أرباحك مع مكافآت وخصومات حصرية"
                  : "Multiply your earnings with exclusive bonuses and discounts"}
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Gift className="w-4 h-4" />
              {language === "ar" ? "نظرة عامة" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="bonuses" className="gap-2">
              <Percent className="w-4 h-4" />
              {language === "ar" ? "المكافآت" : "Bonuses"}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              {language === "ar" ? "السجل" : "History"}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Feature Overview Card */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-success/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  {language === "ar" ? "لماذا إعادة الاستثمار؟" : "Why Reinvest?"}
                </CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? "أعد استثمار عوائدك المتراكمة في عقارات جديدة مباشرةً من رصيدك — دون دفع جديد بالبطاقة"
                    : "Reinvest your accrued returns into new properties straight from your balance — no new card charge"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {compoundBenefits.map((benefit, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 rounded-xl border border-border/50 transition-all hover:shadow-md",
                        benefit.bgColor
                      )}
                    >
                      <benefit.icon className={cn("w-8 h-8 mb-3", benefit.color)} />
                      <h4 className="font-semibold text-foreground mb-1">{benefit.title}</h4>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Available Returns Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    {language === "ar" ? "العوائد المتاحة" : "Available Returns"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">
                        {language === "ar" ? "الرصيد المتاح لإعادة الاستثمار" : "Balance Available to Reinvest"}
                      </span>
                      <span className="text-2xl font-bold text-gradient-gold">
                        ${availableReturns.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar"
                        ? "عوائدك المتراكمة من التوزيعات والمبيعات."
                        : "Your accrued distribution & sale proceeds."}
                    </p>
                  </div>

                  {/* Bonuses (5% / Pronova / reduced fees) are a future product decision —
                      flagged clearly rather than shown as if active. */}
                  <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-lg">
                    <span className="text-sm text-muted-foreground">
                      {language === "ar" ? "مكافآت إعادة الاستثمار" : "Reinvestment bonuses"}
                    </span>
                    <Badge variant="secondary">{language === "ar" ? "قريباً" : "Coming soon"}</Badge>
                  </div>

                  <Link to="/marketplace?reinvest=true">
                    <Button variant="hero" className="w-full gap-2 mt-2" disabled={availableReturns <= 0}>
                      <ShoppingCart className="w-4 h-4" />
                      {language === "ar" ? "أعد الاستثمار من رصيدك" : "Reinvest from Balance"}
                      <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
                    </Button>
                  </Link>
                  <p className="text-xs text-muted-foreground text-center">
                    {language === "ar"
                      ? "اختر عقارًا ثم اختر «الدفع من الرصيد» عند الدفع."
                      : "Pick a property, then choose “Pay from Balance” at checkout."}
                  </p>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-success" />
                    {language === "ar" ? "إحصائيات إعادة الاستثمار" : "Reinvestment Stats"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-xl text-center">
                      <div className="text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "إجمالي إعادة الاستثمار" : "Total Reinvested"}
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        ${totalReinvested.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-xl text-center">
                      <div className="text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "الرصيد المتاح" : "Available Balance"}
                      </div>
                      <div className="text-xl font-bold text-success">
                        ${availableReturns.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-xl text-center">
                      <div className="text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "عمليات إعادة الاستثمار" : "Reinvestments Count"}
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {reinvestments?.length || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-xl text-center">
                      <div className="text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "معلقة" : "Pending"}
                      </div>
                      <div className="text-xl font-bold text-amber-500">
                        {pendingReinvestments.length}
                      </div>
                    </div>
                  </div>

                  {pendingReinvestments.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-sm text-amber-600">
                        {language === "ar"
                          ? `لديك ${pendingReinvestments.length} عملية إعادة استثمار معلقة`
                          : `You have ${pendingReinvestments.length} pending reinvestment(s)`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bonuses Tab — DEFERRED. The 5% / 2% Pronova / reduced-fee mechanics are an
              undefined product decision (no backend, no Pronova integration). We flag this
              honestly instead of advertising bonuses that don't apply. */}
          <TabsContent value="bonuses" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-muted-foreground" />
                  {language === "ar" ? "مكافآت إعادة الاستثمار" : "Reinvestment Bonuses"}
                  <Badge variant="secondary">{language === "ar" ? "قريباً" : "Coming soon"}</Badge>
                </CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? "إعادة الاستثمار اليوم تتم بنفس السعر والرسوم كأي شراء عادي."
                    : "Reinvesting today happens at the same price and fees as any normal purchase."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/40 border border-border rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="font-semibold text-foreground">
                      {language === "ar" ? "المتاح الآن" : "Available now"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? "أعد استثمار رصيدك (عوائد التوزيعات والمبيعات) مباشرةً في رموز جديدة — دون دفع جديد بالبطاقة، وبإصدار فوري للرموز."
                      : "Reinvest your balance (distribution & sale proceeds) straight into new tokens — no new card charge, with instant token minting."}
                  </p>
                </div>
                <div className="p-4 bg-muted/40 border border-border rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-5 h-5 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {language === "ar" ? "قيد التخطيط" : "Planned"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? "خصومات/مكافآت إعادة الاستثمار وتكامل توكن برونوفا — قيد التحديد، وستُعلن لاحقاً."
                      : "Reinvestment discounts/bonuses and Pronova-token integration — to be defined and announced later."}
                  </p>
                </div>
                <Link to="/marketplace?reinvest=true">
                  <Button variant="hero" className="w-full gap-2 mt-2" disabled={availableReturns <= 0}>
                    <ShoppingCart className="w-4 h-4" />
                    {language === "ar" ? "أعد الاستثمار من رصيدك" : "Reinvest from Balance"}
                    <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  {language === "ar" ? "سجل إعادة الاستثمار" : "Reinvestment History"}
                </CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? "جميع عمليات إعادة الاستثمار السابقة"
                    : "All your past reinvestment transactions"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground mt-2">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </p>
                  </div>
                ) : reinvestments && reinvestments.length > 0 ? (
                  <div className="space-y-3">
                    {reinvestments.map((reinvestment) => (
                      <div
                        key={reinvestment.id}
                        className="p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-foreground">
                            {reinvestment.property_name}
                          </span>
                          <Badge
                            variant={
                              reinvestment.status === "completed"
                                ? "success"
                                : reinvestment.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {reinvestment.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              {language === "ar" ? "المبلغ" : "Amount"}
                            </span>
                            <p className="font-medium">${reinvestment.source_amount.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {language === "ar" ? "المكافأة" : "Bonus"}
                            </span>
                            <p className="font-medium text-success">
                              +${reinvestment.discount_amount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {language === "ar" ? "الإجمالي" : "Total"}
                            </span>
                            <p className="font-medium">${reinvestment.net_investment_value.toLocaleString()}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(reinvestment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="font-semibold text-foreground mb-2">
                      {language === "ar" ? "لا توجد عمليات إعادة استثمار" : "No Reinvestments Yet"}
                    </h4>
                    <p className="text-muted-foreground mb-4">
                      {language === "ar"
                        ? "ابدأ إعادة استثمار عوائدك للحصول على مكافآت إضافية"
                        : "Start reinvesting your returns to get additional bonuses"}
                    </p>
                    <Link to="/marketplace?reinvest=true">
                      <Button variant="default" className="gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        {language === "ar" ? "استثمر الآن" : "Invest Now"}
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
