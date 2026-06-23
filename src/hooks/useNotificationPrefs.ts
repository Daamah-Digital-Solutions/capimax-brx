import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { notificationsApi, type NotificationPreferences } from "@/integrations/api/client";

// Per-type notification preferences (the Notifications settings column). GET on mount,
// PATCH on each toggle with optimistic update + saved/error feedback. Replaces the
// page's old local-only useState that reset on reload — these now persist server-side.
// In-app only: channel/digest toggles are NOT here (no mailer/SMS/scheduler exists).
export type PrefKey = keyof NotificationPreferences;

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    if (!user) {
      setPrefs(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPrefs(await notificationsApi.preferences());
    } catch {
      setError("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  // Optimistically flip one toggle, PATCH it, and reconcile from the server response.
  // On failure, revert to the prior value.
  const toggle = useCallback(
    async (key: PrefKey, value: boolean) => {
      if (!prefs) return;
      const prev = prefs;
      setPrefs({ ...prefs, [key]: value });
      setSaving(key);
      setError(null);
      try {
        const saved = await notificationsApi.updatePreferences({ [key]: value });
        setPrefs(saved);
      } catch {
        setPrefs(prev); // revert
        setError("Failed to save preference");
      } finally {
        setSaving(null);
      }
    },
    [prefs]
  );

  return { prefs, loading, saving, error, toggle, refresh: fetchPrefs };
}
