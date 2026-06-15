import { useState, useEffect, useCallback } from "react";
import { secondaryMarketApi, walletsApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Phase 6 Wave 3: the REAL investor↔investor peer secondary market (one-shot
// "buy-now" listings). Replaces the old 100% mock order book in SecondaryMarket.tsx.
// A purchase settles ON-CHAIN server-side (tokens transfer seller→buyer) + moves
// internal balances. The bid/ask ORDER BOOK is a deferred, separate wave.

export interface SecondaryListing {
  id: string;
  seller_id: string;
  seller_type: string;
  buyer_id: string | null;
  buyer_type: string;
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

export function useSecondaryMarket() {
  const { user } = useAuth();
  const [listings, setListings] = useState<SecondaryListing[]>([]);
  const [myListings, setMyListings] = useState<SecondaryListing[]>([]);
  const [trades, setTrades] = useState<SecondaryListing[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setListings([]); setMyListings([]); setTrades([]); setBalance(0); setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [market, tradeRows, bal] = await Promise.all([
        secondaryMarketApi.market(),
        secondaryMarketApi.trades().catch(() => []),
        walletsApi.balance().catch(() => ({ current_balance: 0, currency: "USD" })),
      ]);
      setListings((market.listings as SecondaryListing[]) || []);
      setMyListings((market.my_listings as SecondaryListing[]) || []);
      setTrades((tradeRows as SecondaryListing[]) || []);
      setBalance(bal.current_balance || 0);
    } catch {
      /* keep prior state */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
    const onFocus = () => { if (document.visibilityState !== "hidden") fetchAll(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchAll]);

  async function listAsset(data: {
    property_id: string;
    property_name: string;
    token_symbol: string;
    token_amount: number;
    unit_price: number;
  }) {
    try {
      const created = (await secondaryMarketApi.listAsset(data)) as SecondaryListing;
      setMyListings((prev) => [created, ...prev]);
      toast.success("Listed on the secondary market");
      return { success: true, data: created };
    } catch (err: any) {
      toast.error(err?.message || "Failed to list");
      return { success: false, error: err?.message };
    }
  }

  async function cancelListing(listingId: string) {
    try {
      const updated = (await secondaryMarketApi.cancelListing(listingId)) as SecondaryListing;
      setMyListings((prev) => prev.map((l) => (l.id === listingId ? updated : l)));
      toast.success("Listing cancelled");
      return { success: true };
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel");
      return { success: false, error: err?.message };
    }
  }

  async function buyListing(listingId: string) {
    try {
      await secondaryMarketApi.purchaseListing(listingId);
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      toast.success("Purchased successfully");
      await fetchAll();
      return { success: true };
    } catch (err: any) {
      toast.error(err?.message || "Failed to purchase");
      return { success: false, error: err?.message };
    }
  }

  async function withdraw(amount: number, method: "bank" | "crypto", notes?: string) {
    try {
      await walletsApi.requestWithdrawal({ amount, method, notes });
      toast.success("Withdrawal request submitted");
      await fetchAll();
      return { success: true };
    } catch (err: any) {
      toast.error(err?.message || "Failed to withdraw");
      return { success: false, error: err?.message };
    }
  }

  return {
    listings, myListings, trades, balance, loading,
    listAsset, cancelListing, buyListing, withdraw, refresh: fetchAll,
  };
}
