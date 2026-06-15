import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  withdrawal_method: string;
  bank_account_id: string | null;
  crypto_wallet_id: string | null;
  card_id: string | null;
  status: string;
  otp_verified: boolean;
  otp_verified_at: string | null;
  processed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewWithdrawalData {
  amount: number;
  currency?: string;
  withdrawal_method: "bank" | "crypto" | "card";
  bank_account_id?: string;
  crypto_wallet_id?: string;
  card_id?: string;
  notes?: string;
}

export function useWithdrawalRequests() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!userId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as WithdrawalRequest[]) || []);
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تحميل طلبات السحب",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (data: NewWithdrawalData) => {
    if (!userId) {
      toast({
        title: "يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لطلب السحب",
        variant: "destructive",
      });
      return null;
    }

    try {
      const referenceNumber = `WDR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const { data: newRequest, error } = await supabase
        .from("withdrawal_requests")
        .insert({
          user_id: userId,
          amount: data.amount,
          currency: data.currency || "USD",
          withdrawal_method: data.withdrawal_method,
          bank_account_id: data.bank_account_id || null,
          crypto_wallet_id: data.crypto_wallet_id || null,
          card_id: data.card_id || null,
          reference_number: referenceNumber,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "withdrawal_request",
        method_type: data.withdrawal_method,
        method_id: data.bank_account_id || data.crypto_wallet_id || data.card_id || null,
        details: { amount: data.amount, currency: data.currency || "USD", reference: referenceNumber },
      }]);

      toast({
        title: "تم إنشاء الطلب",
        description: `تم إنشاء طلب السحب برقم ${referenceNumber}`,
      });

      await fetchRequests();
      return newRequest as WithdrawalRequest;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر إنشاء طلب السحب",
        variant: "destructive",
      });
      return null;
    }
  };

  const cancelRequest = async (id: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "pending");

      if (error) throw error;

      toast({
        title: "تم الإلغاء",
        description: "تم إلغاء طلب السحب",
      });

      await fetchRequests();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر إلغاء طلب السحب",
        variant: "destructive",
      });
      return false;
    }
  };

  const sendOtp = async (id: string): Promise<string | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase.functions.invoke("send-withdrawal-otp", {
        body: { withdrawal_request_id: id },
      });
      if (error) throw error;
      toast({
        title: "تم إرسال الرمز",
        description: data?.dev_code
          ? `رمز التحقق (وضع التطوير): ${data.dev_code}`
          : "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
      });
      return data?.dev_code || null;
    } catch {
      toast({ title: "خطأ", description: "تعذر إرسال رمز التحقق", variant: "destructive" });
      return null;
    }
  };

  const verifyOtp = async (id: string, otp: string) => {
    if (!userId) return false;
    try {
      const { error } = await supabase.functions.invoke("verify-withdrawal-otp", {
        body: { withdrawal_request_id: id, code: otp },
      });
      if (error) throw error;
      toast({ title: "تم التحقق", description: "تم التحقق من الرمز بنجاح" });
      await fetchRequests();
      return true;
    } catch {
      toast({ title: "خطأ", description: "رمز التحقق غير صحيح أو منتهي الصلاحية", variant: "destructive" });
      return false;
    }
  };


  return {
    requests,
    isLoading,
    isAuthenticated: !!userId,
    createRequest,
    cancelRequest,
    sendOtp,
    verifyOtp,
    refetch: fetchRequests,
  };
}
