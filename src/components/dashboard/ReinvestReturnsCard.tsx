import { RefreshCw, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ReinvestReturnsCardProps {
  availableReturns: number;
  // Deprecated/optional: reinvestment bonus + Pronova rewards are a DEFERRED product
  // (no backend, no Pronova token) — these are no longer rendered. Kept optional so
  // existing callers compile; they are intentionally ignored.
  totalReinvested?: number;
  totalBonus?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ReinvestReturnsCard({
  availableReturns,
  className,
  style,
}: ReinvestReturnsCardProps) {
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-primary/10 via-card to-success/5 rounded-2xl border border-primary/30 p-6 animate-fade-in",
        className
      )}
      style={style}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
            <RefreshCw className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {isAr ? "إعادة استثمار العوائد" : "Reinvest Returns"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "أعد استثمار رصيدك في عقارات جديدة"
                : "Put your balance back to work in new properties"}
            </p>
          </div>
        </div>
      </div>

      {/* Available Returns — REAL internal balance */}
      <div className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {isAr ? "العوائد المتاحة للاستثمار" : "Available Returns"}
          </span>
          <span className="text-xl font-bold text-gradient-gold">
            ${availableReturns.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Bonus rewards — deferred product, shown honestly (no fake figures) */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border mb-6">
        <span className="text-sm text-muted-foreground">
          {isAr ? "مكافآت إعادة الاستثمار" : "Reinvestment bonus rewards"}
        </span>
        <Badge variant="secondary">{isAr ? "قريباً" : "Coming soon"}</Badge>
      </div>

      {/* CTA */}
      <Link to="/reinvestment">
        <Button variant="hero" className="w-full gap-2" disabled={availableReturns <= 0}>
          <TrendingUp className="w-4 h-4" />
          {isAr ? "إعادة استثمار العوائد الآن" : "Reinvest Returns Now"}
          <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
        </Button>
      </Link>
    </div>
  );
}
