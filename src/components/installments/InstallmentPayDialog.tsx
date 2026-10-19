import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Loader2,
  AlertTriangle,
  Coins,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  installmentsApi,
  paymentsApi,
  walletsApi,
  type ApiError,
  type InstallmentPlanRow,
} from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { SavedCardPicker } from "@/components/checkout/SavedCardPicker";

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

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20; // ~60s for the webhook/IPN to confirm + settle

/** What the server charges for one row: its amount + installment fee (fee 0 on older plans). */
const rowCharge = (p: InstallmentPlanRow["payments"][number]) => p.charge ?? p.amount;

/** The earliest unpaid row (an overdue one first) — the one the server charges next. */
function nextDueAmount(plan: InstallmentPlanRow): number {
  const row = plan.payments.find(
    (p) => p.type === "installment" && (p.status === "pending" || p.status === "missed"),
  );
  return row ? rowCharge(row) : plan.nextPaymentAmount || plan.installmentAmount;
}

/** Early payoff total = the sum of every still-unpaid installment row (incl. their fees). */
function remainingInstallmentTotal(plan: InstallmentPlanRow): number {
  return plan.payments
    .filter((p) => p.type === "installment" && (p.status === "pending" || p.status === "missed"))
    .reduce((sum, p) => sum + rowCharge(p), 0);
}

// --- Wallet balance (settles at once; off-plan §4) ---------------------------- //
function WalletTab(props: InstallmentPayDialogProps & { amount: number }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    walletsApi
      .balance()
      .then((b) => setBalance(Number(b.current_balance) || 0))
      .catch(() => setBalance(0));
  }, []);

  const enough = balance != null && balance + 1e-9 >= props.amount;

  const handlePay = async () => {
    setBusy(true);
    try {
      await (props.mode === "payoff"
        ? installmentsApi.payoff(props.plan.id, "balance")
        : installmentsApi.payNext(props.plan.id, "balance"));
      toast.success(isArabic ? "تم السداد من المحفظة" : "Paid from your wallet");
      props.onPaid();
      props.onOpenChange(false);
    } catch (err) {
      toast.error((err as ApiError)?.message || (isArabic ? "تعذّر الدفع" : "Payment failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex justify-between p-3 rounded-lg bg-muted text-sm">
        <span className="text-muted-foreground">{isArabic ? "رصيد المحفظة" : "Wallet balance"}</span>
        <span className="font-semibold" dir="ltr">
          {balance == null ? "…" : `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        </span>
      </div>
      {balance != null && !enough && (
        <p className="text-sm text-muted-foreground">
          {isArabic
            ? "الرصيد لا يكفي. اشحن المحفظة وسيُخصم القسط المستحق تلقائيًا، أو ادفع بالبطاقة أو العملات الرقمية."
            : "Not enough balance. Top up your wallet and the due installment is debited automatically, or pay by card or crypto."}{" "}
          <Link to="/wallet" className="text-primary hover:underline">
            {isArabic ? "اشحن المحفظة" : "Top up wallet"}
          </Link>
        </p>
      )}
      <Button variant="hero" size="xl" className="w-full" disabled={busy || !enough} onClick={handlePay}>
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
        {isArabic ? "ادفع من المحفظة" : "Pay from wallet"} ${props.amount.toLocaleString()}
      </Button>
    </div>
  );
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
  const [savedCardId, setSavedCardId] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const startPaid = props.plan.paidInstallments;
      // 1) Start the gated charge — the next due installment, or ALL remaining (payoff).
      const res = await (props.mode === "payoff"
        ? installmentsApi.payoff(props.plan.id, "stripe", undefined, savedCardId)
        : installmentsApi.payNext(props.plan.id, "stripe", undefined, savedCardId));
      if (res.provider !== "stripe") return;
      // 2) Confirm the card DIRECTLY with Stripe (card data never hits our server).
      setPhase("confirming");
      // A saved card is already attached server-side: just confirm (3-D Secure if asked).
      const card = savedCardId ? null : elements.getElement(CardElement);
      if (!savedCardId && !card) return;
      const { error } = savedCardId
        ? await stripe.confirmCardPayment(res.client_secret)
        : await stripe.confirmCardPayment(res.client_secret, { payment_method: { card: card! } });
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
      <SavedCardPicker value={savedCardId} onChange={setSavedCardId} />
      {!savedCardId && (
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
      )}
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

// --- Crypto (NOW Payments hosted invoice) ------------------------------------- //
function CryptoTab(props: InstallmentPayDialogProps & { amount: number }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const [busy, setBusy] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [belowMin, setBelowMin] = useState<number | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (busy) return;
    // Open a tab synchronously (in the gesture) so popup blockers don't eat it; navigate it to
    // the NOW invoice once created. The on-screen button is the reliable fallback.
    const nowTab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    setBusy(true);
    setNotConfigured(false);
    setBelowMin(null);
    try {
      const startPaid = props.plan.paidInstallments;
      const res = await (props.mode === "payoff"
        ? installmentsApi.payoff(props.plan.id, "nowpayments")
        : installmentsApi.payNext(props.plan.id, "nowpayments"));
      if (res.provider !== "nowpayments") {
        nowTab?.close();
        return;
      }
      if (nowTab) nowTab.location.href = res.invoice_url;
      setInvoiceUrl(res.invoice_url);
      const ok = await pollUntilPaid(props.plan.id, startPaid);
      if (ok) {
        toast.success(isArabic ? "تم سداد القسط" : "Installment paid");
        props.onPaid();
        props.onOpenChange(false);
      }
    } catch (err) {
      nowTab?.close();
      const data = (err as ApiError)?.data as { code?: string; min_amount?: number } | undefined;
      if (data?.code === "nowpayments_unconfigured") {
        setNotConfigured(true);
        return;
      }
      if (data?.code === "amount_below_minimum") {
        setBelowMin(Number(data.min_amount) || 0);
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

  if (belowMin !== null) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic
              ? `الحد الأدنى للدفع بالعملات الرقمية حوالي $${belowMin.toLocaleString()}`
              : `The minimum crypto payment is about $${belowMin.toLocaleString()}`}
          </p>
          <p className="text-muted-foreground">
            {isArabic
              ? "جرّب سداد كامل المتبقي دفعة واحدة، أو ادفع بالبطاقة."
              : "Try paying off all remaining at once, or use a card."}
          </p>
        </div>
      </div>
    );
  }

  if (invoiceUrl) {
    return (
      <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {isArabic ? "أكمل الدفع على صفحة NOW Payments" : "Complete your payment on NOW Payments"}
              </p>
              <p className="text-muted-foreground">
                {isArabic
                  ? "افتح الصفحة، اختر العملة وأرسل المبلغ. يُحدَّث القسط تلقائيًا بعد تأكيد الدفع."
                  : "Open the page, pick your coin and pay. The installment updates automatically once the payment confirms."}
              </p>
            </div>
          </div>
        </div>
        <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="block">
          <Button variant="hero" size="xl" className="w-full gap-2">
            <ExternalLink className="w-5 h-5" />
            {isArabic ? "فتح صفحة الدفع (NOW Payments)" : "Open payment page (NOW Payments)"}
          </Button>
        </a>
        <div className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isArabic ? "في انتظار تأكيد الدفع..." : "Waiting for your payment to confirm..."}
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
      <Button variant="hero" size="xl" className="w-full" disabled={busy} onClick={handleGenerate}>
        {busy ? (
          <><Loader2 className="w-5 h-5 animate-spin" />{isArabic ? "جارٍ تجهيز صفحة الدفع..." : "Preparing the payment page..."}</>
        ) : (
          <><Coins className="w-5 h-5" />{isArabic ? "الدفع بالعملات الرقمية" : "Pay with crypto"} ${props.amount.toLocaleString()}</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        {isArabic
          ? "ستُفتح صفحة NOW Payments لاختيار العملة وإتمام الدفع."
          : "The NOW Payments page opens for you to pick a coin and pay."}
      </p>
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
            {(props.plan.feeRate ?? 0) > 0 &&
              (isArabic
                ? ` (شامل رسوم التقسيط ${props.plan.feeRate}%)`
                : ` (incl. ${props.plan.feeRate}% installment fee)`)}
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

        <Tabs defaultValue="wallet" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="wallet">{isArabic ? "المحفظة" : "Wallet"}</TabsTrigger>
            <TabsTrigger value="card">{isArabic ? "بطاقة" : "Card"}</TabsTrigger>
            <TabsTrigger value="crypto">{isArabic ? "عملات رقمية" : "Crypto"}</TabsTrigger>
          </TabsList>
          <TabsContent value="wallet" className="mt-4">
            <WalletTab {...props} amount={amount} />
          </TabsContent>
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
