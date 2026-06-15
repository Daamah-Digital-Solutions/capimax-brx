import { ArrowRight, ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

export function CTASection() {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />

      <div className="container relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full mb-8 animate-fade-in">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-primary font-medium">{t("cta.badge")}</span>
          </div>

          {/* Headline */}
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {t("cta.title")}
            <span className="block text-gradient-gold mt-2">{t("cta.titleHighlight")}</span>
          </h2>

          {/* Description */}
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {t("cta.subtitle")}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Button 
              variant="hero" 
              size="xl" 
              className="w-full sm:w-auto group"
              onClick={() => navigate("/auth")}
            >
              {t("cta.registerFree")}
              <ArrowIcon className={`w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? "group-hover:-translate-x-1" : ""}`} />
            </Button>
            <Button variant="glass" size="xl" className="w-full sm:w-auto" onClick={() => navigate("/how-it-works")}>
              <Play className={`w-5 h-5 ${isRTL ? "ml-2" : "mr-2"}`} />
              {t("cta.watchHowItWorks")}
            </Button>
          </div>

          {/* Trust Line */}
          <p className="mt-8 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.4s" }}>
            {t("cta.trustLine")}
          </p>
        </div>
      </div>
    </section>
  );
}
