import { useState, useEffect } from "react";
import { ownerApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Phase 7 Wave A: owner ENTITY verification (business KYB), mirroring
// useLiquidityProvider's KYB subset. The owner self-registers (?role=owner), applies,
// completes KYB via Sumsub (owner business level), and is activated automatically by
// the signed webhook. Until keys land, the form/dev path drives the flow. Property
// submission / earnings are later waves and are NOT part of this hook.

export interface OwnerProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  applied_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  kyb_status: "not_started" | "documents_pending" | "under_review" | "approved" | "rejected";
  business_type: string | null;
  business_registration_number: string | null;
  tax_id: string | null;
  business_address: string | null;
  business_description: string | null;
  kyb_submitted_at: string | null;
  kyb_approved_at: string | null;
  kyb_rejected_at: string | null;
  kyb_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationData {
  company_name?: string;
  contact_name: string;
  email: string;
  phone?: string;
  country?: string;
}

interface KYBData {
  business_type: string;
  business_registration_number: string;
  tax_id?: string;
  business_address: string;
  business_description?: string;
}

export function useOwnerProfile() {
  const { user } = useAuth();
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOwnerProfile(null);
      setLoading(false);
      return;
    }
    fetchOwnerData();
  }, [user]);

  async function fetchOwnerData() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // null when none — same as Supabase .maybeSingle().
      const profile = (await ownerApi.profile()) as OwnerProfile | null;
      setOwnerProfile(profile);
    } catch {
      setError("Failed to load owner profile");
    } finally {
      setLoading(false);
    }
  }

  async function applyAsOwner(data: ApplicationData) {
    if (!user) {
      return { success: false, error: "Please log in to apply" };
    }
    try {
      const result = (await ownerApi.apply({
        company_name: data.company_name || "",
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || "",
        country: data.country || "",
      })) as OwnerProfile;
      setOwnerProfile(result);
      toast.success("Owner application submitted!");
      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to submit application";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async function submitKYB(data: KYBData) {
    if (!user || !ownerProfile) {
      return { success: false, error: "No owner profile found" };
    }
    try {
      const updated = (await ownerApi.submitKYB({
        business_type: data.business_type,
        business_registration_number: data.business_registration_number,
        tax_id: data.tax_id || "",
        business_address: data.business_address,
        business_description: data.business_description || "",
      })) as OwnerProfile;
      setOwnerProfile(updated);
      toast.success("KYB information submitted for review!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to submit KYB");
      return { success: false, error: err.message };
    }
  }

  return {
    ownerProfile,
    loading,
    error,
    applyAsOwner,
    submitKYB,
    refresh: fetchOwnerData,
  };
}
