import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { walletsApi } from "@/integrations/api/client";

// Phase 4: holdings now come from the Django API (GET /api/wallets/{id}/tokens/)
// instead of Supabase + realtime. The shape is identical to the old Supabase row,
// so TokenHoldings renders unchanged. Realtime is replaced by refresh-on-mount +
// refresh-on-action (exposed as refreshTokens) — a deliberate, simpler model.
export interface OwnershipToken {
  id: string;
  wallet_id: string;
  property_id: string;
  property_name: string;
  token_symbol: string;
  token_amount: number;
  token_value_usd: number;
  ownership_percentage: number;
  acquisition_date: string;
  last_distribution_date: string | null;
  total_distributions: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Phase: Portfolio enrichment — Property metadata (token.property_id == Property.slug,
  // joined server-side) + average cost basis. Optional: null when the property is
  // missing/unpublished or no cost record exists (a new/secondary-only holding).
  city?: string | null;
  location?: string | null;
  location_ar?: string | null;
  country?: string | null;
  asset_type?: string | null;
  category?: string | null;
  expected_yield?: number | null;
  image?: string | null;
  images?: string[];
  construction_progress?: number | null;
  exit_eligible?: boolean;
  avg_cost_per_token?: number | null;
  invested_usd?: number | null;
}

export function useOwnershipTokens(walletId: string | null) {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<OwnershipToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);

  useEffect(() => {
    if (!user || !walletId) {
      setTokens([]);
      setLoading(false);
      return;
    }

    fetchTokens();

    // In-session freshness (replaces the old Supabase realtime): refetch when the
    // tab/window regains focus, so holdings reflect a just-completed invest/mint
    // without a manual reload.
    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchTokens();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, walletId]);

  // Calculate totals when tokens change
  useEffect(() => {
    const value = tokens.reduce((sum, token) => sum + Number(token.token_value_usd), 0);
    const count = tokens.reduce((sum, token) => sum + Number(token.token_amount), 0);
    setTotalValue(value);
    setTotalTokens(count);
  }, [tokens]);

  async function fetchTokens() {
    if (!walletId) return;

    setLoading(true);
    setError(null);

    try {
      const data = (await walletsApi.tokens(walletId)) as OwnershipToken[];
      setTokens(data || []);
    } catch {
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  return {
    tokens,
    loading,
    error,
    totalValue,
    totalTokens,
    refreshTokens: fetchTokens,
  };
}
