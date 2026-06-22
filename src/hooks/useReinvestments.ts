import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  reinvestmentsApi,
  walletsApi,
  type ReinvestmentRow,
} from "@/integrations/api/client";

// Reinvestments — repointed off Supabase onto Django. A reinvestment is a balance-funded
// buy (spend accrued distribution/sale yield in UserBalance → mint more tokens via the
// normal invest path, payment_method="balance"). This hook reads the self-scoped HISTORY
// + the real available balance. The BUY itself happens at Checkout (the "Pay from balance"
// method); there is no client-side Supabase insert anymore. NO bonus/discount in v1 (a
// deferred product decision). REINVESTMENTS_SURFACE.md.

export type Reinvestment = ReinvestmentRow;

export function useReinvestments() {
  const { user } = useAuth();

  const { data: reinvestments, isLoading } = useQuery({
    queryKey: ["reinvestments", user?.id],
    queryFn: () => reinvestmentsApi.history(),
    enabled: !!user?.id,
  });

  // Real available balance (distribution/sale yield) — replaces the old mock $5000.
  const { data: balance } = useQuery({
    queryKey: ["reinvestments-balance", user?.id],
    queryFn: () => walletsApi.balance(),
    enabled: !!user?.id,
  });

  const totalReinvested =
    reinvestments?.reduce(
      (sum, r) => sum + (r.status === "completed" ? r.source_amount : 0),
      0,
    ) ?? 0;

  // No bonus in v1 (discount_amount is always 0); kept for the History shape.
  const totalBonus =
    reinvestments?.reduce(
      (sum, r) => sum + (r.status === "completed" ? r.discount_amount : 0),
      0,
    ) ?? 0;

  const pendingReinvestments = reinvestments?.filter((r) => r.status === "pending") ?? [];

  return {
    reinvestments,
    isLoading,
    availableBalance: balance?.current_balance ?? 0,
    totalReinvested,
    totalBonus,
    pendingReinvestments,
  };
}
