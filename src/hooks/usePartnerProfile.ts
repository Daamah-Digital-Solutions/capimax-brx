import { useState, useEffect } from "react";
import { partnerApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Phase 11 Wave A: partner ENTITY verification (business KYB) + the partner's own
// public-directory details, mirroring useDeveloperProfile's KYB subset. The partner
// self-registers (?role=partner), applies, fills their company/directory details,
// completes KYB via Sumsub (partner business level), and is activated automatically by
// the signed webhook. The partner is a SERVICE VENDOR (NON-EARNING) — no money here.
//
// TWO INDEPENDENT states: `status`/`kyb_status` (verification) and `directory_status`
// (whether the partner appears in the PUBLIC directory — a SEPARATE admin approve/reject
// step). The assignment/deliverable work portal is a later wave (Wave B).

export interface PartnerProfile {
  id: string;
  user_id: string;
  contact_name: string;
  email: string;
  phone: string | null;
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
  // Partner-entered public-directory fields.
  company_name: string | null;
  company_name_ar: string | null;
  category: string | null;
  description: string | null;
  description_ar: string | null;
  logo_url: string | null;
  country: string | null;
  country_ar: string | null;
  website: string | null;
  // The INDEPENDENT public-directory visibility state (admin-controlled).
  directory_status: "pending" | "approved" | "rejected";
  directory_reviewed_at: string | null;
  directory_review_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationData {
  contact_name: string;
  email: string;
  phone?: string;
}

interface DirectoryData {
  company_name?: string;
  company_name_ar?: string;
  category?: string;
  description?: string;
  description_ar?: string;
  logo_url?: string;
  country?: string;
  country_ar?: string;
  website?: string;
}

interface KYBData {
  business_type: string;
  business_registration_number: string;
  tax_id?: string;
  business_address: string;
  business_description?: string;
}

export function usePartnerProfile() {
  const { user } = useAuth();
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPartnerProfile(null);
      setLoading(false);
      return;
    }
    fetchPartnerData();
  }, [user]);

  async function fetchPartnerData() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // null when none — same as Supabase .maybeSingle().
      const profile = (await partnerApi.profile()) as PartnerProfile | null;
      setPartnerProfile(profile);
    } catch {
      setError("Failed to load partner profile");
    } finally {
      setLoading(false);
    }
  }

  async function applyAsPartner(data: ApplicationData & DirectoryData) {
    if (!user) {
      return { success: false, error: "Please log in to apply" };
    }
    try {
      const result = (await partnerApi.apply({
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || "",
        company_name: data.company_name || "",
        company_name_ar: data.company_name_ar || "",
        category: data.category || "",
        description: data.description || "",
        description_ar: data.description_ar || "",
        logo_url: data.logo_url || "",
        country: data.country || "",
        country_ar: data.country_ar || "",
        website: data.website || "",
      })) as PartnerProfile;
      setPartnerProfile(result);
      toast.success("Partner application submitted!");
      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to submit application";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async function updateDirectory(data: DirectoryData) {
    if (!user || !partnerProfile) {
      return { success: false, error: "No partner profile found" };
    }
    try {
      const updated = (await partnerApi.updateDirectory({
        company_name: data.company_name ?? "",
        company_name_ar: data.company_name_ar ?? "",
        category: data.category ?? "",
        description: data.description ?? "",
        description_ar: data.description_ar ?? "",
        logo_url: data.logo_url ?? "",
        country: data.country ?? "",
        country_ar: data.country_ar ?? "",
        website: data.website ?? "",
      })) as PartnerProfile;
      setPartnerProfile(updated);
      toast.success("Directory details saved!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to save directory details");
      return { success: false, error: err.message };
    }
  }

  async function submitKYB(data: KYBData) {
    if (!user || !partnerProfile) {
      return { success: false, error: "No partner profile found" };
    }
    try {
      const updated = (await partnerApi.submitKYB({
        business_type: data.business_type,
        business_registration_number: data.business_registration_number,
        tax_id: data.tax_id || "",
        business_address: data.business_address,
        business_description: data.business_description || "",
      })) as PartnerProfile;
      setPartnerProfile(updated);
      toast.success("KYB information submitted for review!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to submit KYB");
      return { success: false, error: err.message };
    }
  }

  return {
    partnerProfile,
    loading,
    error,
    applyAsPartner,
    updateDirectory,
    submitKYB,
    refresh: fetchPartnerData,
  };
}
