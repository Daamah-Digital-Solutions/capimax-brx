import { useState, useEffect, useCallback } from "react";
import { paymentMethodsApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Client note 11: repointed Supabase → Django (apps/wallets payment-methods). The
// exported interface is UNCHANGED so CryptoWalletsManager renders exactly as before.

export interface InvestorCryptoWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  wallet_label: string | null;
  network: string;
  is_verified: boolean;
  is_default: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewCryptoWalletData {
  wallet_address: string;
  wallet_label?: string;
  network: string;
}

export function useInvestorCryptoWallets() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<InvestorCryptoWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchWallets = useCallback(async () => {
    if (!user) {
      setWallets([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await paymentMethodsApi.listCryptoWallets();
      setWallets((data as InvestorCryptoWallet[]) || []);
    } catch {
      toast({ title: "خطأ", description: "تعذر تحميل محافظ العملات الرقمية", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const addWallet = async (data: NewCryptoWalletData) => {
    if (!user) {
      toast({ title: "يرجى تسجيل الدخول", description: "يجب تسجيل الدخول لإضافة محفظة", variant: "destructive" });
      return null;
    }
    try {
      const newWallet = (await paymentMethodsApi.addCryptoWallet({
        wallet_address: data.wallet_address,
        wallet_label: data.wallet_label || null,
        network: data.network,
      })) as InvestorCryptoWallet;
      toast({ title: "تم الحفظ", description: "تم إضافة المحفظة بنجاح" });
      await fetchWallets();
      return newWallet;
    } catch {
      toast({ title: "خطأ", description: "تعذر إضافة المحفظة", variant: "destructive" });
      return null;
    }
  };

  const updateWallet = async (id: string, data: Partial<NewCryptoWalletData>) => {
    if (!user) return false;
    try {
      await paymentMethodsApi.updateCryptoWallet(id, {
        ...(data.wallet_address && { wallet_address: data.wallet_address }),
        ...(data.wallet_label !== undefined && { wallet_label: data.wallet_label || null }),
        ...(data.network && { network: data.network }),
      });
      toast({ title: "تم التحديث", description: "تم تحديث المحفظة بنجاح" });
      await fetchWallets();
      return true;
    } catch {
      toast({ title: "خطأ", description: "تعذر تحديث المحفظة", variant: "destructive" });
      return false;
    }
  };

  const deleteWallet = async (id: string) => {
    if (!user) return false;
    try {
      await paymentMethodsApi.deleteCryptoWallet(id);
      toast({ title: "تم الحذف", description: "تم حذف المحفظة بنجاح" });
      await fetchWallets();
      return true;
    } catch {
      toast({ title: "خطأ", description: "تعذر حذف المحفظة", variant: "destructive" });
      return false;
    }
  };

  const setDefaultWallet = async (id: string) => {
    if (!user) return false;
    try {
      await paymentMethodsApi.setDefaultCryptoWallet(id);
      toast({ title: "تم التحديث", description: "تم تعيين المحفظة كافتراضية" });
      await fetchWallets();
      return true;
    } catch {
      toast({ title: "خطأ", description: "تعذر تعيين المحفظة كافتراضية", variant: "destructive" });
      return false;
    }
  };

  return {
    wallets,
    isLoading,
    isAuthenticated: !!user,
    addWallet,
    updateWallet,
    deleteWallet,
    setDefaultWallet,
    refetch: fetchWallets,
  };
}
