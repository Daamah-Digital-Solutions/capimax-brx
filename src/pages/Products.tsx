import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2,
  Calendar,
  Layers,
  Clock,
  KeyRound,
  Users2,
  Briefcase,
  HardHat,
  ArrowRight,
  ArrowLeft,
  Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  slug: string;
  icon: React.ElementType;
  titleEn: string;
  titleAr: string;
  taglineEn: string;
  taglineAr: string;
  parent: "ready" | "under-construction" | "ready-portfolio" | "uc-portfolio";
};

const ITEMS: Item[] = [
  { slug: "ready-yield", icon: Building2, parent: "ready", titleEn: "Ready Properties with Yield", titleAr: "عقارات جاهزة مدرّة للعائد", taglineEn: "Operational properties generating rental income from day one.", taglineAr: "عقارات تشغيلية تدرّ إيجاراً من اليوم الأول." },
  { slug: "installment", icon: Calendar, parent: "under-construction", titleEn: "Installment Property", titleAr: "العقار بالتقسيط", taglineEn: "Acquire ownership gradually through scheduled installments.", taglineAr: "تملّك تدريجي عبر أقساط مجدولة." },
  { slug: "phasing", icon: Layers, parent: "under-construction", titleEn: "Property Phasing", titleAr: "العقار بالمراحل", taglineEn: "Token pricing rises with each construction and valuation phase.", taglineAr: "سعر التوكن يرتفع مع كل مرحلة بناء وتقييم." },
  { slug: "future", icon: Clock, parent: "under-construction", titleEn: "Property Future", titleAr: "العقار الآجل", taglineEn: "Reserve future ownership today at predefined pricing.", taglineAr: "احجز ملكية مستقبلية اليوم بأسعار محددة." },
  { slug: "option", icon: KeyRound, parent: "under-construction", titleEn: "Property Option", titleAr: "خيار العقار", taglineEn: "Buy the right — not the obligation — to acquire shares later.", taglineAr: "اشترِ الحق — وليس الالتزام — للاستحواذ لاحقاً." },
  { slug: "shared", icon: Users2, parent: "under-construction", titleEn: "Shared with Owner", titleAr: "ملكية مشتركة مع المالك", taglineEn: "Co-own directly with the original owner or developer.", taglineAr: "تملّك مشترك مباشر مع المالك أو المطور." },
  { slug: "portfolios-ready", icon: Briefcase, parent: "ready-portfolio", titleEn: "Ready Property Portfolios", titleAr: "محافظ عقارات جاهزة", taglineEn: "Diversified baskets of operational properties.", taglineAr: "سلال متنوعة من عقارات تشغيلية." },
  { slug: "portfolios-under-construction", icon: HardHat, parent: "uc-portfolio", titleEn: "Under Construction Portfolios", titleAr: "محافظ عقارات قيد الإنشاء", taglineEn: "Diversified development portfolios with growth potential.", taglineAr: "محافظ تطوير متنوعة بإمكانات نمو." },
];

const GROUPS: { key: Item["parent"]; titleEn: string; titleAr: string; variant: "ready" | "construction" | "verified" | "info" }[] = [
  { key: "ready", titleEn: "Ready Properties", titleAr: "عقارات جاهزة", variant: "ready" },
  { key: "under-construction", titleEn: "Under Construction", titleAr: "تحت الإنشاء", variant: "construction" },
  { key: "ready-portfolio", titleEn: "Ready Portfolios", titleAr: "محافظ جاهزة", variant: "verified" },
  { key: "uc-portfolio", titleEn: "Development Portfolios", titleAr: "محافظ التطوير", variant: "info" },
];

export default function Products() {
  const { language, isRTL } = useLanguage();
  const ar = language === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative py-16 lg:py-20 border-b border-border bg-gradient-to-b from-muted/30 to-background overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
          </div>
          <div className="container relative z-10 max-w-4xl text-center">
            <Badge variant="gold" className="mb-4 gap-1">
              <Globe2 className="w-3.5 h-3.5" />
              {ar ? "أنواع الفرص العقارية" : "Real Estate Opportunity Types"}
            </Badge>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              {ar ? "اكتشف أنواع الفرص" : "Explore Opportunity Types"}
            </h1>
            <p className="text-lg text-muted-foreground">
              {ar
                ? "نماذج تملّك متعددة تشمل العقارات الجاهزة، تحت الإنشاء، والمحافظ المتنوعة — جميعها بسعر توكن موحّد $100."
                : "Multiple ownership models across ready, under-construction, and diversified portfolios — all at a unified $100 token price."}
            </p>
          </div>
        </section>

        {/* Groups */}
        <div className="container py-12 space-y-12">
          {GROUPS.map((group) => {
            const items = ITEMS.filter((i) => i.parent === group.key);
            if (!items.length) return null;
            return (
              <section key={group.key}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Badge variant={group.variant}>{ar ? group.titleAr : group.titleEn}</Badge>
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      {ar ? group.titleAr : group.titleEn}
                    </h2>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card
                        key={item.slug}
                        className="group hover:border-primary/50 transition-all duration-300 hover:shadow-gold"
                      >
                        <CardHeader>
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <CardTitle className="text-lg">
                            {ar ? item.titleAr : item.titleEn}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-5 min-h-[3rem]">
                            {ar ? item.taglineAr : item.taglineEn}
                          </p>
                          <Button variant="gold-outline" size="sm" className="w-full group/btn" asChild>
                            <Link to={`/products/${item.slug}`}>
                              {ar ? "عرض التفاصيل" : "View Details"}
                              <ArrowIcon className={cn("w-4 h-4 transition-transform", isRTL ? "group-hover/btn:-translate-x-1" : "group-hover/btn:translate-x-1")} />
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* CTA */}
          <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-12 text-center">
            <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
              {ar ? "جاهز للبدء؟" : "Ready to start?"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              {ar
                ? "تصفّح السوق العقاري وابدأ التملّك الجزئي بسعر توكن $100."
                : "Browse the marketplace and start fractional ownership at $100 per token."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/marketplace">{ar ? "تصفّح السوق" : "Browse Marketplace"}</Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/auth">{ar ? "سجّل الآن" : "Register Now"}</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
