import { Coins, ShieldCheck, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Phase 5 Wave 2: the cosmetic crypto panel (hardcoded rates + a STATIC wallet
// address + placeholder QR) is REMOVED. The REAL flow — currency selection, a real
// NOW Payments deposit address, exact amount, and a real QR — now lives in the
// checkout action area (NowCryptoCheckout). Minting is gated on the NOW IPN.
// `totalAmount` is kept in the prop signature so PaymentMethodSelector is unchanged.
interface CryptoPaymentProps {
  totalAmount: number;
}

export function CryptoPayment(_props: CryptoPaymentProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-success/10 border border-success/30 rounded-xl">
        <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-success">
            {isArabic ? "دفع آمن بالعملات الرقمية عبر NOW Payments" : "Secure crypto payment via NOW Payments"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isArabic
              ? "اختر العملة وأكمل الدفع أدناه. يتم إنشاء عنوان إيداع حقيقي، وتُصدر الرموز بعد تأكيد الدفع على الشبكة."
              : "Choose your coin and complete payment below. A real deposit address is generated, and tokens are minted after your payment confirms on-chain."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="w-4 h-4" />
        <span>BTC · ETH · USDT · USDC</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-4 h-4" />
        <span>
          {isArabic
            ? "لا نحتفظ بأموالك — تذهب مباشرةً إلى حساب المنصة عبر NOW Payments."
            : "We never custody your funds — they settle directly via NOW Payments."}
        </span>
      </div>
    </div>
  );
}
