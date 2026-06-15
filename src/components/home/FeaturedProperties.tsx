import { MapPin, TrendingUp, Clock, ArrowRight, ArrowLeft, Building2, Home, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

interface Property {
  id: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  image: string;
  assetType: "residential" | "commercial" | "industrial";
  status: "ready" | "construction" | "sold-out";
  expectedYield?: number;
  expectedGrowth?: number;
  minInvestment: number;
  funded: number;
  durationYears: number;
  exitEligible: boolean;
}

const properties: Property[] = [
  {
    id: "1",
    name: "Marina Bay Tower",
    nameAr: "برج مارينا باي",
    location: "Dubai, UAE",
    locationAr: "دبي، الإمارات",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    assetType: "commercial",
    status: "ready",
    expectedYield: 9.5,
    minInvestment: 1000,
    funded: 78,
    durationYears: 5,
    exitEligible: true,
  },
  {
    id: "2",
    name: "Palm Residences",
    nameAr: "مساكن النخلة",
    location: "Abu Dhabi, UAE",
    locationAr: "أبوظبي، الإمارات",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    assetType: "residential",
    status: "construction",
    expectedGrowth: 25,
    minInvestment: 2500,
    funded: 45,
    durationYears: 3,
    exitEligible: false,
  },
  {
    id: "3",
    name: "Industrial Park",
    nameAr: "المجمع الصناعي",
    location: "Riyadh, KSA",
    locationAr: "الرياض، السعودية",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800",
    assetType: "industrial",
    status: "ready",
    expectedYield: 11.2,
    minInvestment: 5000,
    funded: 92,
    durationYears: 7,
    exitEligible: true,
  },
];

export function FeaturedProperties() {
  const { t, language, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const assetTypeConfig = {
    residential: { icon: Home, labelKey: "featured.residential" },
    commercial: { icon: Building2, labelKey: "featured.commercial" },
    industrial: { icon: Warehouse, labelKey: "featured.industrial" },
  };

  const statusConfig = {
    ready: { variant: "ready" as const, labelKey: "featured.readyForYield" },
    construction: { variant: "construction" as const, labelKey: "featured.underConstruction" },
    "sold-out": { variant: "sold-out" as const, labelKey: "featured.soldOut" },
  };

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
            const AssetIcon = assetTypeConfig[property.assetType].icon;
            const statusInfo = statusConfig[property.status];
            
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
                    <span>{t(assetTypeConfig[property.assetType].labelKey)}</span>
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
                        <span className="font-bold text-lg">{property.durationYears} {t("common.years")}</span>
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
