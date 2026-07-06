import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, AlertTriangle, Loader2, Percent } from "lucide-react";
import { paymentsApi, investmentsApi, type ApiError } from "@/integrations/api/client";
import { useInvestment } from "@/hooks/useInvestment";
import { useLanguage } from "@/contexts/LanguageContext";
import { NovaFinancePledgeNotice } from "@/components/legal/NovaFinancePledgeNotice";
import { toast } from "sonner";

// Pronova (temporary rail) — a BRANDED, admin-discounted payment method that settles over the
// SAME Stripe charge as the card method, but is a DISTINCT payment_method end-to-end. The buyer
// pays the DISCOUNTED total via Stripe; the owner is credited the full token value and the
// platform absorbs the discount (server-authoritative — investment.settlement_amount already
// nets it). Deliberately its OWN component (not a flag on StripeCardCheckout): when Pronova (PRN)
// moves on-chain later, only the `createStripeIntent` call below is swapped — the card method is
// never touched.

export interface PronovaCheckoutProps {
  propertyId: string;
  tokenAmount: number;
  /** The DISCOUNTED total the buyer pays (server is authoritative; this must match it). */
  finalAmount: number;
  /** The Pronova discount amount (for the branded breakdown). */
  discount: number;
  /** True only when the terms/risk gating in the parent is satisfied. */
  ready: boolean;
  /** Terms & risk declarations, rendered inline directly ABOVE the Pay button. */
  declarations?: ReactNode;
  onRouteToKyc: () => void;
  onProcessing: () => void;
  onResult: (r: { status: "success" | "failed"; tokensMinted: boolean }) => void;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 15; // ~30s for the webhook to confirm + mint

function PronovaForm(props: PronovaCheckoutProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const stripe = useStripe();
  const elements = useElements();
  const { processInvestment } = useInvestment();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "confirming">("idle");

  const originalAmount = props.finalAmount + props.discount;

  const pollUntilComplete = async (investmentId: string): Promise<boolean> => {
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
    return false; // webhook slow; wallet view will catch up on focus refetch
  };

  const handlePay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    props.onProcessing();
    try {
      // 1) Create the investment as a Pronova buy (PENDING — no mint yet). The server applies
      // the admin-set, platform-absorbed discount to settlement_amount.
      const created = await processInvestment({
        property_id: props.propertyId,
        token_amount: props.tokenAmount,
        payment_method: "pronova",
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

      // 2) Create the Stripe PaymentIntent for this investment (charges the DISCOUNTED
      // settlement_amount). This is the single line a future on-chain-PRN rail replaces.
      const intent = await paymentsApi.createStripeIntent(created.investment_id);

      // 3) Confirm the card DIRECTLY with Stripe (card data never hits our server).
      const card = elements.getElement(CardElement);
      if (!card) {
        props.onResult({ status: "failed", tokensMinted: false });
        return;
      }
      setPhase("confirming");
      const { error } = await stripe.confirmCardPayment(intent.client_secret, {
        payment_method: { card },
      });
      if (error) {
        toast.error(error.message || (isArabic ? "فشل الدفع" : "Payment failed"));
        props.onResult({ status: "failed", tokensMinted: false });
        return;
      }

      // 4) Card confirmed → the webhook now completes + mints. Poll until done.
      const minted = await pollUntilComplete(created.investment_id);
      props.onResult({ status: "success", tokensMinted: minted });
    } catch (err) {
      const msg = (err as ApiError)?.message;
      const code = ((err as ApiError)?.data as { code?: string } | undefined)?.code;
      if (code === "stripe_unconfigured") {
        toast.error(
          isArabic
            ? "مدفوعات البطاقة غير مُفعّلة بعد."
            : "Card payments are not configured yet.",
        );
      } else {
        toast.error(msg || (isArabic ? "تعذّرت معالجة الدفع" : "Could not process the payment"));
      }
      props.onResult({ status: "failed", tokensMinted: false });
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Branded discount header */}
      {props.discount > 0 && (
        <div className="p-4 bg-gradient-to-r from-success/20 to-success/10 rounded-xl border border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-success">
                  {isArabic ? "خصم برونوفا مُطبّق" : "Pronova discount applied"}
                </span>
                <Badge className="bg-success text-success-foreground">
                  {isArabic ? "توفير" : "Save"} ${props.discount.toLocaleString()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isArabic
                  ? "خصم حصري عند الدفع عبر برونوفا — يُطبّق على إجمالي الاستثمار والرسوم."
                  : "Exclusive Pronova discount — applied to your investment + fees."}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-success/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground line-through">
              ${originalAmount.toLocaleString()}
            </span>
            <span className="text-lg font-bold text-gradient-gold">
              ${props.finalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Card entry (settles the discounted total via Stripe) */}
      <div className="p-4 rounded-xl border border-border bg-card" dir="ltr">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "16px",
                color: "#e2e8f0",
                "::placeholder": { color: "#94a3b8" },
              },
              invalid: { color: "#ef4444" },
            },
          }}
        />
      </div>

      {/* Mandatory Pledge / Mortgage Disclosure (shown at the point of payment) */}
      <NovaFinancePledgeNotice variant="compact" />

      {props.declarations}

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!stripe || !props.ready || busy}
        onClick={handlePay}
      >
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {phase === "confirming"
              ? isArabic
                ? "جارٍ تأكيد الدفع..."
                : "Confirming payment..."
              : isArabic
                ? "جارٍ المعالجة..."
                : "Processing..."}
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            {isArabic ? "ادفع عبر برونوفا" : "Pay with Pronova"} ${props.finalAmount.toLocaleString()}
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

export function PronovaCheckout(props: PronovaCheckoutProps) {
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
        } else {
          setConfigured(false);
        }
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

  // Deferred keys → degrade clearly instead of breaking the checkout.
  if (!configured || !stripePromise) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic ? "مدفوعات برونوفا غير مُفعّلة بعد" : "Pronova payments are not configured yet"}
          </p>
          <p className="text-muted-foreground">
            {isArabic
              ? "تُفعّل عند إضافة مفاتيح Stripe. جرّب طريقة دفع أخرى مؤقتًا."
              : "They activate once Stripe keys are added. Please use another method for now."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PronovaForm {...props} />
    </Elements>
  );
}
