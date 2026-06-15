import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Phase 5 Wave 1: the cosmetic/demo card form (raw PAN/CVV inputs) is REMOVED.
// Real card entry now happens via Stripe Elements in the checkout action area
// (StripeCardCheckout) — the card data goes browser→Stripe directly and never
// touches our server. This panel is just an informational header for the method.
const cardBrands = [
  { id: "visa", name: "Visa", color: "text-info" },
  { id: "mastercard", name: "MC", color: "text-warning" },
  { id: "amex", name: "Amex", color: "text-info" },
];

export function CardPaymentForm() {
  const { t, language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-success/10 border border-success/30 rounded-xl">
        <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-success">
            {isArabic ? "دفع آمن عبر Stripe" : "Secure payment via Stripe"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isArabic
              ? "أدخل بيانات بطاقتك في الحقل الآمن أدناه. تتم معالجة البطاقة مباشرةً عبر Stripe ولا نُخزّن أي بيانات بطاقة."
              : "Enter your card in the secure field below. The card is processed directly by Stripe — we never store card data."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t("payment.acceptedCards")}:</span>
        <div className="flex gap-2">
          {cardBrands.map((brand) => (
            <div key={brand.id} className="px-2 py-1 bg-muted rounded text-xs font-bold">
              <span className={brand.color}>{brand.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-4 h-4" />
        <span>{t("payment.secureTransaction")}</span>
      </div>
    </div>
  );
}
