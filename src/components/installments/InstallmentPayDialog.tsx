import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  CheckCircle2,
} from "lucide-react";
import {
  installmentsApi,
  paymentsApi,
  type ApiError,
  type InstallmentPlanRow,
  type PayNextNowResult,
} from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Installments Wave C — pay the plan's NEXT due installment through the REAL gated path
// (Stripe card or NOW crypto). The server charges the installment amount; on the confirmed
// webhook/IPN it progressively releases locked→released tokens + credits the owner/broker —
// there is NO new mint here. After confirmation we POLL the plan until the paid count grows,
// then refresh the page. Bilingual EN/AR.

export interface InstallmentPayDialogProps {
  plan: InstallmentPlanRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the installment is confirmed settled (the page refetches). */
  onPaid: () => void;
  /** "next" (default) charges the next due installment; "payoff" clears ALL remaining. */
  mode?: "next" | "payoff";
}

const CRYPTO_OPTIONS = [
  { id: "btc", label: "BTC — Bitcoin", code: "btc", network: "Bitcoin" },
  { id: "eth", label: "ETH — Ethereum", code: "eth", network: "Ethereum" },
  { id: "usdt", label: "USDT — Tether", code: "usdttrc20", network: "Tron (TRC20)" },
  { id: "usdc", label: "USDC — USD Coin", code: "usdcerc20", network: "Ethereum (ERC20)" },
];

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20; // ~60s for the webhook/IPN to confirm + settle

/** First pending installment row's amount (the final row may differ by the rounding cent). */
function nextDueAmount(plan: InstallmentPlanRow): number {
  const row = plan.payments.find((p) => p.type === "installment" && p.status === "pending");
  return row ? row.amount : plan.installmentAmount;
}

/** Early payoff total = the sum of every still-unpaid installment row. */
function remainingInstallmentTotal(plan: InstallmentPlanRow): number {
  return plan.payments
    .filter((p) => p.type === "installment" && (p.status === "pending" || p.status === "missed"))
    .reduce((sum, p) => sum + p.amount, 0);
}

/** Poll the plans list until THIS plan's paid-installment count grows past `startPaid`. */
async function pollUntilPaid(planId: string, startPaid: number): Promise<boolean> {
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    try {
      const data = await installmentsApi.plans();
      const p = data.plans.find((x) => x.id === planId);
      if (p && p.paidInstallments > startPaid) return true;
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false; // webhook slow; the page's focus refetch will catch up
}

// --- Card (Stripe Elements) --------------------------------------------------- //
function CardForm(props: InstallmentPayDialogProps & { amount: number }) {
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
      const startPaid = props.plan.paidInstallments;
      // 1) Start the gated charge — the next due installment, or ALL remaining (payoff).
      const res = await (props.mode === "payoff"
        ? installmentsApi.payoff(props.plan.id, "stripe")
        : installmentsApi.payNext(props.plan.id, "stripe"));
      if (res.provider !== "stripe") return;
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
      // 3) The webhook now settles (release + credit). Poll until the plan advances.
      setPhase("settling");
      const ok = await pollUntilPaid(props.plan.id, startPaid);
      if (ok) {
        toast.success(isArabic ? "تم سداد القسط" : "Installment paid");
        props.onPaid();
        props.onOpenChange(false);
      } else {
        toast.info(
          isArabic
            ? "تم استلام الدفع — يتم تأكيده، حدّث الصفحة بعد قليل."
            : "Payment received — confirming shortly. It will update on refresh.",
        );
        props.onPaid();
        props.onOpenChange(false);
      }
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
                ? isArabic ? "جارٍ تحرير الرموز..." : "Releasing tokens..."
                : isArabic ? "جارٍ المعالجة..." : "Processing..."}
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            {isArabic ? "ادفع" : "Pay"} ${props.amount.toLocaleString()}
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

function CardTab(props: InstallmentPayDialogProps & { amount: number }) {
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
            {isArabic ? "جرّب الدفع بالعملات الرقمية مؤقتًا." : "Please use crypto for now."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <Elements stripe={stripePromise} options={options}>
      <CardForm {...props} />
    </Elements>
  );
}

// --- Crypto (NOW Payments) ---------------------------------------------------- //
function CryptoTab(props: InstallmentPayDialogProps & { amount: number }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const [selected, setSelected] = useState("usdt");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [pay, setPay] = useState<PayNextNowResult | null>(null);
  const option = CRYPTO_OPTIONS.find((c) => c.id === selected);

  const handleGenerate = async () => {
    if (busy || !option) return;
    setBusy(true);
    setNotConfigured(false);
    try {
      const startPaid = props.plan.paidInstallments;
      const res = await (props.mode === "payoff"
        ? installmentsApi.payoff(props.plan.id, "nowpayments", option.code)
        : installmentsApi.payNext(props.plan.id, "nowpayments", option.code));
      if (res.provider !== "nowpayments") return;
      setPay(res);
      const ok = await pollUntilPaid(props.plan.id, startPaid);
      if (ok) {
        toast.success(isArabic ? "تم سداد القسط" : "Installment paid");
        props.onPaid();
        props.onOpenChange(false);
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
      const ok = await pollUntilPaid(props.plan.id, props.plan.paidInstallments);
      if (ok) {
        props.onPaid();
        props.onOpenChange(false);
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
            {isArabic ? "جرّب الدفع بالبطاقة مؤقتًا." : "Please use a card for now."}
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
          <><Coins className="w-5 h-5" />{isArabic ? "الدفع بالعملات الرقمية" : "Pay with crypto"} ${props.amount.toLocaleString()}</>
        )}
      </Button>
    </div>
  );
}

export function InstallmentPayDialog(props: InstallmentPayDialogProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const isPayoff = props.mode === "payoff";
  const amount = isPayoff ? remainingInstallmentTotal(props.plan) : nextDueAmount(props.plan);
  const remainingTokens =
    props.plan.tokenAmount != null && props.plan.releasedTokens != null
      ? props.plan.tokenAmount - props.plan.releasedTokens
      : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isPayoff
              ? isArabic ? "سداد كامل المتبقي" : "Pay off remaining"
              : isArabic ? "سداد القسط" : "Pay installment"}
          </DialogTitle>
          <DialogDescription>
            {isArabic ? props.plan.property : props.plan.propertyEn} — ${amount.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        {/* Honest release context: paying this installment unlocks more tokens. */}
        {remainingTokens != null && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">
              {isArabic
                ? `${props.plan.releasedTokens} من ${props.plan.tokenAmount} رمز محرَّر — يُحرَّر المزيد مع هذا القسط.`
                : `${props.plan.releasedTokens} of ${props.plan.tokenAmount} tokens released — more unlock with this payment.`}
            </span>
          </div>
        )}

        <Tabs defaultValue="card" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="card">{isArabic ? "بطاقة" : "Card"}</TabsTrigger>
            <TabsTrigger value="crypto">{isArabic ? "عملات رقمية" : "Crypto"}</TabsTrigger>
          </TabsList>
          <TabsContent value="card" className="mt-4">
            <CardTab {...props} amount={amount} />
          </TabsContent>
          <TabsContent value="crypto" className="mt-4">
            <CryptoTab {...props} amount={amount} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
