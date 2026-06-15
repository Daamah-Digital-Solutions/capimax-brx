import { useState, useEffect } from "react";
import { lpApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLiquidityProvider } from "@/hooks/useLiquidityProvider";

// Phase 6 Wave 2: repointed Supabase → Django (apps/lp holdings). Holdings are
// CREATED server-side when a purchase settles on-chain (useLPMarket.purchaseAsset),
// so `recordPurchase` just refreshes. Interface unchanged. Realtime → focus refetch.

export interface LPHolding {
  id: string;
  lp_id: string;
  listing_id: string | null;
  property_id: string;
  property_name: string;
  token_symbol: string;
  token_amount: number;
  purchase_price: number;
  current_value: number;
  purchase_date: string;
  status: "held" | "listed_lp" | "listed_secondary" | "sold";
  listed_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useLPHoldings() {
  const { user } = useAuth();
  const { lpProfile } = useLiquidityProvider();
  const [holdings, setHoldings] = useState<LPHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isApprovedLP = lpProfile?.status === "approved";

  useEffect(() => {
    if (!user || !lpProfile) {
      setHoldings([]);
      setLoading(false);
      return;
    }

    fetchHoldings();

    // Realtime → focus/visibility refetch (mirrors the wallet hooks).
    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchHoldings();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
  }, [user, lpProfile?.id]);

  async function fetchHoldings() {
    if (!lpProfile) return;

    setLoading(true);
    setError(null);

    try {
      const data = (await lpApi.holdings()) as LPHolding[];
      setHoldings(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load holdings");
    } finally {
      setLoading(false);
    }
  }

  async function recordPurchase(data: {
    listing_id: string;
    property_id: string;
    property_name: string;
    token_symbol: string;
    token_amount: number;
    purchase_price: number;
  }) {
    if (!lpProfile || !isApprovedLP) {
      return { success: false, error: "LP profile required" };
    }

    // Holdings are created server-side when a purchase settles on-chain
    // (useLPMarket.purchaseAsset). This just refreshes from the source of truth.
    await fetchHoldings();
    return { success: true };
  }

  async function updateHoldingStatus(
    holdingId: string,
    status: LPHolding["status"],
    listedAt?: string
  ) {
    try {
      const updated = (await lpApi.updateHolding(holdingId, {
        status,
        ...(listedAt ? { listed_at: listedAt } : {}),
      })) as LPHolding;

      setHoldings(holdings.map((h) => (h.id === holdingId ? updated : h)));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Calculate summary stats
  const totalHoldings = holdings.filter(h => h.status === "held").length;
  const totalValue = holdings
    .filter(h => h.status === "held")
    .reduce((sum, h) => sum + h.current_value, 0);
  const totalInvested = holdings
    .filter(h => h.status !== "sold")
    .reduce((sum, h) => sum + h.purchase_price, 0);
  const listedCount = holdings.filter(
    h => h.status === "listed_lp" || h.status === "listed_secondary"
  ).length;

  return {
    holdings,
    loading,
    error,
    isApprovedLP,
    recordPurchase,
    updateHoldingStatus,
    refresh: fetchHoldings,
    stats: {
      totalHoldings,
      totalValue,
      totalInvested,
      listedCount,
    }
  };
}
