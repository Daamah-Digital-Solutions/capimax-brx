import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Globe2, Building2, HardHat, Layers, MapPin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { propertiesApi } from "@/integrations/api/client";

// The showcase grid now reflects the REAL catalogue (GET /api/properties/, first 4
// published) instead of hardcoded sample properties. The surrounding marketing copy is
// unchanged. On an empty catalogue the grid renders nothing (no fabricated cards).
interface ShowcaseProperty {
  id: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  country: string;
  image: string;
  status: "ready" | "construction" | "sold-out";
  expectedYield?: number;
  expectedGrowth?: number;
}

// status → badge stage label / variant / icon (mirrors the marketplace status semantics).
const STATUS_META: Record<
  string,
  { stageEn: string; stageAr: string; variant: "ready" | "construction" | "verified"; icon: typeof Building2 }
> = {
  ready: { stageEn: "Ready Property", stageAr: "عقار جاهز", variant: "ready", icon: Building2 },
  construction: { stageEn: "Under Construction", stageAr: "تحت الإنشاء", variant: "construction", icon: HardHat },
  "sold-out": { stageEn: "Fully Funded", stageAr: "مموّل بالكامل", variant: "verified", icon: Layers },
};

const COUNTRY_FLAG: Record<string, string> = {
  uae: "🇦🇪",
  ksa: "🇸🇦",
  qatar: "🇶🇦",
  bahrain: "🇧🇭",
  oman: "🇴🇲",
};

export function GlobalOwnershipSection() {
  const { language, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const ar = language === "ar";

  const [showcases, setShowcases] = useState<ShowcaseProperty[]>([]);
  useEffect(() => {
    let active = true;
    propertiesApi
      .list()
      .then((data) => active && setShowcases((data as ShowcaseProperty[]).slice(0, 4)))
      .catch(() => active && setShowcases([]));
    return () => {
      active = false;
    };
  }, []);

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
            const meta = STATUS_META[s.status] ?? STATUS_META.ready;
            const Icon = meta.icon;
            const title = ar ? s.nameAr : s.name;
            const yieldPct = s.expectedYield || s.expectedGrowth || 0;
            return (
              <Link
                key={s.id}
                to={`/property/${s.id}`}
                className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={s.image}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                  <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                    <Badge variant={meta.variant} className="gap-1">
                      <Icon className="w-3 h-3" />
                      {ar ? meta.stageAr : meta.stageEn}
                    </Badge>
                    <span className="text-2xl drop-shadow">{COUNTRY_FLAG[s.country] ?? "🌍"}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-base font-semibold text-foreground mb-1 line-clamp-1">
                    {title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{ar ? s.locationAr : s.location}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-bold">{yieldPct}%</span>
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
