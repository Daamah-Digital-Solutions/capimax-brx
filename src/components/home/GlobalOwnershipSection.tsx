import { ArrowRight, ArrowLeft, Globe2, Building2, HardHat, Layers, MapPin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Showcase {
  titleEn: string;
  titleAr: string;
  locationEn: string;
  locationAr: string;
  countryFlag: string;
  image: string;
  yieldPct: number;
  stageEn: string;
  stageAr: string;
  variant: "ready" | "construction" | "verified" | "info";
  icon: typeof Building2;
}

const showcases: Showcase[] = [
  {
    titleEn: "Marina Bay Tower",
    titleAr: "برج مارينا باي",
    locationEn: "Dubai, UAE",
    locationAr: "دبي، الإمارات",
    countryFlag: "🇦🇪",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    yieldPct: 9.5,
    stageEn: "Ready Property",
    stageAr: "عقار جاهز",
    variant: "ready",
    icon: Building2,
  },
  {
    titleEn: "Palm Residences",
    titleAr: "مساكن النخلة",
    locationEn: "Abu Dhabi, UAE",
    locationAr: "أبوظبي، الإمارات",
    countryFlag: "🇦🇪",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    yieldPct: 25,
    stageEn: "Under Construction",
    stageAr: "تحت الإنشاء",
    variant: "construction",
    icon: HardHat,
  },
  {
    titleEn: "Diversified Portfolio",
    titleAr: "محفظة عقارية متنوعة",
    locationEn: "GCC Region",
    locationAr: "منطقة الخليج",
    countryFlag: "🌍",
    image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800",
    yieldPct: 12.4,
    stageEn: "Property Portfolio",
    stageAr: "محفظة عقارية",
    variant: "verified",
    icon: Layers,
  },
  {
    titleEn: "London Heritage Estates",
    titleAr: "عقارات لندن التراثية",
    locationEn: "London, UK",
    locationAr: "لندن، المملكة المتحدة",
    countryFlag: "🇬🇧",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
    yieldPct: 8.1,
    stageEn: "International",
    stageAr: "فرصة دولية",
    variant: "info",
    icon: Globe2,
  },
];

export function GlobalOwnershipSection() {
  const { language, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const ar = language === "ar";

  return (
    <section className="relative py-20 bg-gradient-to-b from-background to-muted/30 overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        {/* Messaging */}
        <div className="max-w-4xl mx-auto text-center mb-12 animate-fade-in">
          <Badge variant="gold" className="mb-5 gap-1">
            <Globe2 className="w-3.5 h-3.5" />
            {ar ? "ملكية عقارية عالمية" : "Global Real Estate Ownership"}
          </Badge>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-5 leading-tight">
            {ar ? "تملك في دول متعددة حول العالم" : "Own Real Estate Across Multiple Global Markets"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            {ar
              ? "تملك واستثمر في عقارات جاهزة وتحت الإنشاء ومحافظ عقارية متنوعة"
              : "Own & Invest in Ready Properties, Under Construction Projects, and Diversified Property Portfolios"}
          </p>

          {/* Products CTA */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="hero" size="xl" className="group" asChild>
              <Link to="/products">
                {ar ? "اكتشف أنواع الفرص" : "Explore Opportunity Types"}
                <ArrowIcon className={cn("w-5 h-5 group-hover:translate-x-1 transition-transform", isRTL && "rotate-180 group-hover:-translate-x-1")} />
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="/marketplace">
                {ar ? "تصفح السوق" : "Browse Marketplace"}
              </Link>
            </Button>
          </div>
        </div>

        {/* Showcase Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {showcases.map((s, i) => {
            const Icon = s.icon;
            return (
              <Link
                key={i}
                to="/marketplace"
                className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={s.image}
                    alt={ar ? s.titleAr : s.titleEn}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                    <Badge variant={s.variant} className="gap-1">
                      <Icon className="w-3 h-3" />
                      {ar ? s.stageAr : s.stageEn}
                    </Badge>
                    <span className="text-2xl drop-shadow">{s.countryFlag}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-base font-semibold text-foreground mb-1 line-clamp-1">
                    {ar ? s.titleAr : s.titleEn}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{ar ? s.locationAr : s.locationEn}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-bold">{s.yieldPct}%</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ar ? "العائد المتوقع" : "Est. Yield"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
