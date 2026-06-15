import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface InvestorBankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  bank_code: string | null;
  account_holder_name: string;
  account_number_masked: string;
  iban_masked: string | null;
  swift_code: string | null;
  country: string;
  currency: string;
  is_verified: boolean;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewBankAccountData {
  bank_name: string;
  bank_code?: string;
  account_holder_name: string;
  account_number: string;
  iban?: string;
  swift_code?: string;
  country: string;
  currency: string;
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return "****";
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

function maskIban(iban: string): string {
  if (iban.length <= 6) return "****";
  return iban.slice(0, 4) + "*".repeat(iban.length - 8) + iban.slice(-4);
}

export function useInvestorBankAccounts() {
  const [accounts, setAccounts] = useState<InvestorBankAccount[]>([]);
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

  const fetchAccounts = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("investor_bank_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts((data as InvestorBankAccount[]) || []);
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تحميل الحسابات البنكية",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = async (data: NewBankAccountData) => {
    if (!userId) {
      toast({
        title: "يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لإضافة حساب بنكي",
        variant: "destructive",
      });
      return null;
    }

    try {
      const isFirst = accounts.length === 0;
      
      const { data: newAccount, error } = await supabase
        .from("investor_bank_accounts")
        .insert({
          user_id: userId,
          bank_name: data.bank_name,
          bank_code: data.bank_code || null,
          account_holder_name: data.account_holder_name,
          account_number_masked: maskAccountNumber(data.account_number),
          iban_masked: data.iban ? maskIban(data.iban) : null,
          swift_code: data.swift_code || null,
          country: data.country,
          currency: data.currency,
          is_default: isFirst,
        })
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "add",
        method_type: "bank",
        method_id: newAccount.id,
        details: { bank_name: data.bank_name, country: data.country },
      }]);

      toast({
        title: "تم الحفظ",
        description: "تم إضافة الحساب البنكي بنجاح",
      });

      await fetchAccounts();
      return newAccount as InvestorBankAccount;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر إضافة الحساب البنكي",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateAccount = async (id: string, data: Partial<NewBankAccountData>) => {
    if (!userId) return false;

    try {
      const updateData: Record<string, unknown> = {};
      if (data.bank_name) updateData.bank_name = data.bank_name;
      if (data.bank_code !== undefined) updateData.bank_code = data.bank_code || null;
      if (data.account_holder_name) updateData.account_holder_name = data.account_holder_name;
      if (data.account_number) updateData.account_number_masked = maskAccountNumber(data.account_number);
      if (data.iban !== undefined) updateData.iban_masked = data.iban ? maskIban(data.iban) : null;
      if (data.swift_code !== undefined) updateData.swift_code = data.swift_code || null;
      if (data.country) updateData.country = data.country;
      if (data.currency) updateData.currency = data.currency;

      const { error } = await supabase
        .from("investor_bank_accounts")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "edit",
        method_type: "bank",
        method_id: id,
        details: updateData as Record<string, string | null>,
      }]);

      toast({
        title: "تم التحديث",
        description: "تم تحديث الحساب البنكي بنجاح",
      });

      await fetchAccounts();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تحديث الحساب البنكي",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteAccount = async (id: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("investor_bank_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "delete",
        method_type: "bank",
        method_id: id,
      }]);

      toast({
        title: "تم الحذف",
        description: "تم حذف الحساب البنكي بنجاح",
      });

      await fetchAccounts();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر حذف الحساب البنكي",
        variant: "destructive",
      });
      return false;
    }
  };

  const setDefaultAccount = async (id: string) => {
    if (!userId) return false;

    try {
      await supabase
        .from("investor_bank_accounts")
        .update({ is_default: false })
        .eq("user_id", userId);

      const { error } = await supabase
        .from("investor_bank_accounts")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تعيين الحساب كافتراضي",
      });

      await fetchAccounts();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تعيين الحساب كافتراضي",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    accounts,
    isLoading,
    isAuthenticated: !!userId,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    refetch: fetchAccounts,
  };
}
