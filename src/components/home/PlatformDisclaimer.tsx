import { AlertTriangle, Info, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function PlatformDisclaimer() {
  const { t } = useLanguage();

  return (
    <section className="bg-muted/50 border-t border-border py-12">
      <div className="container">
        {/* Platform Definition */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {t("disclaimer.platformDefinition")}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-4xl">
            {t("disclaimer.platformDescription")}
          </p>
        </div>
        
        {/* Mandatory Disclaimer */}
        <div className="bg-background/50 rounded-xl p-6 border border-border">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <h4 className="font-semibold text-foreground">
              {t("disclaimer.importantDisclaimer")}
            </h4>
          </div>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              {t("disclaimer.text1")}
            </p>
            <p>
              {t("disclaimer.text2")}
            </p>
            <p>
              {t("disclaimer.text3")}
            </p>
          </div>
          
          <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>{t("disclaimer.regulationD")}</span>
            </div>
            <span className="text-border">|</span>
            <span>{t("disclaimer.regulationS")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}