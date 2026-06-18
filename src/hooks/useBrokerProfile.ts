import { useState, useEffect, useCallback } from "react";
import { brokerApi, kycApi, type BrokerProfile, type KycStatus } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Phase 12 Wave A: broker onboarding — HYBRID verification (identity reuses the EXISTING
// investor KYC surface; the broker-specific half is a professional LICENCE approved by an
// admin) + the broker's referral code/link. The broker self-registers (?role=broker),
// applies, completes personal KYC, uploads a licence, and is activated once the admin
// approves the licence (which requires KYC approved). NO money/commission this wave.

interface ApplicationData {
  contact_name: string;
  email: string;
  phone?: string;
}

interface LicenseData {
  license_number: string;
  license_authority: string;
  license_expiry?: string | null;
}

export function useBrokerProfile() {
  const { user } = useAuth();
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);
  // The shared investor KYC status (identity half), surfaced via the reused KycVerification.
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setBrokerProfile(null);
      setKycStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profile, kyc] = await Promise.all([
        brokerApi.profile(),
        kycApi.me().catch(() => null),
      ]);
      setBrokerProfile(profile);
      setKycStatus(kyc);
    } catch {
      // leave nulls — UI shows the apply CTA
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function applyAsBroker(data: ApplicationData) {
    if (!user) return { success: false, error: "Please log in to apply" };
    try {
      const result = await brokerApi.apply({
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || "",
      });
      setBrokerProfile(result);
      toast.success("Broker application submitted!");
      return { success: true, data: result };
    } catch (err: any) {
      const msg = err.message || "Failed to submit application";
      toast.error(msg);
      return { success: false, error: msg };
    }
  }

  async function submitLicense(data: LicenseData) {
    if (!user || !brokerProfile) return { success: false, error: "No broker profile found" };
    try {
      const updated = await brokerApi.submitLicense({
        license_number: data.license_number,
        license_authority: data.license_authority,
        license_expiry: data.license_expiry || null,
      });
      setBrokerProfile(updated);
      toast.success("Licence details saved!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to save licence");
      return { success: false, error: err.message };
    }
  }

  async function uploadLicense(file: File) {
    if (!user || !brokerProfile) return { success: false, error: "No broker profile found" };
    try {
      const updated = await brokerApi.uploadLicense(file);
      setBrokerProfile(updated);
      toast.success("Licence document uploaded!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to upload licence");
      return { success: false, error: err.message };
    }
  }

  return {
    brokerProfile,
    kycStatus,
    loading,
    applyAsBroker,
    submitLicense,
    uploadLicense,
    refresh: fetchData,
  };
}
