import {
  MapPin,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  ArrowUpRight,
  Building2,
  Home,
  Warehouse,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { propertyModelMeta, type PropertyModel } from "@/data/properties";

interface Property {
  id: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  image: string;
  assetType: "residential" | "commercial" | "industrial" | "mixed" | "hospitality" | "land";
  status: "ready" | "construction" | "sold-out";
  expectedYield?: number;
  expectedGrowth?: number;
  minInvestment: number;
  funded: number;
  duration?: string;
  durationAr?: string;
  exitEligible: boolean;
  totalValue: number;
  investors: number;
  riskLevel: "low" | "medium" | "high";
  model?: PropertyModel;
  futureTokenPrice?: number;
}

interface PropertyCardProps {
  property: Property;
  viewMode: "grid" | "list";
  index: number;
}

export function PropertyCard({ property, viewMode, index }: PropertyCardProps) {
  const { t, language } = useLanguage();

  const assetTypeConfig: Record<string, { icon: React.ElementType; label: string }> = {
    residential: { icon: Home, label: t("property.residential") },
    commercial: { icon: Building2, label: t("property.commercial") },
    industrial: { icon: Warehouse, label: t("property.industrial") },
    mixed: { icon: Building2, label: language === "ar" ? "متعدد الاستخدامات" : "Mixed Use" },
    hospitality: { icon: Building2, label: language === "ar" ? "ضيافة" : "Hospitality" },
    land: { icon: Warehouse, label: language === "ar" ? "أرض" : "Land" },
  };

  const statusConfig = {
    ready: { variant: "ready" as const, label: t("property.ready") },
    construction: { variant: "construction" as const, label: t("property.underConstruction") },
    "sold-out": { variant: "sold-out" as const, label: t("property.soldOut") },
  };

  const riskConfig = {
    low: { color: "bg-success", label: t("property.riskLow") },
    medium: { color: "bg-warning", label: t("property.riskMedium") },
    high: { color: "bg-destructive", label: t("property.riskHigh") },
  };

  const AssetIcon = assetTypeConfig[property.assetType].icon;
  const statusInfo = statusConfig[property.status];
  const riskInfo = riskConfig[property.riskLevel];
  const yieldValue = property.expectedYield || property.expectedGrowth || 0;
  const propertyName = language === "ar" ? property.nameAr : property.name;
  const propertyLocation = language === "ar" ? property.locationAr : property.location;
  const duration = language === "ar" ? property.durationAr : property.duration;
  const exitLabel = t("property.exitEligible");

  if (viewMode === "list") {
    return (
      <Link 
        to={`/property/${property.id}`}
        className="group flex bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {/* Image */}
        <div className="relative w-64 h-48 shrink-0 overflow-hidden">
          <img
            src={property.image}
            alt={propertyName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-background/60 to-transparent" />
          <div className="absolute top-3 start-3 flex flex-col gap-1.5">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {property.model && (
              <Badge variant="gold" className="gap-1">
                <Sparkles className="w-3 h-3" />
                {language === "ar" ? propertyModelMeta[property.model].labelAr : propertyModelMeta[property.model].label}
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                {propertyName}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                <span>{propertyLocation}</span>
                <span className="text-muted-foreground/50">•</span>
                <AssetIcon className="w-4 h-4" />
                <span>{assetTypeConfig[property.assetType].label}</span>
              </div>
            </div>
            {property.exitEligible && (
              <Badge variant="exit-eligible">{exitLabel}</Badge>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4 flex-1">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold text-lg">{yieldValue}%</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {property.expectedYield ? t("property.yield") : t("property.growth")}
              </div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-lg">${property.minInvestment.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">{t("property.minInvestment")}</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-lg">{duration}</span>
              </div>
              <div className="text-xs text-muted-foreground">{t("property.duration")}</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-lg">{property.investors}</span>
              </div>
              <div className="text-xs text-muted-foreground">{t("property.investors")}</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className={cn("w-2 h-2 rounded-full", riskInfo.color)} />
                <span className="font-medium">{riskInfo.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">{t("property.risk")}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t("property.funded")}</div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-gold rounded-full"
                    style={{ width: `${property.funded}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-primary">{property.funded}%</span>
              </div>
            </div>
            <Button variant="hero" size="sm" className="gap-2">
              {t("property.investNow")}
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Link>
    );
  }

  // Grid View
  return (
    <Link 
      to={`/property/${property.id}`}
      className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Image */}
      <div className="relative h-52 overflow-hidden">
        <img
          src={property.image}
          alt={propertyName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        
        {/* Badges */}
        <div className="absolute top-4 start-4 flex flex-wrap gap-2">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          {property.exitEligible && (
            <Badge variant="exit-eligible">{exitLabel}</Badge>
          )}
        </div>
        {property.model && (
          <div className="absolute top-4 end-4">
            <Badge variant="gold" className="gap-1">
              <Sparkles className="w-3 h-3" />
              {language === "ar" ? propertyModelMeta[property.model].labelAr : propertyModelMeta[property.model].label}
            </Badge>
          </div>
        )}
        
        {/* Asset Type & Risk */}
        <div className="absolute bottom-4 start-4 end-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground bg-background/50 backdrop-blur-sm rounded-full px-3 py-1">
            <AssetIcon className="w-4 h-4" />
            <span>{assetTypeConfig[property.assetType].label}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-foreground bg-background/50 backdrop-blur-sm rounded-full px-2 py-1">
            <span className={cn("w-2 h-2 rounded-full", riskInfo.color)} />
            <span>{riskInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
          {propertyName}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <MapPin className="w-4 h-4" />
          <span>{propertyLocation}</span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="font-bold text-lg">{yieldValue}%</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {property.expectedYield ? t("property.yield") : t("property.growth")}
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-foreground mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold">{duration}</span>
            </div>
            <div className="text-xs text-muted-foreground">{t("property.duration")}</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-foreground mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold">{property.investors}</span>
            </div>
            <div className="text-xs text-muted-foreground">{t("property.investors")}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t("property.funded")}</span>
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
            <div className="text-xs text-muted-foreground">{t("property.minInvestment")}</div>
            <div className="text-lg font-bold text-foreground">
              ${property.minInvestment.toLocaleString()}
            </div>
          </div>
          <Button variant="hero" size="sm">
            {t("property.investNow")}
          </Button>
        </div>
      </div>
    </Link>
  );
}
