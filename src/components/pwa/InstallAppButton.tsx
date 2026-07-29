import { useState } from "react";
import { Download, Share, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useOptionalLanguage } from "@/contexts/LanguageContext";

// Persistent "Install app" affordance — available ANY TIME (unlike the one-shot first-visit
// prompt), mirroring how PropShare keeps a download button in the chrome. When the browser
// captured a native install prompt (Chrome/Edge/Android) it fires it directly; otherwise
// (iOS Safari has no beforeinstallprompt, or the prompt wasn't captured yet) it opens short
// platform-specific "Add to Home Screen" instructions. Renders nothing once installed.

interface InstallAppButtonProps {
  /** Button style; defaults to a compact ghost icon that fits the header. */
  variant?: "ghost" | "outline" | "hero" | "gold-outline";
  /** Show the "Install app" label next to the icon (defaults to sm+ only). */
  showLabel?: boolean;
  className?: string;
}

export function InstallAppButton({
  variant = "ghost",
  showLabel = true,
  className,
}: InstallAppButtonProps) {
  const { isInstalled, isInstallable, promptInstall } = usePWAInstall();
  const language = useOptionalLanguage();
  const isArabic = language?.language === "ar";
  const [showHelp, setShowHelp] = useState(false);

  const isIOS =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  // Already running as an installed app → nothing to offer.
  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await promptInstall();
      if (!ok) setShowHelp(true); // user dismissed or the prompt was unavailable → show help
      return;
    }
    setShowHelp(true); // iOS / prompt not captured → manual instructions
  };

  const label = isArabic ? "تثبيت التطبيق" : "Install app";

  return (
    <>
      <Button
        variant={variant}
        size={showLabel ? "sm" : "icon"}
        onClick={handleClick}
        title={label}
        aria-label={label}
        className={className}
      >
        <Download className="w-4 h-4" />
        {showLabel && <span className="hidden sm:inline">{label}</span>}
      </Button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              {isArabic ? "ثبّت تطبيق CapiMax BRX" : "Install CapiMax BRX"}
            </DialogTitle>
            <DialogDescription>
              {isArabic
                ? "أضِف التطبيق إلى شاشتك الرئيسية للوصول الأسرع — بدون متجر تطبيقات."
                : "Add the app to your home screen for faster access — no app store needed."}
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                  1
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  {isArabic ? "اضغط زر المشاركة" : "Tap the Share button"}
                  <Share className="w-4 h-4 text-primary" />
                  {isArabic ? "في شريط Safari." : "in Safari's toolbar."}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                  2
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  {isArabic ? "اختر" : "Choose"}
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Plus className="w-4 h-4 text-primary" />
                    {isArabic ? "«إضافة إلى الشاشة الرئيسية»." : "“Add to Home Screen”."}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                  3
                </span>
                <span>
                  {isArabic
                    ? "اضغط «إضافة» — سيظهر التطبيق باسم CapiMax BRX وشعاره."
                    : "Tap “Add” — the app appears as CapiMax BRX with its logo."}
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                  1
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  {isArabic ? "افتح قائمة المتصفح" : "Open the browser menu"}
                  <MoreVertical className="w-4 h-4 text-primary" />
                  {isArabic ? "أعلى اليمين." : "(top-right)."}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                  2
                </span>
                <span>
                  {isArabic
                    ? "اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."
                    : "Choose “Install app” or “Add to Home screen”."}
                </span>
              </li>
            </ol>
          )}

          <Button variant="outline" className="w-full mt-2" onClick={() => setShowHelp(false)}>
            {isArabic ? "تمام" : "Got it"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
