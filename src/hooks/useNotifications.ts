import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { notificationsApi, type ApiNotification } from "@/integrations/api/client";

// Phase 10: in-app notifications from the Django API (GET /api/notifications/). Refetch
// on mount + on focus (same pattern as useDistributions/useOwnershipTokens — NO realtime,
// Supabase realtime was dropped platform-wide). Mutations (mark-read / mark-all / delete)
// optimistically update local state then reconcile the unread count.
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.unreadCount(),
      ]);
      setNotifications(list ?? []);
      setUnreadCount(count?.unread ?? 0);
    } catch {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchAll();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
  }, [fetchAll]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(id);
    } catch {
      fetchAll(); // reconcile on failure
    }
  }, [fetchAll]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      fetchAll();
    }
  }, [fetchAll]);

  const remove = useCallback(async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id)?.read === false;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.delete(id);
    } catch {
      fetchAll();
    }
  }, [notifications, fetchAll]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: fetchAll,
    markRead,
    markAllRead,
    remove,
  };
}

// A lightweight bell-only hook: just the unread count, polled on mount + focus.
export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { unread } = await notificationsApi.unreadCount();
      setUnreadCount(unread ?? 0);
    } catch {
      /* keep last known count */
    }
  }, [user]);

  useEffect(() => {
    fetchCount();
    const refetchOnFocus = () => {
      if (document.visibilityState !== "hidden") fetchCount();
    };
    window.addEventListener("focus", refetchOnFocus);
    document.addEventListener("visibilitychange", refetchOnFocus);
    return () => {
      window.removeEventListener("focus", refetchOnFocus);
      document.removeEventListener("visibilitychange", refetchOnFocus);
    };
  }, [fetchCount]);

  return { unreadCount, refresh: fetchCount };
}
