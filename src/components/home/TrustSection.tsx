import { Shield, Blocks, FileCheck, Eye, Lock, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export function TrustSection() {
  const { t } = useLanguage();

  const trustFeatures = [
    {
      icon: Blocks,
      titleKey: "trust.blockchain",
      descriptionKey: "trust.blockchainDesc",
    },
    {
      icon: Shield,
      titleKey: "trust.smartContracts",
      descriptionKey: "trust.smartContractsDesc",
    },
    {
      icon: FileCheck,
      titleKey: "trust.spvStructure",
      descriptionKey: "trust.spvStructureDesc",
    },
    {
      icon: Eye,
      titleKey: "trust.transparentReports",
      descriptionKey: "trust.transparentReportsDesc",
    },
    {
      icon: Lock,
      titleKey: "trust.advancedSecurity",
      descriptionKey: "trust.advancedSecurityDesc",
    },
    {
      icon: Award,
      titleKey: "trust.regulatoryCompliance",
      descriptionKey: "trust.regulatoryComplianceDesc",
    },
  ];

  return (
    <section className="py-20 bg-card/50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      <div className="container relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="gold" className="mb-4">{t("trust.badge")}</Badge>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("trust.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("trust.subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {trustFeatures.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-background rounded-2xl border border-border hover:border-primary/30 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t(feature.titleKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(feature.descriptionKey)}</p>
            </div>
          ))}
        </div>

        {/* Blockchain Verification */}
        <div className="max-w-4xl mx-auto p-6 bg-background rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-20 h-20 bg-gradient-gold rounded-2xl flex items-center justify-center shrink-0 shadow-gold">
              <Blocks className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="flex-1 text-center md:text-start">
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                {t("trust.verifyTitle")}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t("trust.verifySubtitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
                <Button variant="hero" size="sm">
                  {t("trust.viewOnBlockchain")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("trust.address")}: 0x7a23...8f4d
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
