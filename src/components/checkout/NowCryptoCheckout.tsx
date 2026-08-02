import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Coins, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
import {
  paymentsApi,
  investmentsApi,
  type ApiError,
} from "@/integrations/api/client";
import { useInvestment } from "@/hooks/useInvestment";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Phase 5 Wave 2 — REAL crypto payment via NOW Payments, using a HOSTED INVOICE. We create a
// NOW invoice for the investment and hand the buyer NOW's own branded page (`invoice_url`),
// where they pick the coin and see the address/QR + countdown + live status. NOW then fires the
// signature-verified IPN (matched back by order_id) and the server mints — we never mint on a
// frontend response. After the link opens we POLL the investment until the IPN flips it to
// completed. Bilingual EN/AR.

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

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_TRIES = 45; // ~3 min auto-poll; a manual "check status" stays after

export function NowCryptoCheckout(props: NowCryptoCheckoutProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const { processInvestment } = useInvestment();

  const [busy, setBusy] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  // NOW enforces a per-currency minimum (a flat ~USD floor). When the charge is below it the
  // server returns `amount_below_minimum` + the figure.
  const [belowMin, setBelowMin] = useState<{ min: number; currency: string } | null>(null);
  const [invoice, setInvoice] = useState<{ url: string; investmentId: string } | null>(null);

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
    if (busy) return;
    // Open a tab synchronously (inside the click gesture) so popup blockers don't eat it; we
    // navigate it to the NOW invoice once it's created. If the browser blocks it, the on-screen
    // "Open payment page" button is the reliable fallback.
    const nowTab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    setBusy(true);
    setNotConfigured(false);
    setBelowMin(null);
    props.onProcessing();
    try {
      // 1) Create the investment (PENDING for crypto — no mint yet). For an installment the
      // server charges only the down-payment + mints-then-locks on the IPN.
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
        nowTab?.close();
        if (created.code === "kyc_required") {
          props.onRouteToKyc();
          return;
        }
        toast.error(created.error || (isArabic ? "فشل إنشاء الاستثمار" : "Could not start the investment"));
        props.onResult({ status: "failed", tokensMinted: false });
        return;
      }

      // 2) Create the NOW hosted invoice → open its page for the buyer.
      const inv = await paymentsApi.createNowInvoice(created.investment_id);
      if (nowTab) nowTab.location.href = inv.invoice_url;
      setInvoice({ url: inv.invoice_url, investmentId: created.investment_id });

      // 3) Wait for the IPN to confirm + mint; poll the investment.
      const minted = await pollUntilComplete(created.investment_id);
      if (minted === null) return; // still awaiting — the "check status" button remains
      props.onResult({ status: "success", tokensMinted: minted });
    } catch (err) {
      nowTab?.close();
      const data = (err as ApiError)?.data as
        | { code?: string; min_amount?: number; currency?: string }
        | undefined;
      if (data?.code === "nowpayments_unconfigured") {
        setNotConfigured(true);
        return; // degrade — don't show a failure modal
      }
      if (data?.code === "amount_below_minimum") {
        setBelowMin({ min: Number(data.min_amount) || 0, currency: data.currency || "usdttrc20" });
        props.onResult({ status: "failed", tokensMinted: false });
        return;
      }
      toast.error((err as ApiError)?.message || (isArabic ? "تعذّرت معالجة الدفع" : "Could not process the payment"));
      props.onResult({ status: "failed", tokensMinted: false });
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      const inv = await investmentsApi.get(invoice.investmentId);
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

  // Below NOW's minimum → tell the buyer the exact floor + let them adjust.
  if (belowMin) {
    return (
      <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {isArabic
                ? `الحد الأدنى للدفع بالعملات الرقمية حوالي $${belowMin.min.toLocaleString()}`
                : `The minimum crypto payment is about $${belowMin.min.toLocaleString()}`}
            </p>
            <p className="text-muted-foreground">
              {isArabic
                ? "زوّد المبلغ أو ادفع بطريقة أخرى (بطاقة/رصيد)."
                : "Increase the amount, or pay with another method (card / balance)."}
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setBelowMin(null)}>
          {isArabic ? "رجوع" : "Back"}
        </Button>
      </div>
    );
  }

  // Invoice created: the buyer completes on NOW's hosted page; we poll for the IPN.
  if (invoice) {
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
                  ? "افتح صفحة الدفع، اختر العملة الرقمية وأرسل المبلغ. تُصدر رموزك تلقائيًا بعد تأكيد الدفع على الشبكة."
                  : "Open the payment page, pick your coin and send the amount. Your tokens are issued automatically once the payment confirms on-chain."}
              </p>
            </div>
          </div>
        </div>

        <a href={invoice.url} target="_blank" rel="noopener noreferrer" className="block">
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

  // Entry: one button that creates the invoice and opens NOW's hosted page.
  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {props.declarations}

      <Button variant="hero" size="xl" className="w-full" disabled={!props.ready || busy} onClick={handleGenerate}>
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isArabic ? "جارٍ تجهيز صفحة الدفع..." : "Preparing the payment page..."}
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
          ? "ستُفتح صفحة NOW Payments لاختيار العملة وإتمام الدفع بأمان. تُصدر الرموز بعد تأكيد الدفع على الشبكة."
          : "The NOW Payments page opens for you to pick a coin and pay securely. Tokens are issued after your payment confirms on-chain."}
      </p>
    </div>
  );
}
