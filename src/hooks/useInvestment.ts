import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { investmentsApi, type ApiError } from "@/integrations/api/client";

/**
 * Fired when the server refuses a buy because the unit price changed while the page was
 * open (off-plan §3.4.1). The checkout listens, reloads the property and asks the buyer to
 * confirm the new amount. detail: { propertyId, currentPrice }.
 */
export const PRICE_CHANGED_EVENT = "capimax:price-changed";

// Clear EN/AR copy for the off-plan purchase codes (the server text is English-only).
const OFFPLAN_CODE_MESSAGES: Record<string, { en: string; ar: string }> = {
  PRICE_CHANGED: {
    en: "The unit price has just changed. The amounts were updated — please review and confirm again.",
    ar: "تغيّر سعر الوحدة للتو وتم تحديث المبالغ — يرجى مراجعتها والتأكيد مرة أخرى.",
  },
  INSTALLMENTS_ONLY: {
    en: "This property is sold through installment plans only.",
    ar: "هذا العقار متاح بنظام التقسيط فقط.",
  },
  FULL_PAYMENT_ONLY: {
    en: "This property is sold by full payment only.",
    ar: "هذا العقار متاح بالدفع الكامل فقط.",
  },
};

// Phase 3 Wave 2: investments now talk to the Django backend (SPEC §4.1) instead of
// the old Supabase edge function. The server computes amount/price/ownership from the
// REAL property (LOCKED token-economics policy) — the client only sends which property,
// how many tokens, and the payment method.
interface InvestmentData {
  property_id: string; // Property.slug (frontend string id)
  token_amount: number; // whole tokens (1 token == one share)
  payment_method: string;
  // Installments (Wave B): when set, the server charges only the down-payment and
  // mints the full position LOCKED on the confirmed webhook.
  is_installment?: boolean;
  down_payment_percent?: number;
  n_installments?: number;
  frequency?: "monthly" | "quarterly";
  // Off-plan §3.4.1: the unit price shown to the buyer (server refuses if it changed).
  expected_unit_price?: number;
}

interface InvestmentResult {
  success: boolean;
  investment_id?: string;
  tokens_minted?: boolean;
  certificate_generated?: boolean;
  // Machine-readable rejection code (e.g. "kyc_required") so the UI can route the
  // user to the KYC flow instead of showing a raw error. Phase 4 #1.
  code?: string;
  error?: string;
}

export function useInvestment() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function processInvestment(data: InvestmentData): Promise<InvestmentResult> {
    if (!user) {
      setError("Please log in to invest");
      return { success: false, error: "Please log in to invest" };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await investmentsApi.create(data);
      return {
        success: true,
        investment_id: result.investment_id,
        tokens_minted: result.tokens_minted,
        certificate_generated: result.certificate_generated,
      };
    } catch (err) {
      const apiErr = err as ApiError;
      const body = apiErr?.data as { code?: string; current_price?: string } | undefined;
      const code = body?.code;
      const offplan = code ? OFFPLAN_CODE_MESSAGES[code] : undefined;
      const message = offplan
        ? language === "ar" ? offplan.ar : offplan.en
        : apiErr?.message || "Failed to process investment";
      if (code === "PRICE_CHANGED") {
        window.dispatchEvent(
          new CustomEvent(PRICE_CHANGED_EVENT, {
            detail: { propertyId: data.property_id, currentPrice: Number(body?.current_price) },
          }),
        );
      }
      setError(message);
      return { success: false, error: message, code };
    } finally {
      setLoading(false);
    }
  }

  async function mintPendingTokens(investmentId: string): Promise<InvestmentResult> {
    if (!user) {
      setError("Please log in");
      return { success: false, error: "Please log in" };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await investmentsApi.mint(investmentId);
      return { success: result.success, tokens_minted: result.tokens_minted };
    } catch (err) {
      const message = (err as ApiError)?.message || "Failed to mint tokens";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  return {
    processInvestment,
    mintPendingTokens,
    loading,
    error,
  };
}
