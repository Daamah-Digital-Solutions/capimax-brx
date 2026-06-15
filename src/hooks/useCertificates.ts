import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { certificatesApi, type ApiError } from "@/integrations/api/client";

// Phase 3 Wave 3: certificates now come from the Django backend (SPEC §4.1/§2.3)
// instead of the Supabase table + edge function. Same shape the UI already reads.
export interface Certificate {
  id: string;
  certificate_id: string;
  status: "provisional" | "final" | "revoked";
  issue_date: string;
  finalized_at: string | null;
  investor_name: string;
  investor_id_masked: string;
  spv_name: string;
  property_name: string;
  property_location: string;
  listing_id: string;
  investment_amount: number;
  units_purchased: number;
  unit_price: number;
  ownership_percentage: number;
  subscription_date: string;
  verification_code: string;
  verification_url: string;
  pdf_url: string | null;
  pdf_path: string | null;
  created_at: string;
}

export function useCertificates() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCertificates([]);
      setLoading(false);
      return;
    }
    fetchCertificates();
  }, [user]);

  async function fetchCertificates() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = (await certificatesApi.list()) as Certificate[];
      setCertificates(data || []);
    } catch {
      setError("Failed to load certificates");
    } finally {
      setLoading(false);
    }
  }

  async function generateCertificate(
    investmentId: string,
    status: "provisional" | "final" = "provisional"
  ) {
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      const data = await certificatesApi.generate(investmentId, status);
      if (!data.success) {
        return { success: false, error: data.error };
      }
      await fetchCertificates();
      return { success: true, certificate: data.certificate };
    } catch (err) {
      return { success: false, error: (err as ApiError)?.message || "Failed to generate" };
    }
  }

  async function downloadCertificate(certificate: Certificate) {
    try {
      const blob = await certificatesApi.downloadPdf(certificate.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${certificate.certificate_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as ApiError)?.message || "PDF not available" };
    }
  }

  return {
    certificates,
    loading,
    error,
    generateCertificate,
    downloadCertificate,
    refreshCertificates: fetchCertificates,
  };
}
