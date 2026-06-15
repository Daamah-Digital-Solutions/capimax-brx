import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [wallets, setWallets] = useState<InvestorCryptoWallet[]>([]);
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

  const fetchWallets = useCallback(async () => {
    if (!userId) {
      setWallets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("investor_crypto_wallets")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWallets((data as InvestorCryptoWallet[]) || []);
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تحميل محافظ العملات الرقمية",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const addWallet = async (data: NewCryptoWalletData) => {
    if (!userId) {
      toast({
        title: "يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لإضافة محفظة",
        variant: "destructive",
      });
      return null;
    }

    try {
      const isFirst = wallets.length === 0;
      
      const { data: newWallet, error } = await supabase
        .from("investor_crypto_wallets")
        .insert({
          user_id: userId,
          wallet_address: data.wallet_address,
          wallet_label: data.wallet_label || null,
          network: data.network,
          is_default: isFirst,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "add",
        method_type: "crypto",
        method_id: newWallet.id,
        details: { network: data.network, wallet_label: data.wallet_label || null },
      }]);

      toast({
        title: "تم الحفظ",
        description: "تم إضافة المحفظة بنجاح",
      });

      await fetchWallets();
      return newWallet as InvestorCryptoWallet;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر إضافة المحفظة",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateWallet = async (id: string, data: Partial<NewCryptoWalletData>) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("investor_crypto_wallets")
        .update({
          ...(data.wallet_address && { wallet_address: data.wallet_address }),
          ...(data.wallet_label !== undefined && { wallet_label: data.wallet_label || null }),
          ...(data.network && { network: data.network }),
        })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "edit",
        method_type: "crypto",
        method_id: id,
        details: { 
          wallet_address: data.wallet_address || null, 
          wallet_label: data.wallet_label || null, 
          network: data.network || null 
        },
      }]);

      toast({
        title: "تم التحديث",
        description: "تم تحديث المحفظة بنجاح",
      });

      await fetchWallets();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تحديث المحفظة",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteWallet = async (id: string) => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("investor_crypto_wallets")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await supabase.from("payment_method_audit_log").insert([{
        user_id: userId,
        action: "delete",
        method_type: "crypto",
        method_id: id,
      }]);

      toast({
        title: "تم الحذف",
        description: "تم حذف المحفظة بنجاح",
      });

      await fetchWallets();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر حذف المحفظة",
        variant: "destructive",
      });
      return false;
    }
  };

  const setDefaultWallet = async (id: string) => {
    if (!userId) return false;

    try {
      await supabase
        .from("investor_crypto_wallets")
        .update({ is_default: false })
        .eq("user_id", userId);

      const { error } = await supabase
        .from("investor_crypto_wallets")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تعيين المحفظة كافتراضية",
      });

      await fetchWallets();
      return true;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تعيين المحفظة كافتراضية",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    wallets,
    isLoading,
    isAuthenticated: !!userId,
    addWallet,
    updateWallet,
    deleteWallet,
    setDefaultWallet,
    refetch: fetchWallets,
  };
}
