import { useCallback, useEffect, useState } from "react";
import {
  partnerApi,
  type ApiAssignment,
  type ApiAssignmentEvent,
} from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Phase 11 Wave B: the partner's own assignment / deliverable work portal
// (StrategicPartners.tsx). Mirrors usePartnerProfile/useNotifications: poll on mount +
// window focus (NO realtime — dropped platform-wide), optimistic-free refetch after a
// mutation. NON-EARNING — nothing here touches money.

export function useAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<ApiAssignment[]>([]);
  const [activity, setActivity] = useState<ApiAssignmentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    if (!user) {
      setAssignments([]);
      setActivity([]);
      setLoading(false);
      return;
    }
    try {
      const data = await partnerApi.assignments();
      setAssignments(data.assignments || []);
      setActivity(data.activity || []);
    } catch {
      // A non-partner (or pending KYB) is gated server-side; show an empty portal.
      setAssignments([]);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Refetch when the tab regains focus (poll-on-focus, no realtime).
  useEffect(() => {
    const onFocus = () => fetchAssignments();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchAssignments]);

  async function uploadDeliverable(deliverableId: string, file: File) {
    try {
      await partnerApi.uploadDeliverable(deliverableId, file);
      await fetchAssignments();
      toast.success("File uploaded");
      return { success: true };
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
      return { success: false, error: err?.message };
    }
  }

  async function submitAssignment(assignmentId: string) {
    try {
      await partnerApi.submitAssignment(assignmentId);
      await fetchAssignments();
      toast.success("Submitted for review");
      return { success: true };
    } catch (err: any) {
      toast.error(err?.message || "Submit failed");
      return { success: false, error: err?.message };
    }
  }

  return {
    assignments,
    activity,
    loading,
    refresh: fetchAssignments,
    uploadDeliverable,
    submitAssignment,
  };
}
