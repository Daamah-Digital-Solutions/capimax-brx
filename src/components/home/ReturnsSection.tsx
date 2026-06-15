import { DollarSign, ArrowRight, Clock, TrendingUp, RefreshCw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export function ReturnsSection() {
  const { t } = useLanguage();

  const returnSteps = [
    {
      icon: DollarSign,
      titleKey: "returns.collectRevenue",
      descriptionKey: "returns.collectRevenueDesc",
    },
    {
      icon: Clock,
      titleKey: "returns.calculateShare",
      descriptionKey: "returns.calculateShareDesc",
    },
    {
      icon: Wallet,
      titleKey: "returns.distribution",
      descriptionKey: "returns.distributionDesc",
    },
  ];

  const exitOptions = [
    {
      icon: RefreshCw,
      titleKey: "returns.secondaryMarket",
      descriptionKey: "returns.secondaryMarketDesc",
      available: true,
    },
    {
      icon: TrendingUp,
      titleKey: "returns.projectCompletion",
      descriptionKey: "returns.projectCompletionDesc",
      available: true,
    },
    {
      icon: DollarSign,
      titleKey: "returns.assetLiquidation",
      descriptionKey: "returns.assetLiquidationDesc",
      available: true,
    },
  ];

  return (
    <section className="py-20 bg-card/50">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* How Returns Work */}
          <div className="animate-fade-in">
            <Badge variant="gold" className="mb-4">{t("returns.howReturnsBadge")}</Badge>
            <h2 className="font-display text-3xl font-bold text-foreground mb-6">
              {t("returns.howReturnsTitle")}
            </h2>
            <p className="text-muted-foreground mb-8">
              {t("returns.howReturnsSubtitle")}
            </p>

            {/* Steps */}
            <div className="space-y-6">
              {returnSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t(step.titleKey)}</h4>
                    <p className="text-sm text-muted-foreground">{t(step.descriptionKey)}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* How Exit Works */}
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Badge variant="gold" className="mb-4">{t("returns.exitStrategyBadge")}</Badge>
            <h2 className="font-display text-3xl font-bold text-foreground mb-6">
              {t("returns.exitStrategyTitle")}
            </h2>
            <p className="text-muted-foreground mb-8">
              {t("returns.exitStrategySubtitle")}
            </p>

            {/* Exit Options */}
            <div className="space-y-4">
              {exitOptions.map((option, index) => (
                <div
                  key={index}
                  className="p-5 bg-background rounded-xl border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <option.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">{t(option.titleKey)}</h4>
                        {option.available && (
                          <Badge variant="success" className="text-xs">{t("returns.available")}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{t(option.descriptionKey)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Note */}
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{t("returns.note")}:</strong> {t("returns.noteText")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
