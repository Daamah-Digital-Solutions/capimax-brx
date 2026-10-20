import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { rolesApi, type RoleKey, type RoleRow } from "@/integrations/api/client";

export const ROLE_LABELS: Record<RoleKey, { en: string; ar: string }> = {
  investor: { en: "Investor", ar: "مستثمر" },
  owner: { en: "Property Owner", ar: "مالك عقار" },
  broker: { en: "Broker", ar: "وسيط" },
  lp: { en: "Liquidity Provider", ar: "مزوّد سيولة" },
  developer: { en: "Developer", ar: "مطوّر عقاري" },
  partner: { en: "Strategic Partner", ar: "شريك استراتيجي" },
};

/** The caller's roles (held / pending / rejected / available) — shared across the app. */
export function useRoles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["roles", user?.id],
    queryFn: rolesApi.overview,
    enabled: !!user,
    staleTime: 30_000,
  });
  const rows: RoleRow[] = query.data?.roles ?? [];
  const status = (role: RoleKey) => rows.find((r) => r.role === role)?.status ?? "available";
  return {
    ...query,
    rows,
    current: query.data?.current,
    isAdmin: !!query.data?.is_admin,
    held: rows.filter((r) => r.status === "active"),
    status,
    holds: (role: RoleKey) => status(role) === "active",
    refresh: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  };
}
