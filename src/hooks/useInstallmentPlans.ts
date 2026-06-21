import { useState, useEffect, useCallback } from "react";
import { installmentsApi, type InstallmentsResponse } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

// Installments Wave A: the investor's REAL installment plans + cent-exact schedules
// (self-scoped GET /api/installments/plans/). READ-ONLY this wave — plans are created by
// a later Checkout wave; "Pay Now" is not yet a real action. Poll on mount + window focus
// (the platform-wide no-realtime pattern).

export interface InstallmentPlansState {
  data: InstallmentsResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: InstallmentsResponse = {
  stats: {
    totalCommitment: 0,
    totalPaid: 0,
    remainingAmount: 0,
    nextPaymentAmount: 0,
    nextPaymentDate: null,
    activePlans: 0,
    completedPlans: 0,
  },
  plans: [],
};

export function useInstallmentPlans(): InstallmentPlansState {
  const { user } = useAuth();
  const [data, setData] = useState<InstallmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await installmentsApi.plans());
    } catch {
      // leave prior data; the page shows its empty state until it loads
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, refresh]);

  return { data, loading, refresh };
}
