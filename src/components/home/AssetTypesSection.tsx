import { Building2, Hammer, Calendar, TrendingUp, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export function AssetTypesSection() {
  const { t, isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const assetTypes = [
    {
      icon: Building2,
      titleKey: "assetTypes.readyProperties",
      descriptionKey: "assetTypes.readyPropertiesDesc",
      features: [
        "assetTypes.monthlyQuarterlyYield",
        "assetTypes.preLeased",
        "assetTypes.stableCashflow",
        "assetTypes.lowerRisk",
      ],
      yield: "8-12%",
      yieldLabelKey: "assetTypes.annualYield",
      color: "from-emerald-500/20 to-emerald-500/5",
      borderColor: "border-emerald-500/30",
      badgeVariant: "ready" as const,
    },
    {
      icon: Hammer,
      titleKey: "assetTypes.underConstruction",
      descriptionKey: "assetTypes.underConstructionDesc",
      features: [
        "assetTypes.highCapitalGrowth",
        "assetTypes.regularUpdates",
        "assetTypes.exitOnCompletion",
        "assetTypes.installmentOption",
      ],
      yield: "20-35%",
      yieldLabelKey: "assetTypes.expectedGrowth",
      color: "from-amber-500/20 to-amber-500/5",
      borderColor: "border-amber-500/30",
      badgeVariant: "construction" as const,
    },
    {
      icon: Calendar,
      titleKey: "assetTypes.installmentInvestment",
      descriptionKey: "assetTypes.installmentInvestmentDesc",
      features: [
        "assetTypes.reducedDownPayment",
        "assetTypes.flexibleInstallments",
        "assetTypes.gradualOwnership",
        "assetTypes.noInterest",
      ],
      yield: t("assetTypes.from10Percent"),
      yieldLabelKey: "assetTypes.downPayment",
      color: "from-blue-500/20 to-blue-500/5",
      borderColor: "border-blue-500/30",
      badgeVariant: "info" as const,
    },
    {
      icon: TrendingUp,
      titleKey: "assetTypes.secondaryMarket",
      descriptionKey: "assetTypes.secondaryMarketDesc",
      features: [
        "assetTypes.enhancedLiquidity",
        "assetTypes.marketPricing",
        "assetTypes.earlyExitOptions",
        "assetTypes.investAnytime",
      ],
      yield: t("assetTypes.liquidity"),
      yieldLabelKey: "assetTypes.exitOptions",
      color: "from-purple-500/20 to-purple-500/5",
      borderColor: "border-purple-500/30",
      badgeVariant: "secondary" as const,
    },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="gold" className="mb-4">{t("assetTypes.badge")}</Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("assetTypes.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("assetTypes.subtitle")}
          </p>
        </div>

        {/* Asset Types Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {assetTypes.map((type, index) => (
            <div
              key={index}
              className={`group relative p-6 rounded-2xl border ${type.borderColor} bg-gradient-to-br ${type.color} hover:shadow-lg transition-all duration-300 animate-fade-in`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-5">
                {/* Icon */}
                <div className="w-16 h-16 bg-background/50 rounded-xl flex items-center justify-center shrink-0">
                  <type.icon className="w-8 h-8 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display text-xl font-semibold text-foreground">
                      {t(type.titleKey)}
                    </h3>
                  </div>
                  <p className="text-muted-foreground mb-4">{t(type.descriptionKey)}</p>

                  {/* Features */}
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {type.features.map((featureKey, fIndex) => (
                      <div key={fIndex} className="flex items-center gap-2 text-sm text-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{t(featureKey)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div>
                      <div className="text-2xl font-bold text-gradient-gold">{type.yield}</div>
                      <div className="text-xs text-muted-foreground">{t(type.yieldLabelKey)}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                      {t("assetTypes.explore")}
                      <ArrowIcon className={`w-4 h-4 ${isRTL ? "mr-1" : "ml-1"}`} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
