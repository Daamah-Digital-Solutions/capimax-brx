import { 
  Coins, 
  Shield, 
  TrendingUp, 
  Eye, 
  RefreshCw, 
  Building2, 
  FileCheck, 
  Blocks,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export function BenefitsSection() {
  const { t, language } = useLanguage();

  const benefits = [
    {
      icon: Coins,
      titleKey: "benefits.fractionalOwnership",
      descriptionKey: "benefits.fractionalOwnershipDesc",
      features: [
        "benefits.noLargeCapital",
        "benefits.easyDiversification",
        "benefits.premiumAccess",
      ],
    },
    {
      icon: Blocks,
      titleKey: "benefits.tokenization",
      descriptionKey: "benefits.tokenizationDesc",
      features: [
        "benefits.verifiedOwnership",
        "benefits.permanentRecord",
        "benefits.instantSettlement",
      ],
    },
    {
      icon: Building2,
      titleKey: "benefits.spvStructure",
      descriptionKey: "benefits.spvStructureDesc",
      features: [
        "benefits.legalSeparation",
        "benefits.riskProtection",
        "benefits.clearGovernance",
      ],
    },
    {
      icon: Eye,
      titleKey: "benefits.fullTransparency",
      descriptionKey: "benefits.fullTransparencyDesc",
      features: [
        "benefits.monthlyReports",
        "benefits.liveData",
        "benefits.independentAudit",
      ],
    },
    {
      icon: RefreshCw,
      titleKey: "benefits.secondaryMarket",
      descriptionKey: "benefits.secondaryMarketDesc",
      features: [
        "benefits.enhancedLiquidity",
        "benefits.transparentPricing",
        "benefits.flexibleExit",
      ],
    },
    {
      icon: Shield,
      titleKey: "benefits.securityCompliance",
      descriptionKey: "benefits.securityComplianceDesc",
      features: [
        "benefits.kycAml",
        "benefits.advancedEncryption",
        "benefits.continuousAudit",
      ],
    },
  ];

  return (
    <section className="py-20 bg-card/50">
      <div className="container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="gold" className="mb-4">{t("benefits.badge")}</Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("benefits.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("benefits.subtitle")}
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="group p-6 bg-card rounded-2xl border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-gold animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <benefit.icon className="w-7 h-7 text-primary" />
              </div>

              {/* Title */}
              <h3 className="font-display text-xl font-semibold text-foreground mb-4">
                {t(benefit.titleKey)}
              </h3>

              {/* Description */}
              <p className="text-muted-foreground mb-5">
                {t(benefit.descriptionKey)}
              </p>

              {/* Features */}
              <ul className="space-y-2">
                {benefit.features.map((featureKey, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{t(featureKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
