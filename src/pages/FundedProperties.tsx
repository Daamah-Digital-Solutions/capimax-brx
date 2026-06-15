import { useEffect, useState } from "react";
import {
  Search,
  Grid3X3,
  List,
  CheckCircle2,
  TrendingUp,
  Users,
  Calendar,
  MapPin,
  Building2,
  Home,
  Warehouse,
  DollarSign,
  Award,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { propertiesApi } from "@/integrations/api/client";

// Phase 2: closed deals now come from the Django API (GET /api/properties/funded/),
// replacing the inline array. Same item shape, so the UI below is unchanged.
interface FundedProperty {
  id: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  image: string;
  assetType: "industrial" | "residential" | "commercial";
  fundedDate: string;
  totalValue: number;
  investors: number;
  expectedYield: number;
  duration: string;
  durationAr: string;
}

const assetTypeConfig = {
  residential: { icon: Home, labelAr: "سكني", labelEn: "Residential" },
  commercial: { icon: Building2, labelAr: "تجاري", labelEn: "Commercial" },
  industrial: { icon: Warehouse, labelAr: "صناعي", labelEn: "Industrial" },
};

export default function FundedProperties() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const { t, language, isRTL } = useLanguage();

  const [fundedProperties, setFundedProperties] = useState<FundedProperty[]>([]);
  useEffect(() => {
    let active = true;
    propertiesApi
      .funded()
      .then((data) => active && setFundedProperties(data as FundedProperty[]))
      .catch(() => active && setFundedProperties([]));
    return () => {
      active = false;
    };
  }, []);

  const filteredProperties = fundedProperties.filter(property => {
    const name = language === "ar" ? property.nameAr : property.name;
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate totals
  const totalFunded = fundedProperties.reduce((sum, p) => sum + p.totalValue, 0);
  const totalInvestors = fundedProperties.reduce((sum, p) => sum + p.investors, 0);
  const avgYield = fundedProperties.length
    ? fundedProperties.reduce((sum, p) => sum + p.expectedYield, 0) / fundedProperties.length
    : 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="bg-gradient-to-b from-primary/10 to-background border-b border-border">
          <div className="container py-12">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="gold" className="mb-4">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isRTL ? "استثمارات ناجحة" : "Successful Investments"}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
                {isRTL ? "العقارات المموّلة بالكامل" : "Fully Funded Properties"}
              </h1>
              <p className="text-lg text-muted-foreground">
                {isRTL 
                  ? "استعرض العقارات التي وصلت إلى 100% من التمويل. دليل على ثقة المستثمرين ونجاح المنصة."
                  : "Browse properties that reached 100% funding. Proof of investor trust and platform success."
                }
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-4xl mx-auto">
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="p-4 text-center">
                  <Award className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{fundedProperties.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {isRTL ? "عقار مموّل" : "Funded Properties"}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">
                    ${(totalFunded / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isRTL ? "إجمالي التمويل" : "Total Funded"}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">
                    {totalInvestors.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isRTL ? "مستثمر" : "Investors"}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{avgYield.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {isRTL ? "متوسط العائد" : "Avg. Yield"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b border-border bg-card/50 sticky top-16 z-20 backdrop-blur-lg">
          <div className="container py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={isRTL ? "ابحث عن عقار..." : "Search properties..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 ps-10 pe-4 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {filteredProperties.length} {isRTL ? "نتيجة" : "results"}
                </span>
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Grid */}
        <div className="container py-8">
          {filteredProperties.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                {isRTL ? "لم يتم العثور على نتائج" : "No results found"}
              </p>
            </div>
          ) : (
            <div className={cn(
              viewMode === "grid"
                ? "grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            )}>
              {filteredProperties.map((property, index) => {
                const AssetIcon = assetTypeConfig[property.assetType].icon;
                const assetLabel = language === "ar" 
                  ? assetTypeConfig[property.assetType].labelAr 
                  : assetTypeConfig[property.assetType].labelEn;
                const propertyName = language === "ar" ? property.nameAr : property.name;
                const propertyLocation = language === "ar" ? property.locationAr : property.location;
                const duration = language === "ar" ? property.durationAr : property.duration;

                if (viewMode === "list") {
                  return (
                    <Link
                      key={property.id}
                      to={`/property/${property.id}`}
                      className="group flex bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {/* Image */}
                      <div className="relative w-64 h-48 shrink-0 overflow-hidden">
                        <img
                          src={property.image}
                          alt={propertyName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-l from-background/60 to-transparent" />
                        <div className="absolute top-3 start-3">
                          <Badge className="bg-emerald-500 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {isRTL ? "مموّل" : "FUNDED"}
                          </Badge>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-5">
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
                              <span>{assetLabel}</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-center gap-1 text-primary mb-1">
                              <TrendingUp className="w-4 h-4" />
                              <span className="font-bold text-lg">{property.expectedYield}%</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isRTL ? "العائد" : "Yield"}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <DollarSign className="w-4 h-4 text-muted-foreground" />
                              <span className="font-bold">${(property.totalValue / 1000000).toFixed(1)}M</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isRTL ? "القيمة" : "Value"}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="font-bold">{property.investors}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isRTL ? "مستثمر" : "Investors"}
                            </div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="font-bold text-sm">{duration}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isRTL ? "المدة" : "Duration"}
                            </div>
                          </div>
                        </div>

                        {/* Funded Date */}
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                          <div className="text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            {isRTL ? "تاريخ التمويل:" : "Funded on:"} {formatDate(property.fundedDate)}
                          </div>
                          <Button variant="outline" size="sm">
                            {isRTL ? "عرض التفاصيل" : "View Details"}
                          </Button>
                        </div>
                      </div>
                    </Link>
                  );
                }

                // Grid View
                return (
                  <Link
                    key={property.id}
                    to={`/property/${property.id}`}
                    className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {/* Image */}
                    <div className="relative h-52 overflow-hidden">
                      <img
                        src={property.image}
                        alt={propertyName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      
                      {/* Funded Badge */}
                      <div className="absolute top-4 start-4">
                        <Badge className="bg-emerald-500 text-white shadow-lg">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {isRTL ? "مموّل بالكامل" : "FULLY FUNDED"}
                        </Badge>
                      </div>
                      
                      {/* Asset Type */}
                      <div className="absolute bottom-4 start-4 end-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-foreground bg-background/50 backdrop-blur-sm rounded-full px-3 py-1">
                          <AssetIcon className="w-4 h-4" />
                          <span>{assetLabel}</span>
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
                            <span className="font-bold text-lg">{property.expectedYield}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? "العائد" : "Yield"}
                          </div>
                        </div>
                        <div className="bg-muted rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-foreground mb-1">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold">{property.investors}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? "مستثمر" : "Investors"}
                          </div>
                        </div>
                        <div className="bg-muted rounded-lg p-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-foreground mb-1">
                            <span className="font-bold text-sm">{duration}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? "المدة" : "Duration"}
                          </div>
                        </div>
                      </div>

                      {/* Funding Complete Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">{isRTL ? "التمويل" : "Funding"}</span>
                          <span className="text-emerald-500 font-semibold">100%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full w-full bg-emerald-500 rounded-full" />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div>
                          <div className="text-xs text-muted-foreground">{isRTL ? "القيمة الإجمالية" : "Total Value"}</div>
                          <div className="text-lg font-bold text-foreground">
                            ${property.totalValue.toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          {isRTL ? "عرض التفاصيل" : "View Details"}
                        </Button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Message Box */}
          <Card className="mt-12 bg-muted/30 border-border/50">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isRTL 
                  ? "هذه العقارات لم تعد متاحة للاستثمار الجديد"
                  : "These properties are no longer available for new investment"
                }
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                {isRTL 
                  ? "تم تمويل هذه العقارات بالكامل وهي الآن في مرحلة التشغيل. استعرض الفرص المتاحة في السوق للاستثمار."
                  : "These properties have been fully funded and are now in operation. Browse available opportunities in the marketplace to invest."
                }
              </p>
              <Link to="/marketplace">
                <Button variant="hero" size="lg">
                  {isRTL ? "استعرض الفرص المتاحة" : "Browse Available Opportunities"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}