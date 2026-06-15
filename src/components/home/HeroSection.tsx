import { ArrowRight, ArrowLeft, Building2, Shield, TrendingUp, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-buildings.jpg";

export function HeroSection() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      {/* Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-${isRTL ? 'l' : 'r'} from-background via-background/95 to-background/70`} />
      
      {/* Animated Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s", animationDelay: "2s" }} />
      </div>

      <div className="container relative z-10 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full mb-8 animate-fade-in">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">{t("hero.badge")}</span>
          </div>

          {/* Ecosystem Tagline */}
          <p className="text-base md:text-lg text-primary/90 font-medium mb-4 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "0.05s" }}>
            {t("hero.ecosystemTagline")}
          </p>

          {/* Main Headline */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {t("hero.title1")}
            <span className="block text-gradient-gold mt-2">{t("hero.title2")}</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {t("hero.subtitle")}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Button variant="hero" size="xl" className="w-full sm:w-auto group" onClick={() => navigate("/marketplace")}>
              {t("hero.exploreCTA")}
              <ArrowIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="hero-outline" size="xl" className="w-full sm:w-auto" onClick={() => navigate("/auth")}>
              {t("hero.registerNow")}
            </Button>
          </div>

          {/* Secondary CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Button variant="glass" size="lg" onClick={() => navigate("/submit-property")}>
              <Building2 className="w-4 h-4" />
              {t("hero.listProperty")}
            </Button>
            <Button variant="glass" size="lg" onClick={() => navigate("/submit-property")}>
              {t("hero.forDevelopers")}
            </Button>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: "0.5s" }}>
          {[
            { icon: Building2, value: "+50", labelKey: "hero.properties" },
            { icon: TrendingUp, value: "12%", labelKey: "hero.avgYield" },
            { icon: Shield, value: "100%", labelKey: "hero.transparency" },
            { icon: Coins, value: "$100", labelKey: "hero.minInvestment" },
          ].map((stat, index) => (
            <div key={index} className="text-center p-4 bg-glass rounded-2xl">
              <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
              <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{t(stat.labelKey)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
