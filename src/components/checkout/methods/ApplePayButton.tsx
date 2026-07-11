import { Smartphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export function ApplePayButton() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  // Check if Apple Pay is available (simplified check)
  const isAppleDevice = /iPhone|iPad|Mac/i.test(navigator.userAgent);

  return (
    <div className="space-y-4">
      {/* Apple Pay Button */}
      <Button
        className="w-full h-14 bg-black hover:bg-black/90 text-white font-semibold text-lg rounded-xl"
        disabled={!isAppleDevice}
      >
        <svg
          className="w-6 h-6 mr-2"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Pay
      </Button>

      {/* Device Compatibility */}
      <div className={`flex items-center gap-2 p-3 rounded-lg ${isAppleDevice ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'}`}>
        {isAppleDevice ? (
          <>
            <Smartphone className="w-5 h-5 text-success" />
            <span className="text-sm text-success">
              {isAr ? "جهازك متوافق مع Apple Pay" : "Your device supports Apple Pay"}
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-warning" />
            <span className="text-sm text-warning">
              {isAr ? "Apple Pay متاح فقط على أجهزة Apple" : "Apple Pay is only available on Apple devices"}
            </span>
          </>
        )}
      </div>

      {/* Info Note */}
      <p className="text-xs text-muted-foreground text-center">
        {isAr
          ? "عند النقر سيتم توجيهك لإتمام الدفع عبر Apple Pay"
          : "You'll be redirected to complete payment with Apple Pay."}
      </p>
    </div>
  );
}
