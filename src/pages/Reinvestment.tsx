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
  const { reinvestments, isLoading, totalReinvested, totalBonus, pendingReinvestments } = useReinvestments();
  
  // Mock available returns - in production this would come from user's account
  const availableReturns = 5000;
  
  // Discount calculations
  const standardDiscount = 5; // 5% standard reinvestment bonus
  const pronovaBonus = 2; // 2% Pronova bonus
  const standardFee = 1; // 1% standard purchase fee
  const pronovaFee = 0; // 0% fee with Pronova
  
  const potentialBonus = (availableReturns * standardDiscount) / 100;
  const potentialPronovaBonus = (availableReturns * pronovaBonus) / 100;
  const totalPotentialValue = availableReturns + potentialBonus + potentialPronovaBonus;

  const benefits = [
    {
      icon: Percent,
      title: language === "ar" ? "خصم 5% فوري" : "5% Instant Discount",
      description: language === "ar" 
        ? "احصل على خصم 5% على قيمة كل سهم عند إعادة الاستثمار"
        : "Get 5% off the value of each share when reinvesting",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      icon: Coins,
      title: language === "ar" ? "مكافأة برونوفا 2%" : "2% Pronova Bonus",
      description: language === "ar"
        ? "مكافأة إضافية 2% عند الدفع بتوكن برونوفا"
        : "Additional 2% bonus when paying with Pronova token",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Shield,
      title: language === "ar" ? "رسوم مخفضة" : "Reduced Fees",
      description: language === "ar"
        ? "رسوم 1% فقط مع الشراء العادي، 0% مع برونوفا"
        : "Only 1% fee with standard purchase, 0% with Pronova",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
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
                    ? "إعادة استثمار عوائدك تتيح لك الاستفادة من مكافآت وخصومات حصرية غير متاحة للمشتريات العادية"
                    : "Reinvesting your returns allows you to benefit from exclusive bonuses and discounts not available for regular purchases"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {benefits.map((benefit, index) => (
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {language === "ar" ? "العوائد المتاحة للاستثمار" : "Returns Available for Reinvestment"}
                      </span>
                      <span className="text-2xl font-bold text-gradient-gold">
                        ${availableReturns.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>

                  {/* Calculation Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                      <span className="text-sm">
                        {language === "ar" ? "مكافأة إعادة الاستثمار" : "Reinvestment Bonus"} (5%)
                      </span>
                      <span className="font-semibold text-success">+${potentialBonus.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                      <span className="text-sm">
                        {language === "ar" ? "مكافأة برونوفا" : "Pronova Bonus"} (2%)
                      </span>
                      <span className="font-semibold text-primary">+${potentialPronovaBonus.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/20 to-success/20 rounded-xl border border-primary/30">
                      <span className="font-medium">
                        {language === "ar" ? "إجمالي قيمة الاستثمار" : "Total Investment Value"}
                      </span>
                      <span className="text-xl font-bold text-gradient-gold">
                        ${totalPotentialValue.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Link to="/marketplace?reinvest=true">
                    <Button variant="hero" className="w-full gap-2 mt-4">
                      <ShoppingCart className="w-4 h-4" />
                      {language === "ar" ? "اذهب إلى السوق للاستثمار" : "Go to Marketplace to Invest"}
                      <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
                    </Button>
                  </Link>
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
                        {language === "ar" ? "إجمالي المكافآت" : "Total Bonus Earned"}
                      </div>
                      <div className="text-xl font-bold text-success">
                        ${totalBonus.toLocaleString()}
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

          {/* Bonuses Tab */}
          <TabsContent value="bonuses" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Discount Structure */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-success" />
                    {language === "ar" ? "هيكل الخصومات" : "Discount Structure"}
                  </CardTitle>
                  <CardDescription>
                    {language === "ar"
                      ? "الخصومات والمكافآت المطبقة تلقائياً"
                      : "Discounts and bonuses applied automatically"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-success/30 bg-success/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">
                        {language === "ar" ? "خصم إعادة الاستثمار" : "Reinvestment Discount"}
                      </span>
                      <Badge variant="success" className="text-lg px-3 py-1">5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar"
                        ? "يُطبق تلقائياً على جميع عمليات إعادة الاستثمار"
                        : "Automatically applied to all reinvestment transactions"}
                    </p>
                  </div>

                  <div className="p-4 border border-primary/30 bg-primary/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">
                        {language === "ar" ? "مكافأة برونوفا" : "Pronova Bonus"}
                      </span>
                      <Badge variant="default" className="text-lg px-3 py-1">+2%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar"
                        ? "مكافأة إضافية عند الدفع بتوكن برونوفا"
                        : "Additional bonus when paying with Pronova token"}
                    </p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-success/10 to-primary/10 border border-success/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {language === "ar" ? "إجمالي المكافأة المحتملة" : "Total Potential Bonus"}
                      </span>
                      <Badge variant="gold" className="text-lg px-4 py-1">7%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fee Structure */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-500" />
                    {language === "ar" ? "هيكل الرسوم" : "Fee Structure"}
                  </CardTitle>
                  <CardDescription>
                    {language === "ar"
                      ? "رسوم المعاملات حسب طريقة الدفع"
                      : "Transaction fees based on payment method"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-border rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          {language === "ar" ? "الشراء العادي" : "Standard Purchase"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3 py-1">{standardFee}%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar"
                        ? "رسوم المعاملات للمشتريات ببطاقة الائتمان أو التحويل البنكي"
                        : "Transaction fee for credit card or bank transfer purchases"}
                    </p>
                  </div>

                  <div className="p-4 border border-primary/30 bg-primary/5 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-foreground">
                          {language === "ar" ? "الدفع ببرونوفا" : "Pronova Payment"}
                        </span>
                      </div>
                      <Badge variant="success" className="text-lg px-3 py-1">{pronovaFee}%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar"
                        ? "بدون رسوم عند الدفع بتوكن برونوفا"
                        : "Zero fees when paying with Pronova token"}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-success">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {language === "ar" ? "موصى به" : "Recommended"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-success/10">
              <CardContent className="py-8">
                <div className="text-center space-y-4">
                  <h3 className="text-2xl font-bold text-foreground">
                    {language === "ar" 
                      ? "ابدأ إعادة الاستثمار الآن واحصل على مكافآتك"
                      : "Start Reinvesting Now and Get Your Bonuses"}
                  </h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    {language === "ar"
                      ? "استفد من خصم 5% + 2% مكافأة برونوفا على جميع عمليات إعادة الاستثمار"
                      : "Take advantage of 5% discount + 2% Pronova bonus on all reinvestments"}
                  </p>
                  <Link to="/marketplace?reinvest=true">
                    <Button variant="hero" size="lg" className="gap-2 mt-4">
                      <ShoppingCart className="w-5 h-5" />
                      {language === "ar" ? "تصفح فرص الاستثمار" : "Browse Investment Opportunities"}
                      <ArrowRight className={cn("w-5 h-5", isRTL && "rotate-180")} />
                    </Button>
                  </Link>
                </div>
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
