import { useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Loader2, AlertTriangle, Coins, RefreshCw } from "lucide-react";
import {
  paymentsApi,
  investmentsApi,
  type ApiError,
} from "@/integrations/api/client";
import { useInvestment } from "@/hooks/useInvestment";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Phase 5 Wave 2 — REAL crypto payment via NOW Payments. Replaces the old cosmetic
// CryptoPayment (hardcoded rates + a static 0x7a23… address + placeholder QR). The
// REAL deposit address + exact amount come from NOW; the buyer pays it directly and
// minting is gated on the signature-verified IPN (we never mint on a frontend
// response). After the address is shown we POLL the investment until the IPN flips
// it to completed.

export interface NowCryptoCheckoutProps {
  propertyId: string;
  tokenAmount: number;
  ready: boolean;
  /** Terms & risk declarations, rendered inline directly ABOVE the Pay button. */
  declarations?: ReactNode;
  /** Installments (Wave B): when set, the server charges only the down-payment. */
  installment?: {
    down_payment_percent: number;
    n_installments: number;
    frequency: "monthly" | "quarterly";
  };
  onRouteToKyc: () => void;
  onProcessing: () => void;
  onResult: (r: { status: "success" | "failed"; tokensMinted: boolean }) => void;
}

// User-facing options → the NOW Payments currency code we send. (Codes apply once
// live keys land; the sandbox accepts these too.)
const CRYPTO_OPTIONS = [
  { id: "btc", label: "BTC — Bitcoin", code: "btc", network: "Bitcoin" },
  { id: "eth", label: "ETH — Ethereum", code: "eth", network: "Ethereum" },
  { id: "usdt", label: "USDT — Tether", code: "usdttrc20", network: "Tron (TRC20)" },
  { id: "usdc", label: "USDC — USD Coin", code: "usdcerc20", network: "Ethereum (ERC20)" },
];

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_TRIES = 30; // ~2 min auto-poll; a manual "check status" stays after

export function NowCryptoCheckout(props: NowCryptoCheckoutProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const { processInvestment } = useInvestment();

  const [selected, setSelected] = useState("usdt");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [pay, setPay] = useState<{
    pay_address: string;
    pay_amount: string | null;
    pay_currency: string;
    investment_id: string;
  } | null>(null);

  const option = CRYPTO_OPTIONS.find((c) => c.id === selected);

  const pollUntilComplete = async (investmentId: string): Promise<boolean | null> => {
    for (let i = 0; i < POLL_MAX_TRIES; i++) {
      try {
        const inv = await investmentsApi.get(investmentId);
        if (inv.payment_status === "completed") return inv.tokens_minted;
        if (inv.payment_status === "failed") return false;
      } catch {
        /* transient — keep polling */
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    return null; // not yet confirmed — leave the awaiting UI with a manual check
  };

  const handleGenerate = async () => {
    if (busy || !option) return;
    setBusy(true);
    setNotConfigured(false);
    props.onProcessing();
    try {
      // 1) Create the investment (PENDING for crypto — no mint yet). For an installment
      // the server charges only the down-payment + mints-then-locks on the IPN.
      const created = await processInvestment({
        property_id: props.propertyId,
        token_amount: props.tokenAmount,
        payment_method: "crypto",
        ...(props.installment
          ? {
              is_installment: true,
              down_payment_percent: props.installment.down_payment_percent,
              n_installments: props.installment.n_installments,
              frequency: props.installment.frequency,
            }
          : {}),
      });
      if (!created.success || !created.investment_id) {
        if (created.code === "kyc_required") {
          props.onRouteToKyc();
          return;
        }
        toast.error(created.error || (isArabic ? "فشل إنشاء الاستثمار" : "Could not start the investment"));
        props.onResult({ status: "failed", tokensMinted: false });
        return;
      }

      // 2) Create the NOW payment → real deposit address + amount.
      const np = await paymentsApi.createNowPayment(created.investment_id, option.code);
      setPay({
        pay_address: np.pay_address,
        pay_amount: np.pay_amount,
        pay_currency: np.pay_currency,
        investment_id: created.investment_id,
      });

      // 3) Wait for the IPN to confirm + mint; poll the investment.
      const minted = await pollUntilComplete(created.investment_id);
      if (minted === null) return; // still awaiting — manual check button remains
      props.onResult({ status: "success", tokensMinted: minted });
    } catch (err) {
      const code = ((err as ApiError)?.data as { code?: string } | undefined)?.code;
      if (code === "nowpayments_unconfigured") {
        setNotConfigured(true);
        return; // degrade — don't show a failure modal
      }
      toast.error((err as ApiError)?.message || (isArabic ? "تعذّرت معالجة الدفع" : "Could not process the payment"));
      props.onResult({ status: "failed", tokensMinted: false });
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    if (!pay) return;
    setBusy(true);
    try {
      const inv = await investmentsApi.get(pay.investment_id);
      if (inv.payment_status === "completed") {
        props.onResult({ status: "success", tokensMinted: inv.tokens_minted });
      } else if (inv.payment_status === "failed") {
        props.onResult({ status: "failed", tokensMinted: false });
      } else {
        toast.info(isArabic ? "لم يصل الدفع بعد." : "Payment not received yet.");
      }
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!pay) return;
    await navigator.clipboard.writeText(pay.pay_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (notConfigured) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic ? "مدفوعات العملات الرقمية غير مُفعّلة بعد" : "Crypto payments are not configured yet"}
          </p>
          <p className="text-muted-foreground">
            {isArabic
              ? "سيتم تفعيلها عند إضافة مفاتيح NOW Payments. جرّب طريقة دفع أخرى مؤقتًا."
              : "They activate once NOW Payments keys are added. Please use another method for now."}
          </p>
        </div>
      </div>
    );
  }

  // Awaiting payment: show the REAL address + amount + QR.
  if (pay) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-xl">
          <div className="text-sm text-muted-foreground mb-1">
            {isArabic ? "أرسل بالضبط" : "Send exactly"}:
          </div>
          <div className="text-2xl font-bold text-foreground" dir="ltr">
            {pay.pay_amount ?? "—"} {pay.pay_currency.toUpperCase()}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={pay.pay_address} size={176} />
          </div>
          <div className="w-full space-y-2">
            <label className="text-sm font-medium text-foreground">
              {isArabic ? "عنوان الإيداع" : "Deposit address"}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs break-all" dir="ltr">
                {pay.pay_address}
              </div>
              <Button variant="outline" size="icon" onClick={copyAddress} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isArabic
            ? "في انتظار تأكيد الدفع على الشبكة..."
            : "Waiting for your payment to confirm on-chain..."}
        </div>

        <Button variant="outline" className="w-full" onClick={recheck} disabled={busy}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {isArabic ? "لقد دفعت — تحقّق من الحالة" : "I've paid — check status"}
        </Button>
      </div>
    );
  }

  // Currency selection + generate.
  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {isArabic ? "اختر العملة الرقمية" : "Select cryptocurrency"}
        </label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRYPTO_OPTIONS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {option && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isArabic ? "الشبكة" : "Network"}:
            </span>
            <Badge variant="secondary">{option.network}</Badge>
          </div>
        )}
      </div>

      {props.declarations}

      <Button variant="hero" size="xl" className="w-full" disabled={!props.ready || busy} onClick={handleGenerate}>
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isArabic ? "جارٍ إنشاء عنوان الدفع..." : "Generating payment address..."}
          </>
        ) : (
          <>
            <Coins className="w-5 h-5" />
            {isArabic ? "الدفع بالعملات الرقمية" : "Pay with crypto"}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        {isArabic
          ? "سيتم إنشاء عنوان إيداع حقيقي عبر NOW Payments. تُصدر الرموز بعد تأكيد الدفع على الشبكة."
          : "A real deposit address is generated via NOW Payments. Tokens are minted after your payment confirms on-chain."}
      </p>
    </div>
  );
}
