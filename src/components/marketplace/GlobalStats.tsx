import { 
  Building2, 
  Users, 
  Globe2, 
  TrendingUp, 
  Coins, 
  MapPin, 
  Building, 
  HardHat 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export function GlobalStats() {
  const { t, language } = useLanguage();

  const stats = [
    {
      icon: Building2,
      value: 32,
      label: t("stats.readyProperties"),
      labelEn: "Ready Properties",
      color: "from-emerald-500",
      progress: 75,
    },
    {
      icon: HardHat,
      value: 18,
      label: t("stats.underConstruction"),
      labelEn: "Under Construction",
      color: "from-amber-500",
      progress: 45,
    },
    {
      icon: Users,
      value: "2,847",
      label: t("stats.investors"),
      labelEn: "Investors",
      color: "from-blue-500",
      progress: 82,
    },
    {
      icon: Globe2,
      value: 47,
      label: t("stats.nationalities"),
      labelEn: "Nationalities",
      color: "from-purple-500",
      progress: 60,
    },
    {
      icon: Building,
      value: 12,
      label: t("stats.developers"),
      labelEn: "Developers",
      color: "from-pink-500",
      progress: 35,
    },
    {
      icon: Coins,
      value: "$127M",
      label: t("stats.totalTokenValue"),
      labelEn: "Total Token Value",
      color: "from-primary",
      progress: 90,
    },
    {
      icon: MapPin,
      value: 8,
      label: t("stats.cities"),
      labelEn: "Cities",
      color: "from-teal-500",
      progress: 55,
    },
    {
      icon: TrendingUp,
      value: "9.8%",
      label: t("stats.avgYield"),
      labelEn: "Avg. Yield",
      color: "from-green-500",
      progress: 68,
    },
  ];

  return (
    <section className="bg-card border-b border-border py-8">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Badge variant="gold" className="mb-2">
              {language === "ar" ? "إحصائيات المنصة / Global Statistics" : "Global Statistics / إحصائيات المنصة"}
            </Badge>
            <h2 className="font-display text-xl font-bold text-foreground">{t("stats.marketOverview")}</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
            {t("stats.lastUpdate")}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group relative p-4 bg-background rounded-xl border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Icon with Progress Ring */}
              <div className="relative w-14 h-14 mx-auto mb-3">
                {/* Progress Ring */}
                <svg className="w-14 h-14 -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-muted"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${stat.progress * 1.5} 150`}
                    className={`text-primary transition-all duration-1000`}
                  />
                </svg>
                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
              </div>

              {/* Value */}
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground group-hover:text-gradient-gold transition-colors">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {stat.label}
                </div>
              </div>

              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="text-sm font-medium">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.labelEn}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
