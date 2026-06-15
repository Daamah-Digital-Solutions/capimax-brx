import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PWASettings {
  id: string;
  app_name: string;
  app_short_name: string;
  app_description: string;
  theme_color: string;
  background_color: string;
  install_prompt_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function usePWASettings() {
  return useQuery({
    queryKey: ["pwa-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pwa_settings")
        .select("*")
        .single();

      if (error) throw error;
      return data as PWASettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdatePWASettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<PWASettings>) => {
      const { data: currentSettings } = await supabase
        .from("pwa_settings")
        .select("id")
        .single();

      if (!currentSettings) throw new Error("No PWA settings found");

      const { data, error } = await supabase
        .from("pwa_settings")
        .update(settings)
        .eq("id", currentSettings.id)
        .select()
        .single();

      if (error) throw error;
      return data as PWASettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pwa-settings"] });
    },
  });
}
