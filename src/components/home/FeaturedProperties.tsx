import { useEffect, useState } from "react";
import { MapPin, TrendingUp, Clock, ArrowRight, ArrowLeft, Building2, Home, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { propertiesApi } from "@/integrations/api/client";

// Home featured carousel — real data from GET /api/properties/featured/ (admin flags
// `is_featured`). Same camelCase Property shape the Marketplace renders. No hardcoded
// cards: on an empty / featured-less catalogue the section renders nothing.
interface FeaturedProperty {
  id: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  image: string;
  assetType: string;
  status: "ready" | "construction" | "sold-out";
  expectedYield?: number;
  expectedGrowth?: number;
  minInvestment: number;
  funded: number;
  duration: string;
  durationAr: string;
  exitEligible: boolean;
}

export function FeaturedProperties() {
  const { t, language, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [properties, setProperties] = useState<FeaturedProperty[]>([]);
  useEffect(() => {
    let active = true;
    propertiesApi
      .featured()
      .then((data) => active && setProperties(data as FeaturedProperty[]))
      .catch(() => active && setProperties([]));
    return () => {
      active = false;
    };
  }, []);

  // All 6 asset types (mirror PropertyCard) so real data can't crash the lookup.
  const assetTypeConfig: Record<string, { icon: React.ElementType; label: string }> = {
    residential: { icon: Home, label: t("featured.residential") },
    commercial: { icon: Building2, label: t("featured.commercial") },
    industrial: { icon: Warehouse, label: t("featured.industrial") },
    mixed: { icon: Building2, label: language === "ar" ? "متعدد الاستخدامات" : "Mixed Use" },
    hospitality: { icon: Building2, label: language === "ar" ? "ضيافة" : "Hospitality" },
    land: { icon: Warehouse, label: language === "ar" ? "أرض" : "Land" },
  };

  const statusConfig = {
    ready: { variant: "ready" as const, labelKey: "featured.readyForYield" },
    construction: { variant: "construction" as const, labelKey: "featured.underConstruction" },
    "sold-out": { variant: "sold-out" as const, labelKey: "featured.soldOut" },
  };

  // No featured properties yet → render nothing (never fabricated cards).
  if (properties.length === 0) return null;

  return (
    <section className="py-20 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <Badge variant="gold" className="mb-4">{t("featured.badge")}</Badge>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("featured.title")}
            </h2>
            <p className="text-muted-foreground max-w-xl">
              {t("featured.subtitle")}
            </p>
          </div>
          <Button variant="gold-outline" className="w-fit" asChild>
            <Link to="/marketplace">
              {t("featured.viewAll")}
              <ArrowIcon className={cn("w-4 h-4", isRTL ? "mr-2" : "ml-2")} />
            </Link>
          </Button>
        </div>

        {/* Properties Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property, index) => {
            const assetInfo = assetTypeConfig[property.assetType] ?? assetTypeConfig.commercial;
            const AssetIcon = assetInfo.icon;
            const statusInfo = statusConfig[property.status] ?? statusConfig.ready;
            
              return (
              <Link
                to={`/property/${property.id}`}
                key={property.id}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in block"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={property.image}
                    alt={language === "ar" ? property.nameAr : property.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  
                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                    <Badge variant={statusInfo.variant}>{t(statusInfo.labelKey)}</Badge>
                    {property.exitEligible && (
                      <Badge variant="exit-eligible">{t("featured.exitAvailable")}</Badge>
                    )}
                  </div>
                  
                  {/* Asset Type */}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-sm text-foreground">
                    <AssetIcon className="w-4 h-4" />
                    <span>{assetInfo.label}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                    {language === "ar" ? property.nameAr : property.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="w-4 h-4" />
                    <span>{language === "ar" ? property.locationAr : property.location}</span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-primary mb-1">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-bold text-lg">
                          {property.expectedYield || property.expectedGrowth}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {property.expectedYield ? t("featured.expectedYield") : t("featured.expectedGrowth")}
                      </div>
                    </div>
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-foreground mb-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-bold text-lg">
                          {language === "ar" ? property.durationAr : property.duration}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{t("featured.duration")}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t("featured.funding")}</span>
                      <span className="text-primary font-semibold">{property.funded}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-gold rounded-full transition-all duration-500"
                        style={{ width: `${property.funded}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-foreground">{t("featured.minInvestment")}</div>
                      <div className="text-lg font-bold text-foreground">
                        ${property.minInvestment.toLocaleString()}
                      </div>
                    </div>
                    <Button variant="hero" size="sm">
                      {t("featured.investNow")}
                    </Button>
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
