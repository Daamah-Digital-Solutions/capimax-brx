import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  TrendingUp,
  Coins,
  MapPin,
  Building,
  HardHat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { propertiesApi } from "@/integrations/api/client";

type PlatformStats = Awaited<ReturnType<typeof propertiesApi.stats>>;

/** Compact USD: $0 / $1.2M / $18.5M / $7.5K — real value, never a marketing constant. */
function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// Each tile binds to a REAL field of /api/properties/stats/. No hardcoded values.
const TILES: {
  icon: typeof Building2;
  key: string;
  labelEn: string;
  get: (s: PlatformStats) => string;
}[] = [
  { icon: Building2, key: "readyProperties", labelEn: "Ready Properties", get: (s) => String(s.ready) },
  { icon: HardHat, key: "underConstruction", labelEn: "Under Construction", get: (s) => String(s.construction) },
  { icon: Users, key: "investors", labelEn: "Investors", get: (s) => s.totalInvestors.toLocaleString() },
  { icon: Building, key: "developers", labelEn: "Developers", get: (s) => String(s.developers) },
  { icon: Coins, key: "totalTokenValue", labelEn: "Total Token Value", get: (s) => formatUsd(s.totalValue) },
  { icon: MapPin, key: "cities", labelEn: "Cities", get: (s) => String(s.cities) },
  { icon: TrendingUp, key: "avgYield", labelEn: "Avg. Yield", get: (s) => `${s.avgYield}%` },
];

export function GlobalStats() {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    propertiesApi
      .stats()
      .then((s) => alive && setStats(s))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="bg-card border-b border-border py-8">
      <div className="container">
        <div className="mb-6">
          <Badge variant="gold" className="mb-2">
            {language === "ar" ? "إحصائيات المنصة / Global Statistics" : "Global Statistics / إحصائيات المنصة"}
          </Badge>
          <h2 className="font-display text-xl font-bold text-foreground">{t("stats.marketOverview")}</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {TILES.map((tile) => (
            <div
              key={tile.key}
              className="group relative p-4 bg-background rounded-xl border border-border hover:border-primary/50 transition-all duration-300"
            >
              {/* Icon */}
              <div className="w-14 h-14 mx-auto mb-3 flex items-center justify-center">
                <tile.icon className="w-6 h-6 text-primary" />
              </div>

              {/* Value — real, loading skeleton, or honest dash on error. Never a fake constant. */}
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground group-hover:text-gradient-gold transition-colors">
                  {error ? (
                    "—"
                  ) : stats ? (
                    tile.get(stats)
                  ) : (
                    <span className="inline-block h-7 w-14 rounded bg-muted animate-pulse align-middle" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {t(`stats.${tile.key}`)}
                </div>
              </div>

              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="text-sm font-medium">{t(`stats.${tile.key}`)}</div>
                <div className="text-xs text-muted-foreground">{tile.labelEn}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
