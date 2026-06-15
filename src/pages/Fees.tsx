import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Percent,
  Info,
  CheckCircle2,
  Building2,
  Users,
  Wallet,
  HelpCircle,
  ExternalLink,
  Coins,
  CreditCard,
  Construction,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Fees() {
  const { t, isRTL } = useLanguage();

  const standardPlatformFees = [
    {
      name: t("fees.tokenizationFee"),
      nameEn: "Tokenization Fee",
      rate: "2%",
      description: t("fees.tokenizationFeeDesc"),
      category: "platform",
    },
    {
      name: t("fees.listingFee"),
      nameEn: "Listing Fee",
      rate: "2%",
      description: t("fees.listingFeeDesc"),
      category: "platform",
    },
    {
      name: t("fees.purchaseFee"),
      nameEn: "Purchase Fee",
      rate: "2%",
      description: t("fees.purchaseFeeDesc"),
      category: "investor",
    },
    {
      name: t("fees.annualManagement"),
      nameEn: "Annual Management Fee",
      rate: "1%",
      description: t("fees.annualManagementDesc"),
      category: "investor",
    },
    {
      name: t("fees.exitFee"),
      nameEn: "Exit Fee",
      rate: "0.5%",
      description: t("fees.exitFeeDesc"),
      category: "investor",
    },
  ];

  const installmentFees = [
    {
      name: t("fees.downPaymentFee"),
      nameEn: "Down Payment Fee",
      rate: "4%",
      icon: CreditCard,
    },
    {
      name: t("fees.installmentFee"),
      nameEn: "Each Installment Fee",
      rate: "2%",
      icon: DollarSign,
    },
    {
      name: t("fees.profitMarginFee"),
      nameEn: "Profit Margin Fee",
      rate: "10%",
      icon: Percent,
    },
  ];

  const paymentMethods = [
    { name: isRTL ? "بطاقات الائتمان" : "Credit Cards", nameEn: "Credit Cards", fee: "2.5%" },
    { name: isRTL ? "التحويل البنكي" : "Bank Transfer", nameEn: "Bank Transfer", fee: "0%" },
    { name: "Apple Pay", nameEn: "Apple Pay", fee: "1.5%" },
    { name: "Google Pay", nameEn: "Google Pay", fee: "1.5%" },
    { name: isRTL ? "العملات الرقمية" : "Cryptocurrency", nameEn: "Cryptocurrency", fee: "1%" },
    { name: "Pronova Token", nameEn: "Pronova Token", fee: isRTL ? "-5% خصم" : "-5% Discount" },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="gold" className="mb-4">
            {isRTL ? "هيكل الرسوم" : "Fee Structure"} / Fee Structure
          </Badge>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {isRTL ? "الرسوم والتكاليف" : "Fees & Costs"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isRTL 
              ? "نؤمن بالشفافية الكاملة، هنا جميع الرسوم المتعلقة بالاستثمار والإدراج"
              : "We believe in full transparency. Here are all fees related to investment and listing."
            }
          </p>
        </div>

        {/* Standard Platform Fees */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{isRTL ? "رسوم المنصة القياسية" : "Standard Platform Fees"}</CardTitle>
                <p className="text-sm text-muted-foreground">Standard Platform Fees</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {standardPlatformFees.map((fee, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{fee.name}</h4>
                    <p className="text-xs text-muted-foreground mb-1">{fee.nameEn}</p>
                    <p className="text-sm text-muted-foreground">{fee.description}</p>
                  </div>
                  <Badge
                    variant={fee.rate === "0%" ? "success" : "outline"}
                    className="text-lg font-bold shrink-0 ml-4"
                  >
                    {fee.rate}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Installment Property Fees */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Construction className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle>{t("fees.installmentPropertyFees")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("fees.installmentPropertyFeesDesc")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              {installmentFees.map((fee, index) => (
                <div
                  key={index}
                  className="text-center p-6 bg-background/50 rounded-xl border border-amber-500/20"
                >
                  <fee.icon className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-foreground mb-2">{fee.rate}</div>
                  <p className="text-sm text-muted-foreground">{fee.name}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <Info className="w-4 h-4" />
                <span>
                  {isRTL 
                    ? "يتم خصم هذه الرسوم تلقائياً للعقارات قيد الإنشاء"
                    : "These fees are automatically deducted for under-construction properties"
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{isRTL ? "طرق الدفع والرسوم" : "Payment Methods & Fees"}</CardTitle>
                <p className="text-sm text-muted-foreground">Payment Methods & Fees</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentMethods.map((method, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    method.fee.includes("-")
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-muted/30"
                  }`}
                >
                  <div>
                    <h4 className="font-medium text-foreground">{method.name}</h4>
                    <p className="text-xs text-muted-foreground">{method.nameEn}</p>
                  </div>
                  <Badge
                    variant={
                      method.fee === "0%"
                        ? "success"
                        : method.fee.includes("-")
                          ? "gold"
                          : "outline"
                    }
                  >
                    {method.fee}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pronova Discount */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
                <Coins className="w-10 h-10 text-primary-foreground" />
              </div>
              <div className="flex-1 text-center md:text-start">
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  {isRTL 
                    ? "ادفع ببرونوفا واحصل على خصم 5%"
                    : "Pay with Pronova & Get 5% Discount"
                  }
                </h3>
                <p className="text-muted-foreground mb-2">
                  {isRTL 
                    ? "ربحك الأول على المنصة - يغطي رسوم سنة كاملة من التكاليف"
                    : "Your first profit on the platform - covers one full year of costs"
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  1 PRN = 1 USD ({isRTL ? "قيمة ثابتة" : "Fixed Value"})
                </p>
              </div>
              <Button asChild size="lg" className="bg-gradient-gold hover:opacity-90 shadow-gold shrink-0">
                <a href="https://www.pronovacrypto.com" target="_blank" rel="noopener noreferrer">
                  {isRTL ? "تعرف على المزيد" : "Learn More"}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fee Calculation Example */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{isRTL ? "مثال على حساب الرسوم" : "Fee Calculation Example"}</CardTitle>
                <p className="text-sm text-muted-foreground">Fee Calculation Example</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
                <span className="text-foreground">{isRTL ? "مبلغ الاستثمار" : "Investment Amount"}</span>
                <span className="font-bold text-foreground">$10,000</span>
              </div>

              <div className="space-y-3 mb-4 pb-4 border-b border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{isRTL ? "رسوم الشراء (2%)" : "Purchase Fee (2%)"}</span>
                  <span className="text-foreground">$200</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{isRTL ? "رسوم التحويل البنكي" : "Bank Transfer Fee"}</span>
                  <span className="text-foreground">$0</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{isRTL ? "الإجمالي" : "Total"}</span>
                <span className="text-xl font-bold text-primary">$10,200</span>
              </div>

              <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-500 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isRTL 
                      ? <>باستخدام Pronova Token، ستوفر $10 وتدفع فقط <strong>$10,190</strong></>
                      : <>With Pronova Token, save $10 and pay only <strong>$10,190</strong></>
                    }
                  </span>
                </div>
              </div>
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
                      ? "جميع الرسوم المذكورة بالدولار الأمريكي (USD)"
                      : "All fees are displayed in US Dollars (USD)"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "جميع الرسوم المذكورة لا تشمل ضريبة القيمة المضافة حيث تُطبق"
                      : "All fees exclude VAT where applicable"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "قد تختلف الرسوم حسب حجم الاستثمار وفئة المستثمر"
                      : "Fees may vary based on investment size and investor category"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "للمستثمرين المؤسسيين أسعار خاصة - تواصل معنا للمزيد"
                      : "Institutional investors have special rates - contact us for more"
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {isRTL 
                      ? "يتم خصم رسوم الإدارة السنوية من التوزيعات قبل صرفها"
                      : "Annual management fees are deducted from distributions before payout"
                    }
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center py-8">
          <h3 className="text-xl font-bold text-foreground mb-4">
            {isRTL ? "هل لديك أسئلة حول الرسوم؟" : "Have questions about fees?"}
          </h3>
          <div className="flex justify-center gap-4">
            <Link to="/support">
              <Button variant="outline" size="lg">
                <HelpCircle className="w-4 h-4 mr-2" />
                {isRTL ? "تواصل مع الدعم" : "Contact Support"}
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button size="lg" className="bg-gradient-gold hover:opacity-90">
                {isRTL ? "كيف تعمل المنصة" : "How Platform Works"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}