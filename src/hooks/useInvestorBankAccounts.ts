import { useState, useEffect, useCallback } from "react";
import { paymentMethodsApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Client note 11: repointed Supabase → Django (apps/wallets payment-methods). The
// exported interface is UNCHANGED so BankAccountsManager renders exactly as before.
// The RAW account number / IBAN are sent to the backend, which masks them server-side
// and never persists the raw value.

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

export function useInvestorBankAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<InvestorBankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await paymentMethodsApi.listBankAccounts();
      setAccounts((data as InvestorBankAccount[]) || []);
    } catch {
      toast({ title: "خطأ", description: "تعذر تحميل الحسابات البنكية", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = async (data: NewBankAccountData) => {
    if (!user) {
      toast({ title: "يرجى تسجيل الدخول", description: "يجب تسجيل الدخول لإضافة حساب بنكي", variant: "destructive" });
      return null;
    }
    try {
      const newAccount = (await paymentMethodsApi.addBankAccount({
        bank_name: data.bank_name,
        bank_code: data.bank_code || null,
        account_holder_name: data.account_holder_name,
        account_number: data.account_number,
        iban: data.iban || null,
        swift_code: data.swift_code || null,
        country: data.country,
        currency: data.currency,
      })) as InvestorBankAccount;
      toast({ title: "تم الحفظ", description: "تم إضافة الحساب البنكي بنجاح" });
      await fetchAccounts();
      return newAccount;
    } catch {
      toast({ title: "خطأ", description: "تعذر إضافة الحساب البنكي", variant: "destructive" });
      return null;
    }
  };

  const updateAccount = async (id: string, data: Partial<NewBankAccountData>) => {
    if (!user) return false;
    try {
      await paymentMethodsApi.updateBankAccount(id, {
        ...(data.bank_name && { bank_name: data.bank_name }),
        ...(data.bank_code !== undefined && { bank_code: data.bank_code || null }),
        ...(data.account_holder_name && { account_holder_name: data.account_holder_name }),
        ...(data.account_number && { account_number: data.account_number }),
        ...(data.iban !== undefined && { iban: data.iban || null }),
        ...(data.swift_code !== undefined && { swift_code: data.swift_code || null }),
        ...(data.country && { country: data.country }),
        ...(data.currency && { currency: data.currency }),
      });
      toast({ title: "تم التحديث", description: "تم تحديث الحساب البنكي بنجاح" });
      await fetchAccounts();
      return true;
    } catch {
      toast({ title: "خطأ", description: "تعذر تحديث الحساب البنكي", variant: "destructive" });
      return false;
    }
  };

  const deleteAccount = async (id: string) => {
    if (!user) return false;
    try {
      await paymentMethodsApi.deleteBankAccount(id);
      toast({ title: "تم الحذف", description: "تم حذف الحساب البنكي بنجاح" });
      await fetchAccounts();
      return true;
    } catch {
      toast({ title: "خطأ", description: "تعذر حذف الحساب البنكي", variant: "destructive" });
      return false;
    }
  };

  const setDefaultAccount = async (id: string) => {
    if (!user) return false;
    try {
      await paymentMethodsApi.setDefaultBankAccount(id);
      toast({ title: "تم التحديث", description: "تم تعيين الحساب كافتراضي" });
      await fetchAccounts();
      return true;
    } catch {
      toast({ title: "خطأ", description: "تعذر تعيين الحساب كافتراضي", variant: "destructive" });
      return false;
    }
  };

  return {
    accounts,
    isLoading,
    isAuthenticated: !!user,
    addAccount,
    updateAccount,
    deleteAccount,
    setDefaultAccount,
    refetch: fetchAccounts,
  };
}
