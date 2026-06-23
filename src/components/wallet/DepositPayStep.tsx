import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
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
import {
  Lock,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Coins,
  RefreshCw,
} from "lucide-react";
import {
  paymentsApi,
  walletsApi,
  type ApiError,
} from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Deposit / top-up payment step — reuses the SAME gated Stripe/NOW machinery as the buy
// flow, but credits the user's internal balance (NO mint). The balance is credited only on
// the confirmed webhook/IPN; here we poll the balance until it rises, then refresh. With no
// provider keys the backend returns 503 → we show an honest "not configured" panel (never a
// silent success). Bilingual EN/AR.

interface DepositPayStepProps {
  method: "card" | "crypto";
  amount: number;
  /** Called once the deposit is confirmed credited (the wallet refetches + dialog closes). */
  onPaid: () => void;
}

const CRYPTO_OPTIONS = [
  { id: "btc", label: "BTC — Bitcoin", code: "btc", network: "Bitcoin" },
  { id: "eth", label: "ETH — Ethereum", code: "eth", network: "Ethereum" },
  { id: "usdt", label: "USDT — Tether", code: "usdttrc20", network: "Tron (TRC20)" },
  { id: "usdc", label: "USDC — USD Coin", code: "usdcerc20", network: "Ethereum (ERC20)" },
];

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20; // ~60s for the webhook/IPN to confirm + credit

/** Poll the balance until it rises above `startBalance` (the credit landed). */
async function pollUntilCredited(startBalance: number): Promise<boolean> {
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    try {
      const bal = await walletsApi.balance();
      if (Number(bal.current_balance) > startBalance) return true;
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false; // webhook slow; the wallet's focus refetch will catch up
}

// --- Card (Stripe Elements) --------------------------------------------------- //
function DepositCardForm({ amount, onPaid }: DepositPayStepProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "confirming" | "settling">("idle");

  const handlePay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const start = Number((await walletsApi.balance().catch(() => ({ current_balance: 0 }))).current_balance) || 0;
      // 1) Start the gated deposit charge (credits balance on the confirmed webhook).
      const res = await paymentsApi.createDepositStripe(amount);
      // 2) Confirm the card DIRECTLY with Stripe (card data never hits our server).
      const card = elements.getElement(CardElement);
      if (!card) return;
      setPhase("confirming");
      const { error } = await stripe.confirmCardPayment(res.client_secret, {
        payment_method: { card },
      });
      if (error) {
        toast.error(error.message || (isArabic ? "فشل الدفع" : "Payment failed"));
        return;
      }
      // 3) The webhook now credits the balance. Poll until it rises.
      setPhase("settling");
      const ok = await pollUntilCredited(start);
      toast[ok ? "success" : "info"](
        ok
          ? isArabic ? "تم إيداع الرصيد" : "Deposit credited"
          : isArabic ? "تم استلام الدفع — يُحدَّث الرصيد قريباً." : "Payment received — your balance will update shortly.",
      );
      onPaid();
    } catch (err) {
      const code = ((err as ApiError)?.data as { code?: string } | undefined)?.code;
      if (code === "stripe_unconfigured") {
        toast.error(isArabic ? "مدفوعات البطاقة غير مُفعّلة بعد." : "Card payments are not configured yet.");
      } else {
        toast.error((err as ApiError)?.message || (isArabic ? "تعذّرت معالجة الدفع" : "Could not process the payment"));
      }
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="p-4 rounded-xl border border-border bg-card" dir="ltr">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: { fontSize: "16px", color: "#e2e8f0", "::placeholder": { color: "#94a3b8" } },
              invalid: { color: "#ef4444" },
            },
          }}
        />
      </div>
      <Button variant="hero" size="xl" className="w-full" disabled={!stripe || busy} onClick={handlePay}>
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {phase === "confirming"
              ? isArabic ? "جارٍ تأكيد الدفع..." : "Confirming payment..."
              : phase === "settling"
                ? isArabic ? "جارٍ إيداع الرصيد..." : "Crediting balance..."
                : isArabic ? "جارٍ المعالجة..." : "Processing..."}
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            {isArabic ? "إيداع" : "Deposit"} ${amount.toLocaleString()}
          </>
        )}
      </Button>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-4 h-4" />
        <span>
          {isArabic
            ? "تتم معالجة بطاقتك بأمان عبر Stripe — لا نُخزّن بيانات بطاقتك."
            : "Your card is processed securely by Stripe — we never store your card details."}
        </span>
      </div>
    </div>
  );
}

function DepositCardTab(props: DepositPayStepProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    paymentsApi
      .stripeConfig()
      .then((cfg) => {
        if (!active) return;
        if (cfg.configured && cfg.publishable_key) {
          setConfigured(true);
          setStripePromise(loadStripe(cfg.publishable_key));
        } else setConfigured(false);
      })
      .catch(() => active && setConfigured(false));
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(() => ({ appearance: { theme: "night" as const } }), []);

  if (configured === null) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!configured || !stripePromise) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic ? "مدفوعات البطاقة غير مُفعّلة بعد" : "Card payments are not configured yet"}
          </p>
          <p className="text-muted-foreground">
            {isArabic ? "جرّب الإيداع بالعملات الرقمية مؤقتًا." : "Please use crypto for now."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise} options={options}>
      <DepositCardForm {...props} />
    </Elements>
  );
}

// --- Crypto (NOW Payments) ---------------------------------------------------- //
function DepositCryptoTab({ amount, onPaid }: DepositPayStepProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const [selected, setSelected] = useState("usdt");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [pay, setPay] = useState<{ pay_address: string; pay_amount: string | null; pay_currency: string } | null>(null);
  const option = CRYPTO_OPTIONS.find((c) => c.id === selected);

  const handleGenerate = async () => {
    if (busy || !option) return;
    setBusy(true);
    setNotConfigured(false);
    try {
      const start = Number((await walletsApi.balance().catch(() => ({ current_balance: 0 }))).current_balance) || 0;
      const res = await paymentsApi.createDepositNow(amount, option.code);
      setPay(res);
      const ok = await pollUntilCredited(start);
      if (ok) {
        toast.success(isArabic ? "تم إيداع الرصيد" : "Deposit credited");
        onPaid();
      }
    } catch (err) {
      const code = ((err as ApiError)?.data as { code?: string } | undefined)?.code;
      if (code === "nowpayments_unconfigured") {
        setNotConfigured(true);
        return;
      }
      toast.error((err as ApiError)?.message || (isArabic ? "تعذّرت معالجة الدفع" : "Could not process the payment"));
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setBusy(true);
    try {
      const start = -1; // any positive balance counts as credited for the recheck
      const ok = await pollUntilCredited(start);
      if (ok) {
        toast.success(isArabic ? "تم إيداع الرصيد" : "Deposit credited");
        onPaid();
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
            {isArabic ? "جرّب الإيداع بالبطاقة مؤقتًا." : "Please use a card for now."}
          </p>
        </div>
      </div>
    );
  }

  if (pay) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-xl">
          <div className="text-sm text-muted-foreground mb-1">{isArabic ? "أرسل بالضبط" : "Send exactly"}:</div>
          <div className="text-2xl font-bold text-foreground" dir="ltr">
            {pay.pay_amount ?? "—"} {pay.pay_currency.toUpperCase()}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={pay.pay_address} size={176} />
          </div>
          <div className="w-full space-y-2">
            <label className="text-sm font-medium text-foreground">{isArabic ? "عنوان الإيداع" : "Deposit address"}</label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-xs break-all" dir="ltr">{pay.pay_address}</div>
              <Button variant="outline" size="icon" onClick={copyAddress} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isArabic ? "في انتظار تأكيد الدفع على الشبكة..." : "Waiting for your payment to confirm on-chain..."}
        </div>
        <Button variant="outline" className="w-full" onClick={recheck} disabled={busy}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {isArabic ? "لقد دفعت — تحقّق من الحالة" : "I've paid — check status"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">{isArabic ? "اختر العملة الرقمية" : "Select cryptocurrency"}</label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CRYPTO_OPTIONS.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {option && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{isArabic ? "الشبكة" : "Network"}:</span>
            <Badge variant="secondary">{option.network}</Badge>
          </div>
        )}
      </div>
      <Button variant="hero" size="xl" className="w-full" disabled={busy} onClick={handleGenerate}>
        {busy ? (
          <><Loader2 className="w-5 h-5 animate-spin" />{isArabic ? "جارٍ إنشاء عنوان الدفع..." : "Generating payment address..."}</>
        ) : (
          <><Coins className="w-5 h-5" />{isArabic ? "الإيداع بالعملات الرقمية" : "Deposit with crypto"} ${amount.toLocaleString()}</>
        )}
      </Button>
    </div>
  );
}

export function DepositPayStep(props: DepositPayStepProps) {
  return props.method === "crypto" ? <DepositCryptoTab {...props} /> : <DepositCardTab {...props} />;
}
