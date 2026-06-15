import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function TestingNotice() {
  const { t, language } = useLanguage();

  return (
    <div
      className="bg-warning/10 border-b border-warning/20 w-full"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="container py-2.5 px-4">
        <div className="flex items-center gap-3 justify-center">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs sm:text-sm text-warning-foreground/90 leading-relaxed text-center">
            <span className="font-semibold">{t("notice.testingLabel")}</span>
            {" "}
            {t("notice.testingMessage")}
          </p>
        </div>
      </div>
    </div>
  );
}
