import { useState, useEffect } from "react";
import { lpApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Phase 6 Wave 1: repointed Supabase → Django (apps/lp). The hook's exported
// interfaces and function signatures are UNCHANGED so LiquidityProvider.tsx +
// LPRegistrationFlow render exactly as before. KYB approval is automatic via the
// signed Sumsub webhook (business level); until keys land the form/dev path drives
// the flow. The LP secondary market (lp_holdings) is a later wave and untouched.

export interface LiquidityProvider {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  investment_amount: number;
  status: "pending" | "approved" | "rejected" | "suspended";
  applied_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  crypto_wallet_address: string | null;
  crypto_network: string | null;
  total_deposited: number;
  total_withdrawn: number;
  total_earnings: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
  // KYB fields
  kyb_status: "not_started" | "documents_pending" | "under_review" | "approved" | "rejected";
  business_type: string | null;
  business_registration_number: string | null;
  tax_id: string | null;
  business_address: string | null;
  business_description: string | null;
  annual_revenue: string | null;
  source_of_funds: string | null;
  kyb_submitted_at: string | null;
  kyb_approved_at: string | null;
  kyb_rejected_at: string | null;
  kyb_rejection_reason: string | null;
}

export interface LPTransaction {
  id: string;
  lp_id: string;
  tx_type: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  withdrawal_method: string | null;
  bank_reference: string | null;
  crypto_tx_hash: string | null;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface LPDocument {
  id: string;
  lp_id: string | null;
  user_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number | null;
  is_template: boolean;
  uploaded_by: string;
  created_at: string;
}

interface ApplicationData {
  company_name?: string;
  contact_name: string;
  email: string;
  phone?: string;
  country?: string;
  investment_amount: number;
}

interface WithdrawalData {
  amount: number;
  withdrawal_method: "bank" | "crypto";
  notes?: string;
}

interface KYBData {
  business_type: string;
  business_registration_number: string;
  tax_id: string;
  business_address: string;
  business_description: string;
  annual_revenue: string;
  source_of_funds: string;
}

export function useLiquidityProvider() {
  const { user } = useAuth();
  const [lpProfile, setLpProfile] = useState<LiquidityProvider | null>(null);
  const [transactions, setTransactions] = useState<LPTransaction[]>([]);
  const [documents, setDocuments] = useState<LPDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLpProfile(null);
      setTransactions([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    fetchLPData();
  }, [user]);

  async function fetchLPData() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch LP profile (null when none — same as Supabase .maybeSingle()).
      const profile = (await lpApi.profile()) as LiquidityProvider | null;
      setLpProfile(profile);

      // If user is an approved LP, fetch transactions.
      if (profile && profile.status === "approved") {
        const txData = (await lpApi.transactions()) as LPTransaction[];
        setTransactions(txData || []);
      } else {
        setTransactions([]);
      }

      // Fetch documents (including shared templates).
      const docsData = (await lpApi.documents()) as LPDocument[];
      setDocuments(docsData || []);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function applyAsLP(data: ApplicationData) {
    if (!user) {
      return { success: false, error: "Please log in to apply" };
    }

    try {
      const result = (await lpApi.apply({
        company_name: data.company_name || "",
        contact_name: data.contact_name,
        email: data.email,
        phone: data.phone || "",
        country: data.country || "",
        investment_amount: data.investment_amount,
      })) as LiquidityProvider;

      setLpProfile(result);
      toast.success("Application submitted successfully!");
      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || "Failed to submit application";
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async function updateBankDetails(bankData: {
    bank_name: string;
    bank_account_number: string;
    bank_iban: string;
    bank_swift: string;
  }) {
    if (!user || !lpProfile) {
      return { success: false, error: "No LP profile found" };
    }

    try {
      const updated = (await lpApi.updateBankDetails(bankData)) as LiquidityProvider;
      setLpProfile({ ...lpProfile, ...updated });
      toast.success("Bank details updated successfully!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to update bank details");
      return { success: false, error: err.message };
    }
  }

  async function updateCryptoDetails(cryptoData: {
    crypto_wallet_address: string;
    crypto_network: string;
  }) {
    if (!user || !lpProfile) {
      return { success: false, error: "No LP profile found" };
    }

    try {
      const updated = (await lpApi.updateCryptoDetails(cryptoData)) as LiquidityProvider;
      setLpProfile({ ...lpProfile, ...updated });
      toast.success("Crypto wallet updated successfully!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to update crypto wallet");
      return { success: false, error: err.message };
    }
  }

  async function requestWithdrawal(data: WithdrawalData) {
    if (!user || !lpProfile) {
      return { success: false, error: "No LP profile found" };
    }

    if (data.amount > lpProfile.current_balance) {
      toast.error("Insufficient balance");
      return { success: false, error: "Insufficient balance" };
    }

    try {
      const result = (await lpApi.requestWithdrawal({
        amount: data.amount,
        withdrawal_method: data.withdrawal_method,
        notes: data.notes || "",
      })) as LPTransaction;

      setTransactions([result, ...transactions]);
      toast.success("Withdrawal request submitted!");
      return { success: true, data: result };
    } catch (err: any) {
      toast.error(err.message || "Failed to submit withdrawal");
      return { success: false, error: err.message };
    }
  }

  async function uploadDocument(file: File, documentType: string, documentName: string) {
    if (!user) {
      return { success: false, error: "Please log in to upload" };
    }

    try {
      const doc = (await lpApi.uploadDocument(file, documentType, documentName)) as LPDocument;
      setDocuments([doc, ...documents]);
      toast.success("Document uploaded successfully!");
      return { success: true, data: doc };
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
      return { success: false, error: err.message };
    }
  }

  async function downloadDocument(doc: LPDocument) {
    try {
      const data = await lpApi.downloadDocument(doc.id);

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.document_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to download document");
      return { success: false, error: err.message };
    }
  }

  async function deleteDocument(docId: string) {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return { success: false, error: "Document not found" };

    try {
      await lpApi.deleteDocument(docId);
      setDocuments(documents.filter((d) => d.id !== docId));
      toast.success("Document deleted successfully!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
      return { success: false, error: err.message };
    }
  }

  async function submitKYB(data: KYBData) {
    if (!user || !lpProfile) {
      return { success: false, error: "No LP profile found" };
    }

    try {
      const updated = (await lpApi.submitKYB({
        business_type: data.business_type,
        business_registration_number: data.business_registration_number,
        tax_id: data.tax_id || "",
        business_address: data.business_address,
        business_description: data.business_description || "",
        annual_revenue: data.annual_revenue || "",
        source_of_funds: data.source_of_funds,
      })) as LiquidityProvider;

      setLpProfile(updated);

      toast.success("KYB information submitted for review!");
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to submit KYB");
      return { success: false, error: err.message };
    }
  }

  async function uploadKYBDocument(file: File, documentType: string, documentName: string) {
    if (!user || !lpProfile) {
      return { success: false, error: "No LP profile found" };
    }

    try {
      const doc = await lpApi.uploadKYBDocument(file, documentType, documentName);

      // The backend advances KYB not_started → documents_pending on the first doc;
      // mirror that locally so the UI reflects it without a refetch.
      if (lpProfile.kyb_status === "not_started") {
        setLpProfile({ ...lpProfile, kyb_status: "documents_pending" });
      }

      return { success: true, data: doc };
    } catch (err: any) {
      toast.error(err.message || "Failed to upload KYB document");
      return { success: false, error: err.message };
    }
  }

  return {
    lpProfile,
    transactions,
    documents,
    loading,
    error,
    applyAsLP,
    submitKYB,
    uploadKYBDocument,
    updateBankDetails,
    updateCryptoDetails,
    requestWithdrawal,
    uploadDocument,
    downloadDocument,
    deleteDocument,
    refresh: fetchLPData,
  };
}
