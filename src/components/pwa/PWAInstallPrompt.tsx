import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useOptionalLanguage } from "@/contexts/LanguageContext";

export function PWAInstallPrompt() {
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const { canShowPrompt, promptInstall } = usePWAInstall();
  const language = useOptionalLanguage();
  const t =
    language?.t ??
    ((key: string) => {
      const fallback: Record<string, string> = {
        "pwa.installTitle": "Install app",
        "pwa.installDescription": "Add this app to your home screen for faster access.",
        "pwa.install": "Install",
        "pwa.notNow": "Not now",
      };
      return fallback[key] ?? key;
    });
  const isRTL = language?.isRTL ?? false;
  const isArabic = language?.language === "ar";

  useEffect(() => {
    // Check if user has dismissed the prompt before
    const wasDismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    // Delay showing prompt by 3 seconds
    const timer = setTimeout(() => {
      if (canShowPrompt && !dismissed) {
        setShowPrompt(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [canShowPrompt, dismissed]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      setShowPrompt(false);
    }
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div 
      className={`fixed bottom-4 ${isRTL ? 'left-4' : 'right-4'} z-50 max-w-sm animate-in slide-in-from-bottom-4 duration-300`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="bg-card border border-border rounded-xl p-4 shadow-elevated">
        <div className="flex items-start gap-3">
          <img
            src="/pwa-icon.svg"
            alt="CapiMax BRX"
            className="flex-shrink-0 w-12 h-12 rounded-lg"
          />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              {isArabic ? "ثبّت تطبيق CapiMax BRX" : "Install CapiMax BRX"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isArabic
                ? "أضِف CapiMax BRX إلى شاشتك الرئيسية للوصول الأسرع."
                : "Add CapiMax BRX to your home screen for faster access."}
            </p>
            
            <div className="flex items-center gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleInstall}
                className="gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {t("pwa.install")}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={handleDismiss}
              >
                {t("pwa.notNow")}
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
