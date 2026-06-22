import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pwaSettingsApi, type PWASettingsRow } from "@/integrations/api/client";

// PWA settings — repointed off Supabase onto the Django pwaSettingsApi (one of the
// satellite Supabase surfaces). A SINGLETON global-config row: GET is public (the app
// reads its own branding + the install-prompt gate in usePWAInstall.ts), the WRITE is
// admin-only server-side (IsAdminRole → 403 for non-admins). No PII, no secrets.

export type PWASettings = PWASettingsRow;

export function usePWASettings() {
  return useQuery({
    queryKey: ["pwa-settings"],
    queryFn: () => pwaSettingsApi.get(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdatePWASettings() {
  const queryClient = useQueryClient();

  return useMutation({
    // Admin-only on the server; a non-admin save is rejected with 403.
    mutationFn: (settings: Partial<PWASettings>) => pwaSettingsApi.update(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pwa-settings"] });
    },
  });
}
