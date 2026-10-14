import { useState, useEffect, useCallback } from "react";
import { secondaryMarketApi, walletsApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  // Decision 5: the buyer pays the resale fee on top; older rows were seller-paid.
  fee_payer: "buyer" | "seller";
  buyer_total: number;
  // Off-plan §6: a whole installment plan sold as one position.
  plan_id: string | null;
  is_position: boolean;
  position_value: number | null;
  paid_principal: number | null;
  assumed_principal: number | null;
  position: PositionTerms | null;
  status: "listed" | "pending" | "completed" | "cancelled" | "expired";
  listed_at: string;
  purchased_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** What the buyer of an open position takes over (plan figures, never the seller's own). */
export interface PositionTerms {
  plan_unit_price: number | null;
  price_change_pct: number | null;
  fee_rate: number;
  remaining_installments: number;
  remaining_charge: number;
  first_due_date: string | null;
  overdue_installments: number;
  frequency: "monthly" | "quarterly";
  rows: { sequence: number; due_date: string; amount: number; fee: number; charge: number; overdue: boolean }[];
}

export function useSecondaryMarket() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [feePercent, setFeePercent] = useState(1);
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
      if (typeof market.fee_percent === "number") setFeePercent(market.fee_percent);
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

  async function buyListing(listing: SecondaryListing) {
    // A position is bought at the exact cash + fee the buyer was shown.
    const expected = listing.is_position
      ? { expected_cash: listing.total_value, expected_fee: listing.platform_fee_amount }
      : undefined;
    try {
      await secondaryMarketApi.purchaseListing(listing.id, expected);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      toast.success(
        listing.is_position
          ? isAr ? "تم شراء المركز وانتقلت إليك خطة الأقساط" : "Position bought — the installment plan is now yours"
          : isAr ? "تم الشراء بنجاح" : "Purchased successfully",
      );
      await fetchAll();
      return { success: true };
    } catch (err: any) {
      const code = err?.data?.code;
      if (code === "POSITION_CHANGED") {
        toast.error(
          isAr
            ? "تغيّرت أرقام هذا المركز (ربما سدّد البائع قسطًا). راجع المبلغ الجديد وأكّد مرة أخرى."
            : "This position's figures changed (the seller may have paid an installment). Review the new amount and confirm again.",
        );
        await fetchAll();
      } else {
        toast.error(err?.message || (isAr ? "تعذّر الشراء" : "Failed to purchase"));
      }
      return { success: false, error: err?.message, code };
    }
  }

  async function listPosition(planId: string, pricePerUnit?: number) {
    try {
      const created = (await secondaryMarketApi.listPosition({
        plan_id: planId,
        ...(pricePerUnit ? { price_per_unit: pricePerUnit } : {}),
      })) as SecondaryListing;
      setMyListings((prev) => [created, ...prev]);
      toast.success(isAr ? "تم عرض المركز في السوق الثانوي" : "Position listed on the secondary market");
      return { success: true, data: created };
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "تعذّر عرض المركز" : "Failed to list the position"));
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
    listings, myListings, trades, balance, loading, feePercent,
    listAsset, listPosition, cancelListing, buyListing, withdraw, refresh: fetchAll,
  };
}
