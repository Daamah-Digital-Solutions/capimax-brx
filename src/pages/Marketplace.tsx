import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  ChevronDown,
  X,
  Building2,
  HardHat,
  Layers,
  Briefcase,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PropertyCard } from "@/components/marketplace/PropertyCard";
import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { GlobalStats } from "@/components/marketplace/GlobalStats";
import { useLanguage } from "@/contexts/LanguageContext";
// Phase 2: the catalogue now comes from the Django API (was static properties.ts).
// We keep the TYPES + propertyModelMeta (display labels) from properties.ts.
import { propertyModelMeta, type Property, type PropertyCategory, type PropertyModel } from "@/data/properties";
import { propertiesApi } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

const categories: { id: PropertyCategory; icon: React.ElementType; en: string; ar: string }[] = [
  { id: "ready", icon: Building2, en: "Ready Properties", ar: "عقارات جاهزة" },
  { id: "construction", icon: HardHat, en: "Under Construction", ar: "قيد الإنشاء" },
  { id: "ready_portfolio", icon: Briefcase, en: "Ready Portfolios", ar: "محافظ جاهزة" },
  { id: "construction_portfolio", icon: Layers, en: "Construction Portfolios", ar: "محافظ قيد الإنشاء" },
];

const constructionModels: { id: PropertyModel; en: string; ar: string }[] = [
  { id: "installment", en: "Installment", ar: "بالتقسيط" },
  { id: "phasing", en: "Phasing", ar: "مرحلي" },
  { id: "future", en: "Future", ar: "مستقبلي" },
  { id: "option", en: "Option", ar: "خيار" },
  { id: "shared", en: "Shared with Owner", ar: "ملكية مشتركة" },
];

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useLanguage();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedExits, setSelectedExits] = useState<string[]>([]);
  const [selectedYieldTypes, setSelectedYieldTypes] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<string[]>([]);
  const [selectedMinInvestment, setSelectedMinInvestment] = useState<number | null>(null);
  const [yieldRange, setYieldRange] = useState<[number, number]>([0, 60]);
  const [search, setSearch] = useState("");

  // Catalogue from the API (replaces the static `properties` array). Same shape,
  // so all the client-side filtering below is unchanged.
  const [properties, setProperties] = useState<Property[]>([]);
  useEffect(() => {
    let active = true;
    propertiesApi
      .list()
      .then((data) => active && setProperties(data as Property[]))
      .catch(() => active && setProperties([]));
    return () => {
      active = false;
    };
  }, []);

  const activeCategory = (searchParams.get("category") as PropertyCategory) || "ready";
  const activeModel = searchParams.get("model") as PropertyModel | null;

  const setCategory = (c: PropertyCategory) => {
    const next = new URLSearchParams(searchParams);
    next.set("category", c);
    next.delete("model");
    setSearchParams(next);
  };
  const setModel = (m: PropertyModel | null) => {
    const next = new URLSearchParams(searchParams);
    if (m) next.set("model", m);
    else next.delete("model");
    setSearchParams(next);
  };

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (p.funded >= 100) return false;
      if (p.category !== activeCategory) return false;
      if (activeModel && p.model !== activeModel) return false;
      if (selectedCountries.length && !selectedCountries.includes(p.country)) return false;
      if (selectedStatus.length && !selectedStatus.includes(p.status)) return false;
      if (selectedTypes.length && !selectedTypes.includes(p.assetType)) return false;
      if (selectedExits.length && !selectedExits.includes(p.exitAvailability)) return false;
      if (selectedYieldTypes.length && !selectedYieldTypes.includes(p.yieldType)) return false;
      if (selectedCities.length && !selectedCities.includes(p.city)) return false;
      if (selectedRisk.length && !selectedRisk.includes(p.riskLevel)) return false;
      if (selectedMinInvestment != null && p.minInvestment > selectedMinInvestment) return false;
      const roi = p.expectedYield ?? p.expectedGrowth ?? 0;
      if (roi < yieldRange[0] || roi > yieldRange[1]) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.name} ${p.nameAr} ${p.location} ${p.locationAr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [properties, activeCategory, activeModel, selectedCountries, selectedStatus, selectedTypes, selectedExits, selectedYieldTypes, selectedCities, selectedRisk, selectedMinInvestment, yieldRange, search]);

  const isYieldActive = yieldRange[0] !== 0 || yieldRange[1] !== 60;

  const resetFilters = () => {
    setSelectedCountries([]);
    setSelectedStatus([]);
    setSelectedTypes([]);
    setSelectedExits([]);
    setSelectedYieldTypes([]);
    setSelectedCities([]);
    setSelectedRisk([]);
    setSelectedMinInvestment(null);
    setYieldRange([0, 60]);
  };

  const counts = useMemo(() => {
    const c: Record<PropertyCategory, number> = {
      ready: 0,
      construction: 0,
      ready_portfolio: 0,
      construction_portfolio: 0,
    };
    properties.forEach((p) => {
      if (p.funded < 100) c[p.category]++;
    });
    return c;
  }, [properties]);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <GlobalStats />

        {/* Header */}
        <div className="border-b border-border bg-card/50 sticky top-16 z-20 backdrop-blur-lg">
          <div className="container py-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    {t("marketplace.title")}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filtered.length} {t("marketplace.opportunities")}
                  </p>
                </div>
                <Link to="/funded-properties">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors">
                    {language === "ar" ? "عرض العقارات المموّلة" : "View Funded Properties"}
                  </Badge>
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 lg:w-72">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("marketplace.searchProperty")}
                    className="w-full h-10 ps-10 pe-4 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className="hidden lg:inline-flex"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                      <SlidersHorizontal className="w-4 h-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side={language === "ar" ? "right" : "left"} className="w-[90vw] sm:w-96 overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{language === "ar" ? "الفلاتر" : "Filters"}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <MarketplaceFilters
                        onClose={() => {}}
                        properties={properties}
                        activeCategory={activeCategory}
                        selectedCountries={selectedCountries}
                        setSelectedCountries={setSelectedCountries}
                        selectedStatus={selectedStatus}
                        setSelectedStatus={setSelectedStatus}
                        selectedTypes={selectedTypes}
                        setSelectedTypes={setSelectedTypes}
                        selectedCities={selectedCities}
                        setSelectedCities={setSelectedCities}
                        selectedRisk={selectedRisk}
                        setSelectedRisk={setSelectedRisk}
                        selectedMinInvestment={selectedMinInvestment}
                        setSelectedMinInvestment={setSelectedMinInvestment}
                        yieldRange={yieldRange}
                        setYieldRange={setYieldRange}
                        selectedExits={selectedExits}
                        setSelectedExits={setSelectedExits}
                        selectedYieldTypes={selectedYieldTypes}
                        setSelectedYieldTypes={setSelectedYieldTypes}
                        onReset={resetFilters}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const Icon = c.icon;
                const isActive = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                      isActive
                        ? "bg-gradient-gold text-primary-foreground border-transparent shadow-gold"
                        : "bg-card border-border hover:border-primary/40 text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{language === "ar" ? c.ar : c.en}</span>
                    <Badge variant={isActive ? "outline" : "secondary"} className={cn("ml-1", isActive && "border-primary-foreground/40 text-primary-foreground")}>
                      {counts[c.id]}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Sub-model chips for Under Construction */}
            {activeCategory === "construction" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground me-1">
                  {language === "ar" ? "نموذج:" : "Model:"}
                </span>
                <button
                  onClick={() => setModel(null)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    !activeModel ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                  )}
                >
                  {language === "ar" ? "الكل" : "All"}
                </button>
                {constructionModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      activeModel === m.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    {language === "ar" ? m.ar : m.en}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="container py-6">
          <div className="flex gap-6">
            {showFilters && (
              <aside className="w-72 shrink-0 hidden lg:block animate-slide-in-left">
                <MarketplaceFilters
                  onClose={() => setShowFilters(false)}
                  properties={properties}
                  activeCategory={activeCategory}
                  selectedCountries={selectedCountries}
                  setSelectedCountries={setSelectedCountries}
                  selectedStatus={selectedStatus}
                  setSelectedStatus={setSelectedStatus}
                  selectedTypes={selectedTypes}
                  setSelectedTypes={setSelectedTypes}
                  selectedCities={selectedCities}
                  setSelectedCities={setSelectedCities}
                  selectedRisk={selectedRisk}
                  setSelectedRisk={setSelectedRisk}
                  selectedMinInvestment={selectedMinInvestment}
                  setSelectedMinInvestment={setSelectedMinInvestment}
                  yieldRange={yieldRange}
                  setYieldRange={setYieldRange}
                  selectedExits={selectedExits}
                  setSelectedExits={setSelectedExits}
                  selectedYieldTypes={selectedYieldTypes}
                  setSelectedYieldTypes={setSelectedYieldTypes}
                  onReset={resetFilters}
                />
              </aside>
            )}

            <div className="flex-1">
              {(selectedCountries.length > 0 || selectedStatus.length > 0 || selectedTypes.length > 0 || selectedExits.length > 0 || selectedYieldTypes.length > 0 || selectedCities.length > 0 || selectedRisk.length > 0 || selectedMinInvestment != null || isYieldActive) && (
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {selectedCountries.map((c) => (
                    <Badge key={c} variant="gold" className="gap-1 pe-1">
                      {c.toUpperCase()}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedCountries(selectedCountries.filter(x => x !== c))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedCities.map((c) => (
                    <Badge key={c} variant="gold" className="gap-1 pe-1">
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedCities(selectedCities.filter(x => x !== c))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedRisk.map((r) => (
                    <Badge key={r} variant="gold" className="gap-1 pe-1">
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedRisk(selectedRisk.filter(x => x !== r))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedMinInvestment != null && (
                    <Badge variant="gold" className="gap-1 pe-1">
                      ≤ ${selectedMinInvestment.toLocaleString()}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedMinInvestment(null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedTypes.map((t_) => (
                    <Badge key={t_} variant="gold" className="gap-1 pe-1">
                      {t_.charAt(0).toUpperCase() + t_.slice(1)}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedTypes(selectedTypes.filter(x => x !== t_))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedExits.map((e) => (
                    <Badge key={e} variant="gold" className="gap-1 pe-1">
                      Exit: {e}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedExits(selectedExits.filter(x => x !== e))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedYieldTypes.map((y) => (
                    <Badge key={y} variant="gold" className="gap-1 pe-1">
                      {y}
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setSelectedYieldTypes(selectedYieldTypes.filter(x => x !== y))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {isYieldActive && (
                    <Badge variant="gold" className="gap-1 pe-1">
                      ROI {yieldRange[0]}%–{yieldRange[1]}%
                      <button className="hover:bg-primary/20 rounded p-0.5" onClick={() => setYieldRange([0, 60])}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetFilters}>
                    {t("marketplace.clearAll")}
                  </Button>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="p-12 text-center bg-card border border-border rounded-2xl">
                  <p className="text-muted-foreground">
                    {language === "ar" ? "لا توجد فرص مطابقة." : "No matching opportunities."}
                  </p>
                </div>
              ) : (
                <div className={viewMode === "grid" ? "grid md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4"}>
                  {filtered.map((property, index) => (
                    <PropertyCard
                      key={property.id}
                      property={property as any}
                      viewMode={viewMode}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
