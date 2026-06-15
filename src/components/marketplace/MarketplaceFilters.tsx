import { useState } from "react";
import { 
  X, 
  ChevronDown, 
  ChevronUp,
  MapPin, 
  Building2, 
  TrendingUp,
  DollarSign,
  Clock,
  Shield,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface FilterSectionProps {
  title: string;
  titleEn: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, titleEn, icon: Icon, children, defaultOpen = true }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-right hover:text-primary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">/ {titleEn}</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  );
}

interface MarketplaceFiltersProps {
  onClose: () => void;
  selectedCountries: string[];
  setSelectedCountries: (val: string[]) => void;
  selectedStatus: string[];
  setSelectedStatus: (val: string[]) => void;
  selectedTypes: string[];
  setSelectedTypes: (val: string[]) => void;
  yieldRange: [number, number];
  setYieldRange: (val: [number, number]) => void;
  selectedExits?: string[];
  setSelectedExits?: (val: string[]) => void;
  selectedYieldTypes?: string[];
  setSelectedYieldTypes?: (val: string[]) => void;
  onReset: () => void;
}

export function MarketplaceFilters({
  onClose,
  selectedCountries,
  setSelectedCountries,
  selectedStatus,
  setSelectedStatus,
  selectedTypes,
  setSelectedTypes,
  yieldRange,
  setYieldRange,
  selectedExits,
  setSelectedExits,
  selectedYieldTypes,
  setSelectedYieldTypes,
  onReset
}: MarketplaceFiltersProps) {
  const { t, language } = useLanguage();
  const [minInvestment, setMinInvestment] = useState([1000, 50000]);

  const exitTypes = [
    { id: "lp", label: language === "ar" ? "سوق LP" : "LP Market" },
    { id: "secondary", label: language === "ar" ? "السوق الثانوي" : "Secondary" },
    { id: "both", label: language === "ar" ? "كلاهما" : "Both" },
  ];
  const yieldTypeOptions = [
    { id: "rental", label: language === "ar" ? "إيجار" : "Rental" },
    { id: "appreciation", label: language === "ar" ? "نمو رأسمالي" : "Appreciation" },
    { id: "hybrid", label: language === "ar" ? "مدمج" : "Hybrid" },
  ];

  const countries = [
    { id: "uae", label: language === "ar" ? "الإمارات" : "UAE", labelEn: "UAE", count: 24 },
    { id: "ksa", label: language === "ar" ? "السعودية" : "KSA", labelEn: "KSA", count: 18 },
    { id: "qatar", label: language === "ar" ? "قطر" : "Qatar", labelEn: "Qatar", count: 8 },
    { id: "bahrain", label: language === "ar" ? "البحرين" : "Bahrain", labelEn: "Bahrain", count: 5 },
    { id: "oman", label: language === "ar" ? "عمان" : "Oman", labelEn: "Oman", count: 3 },
  ];

  const cities = [
    { id: "dubai", label: language === "ar" ? "دبي" : "Dubai", count: 15 },
    { id: "abudhabi", label: language === "ar" ? "أبوظبي" : "Abu Dhabi", count: 9 },
    { id: "riyadh", label: language === "ar" ? "الرياض" : "Riyadh", count: 12 },
    { id: "jeddah", label: language === "ar" ? "جدة" : "Jeddah", count: 6 },
    { id: "doha", label: language === "ar" ? "الدوحة" : "Doha", count: 8 },
  ];

  const assetTypes = [
    { id: "residential", label: t("property.residential"), labelEn: "Residential", count: 22 },
    { id: "commercial", label: t("property.commercial"), labelEn: "Commercial", count: 18 },
    { id: "industrial", label: t("property.industrial"), labelEn: "Industrial", count: 10 },
    { id: "mixed", label: t("filters.mixedUse"), labelEn: "Mixed Use", count: 8 },
  ];

  const statusOptions = [
    { id: "ready", label: t("filters.readyForYield"), variant: "ready" as const },
    { id: "construction", label: t("filters.underConstruction"), variant: "construction" as const },
    { id: "sold-out", label: t("filters.soldOut"), variant: "sold-out" as const },
  ];

  const riskLevels = [
    { id: "low", label: t("filters.low"), color: "bg-success" },
    { id: "medium", label: t("filters.medium"), color: "bg-warning" },
    { id: "high", label: t("filters.high"), color: "bg-destructive" },
  ];

  const toggleFilter = (list: string[], setList: (val: string[]) => void, id: string) => {
    if (list.includes(id)) {
      setList(list.filter(item => item !== id));
    } else {
      setList([...list, id]);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sticky top-36">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-foreground">{t("filters.filterResults")}</h3>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={onReset}>
          <RotateCcw className="w-3 h-3" />
          {t("filters.reset")}
        </Button>
      </div>

      {/* Country Filter */}
      <FilterSection title={t("filters.country")} titleEn="Country" icon={MapPin}>
        <div className="space-y-2">
          {countries.map((country) => (
            <label
              key={country.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                selectedCountries.includes(country.id) ? "bg-primary/10" : "hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCountries.includes(country.id)}
                  onChange={() => toggleFilter(selectedCountries, setSelectedCountries, country.id)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">{country.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{country.count}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* City Filter */}
      <FilterSection title={t("filters.city")} titleEn="City" icon={Building2} defaultOpen={false}>
        <div className="space-y-2">
          {cities.map((city) => (
            <label
              key={city.id}
              className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">{city.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{city.count}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Asset Type */}
      <FilterSection title={t("filters.assetType")} titleEn="Asset Type" icon={Building2}>
        <div className="flex flex-wrap gap-2">
          {assetTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => toggleFilter(selectedTypes, setSelectedTypes, type.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm transition-colors",
                selectedTypes.includes(type.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Status */}
      <FilterSection title={t("filters.status")} titleEn="Status" icon={Clock}>
        <div className="space-y-2">
          {statusOptions.map((status) => (
            <label
              key={status.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                selectedStatus.includes(status.id) ? "bg-primary/10" : "hover:bg-muted"
              )}
            >
              <input
                type="checkbox"
                checked={selectedStatus.includes(status.id)}
                onChange={() => toggleFilter(selectedStatus, setSelectedStatus, status.id)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <Badge variant={status.variant}>{status.label}</Badge>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Yield / ROI Range */}
      <FilterSection title={t("filters.expectedYield")} titleEn="ROI / Expected Yield" icon={TrendingUp}>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("filters.from")} {yieldRange[0]}%</span>
            <span className="text-muted-foreground">{t("filters.to")} {yieldRange[1]}%</span>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Min</label>
            <input
              type="range"
              min="0"
              max="20"
              value={yieldRange[0]}
              onChange={(e) => setYieldRange([parseInt(e.target.value), yieldRange[1]])}
              className="w-full accent-primary"
            />
            <label className="text-xs text-muted-foreground">Max</label>
            <input
              type="range"
              min="0"
              max="20"
              value={yieldRange[1]}
              onChange={(e) => setYieldRange([yieldRange[0], parseInt(e.target.value)])}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </FilterSection>

      {/* Min Investment */}
      <FilterSection title={t("filters.minInvestment")} titleEn="Min Investment" icon={DollarSign}>
        <div className="grid grid-cols-2 gap-2">
          {[1000, 2500, 5000, 10000, 25000, 50000].map((amount) => (
            <button
              key={amount}
              className={cn(
                "p-2 rounded-lg text-sm transition-colors",
                minInvestment[0] === amount
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
              onClick={() => setMinInvestment([amount, minInvestment[1]])}
            >
              ${amount.toLocaleString()}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Risk Level */}
      <FilterSection title={t("filters.riskLevel")} titleEn="Risk Level" icon={Shield}>
        <div className="flex gap-2">
          {riskLevels.map((risk) => (
            <button
              key={risk.id}
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <span className={cn("w-2 h-2 rounded-full", risk.color)} />
              <span className="text-sm">{risk.label}</span>
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Exit Type */}
      {setSelectedExits && (
        <FilterSection title={language === "ar" ? "نوع التخارج" : "Exit Type"} titleEn="Exit Type" icon={Shield}>
          <div className="flex flex-wrap gap-2">
            {exitTypes.map((e) => (
              <button
                key={e.id}
                onClick={() => toggleFilter(selectedExits || [], setSelectedExits, e.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-colors",
                  (selectedExits || []).includes(e.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Yield Type */}
      {setSelectedYieldTypes && (
        <FilterSection title={language === "ar" ? "نوع العائد" : "Yield Type"} titleEn="Yield Type" icon={TrendingUp}>
          <div className="flex flex-wrap gap-2">
            {yieldTypeOptions.map((y) => (
              <button
                key={y.id}
                onClick={() => toggleFilter(selectedYieldTypes || [], setSelectedYieldTypes, y.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm transition-colors",
                  (selectedYieldTypes || []).includes(y.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-muted/80"
                )}
              >
                {y.label}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      <Button variant="hero" className="w-full mt-6">
        {t("filters.applyFilters")}
      </Button>
    </div>
  );
}
