import { RefreshCw, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ReinvestmentBannerProps {
  availableReturns: number;
  className?: string;
}

export function ReinvestmentBanner({ availableReturns, className }: ReinvestmentBannerProps) {
  const { language, isRTL } = useLanguage();

  if (availableReturns <= 0) return null;

  const bonusAmount = (availableReturns * 5) / 100;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-success p-6",
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-foreground rounded-full blur-2xl" />
      </div>

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-foreground/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display text-lg font-semibold text-primary-foreground">
                {language === "ar" ? "إعادة استثمار العوائد" : "Reinvest Your Returns"}
              </h3>
              <Sparkles className="w-4 h-4 text-warning" />
            </div>
            <p className="text-primary-foreground/80 text-sm">
              {language === "ar" 
                ? `لديك $${availableReturns.toLocaleString()} متاحة - احصل على $${bonusAmount.toLocaleString()} مكافأة!`
                : `You have $${availableReturns.toLocaleString()} available - get $${bonusAmount.toLocaleString()} bonus!`}
            </p>
          </div>
        </div>

        <Link to="/marketplace">
          <Button 
            variant="secondary" 
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 shadow-lg"
          >
            {language === "ar" ? "إعادة الاستثمار الآن" : "Reinvest Now"}
            <ArrowRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
