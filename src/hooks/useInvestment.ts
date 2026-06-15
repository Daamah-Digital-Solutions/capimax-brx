import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { investmentsApi, type ApiError } from "@/integrations/api/client";

// Phase 3 Wave 2: investments now talk to the Django backend (SPEC §4.1) instead of
// the old Supabase edge function. The server computes amount/price/ownership from the
// REAL property (LOCKED token-economics policy) — the client only sends which property,
// how many tokens, and the payment method.
interface InvestmentData {
  property_id: string; // Property.slug (frontend string id)
  token_amount: number; // whole tokens (1 token == one share)
  payment_method: string;
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
      const message = apiErr?.message || "Failed to process investment";
      const code = (apiErr?.data as { code?: string } | undefined)?.code;
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
