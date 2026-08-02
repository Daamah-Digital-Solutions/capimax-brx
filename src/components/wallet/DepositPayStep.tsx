import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { StripeWalletPay } from "@/components/checkout/StripeWalletPay";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Coins,
  RefreshCw,
  Building2,
  Upload,
  FileText,
  X,
  ExternalLink,
  ShieldCheck,
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
  method: "card" | "crypto" | "apple" | "google" | "bank";
  amount: number;
  /** Called once the deposit is confirmed credited (the wallet refetches + dialog closes). */
  onPaid: () => void;
  /**
   * Which balance the top-up funds. "wallet" (default) credits the internal UserBalance;
   * "lp" funds the caller's Liquidity Provider operating balance (LiquidityProvider.
   * current_balance) so an LP can add funds before buying on the LP market.
   */
  target?: "wallet" | "lp";
  /**
   * Reads the CURRENT target balance (to detect the credit landing). Defaults to the
   * wallet balance; the LP deposit passes a reader over the LP profile's current_balance.
   */
  pollBalance?: () => Promise<number>;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20; // ~60s for the webhook/IPN to confirm + credit

type BalanceReader = () => Promise<number>;

/** Default balance reader — the caller's internal wallet UserBalance. */
const walletBalanceReader: BalanceReader = async () =>
  Number((await walletsApi.balance()).current_balance) || 0;

/** Poll the target balance until it rises above `startBalance` (the credit landed). */
async function pollUntilCredited(startBalance: number, readBalance: BalanceReader): Promise<boolean> {
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    try {
      if ((await readBalance()) > startBalance) return true;
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false; // webhook slow; the wallet's focus refetch will catch up
}

// --- Card (Stripe Elements) --------------------------------------------------- //
function DepositCardForm({ amount, onPaid, target = "wallet", pollBalance }: DepositPayStepProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "confirming" | "settling">("idle");
  const readBalance = pollBalance ?? walletBalanceReader;

  const handlePay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const start = await readBalance().catch(() => 0);
      // 1) Start the gated deposit charge (credits balance on the confirmed webhook).
      const res = await paymentsApi.createDepositStripe(amount, target);
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
      const ok = await pollUntilCredited(start, readBalance);
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
function DepositCryptoTab({ amount, onPaid, target = "wallet", pollBalance }: DepositPayStepProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const [busy, setBusy] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [belowMin, setBelowMin] = useState<number | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const readBalance = pollBalance ?? walletBalanceReader;

  const handleGenerate = async () => {
    if (busy) return;
    // Open a tab synchronously (in the gesture) so popup blockers don't eat it; navigate it to
    // the NOW invoice once created. The on-screen button is the reliable fallback.
    const nowTab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    setBusy(true);
    setNotConfigured(false);
    setBelowMin(null);
    try {
      const start = await readBalance().catch(() => 0);
      const res = await paymentsApi.createDepositNowInvoice(amount, target);
      if (nowTab) nowTab.location.href = res.invoice_url;
      setInvoiceUrl(res.invoice_url);
      const ok = await pollUntilCredited(start, readBalance);
      if (ok) {
        toast.success(isArabic ? "تم إيداع الرصيد" : "Deposit credited");
        onPaid();
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
      const start = -1; // any positive balance counts as credited for the recheck
      const ok = await pollUntilCredited(start, readBalance);
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

  if (belowMin !== null) {
    return (
      <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {isArabic
                ? `الحد الأدنى للإيداع بالعملات الرقمية حوالي $${belowMin.toLocaleString()}`
                : `The minimum crypto deposit is about $${belowMin.toLocaleString()}`}
            </p>
            <p className="text-muted-foreground">
              {isArabic ? "زوّد المبلغ أو أودِع بالبطاقة." : "Increase the amount, or deposit with a card."}
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setBelowMin(null)}>
          {isArabic ? "رجوع" : "Back"}
        </Button>
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
                {isArabic ? "أكمل الإيداع على صفحة NOW Payments" : "Complete your deposit on NOW Payments"}
              </p>
              <p className="text-muted-foreground">
                {isArabic
                  ? "افتح الصفحة، اختر العملة وأرسل المبلغ. يُضاف رصيدك تلقائيًا بعد تأكيد الدفع."
                  : "Open the page, pick your coin and send the amount. Your balance is credited automatically once the payment confirms."}
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
          <><Coins className="w-5 h-5" />{isArabic ? "الإيداع بالعملات الرقمية" : "Deposit with crypto"} ${amount.toLocaleString()}</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        {isArabic
          ? "ستُفتح صفحة NOW Payments لاختيار العملة وإتمام الدفع. يُضاف الرصيد بعد تأكيد الدفع على الشبكة."
          : "The NOW Payments page opens for you to pick a coin and pay. Your balance is credited after the payment confirms on-chain."}
      </p>
    </div>
  );
}

// --- Apple Pay / Google Pay (Stripe Payment Request) -------------------------- //
// Rides the SAME gated deposit charge as the card tab (paymentsApi.createDepositStripe →
// credited on the confirmed webhook), but the card lives in the wallet so it's one tap. The
// Stripe mechanics + honest "not available on this device" / "not configured" fallbacks live
// in <StripeWalletPay/>; here we only supply how to start the charge and how to detect the credit.
function DepositWalletTab({
  wallet,
  amount,
  onPaid,
  target = "wallet",
  pollBalance,
}: DepositPayStepProps & { wallet: "apple" | "google" }) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const readBalance = pollBalance ?? walletBalanceReader;
  const startRef = useRef(0);

  const createIntent = async (): Promise<string | null> => {
    startRef.current = await readBalance().catch(() => 0);
    const res = await paymentsApi.createDepositStripe(amount, target);
    return res.client_secret;
  };

  const onConfirmed = async () => {
    const ok = await pollUntilCredited(startRef.current, readBalance);
    toast[ok ? "success" : "info"](
      ok
        ? isArabic ? "تم إيداع الرصيد" : "Deposit credited"
        : isArabic ? "تم استلام الدفع — يُحدَّث الرصيد قريباً." : "Payment received — your balance will update shortly.",
    );
    onPaid();
  };

  return (
    <StripeWalletPay
      wallet={wallet}
      amountUSD={amount}
      label={isArabic ? "إيداع كابيماكس BRX" : "CapiMax BRX Deposit"}
      createIntent={createIntent}
      onConfirmed={onConfirmed}
      onFailed={(m) => m && toast.error(m)}
    />
  );
}

// --- Bank transfer (manual, admin-reviewed) ----------------------------------- //
// No automated pay-in rail exists for a bank transfer, so this mirrors the Nova-certificate
// flow: show the platform's receiving account, take a payment proof, and create a PENDING
// deposit an admin reviews + approves (→ balance credited via the SAME gated core). Honest
// "not configured yet" until the operator sets the bank details in the server env.
type BankDetails = Awaited<ReturnType<typeof paymentsApi.bankDepositDetails>>;

function DetailRow({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-foreground truncate" dir="ltr">{value}</span>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 shrink-0"
          onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function DepositBankTab({ amount, onPaid, target = "wallet" }: DepositPayStepProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const fileRef = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    paymentsApi
      .bankDepositDetails()
      .then((d) => active && setDetails(d))
      .catch(() => active && setDetails({ configured: false }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const ok = /\.(pdf|png|jpe?g|webp)$/i.test(f.name) || f.type === "application/pdf" || f.type.startsWith("image/");
    if (!ok) return toast.error(isArabic ? "ارفع PDF أو صورة." : "Upload a PDF or an image.");
    if (f.size > 10 * 1024 * 1024) return toast.error(isArabic ? "الملف كبير جدًا (10 ميغابايت)." : "File too large (10 MB).");
    setFile(f);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const res = await paymentsApi.createBankDeposit(amount, file, target);
      setReference(res.reference);
      toast.success(isArabic ? "تم إرسال طلب الإيداع للمراجعة" : "Deposit submitted for review");
    } catch (err) {
      const code = ((err as ApiError)?.data as { code?: string } | undefined)?.code;
      toast.error(
        code === "bank_unconfigured"
          ? isArabic ? "التحويل البنكي غير مُفعّل بعد." : "Bank transfers are not configured yet."
          : (err as ApiError)?.message || (isArabic ? "تعذّر الإرسال" : "Could not submit the deposit"),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!details?.configured) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic ? "التحويل البنكي غير مُفعّل بعد" : "Bank transfers are not configured yet"}
          </p>
          <p className="text-muted-foreground">
            {isArabic ? "جرّب البطاقة أو العملة الرقمية مؤقتًا." : "Please use a card or crypto for now."}
          </p>
        </div>
      </div>
    );
  }

  // Submitted → awaiting admin review (no credit yet).
  if (reference) {
    return (
      <div className="space-y-4 text-center" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col items-center p-6 rounded-2xl border border-warning/30 bg-warning/5">
          <div className="w-14 h-14 rounded-full bg-warning/20 flex items-center justify-center mb-3">
            <FileText className="w-7 h-7 text-warning" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-1">
            {isArabic ? "الإيداع قيد المراجعة" : "Deposit under review"}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {isArabic
              ? "استلمنا إثبات التحويل. سيراجعه فريقنا ويُضاف الرصيد بعد الموافقة."
              : "We received your transfer proof. Our team will review it and credit your balance once approved."}
          </p>
          <div className="text-xs text-muted-foreground">{isArabic ? "رقم المرجع" : "Reference"}</div>
          <div className="text-base font-bold text-foreground" dir="ltr">{reference}</div>
        </div>
        <Button variant="hero" size="xl" className="w-full" onClick={onPaid}>
          {isArabic ? "تمام" : "Done"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Amount */}
      <div className="p-4 bg-muted rounded-xl flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{isArabic ? "مبلغ الإيداع" : "Deposit amount"}</span>
        <span className="text-lg font-bold text-primary" dir="ltr">${amount.toLocaleString()}</span>
      </div>

      {/* Platform bank account */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {isArabic ? "حوّل إلى حساب المنصة" : "Transfer to the platform account"}
          </span>
        </div>
        <DetailRow label={isArabic ? "البنك" : "Bank"} value={details.bank_name} />
        <DetailRow label={isArabic ? "اسم الحساب" : "Account name"} value={details.account_name} />
        <DetailRow label={isArabic ? "رقم الحساب" : "Account no."} value={details.account_number} />
        <DetailRow label="IBAN" value={details.iban} />
        <DetailRow label="SWIFT" value={details.swift} />
        <DetailRow label={isArabic ? "العنوان" : "Address"} value={details.address} />
      </div>

      <p className="text-xs text-muted-foreground">
        {isArabic
          ? "حوّل المبلغ ثم ارفع صورة/PDF الإيصال. سيراجعه فريقنا ويُضاف الرصيد بعد الموافقة."
          : "Send the transfer, then upload the receipt (image/PDF). Our team reviews it and credits your balance once approved."}
      </p>

      {/* Proof upload */}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/30 rounded-lg">
          <FileText className="w-5 h-5 text-success" />
          <span className="flex-1 text-sm font-medium text-foreground truncate">{file.name}</span>
          <Button
            variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="w-7 h-7" />
            <span className="text-sm font-medium">{isArabic ? "ارفع إثبات التحويل" : "Upload transfer proof"}</span>
            <span className="text-xs">{isArabic ? "PDF أو صورة · حتى 10 ميغابايت" : "PDF or image · up to 10 MB"}</span>
          </div>
        </button>
      )}

      <Button variant="hero" size="xl" className="w-full" disabled={!file || busy} onClick={submit}>
        {busy ? (
          <><Loader2 className="w-5 h-5 animate-spin" />{isArabic ? "جارٍ الإرسال..." : "Submitting..."}</>
        ) : (
          <><FileText className="w-5 h-5" />{isArabic ? "إرسال للمراجعة" : "Submit for review"}</>
        )}
      </Button>
    </div>
  );
}

export function DepositPayStep(props: DepositPayStepProps) {
  if (props.method === "crypto") return <DepositCryptoTab {...props} />;
  if (props.method === "apple" || props.method === "google")
    return <DepositWalletTab {...props} wallet={props.method} />;
  if (props.method === "bank") return <DepositBankTab {...props} />;
  return <DepositCardTab {...props} />;
}
