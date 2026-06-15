import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Crown, Gem, Rocket, Check, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

export default function InstitutionalPackages() {
  const { isRTL } = useLanguage();
  const isAr = isRTL;

  const tiers = [
    {
      name: isAr ? "مؤسسي" : "Institutional",
      icon: Building2,
      range: "$500K – $2M",
      tone: "border-border",
      perks: [
        isAr ? "إدارة محفظة مخصصة" : "Dedicated portfolio manager",
        isAr ? "تقارير ربع سنوية مخصصة" : "Custom quarterly reports",
        isAr ? "أولوية في الاكتتاب" : "Priority allocation",
        isAr ? "خصم 25% على رسوم المنصة" : "25% platform fee discount",
      ],
    },
    {
      name: isAr ? "مؤسسي بلس" : "Institutional Plus",
      icon: Gem,
      range: "$2M – $10M",
      tone: "border-primary/40 bg-primary/5",
      featured: true,
      perks: [
        isAr ? "كل مزايا المؤسسي" : "Everything in Institutional",
        isAr ? "وصول مباشر لفريق الاستثمار" : "Direct deal-team access",
        isAr ? "صفقات خاصة قبل الإطلاق" : "Pre-launch deal flow",
        isAr ? "خصم 50% على رسوم المنصة" : "50% platform fee discount",
        isAr ? "تكامل API مخصص" : "Custom API integration",
      ],
    },
    {
      name: isAr ? "سيادي" : "Sovereign",
      icon: Crown,
      range: "$10M+",
      tone: "border-accent/40 bg-accent/5",
      perks: [
        isAr ? "كل مزايا بلس" : "Everything in Plus",
        isAr ? "هيكلة SPV مخصصة" : "Bespoke SPV structuring",
        isAr ? "صناديق مغلقة حصرية" : "Exclusive closed funds",
        isAr ? "إعفاء كامل من رسوم المنصة" : "Zero platform fees",
        isAr ? "مدير علاقات تنفيذي" : "Executive relationship lead",
      ],
    },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-10" dir={isAr ? "rtl" : "ltr"}>
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge variant="outline" className="gap-1">
            <Rocket className="h-3 w-3" />
            {isAr ? "للمستثمرين المؤسسيين" : "For Institutional Investors"}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            {isAr ? "باقات الاستثمار المؤسسية" : "Institutional Investment Packages"}
          </h1>
          <p className="text-muted-foreground md:text-lg">
            {isAr
              ? "خصومات على الرسوم، وصول حصري للصفقات، وهيكلة SPV مخصصة لرؤوس الأموال الكبرى"
              : "Tiered fee discounts, exclusive deal flow, and bespoke SPV structuring for institutional capital"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <Card key={t.name} className={`${t.tone} relative transition-transform hover:-translate-y-1`}>
              {t.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {isAr ? "الأكثر طلباً" : "Most Popular"}
                </Badge>
              )}
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-background border">
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t.name}</CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">{t.range}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full" variant={t.featured ? "default" : "outline"}>
                  <Link to="/support">
                    {isAr ? "تحدث مع فريقنا" : "Talk to our team"}
                    <ArrowRight className={`h-4 w-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "كيفية الانضمام" : "How to onboard"}</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4 text-sm">
            {[
              isAr ? "اتصل بنا لمناقشة احتياجاتك" : "Contact us to scope your mandate",
              isAr ? "KYB كامل وفحص الأموال" : "Full KYB and source-of-funds review",
              isAr ? "توقيع اتفاقية الاكتتاب" : "Sign subscription agreement",
              isAr ? "تخصيص رأس المال وبدء التدفق" : "Capital allocation and live deal flow",
            ].map((step, i) => (
              <div key={i} className="p-4 rounded-lg border bg-muted/30">
                <div className="text-2xl font-bold text-primary mb-1">{i + 1}</div>
                <p className="text-muted-foreground">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
