import { useState, useEffect, useCallback } from "react";
import { supportApi, type SupportTicketRow } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";

// Support tickets — the caller's OWN tickets + the real unresolved count, from the Django
// support domain (GET /api/support/tickets/). Replaces Support.tsx's hardcoded mock array.
// Poll on mount + window focus (the platform-wide no-realtime pattern).

export interface SupportTicketsState {
  tickets: SupportTicketRow[];
  unresolvedCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useSupportTickets(): SupportTicketsState {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setUnresolvedCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await supportApi.tickets();
      setTickets(data.tickets ?? []);
      setUnresolvedCount(data.unresolved_count ?? 0);
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

  return { tickets, unresolvedCount, loading, refresh };
}
