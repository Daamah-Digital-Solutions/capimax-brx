import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, Loader2 } from "lucide-react";
import { paymentsApi, investmentsApi, type ApiError } from "@/integrations/api/client";
import { useInvestment } from "@/hooks/useInvestment";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Phase 5 Wave 1 — REAL card payment via Stripe Elements (chosen over the hosted
// Checkout redirect to PRESERVE the existing in-page checkout UX). The card is
// entered in Stripe's iframe (CardElement), so the PAN/CVV go browser→Stripe
// directly and NEVER touch our server. Minting is gated on the Stripe webhook, so
// after Stripe confirms we POLL the investment until the webhook flips it to
// completed/minted.

export interface StripeCardCheckoutProps {
  propertyId: string;
  tokenAmount: number;
  finalAmount: number;
  /** True only when the terms/risk gating in the parent is satisfied. */
  ready: boolean;
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

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 15; // ~30s for the webhook to confirm + mint

function CardForm(props: StripeCardCheckoutProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const stripe = useStripe();
  const elements = useElements();
  const { processInvestment } = useInvestment();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "confirming">("idle");

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
      // 1) Create the investment (PENDING for card — no mint yet). For an installment
      // the server charges only the down-payment + mints-then-locks on the webhook.
      const created = await processInvestment({
        property_id: props.propertyId,
        token_amount: props.tokenAmount,
        payment_method: "card",
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

      // 2) Create the Stripe PaymentIntent for this investment.
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
            {isArabic ? "ادفع" : "Pay"} ${props.finalAmount.toLocaleString()}
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

export function StripeCardCheckout(props: StripeCardCheckoutProps) {
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
            {isArabic ? "مدفوعات البطاقة غير مُفعّلة بعد" : "Card payments are not configured yet"}
          </p>
          <p className="text-muted-foreground">
            {isArabic
              ? "سيتم تفعيلها عند إضافة مفاتيح Stripe. جرّب طريقة دفع أخرى مؤقتًا."
              : "They activate once Stripe keys are added. Please use another method for now."}
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
