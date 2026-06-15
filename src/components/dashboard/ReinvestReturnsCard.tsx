import { RefreshCw, Percent, TrendingUp, ArrowRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ReinvestReturnsCardProps {
  availableReturns: number;
  totalReinvested?: number;
  totalBonus?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ReinvestReturnsCard({
  availableReturns,
  totalReinvested = 0,
  totalBonus = 0,
  className,
  style,
}: ReinvestReturnsCardProps) {
  const { language, isRTL } = useLanguage();

  const discountPercentage = 5;
  const pronovaBonus = 2;
  const potentialBonus = (availableReturns * discountPercentage) / 100;
  const potentialPronovaBonus = (availableReturns * pronovaBonus) / 100;
  const totalPotentialValue = availableReturns + potentialBonus + potentialPronovaBonus;

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
              {language === "ar" ? "إعادة استثمار العوائد" : "Reinvest Returns"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === "ar" 
                ? "ضاعف أرباحك مع مكافآت إضافية" 
                : "Multiply your earnings with bonus rewards"}
            </p>
          </div>
        </div>
        <Badge variant="gold" className="gap-1">
          <Percent className="w-3 h-3" />
          {discountPercentage}% {language === "ar" ? "مكافأة" : "Bonus"}
        </Badge>
      </div>

      {/* Available Returns */}
      <div className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {language === "ar" ? "العوائد المتاحة للاستثمار" : "Available Returns"}
          </span>
          <span className="text-xl font-bold text-gradient-gold">
            ${availableReturns.toLocaleString()}
          </span>
        </div>
        <Progress value={75} className="h-2" />
      </div>

      {/* Bonus Calculation */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-success" />
            <span className="text-sm text-foreground">
              {language === "ar" ? "مكافأة إعادة الاستثمار" : "Reinvestment Bonus"} ({discountPercentage}%)
            </span>
          </div>
          <span className="font-semibold text-success">+${potentialBonus.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground">
              {language === "ar" ? "مكافأة برونوفا" : "Pronova Bonus"} ({pronovaBonus}%)
            </span>
          </div>
          <span className="font-semibold text-primary">+${potentialPronovaBonus.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/20 to-success/20 rounded-xl border border-primary/30">
          <span className="font-medium text-foreground">
            {language === "ar" ? "إجمالي قيمة الاستثمار" : "Total Investment Value"}
          </span>
          <span className="text-xl font-bold text-gradient-gold">
            ${totalPotentialValue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Stats */}
      {(totalReinvested > 0 || totalBonus > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">
              {language === "ar" ? "إجمالي إعادة الاستثمار" : "Total Reinvested"}
            </div>
            <div className="font-semibold text-foreground">${totalReinvested.toLocaleString()}</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">
              {language === "ar" ? "إجمالي المكافآت" : "Total Bonus Earned"}
            </div>
            <div className="font-semibold text-success">${totalBonus.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* CTA */}
      <Link to="/marketplace">
        <Button variant="hero" className="w-full gap-2">
          <TrendingUp className="w-4 h-4" />
          {language === "ar" ? "إعادة استثمار العوائد الآن" : "Reinvest Returns Now"}
          <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
        </Button>
      </Link>

      {/* Info */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        {language === "ar" 
          ? "احصل على مكافأة 5% + 2% برونوفا عند إعادة استثمار عوائدك"
          : "Get 5% bonus + 2% Pronova reward when reinvesting your returns"}
      </p>
    </div>
  );
}
