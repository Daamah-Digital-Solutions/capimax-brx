import { useState, useEffect, useCallback } from "react";
import { brokerApi, walletsApi, type BrokerCommissions } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

// Phase 12 Wave B: the broker's REAL commission data. Commission is credited server-side
// at the mint/settlement point of a referred investor's primary sale (platform-borne,
// additive), landing in the broker's UserBalance — withdrawable via the existing wallet
// stack. Poll on mount + on window focus (the platform-wide pattern; no realtime).

export interface BrokerCommissionsState {
  data: BrokerCommissions | null;
  balance: number;          // withdrawable UserBalance (USD)
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useBrokerCommissions(): BrokerCommissionsState {
  const { user } = useAuth();
  const isApprovedBroker =
    user?.profile?.role === "broker" && user?.profile?.role_status === "active";
  const [data, setData] = useState<BrokerCommissions | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isApprovedBroker) {
      setData(null);
      setBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [comm, bal] = await Promise.all([
        brokerApi.commissions(),
        walletsApi.balance().catch(() => ({ current_balance: 0, currency: "USD" })),
      ]);
      setData(comm);
      setBalance(Number(bal.current_balance) || 0);
    } catch {
      // leave prior data; the dashboard shows zeros until it loads
    } finally {
      setLoading(false);
    }
  }, [isApprovedBroker]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll on focus (mirrors useAssignments / the platform-wide no-realtime pattern).
  useEffect(() => {
    if (!isApprovedBroker) return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isApprovedBroker, refresh]);

  return { data, balance, loading, refresh };
}
