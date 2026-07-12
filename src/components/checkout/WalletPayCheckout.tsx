import { useRef, type ReactNode } from "react";
import { StripeWalletPay } from "./StripeWalletPay";
import { paymentsApi, investmentsApi } from "@/integrations/api/client";
import { useInvestment } from "@/hooks/useInvestment";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

// Apple Pay / Google Pay for the BUY flow. It rides the exact same rail as the card checkout —
// create the (pending) investment as a "card" payment, mint a Stripe PaymentIntent for it, then
// let the wallet authorize that intent. Minting stays gated on the Stripe webhook, so after the
// wallet confirms we POLL the investment until the webhook flips it to completed/minted (parity
// with StripeCardCheckout). The Stripe mechanics live in <StripeWalletPay/>; this wrapper only
// supplies "how to create the intent" and "what to do once it's authorized".

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 15; // ~30s for the webhook to confirm + mint

export interface WalletPayCheckoutProps {
  wallet: "apple" | "google";
  propertyId: string;
  tokenAmount: number;
  finalAmount: number;
  /** True only when the terms/risk gating in the parent is satisfied. */
  ready: boolean;
  /** Terms & risk declarations, rendered inline directly ABOVE the wallet button. */
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

export function WalletPayCheckout(props: WalletPayCheckoutProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { processInvestment } = useInvestment();
  // The investment created inside createIntent, read back in onConfirmed for polling.
  const investmentIdRef = useRef<string | null>(null);

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
    return false; // webhook slow; the portfolio's focus refetch will catch up
  };

  const createIntent = async (): Promise<string | null> => {
    // 1) Create the investment (PENDING — the card rail; no mint yet). Installments charge
    //    only the down-payment + the full fee, minted-then-locked on the webhook.
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
        return null; // silent abort — routed to KYC, not a failure
      }
      toast.error(created.error || (isArabic ? "فشل إنشاء الاستثمار" : "Could not start the investment"));
      throw new Error(created.error || "investment_create_failed");
    }
    investmentIdRef.current = created.investment_id;
    // 2) Mint the Stripe PaymentIntent for this investment → the wallet authorizes it.
    const intent = await paymentsApi.createStripeIntent(created.investment_id);
    return intent.client_secret;
  };

  const onConfirmed = async () => {
    const id = investmentIdRef.current;
    const minted = id ? await pollUntilComplete(id) : false;
    props.onResult({ status: "success", tokensMinted: minted });
  };

  const onFailed = (message?: string) => {
    if (message) toast.error(message);
    props.onResult({ status: "failed", tokensMinted: false });
  };

  return (
    <StripeWalletPay
      wallet={props.wallet}
      amountUSD={props.finalAmount}
      ready={props.ready}
      declarations={props.declarations}
      label={isArabic ? "كابيماكس BRX" : "CapiMax BRX"}
      createIntent={createIntent}
      onConfirmed={onConfirmed}
      onProcessing={props.onProcessing}
      onFailed={onFailed}
    />
  );
}
