import { Coins, Wallet, ExternalLink, Percent, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

export function PronovaNovaSection() {
  const { t, isRTL } = useLanguage();

  return (
    <section className="py-16 bg-muted/30">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Pronova Discount Card */}
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-gold opacity-10 blur-3xl" />
            <CardContent className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
                  <Coins className="w-7 h-7 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {t("promo.pronovaTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("promo.pronovaDescription")}
                  </p>
                </div>
              </div>
              
              <div className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/20">
                <div className="flex items-center gap-3">
                  <Percent className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold text-foreground">5% {t("promo.discount")}</p>
                    <p className="text-xs text-muted-foreground">{t("promo.pronovaNote")}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button asChild variant="gold-outline" size="sm">
                  <a href="https://www.pronovacrypto.com" target="_blank" rel="noopener noreferrer">
                    {t("promo.learnMore")}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  1 PRN = 1 USD
                </span>
              </div>
            </CardContent>
          </Card>
          
          {/* Nova Financing Card */}
          <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500 opacity-10 blur-3xl" />
            <CardContent className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shrink-0">
                  <Wallet className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Nova Financing
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t("promo.novaDescription")}
                  </p>
                </div>
              </div>
              
              <div className="bg-emerald-500/10 rounded-xl p-4 mb-6 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-8 h-8 text-emerald-500" />
                  <div>
                    <p className="text-lg font-bold text-foreground">{t("promo.novaHighlight")}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button asChild variant="outline" size="sm" className="border-emerald-500/30 hover:bg-emerald-500/10">
                  <a href="https://www.novadf.com" target="_blank" rel="noopener noreferrer">
                    {t("promo.learnMore")}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("promo.subjectToApproval")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}