import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  loadStripe,
  type Stripe,
  type PaymentRequest,
  type PaymentRequestPaymentMethodEvent,
  type CanMakePaymentResult,
} from "@stripe/stripe-js";
import { Elements, PaymentRequestButtonElement, useStripe } from "@stripe/react-stripe-js";
import { AlertTriangle, Loader2, Lock, Smartphone } from "lucide-react";
import { paymentsApi, type ApiError } from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";

// Apple Pay / Google Pay — REAL wallet payment via Stripe's Payment Request API. Apple/Google
// Pay ride the SAME Stripe PaymentIntent as a card (the buy `create-intent` and the deposit
// `deposit/stripe` views already mint the intent — NO new backend). The card credentials live
// in the wallet, so the PAN never touches our server and the sheet is one tap. Minting/crediting
// stays gated on the Stripe webhook exactly like the card rail.
//
// Honesty, two layers deep:
//   • Stripe keys deferred  → "not configured yet" (never a fake success).
//   • Device/browser can't  → "not available on this device" (feature-detected via
//     paymentRequest.canMakePayment(); Apple Pay ⇒ Safari/Apple, Google Pay ⇒ Chrome/Android).
//
// This component owns ONLY the Stripe mechanics; the caller supplies how to create the
// PaymentIntent (buy vs deposit) and what to do once it's authorized (poll investment/balance).

export interface StripeWalletPayProps {
  /** Which wallet this row offers. Controls the availability filter + the button branding. */
  wallet: "apple" | "google";
  /** Amount in USD (dollars) — drives the wallet sheet total; kept in sync as it changes. */
  amountUSD: number;
  /** Inert until true (terms/risk accepted, property loaded, …). When false a disabled stand-in
   *  is shown so the native sheet can't open before the caller's gating is satisfied. */
  ready?: boolean;
  /** Merchant/line label shown in the wallet sheet. Defaults to "CapiMax BRX". */
  label?: string;
  /** Optional declarations node rendered directly ABOVE the button (parity with the card flow). */
  declarations?: ReactNode;
  /**
   * Create the PaymentIntent server-side and return its client_secret. For a buy this creates
   * the (pending) investment then the intent; for a deposit it starts the gated deposit charge.
   * Return `null` to abort SILENTLY (e.g. the caller already routed to KYC) — no error toast.
   * Throw to signal a real failure (surfaced via onFailed).
   */
  createIntent: () => Promise<string | null>;
  /** Called once Stripe has AUTHORIZED the wallet payment. Do the post-auth work here (poll the
   *  investment/balance until the webhook lands) and report the final result to the parent. */
  onConfirmed: () => Promise<void> | void;
  /** Fired the moment the user authorizes, before the network round-trip (parity with card). */
  onProcessing?: () => void;
  /** Called on any failure with an optional message (already toasted upstream when present). */
  onFailed?: (message?: string) => void;
}

const toCents = (usd: number) => Math.max(0, Math.round((Number(usd) || 0) * 100));

function WalletForm({
  wallet,
  amountUSD,
  ready = true,
  label,
  declarations,
  createIntent,
  onConfirmed,
  onProcessing,
  onFailed,
}: StripeWalletPayProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const stripe = useStripe();
  const [pr, setPr] = useState<PaymentRequest | null>(null);
  const [canPay, setCanPay] = useState<boolean | null>(null); // null = still checking
  const [busy, setBusy] = useState(false);

  const merchantLabel = label ?? "CapiMax BRX";
  const walletName = wallet === "apple" ? "Apple Pay" : "Google Pay";

  // Keep the latest callbacks/flags in a ref so the once-bound Stripe handler always reads
  // fresh values (Stripe event listeners are bound imperatively, outside React's render).
  const live = useRef({ ready, createIntent, onConfirmed, onProcessing, onFailed });
  live.current = { ready, createIntent, onConfirmed, onProcessing, onFailed };

  // 1) Build the payment request + feature-detect this wallet, once Stripe is ready.
  useEffect(() => {
    if (!stripe) return;
    let active = true;
    const request = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: merchantLabel, amount: toCents(amountUSD) },
    });
    request
      .canMakePayment()
      .then((result: CanMakePaymentResult | null) => {
        if (!active) return;
        // Apple Pay ⇒ result.applePay; Google Pay (or a generic Chrome wallet) ⇒ any non-Apple
        // availability. On an Apple device the Google row reports unavailable and vice-versa.
        const ok = wallet === "apple" ? !!result?.applePay : !!result && !result.applePay;
        setCanPay(ok);
        setPr(ok ? request : null);
      })
      .catch(() => active && setCanPay(false));
    return () => {
      active = false;
    };
    // Build once per (stripe, wallet); the amount is synced by the next effect via pr.update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, wallet]);

  // 2) Keep the wallet-sheet total current as the amount changes (units edited, etc.).
  useEffect(() => {
    pr?.update({ total: { label: merchantLabel, amount: toCents(amountUSD) } });
  }, [amountUSD, pr, merchantLabel]);

  // 3) Bind the authorize handler once per payment-request instance.
  useEffect(() => {
    if (!pr || !stripe) return;
    const onMethod = async (ev: PaymentRequestPaymentMethodEvent) => {
      const L = live.current;
      if (!L.ready) {
        ev.complete("fail");
        return;
      }
      L.onProcessing?.();
      setBusy(true);
      try {
        const clientSecret = await L.createIntent();
        if (!clientSecret) {
          ev.complete("fail"); // silent abort (e.g. routed to KYC) — no failure toast
          return;
        }
        // Confirm with the wallet's payment method WITHOUT letting Stripe run next actions yet,
        // so we can close the sheet promptly, then handle any 3-D Secure step ourselves.
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false },
        );
        if (error) {
          ev.complete("fail");
          L.onFailed?.(error.message);
          return;
        }
        ev.complete("success"); // dismiss the native sheet
        if (paymentIntent && paymentIntent.status === "requires_action") {
          const next = await stripe.confirmCardPayment(clientSecret);
          if (next.error) {
            L.onFailed?.(next.error.message);
            return;
          }
        }
        // Authorized → the webhook now completes + mints/credits. Hand off to the caller.
        await L.onConfirmed();
      } catch (e) {
        ev.complete("fail");
        L.onFailed?.((e as ApiError)?.message);
      } finally {
        setBusy(false);
      }
    };
    pr.on("paymentmethod", onMethod);
    return () => {
      pr.off("paymentmethod", onMethod);
    };
  }, [pr, stripe]);

  if (canPay === null) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  // Feature-detect miss → honest "not available on this device" (never a dead button).
  if (!canPay || !pr) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <Smartphone className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic
              ? `${walletName} غير متاح على هذا الجهاز`
              : `${walletName} isn't available on this device`}
          </p>
          <p className="text-muted-foreground">
            {wallet === "apple"
              ? isArabic
                ? "يتطلب Apple Pay متصفح Safari على جهاز Apple مع بطاقة مُضافة. جرّب البطاقة أو العملة الرقمية."
                : "Apple Pay needs Safari on an Apple device with a card set up. Please use Card or Crypto."
              : isArabic
                ? "يتطلب Google Pay متصفح Chrome/جهاز Android مع بطاقة مُضافة. جرّب البطاقة أو العملة الرقمية."
                : "Google Pay needs Chrome / an Android device with a card set up. Please use Card or Crypto."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {declarations}
      {ready ? (
        <div className={busy ? "opacity-60 pointer-events-none" : ""} dir="ltr">
          <PaymentRequestButtonElement
            options={{
              paymentRequest: pr,
              style: { paymentRequestButton: { type: "default", theme: "dark", height: "52px" } },
            }}
          />
        </div>
      ) : (
        // Gate parity with the card flow: until the declarations are accepted the sheet can't open.
        <button
          type="button"
          disabled
          className="w-full h-[52px] rounded-xl bg-muted text-muted-foreground text-sm font-medium opacity-60 cursor-not-allowed"
        >
          {isArabic
            ? "وافق على الإقرارات أعلاه للمتابعة"
            : "Accept the declarations above to continue"}
        </button>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-4 h-4" />
        <span>
          {isArabic
            ? `تتم معالجة الدفع بأمان عبر Stripe و${walletName} — لا نُخزّن بيانات بطاقتك.`
            : `Processed securely by Stripe & ${walletName} — we never store your card details.`}
        </span>
      </div>
    </div>
  );
}

export function StripeWalletPay(props: StripeWalletPayProps) {
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

  // Deferred keys → degrade clearly instead of a fake wallet button.
  if (!configured || !stripePromise) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {isArabic ? "المدفوعات غير مُفعّلة بعد" : "Payments are not configured yet"}
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
      <WalletForm {...props} />
    </Elements>
  );
}
