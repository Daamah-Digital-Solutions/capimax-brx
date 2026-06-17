import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  distributionsApi,
  type DistributionsResponse,
  type DistributionRow,
  type DistributionByProperty,
} from "@/integrations/api/client";

// Phase 9: the investor Distributions page now reads real payouts from the Django
// API (GET /api/distributions/) instead of the static mock arrays. The response is
// pre-shaped to the exact objects the page renders (summary stats + history rows +
// per-property rollup), so the UI logic is unchanged. Refresh-on-mount +
// refresh-on-focus mirrors the holdings hook (no realtime).
const EMPTY_STATS: DistributionsResponse["stats"] = {
  totalReceived: 0,
  pendingAmount: 0,
  nextPaymentDate: null,
  yearToDate: 0,
  averageMonthly: 0,
  propertiesDistributing: 0,
};

export function useDistributions() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DistributionsResponse["stats"]>(EMPTY_STATS);
  const [distributions, setDistributions] = useState<DistributionRow[]>([]);
  const [byProperty, setByProperty] = useState<DistributionByProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setStats(EMPTY_STATS);
      setDistributions([]);
      setByProperty([]);
      setLoading(false);
      return;
    }

    fetchDistributions();

    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchDistributions();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchDistributions() {
    setLoading(true);
    setError(null);
    try {
      const data = await distributionsApi.list();
      setStats(data.stats ?? EMPTY_STATS);
      setDistributions(data.distributions ?? []);
      setByProperty(data.by_property ?? []);
    } catch {
      setError("Failed to load distributions");
      setStats(EMPTY_STATS);
      setDistributions([]);
      setByProperty([]);
    } finally {
      setLoading(false);
    }
  }

  return {
    stats,
    distributions,
    byProperty,
    loading,
    error,
    refresh: fetchDistributions,
  };
}
