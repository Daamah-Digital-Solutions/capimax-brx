import { useState, useEffect } from "react";
import { lpApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLiquidityProvider } from "@/hooks/useLiquidityProvider";
import { toast } from "sonner";

// Phase 6 Wave 2: repointed Supabase → Django (apps/lp market). The hook interface
// is UNCHANGED so LPMarket.tsx renders as before. A purchase now settles ON-CHAIN
// server-side (tokens transfer seller→buyer custodial wallet) + moves internal
// balances; the old ledger-only no-token-move bug is fixed. Realtime is replaced by
// refresh-on-mount / after-action / on-focus.

export interface LPMarketListing {
  id: string;
  investor_id: string;
  lp_id: string | null;
  property_id: string;
  property_name: string;
  token_symbol: string;
  token_amount: number;
  unit_price: number;
  total_value: number;
  platform_fee_percent: number;
  platform_fee_amount: number;
  net_amount: number;
  status: "listed" | "pending" | "completed" | "cancelled" | "expired";
  listed_at: string;
  purchased_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ListAssetData {
  property_id: string;
  property_name: string;
  token_symbol: string;
  token_amount: number;
  unit_price?: number;
}

export function useLPMarket() {
  const { user } = useAuth();
  const { lpProfile } = useLiquidityProvider();
  const [listings, setListings] = useState<LPMarketListing[]>([]);
  const [myListings, setMyListings] = useState<LPMarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isApprovedLP = lpProfile?.status === "approved";

  useEffect(() => {
    if (!user) {
      setListings([]);
      setMyListings([]);
      setLoading(false);
      return;
    }

    fetchListings();

    // Realtime is replaced by a focus/visibility refetch (mirrors the wallet hooks).
    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchListings();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
  }, [user, isApprovedLP]);

  async function fetchListings() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // One call returns both arrays; `listings` (the buyable inventory) is only
      // populated server-side for approved LPs — same gate as before.
      const data = await lpApi.market();
      setMyListings((data.my_listings as LPMarketListing[]) || []);
      setListings((data.listings as LPMarketListing[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  async function listAssetForSale(data: ListAssetData) {
    if (!user) {
      return { success: false, error: "Please log in to list assets" };
    }

    try {
      // The server computes total/fee/net (fee is backend-configurable) and
      // ESCROW-LOCKS the tokens so they can't be double-listed.
      const result = (await lpApi.listAsset({
        property_id: data.property_id,
        property_name: data.property_name,
        token_symbol: data.token_symbol,
        token_amount: data.token_amount,
        // Caller supplies the REAL per-token price (derived from the holding's value);
        // no flat-$100 fallback (that would misprice tokens not worth exactly $100/unit).
        unit_price: data.unit_price,
      })) as LPMarketListing;

      setMyListings([result, ...myListings]);
      toast.success("Asset listed for LP sale successfully!");
      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to list asset";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async function cancelListing(listingId: string) {
    if (!user) {
      return { success: false, error: "Please log in" };
    }

    try {
      const updated = (await lpApi.cancelListing(listingId)) as LPMarketListing;
      setMyListings(myListings.map((l) => (l.id === listingId ? updated : l)));
      toast.success("Listing cancelled successfully");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel listing");
      return { success: false, error: err.message };
    }
  }

  async function purchaseAsset(listingId: string, paymentMethod: string = "lp_balance") {
    if (!user || !lpProfile) {
      return { success: false, error: "LP profile required" };
    }

    if (!isApprovedLP) {
      return { success: false, error: "Only approved LPs can purchase" };
    }

    const listing = listings.find(l => l.id === listingId);
    if (listing && listing.total_value > lpProfile.current_balance) {
      toast.error("Insufficient LP balance");
      return { success: false, error: "Insufficient balance" };
    }

    try {
      // The server runs the ATOMIC settlement: checks + debits the LP balance,
      // credits the seller, TRANSFERS the tokens on-chain seller→buyer, consumes
      // the escrow, and records the holding. Returns the real tx hash.
      await lpApi.purchaseListing(listingId);

      // Remove from available listings (settled) + refresh balances/holdings.
      setListings(listings.filter((l) => l.id !== listingId));
      toast.success("Asset purchased successfully!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to purchase asset");
      return { success: false, error: err.message };
    }
  }

  return {
    listings,
    myListings,
    loading,
    error,
    isApprovedLP,
    listAssetForSale,
    cancelListing,
    purchaseAsset,
    refresh: fetchListings,
  };
}
