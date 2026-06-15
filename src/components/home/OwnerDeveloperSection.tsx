import { Building2, Users, TrendingUp, Globe, FileCheck, ArrowRight, ArrowLeft, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

export function OwnerDeveloperSection() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const ownerBenefits = [
    { icon: Globe, textKey: "ownerDev.globalInvestors" },
    { icon: TrendingUp, textKey: "ownerDev.fairValuation" },
    { icon: FileCheck, textKey: "ownerDev.professionalManagement" },
    { icon: Users, textKey: "ownerDev.verifiedInvestors" },
  ];

  const developerBenefits = [
    { icon: TrendingUp, textKey: "ownerDev.fastFlexibleFunding" },
    { icon: Users, textKey: "ownerDev.wideInvestorNetwork" },
    { icon: Building2, textKey: "ownerDev.interactiveUpdates" },
    { icon: FileCheck, textKey: "ownerDev.fullCompliance" },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* For Property Owners */}
          <div className="relative p-8 rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border hover:border-primary/30 transition-all duration-300 animate-fade-in">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            
            <Badge variant="gold" className="mb-4">{t("ownerDev.ownerBadge")}</Badge>
            
            <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              {t("ownerDev.ownerTitle")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("ownerDev.ownerSubtitle")}
            </p>

            {/* Benefits */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {ownerBenefits.map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-sm text-foreground">
                  <item.icon className="w-5 h-5 text-primary shrink-0" />
                  <span>{t(item.textKey)}</span>
                </div>
              ))}
            </div>

            <Button variant="hero" size="lg" className="group" onClick={() => navigate("/submit-property")}>
              {t("ownerDev.listPropertyNow")}
              <ArrowIcon className={`w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? "group-hover:-translate-x-1" : ""}`} />
            </Button>
          </div>

          {/* For Developers */}
          <div className="relative p-8 rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border hover:border-primary/30 transition-all duration-300 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="absolute top-0 left-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
            
            <Badge variant="gold" className="mb-4">{t("ownerDev.developerBadge")}</Badge>
            
            <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              {t("ownerDev.developerTitle")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("ownerDev.developerSubtitle")}
            </p>

            {/* Benefits */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {developerBenefits.map((item, index) => (
                <div key={index} className="flex items-center gap-3 text-sm text-foreground">
                  <item.icon className="w-5 h-5 text-primary shrink-0" />
                  <span>{t(item.textKey)}</span>
                </div>
              ))}
            </div>

            <Button variant="hero-outline" size="lg" className="group" onClick={() => navigate("/submit-property")}>
              <Hammer className="w-4 h-4 mr-2" />
              {t("ownerDev.contactDevelopers")}
              <ArrowIcon className={`w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? "group-hover:-translate-x-1" : ""}`} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
