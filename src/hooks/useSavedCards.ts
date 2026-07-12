import { useState, useEffect, useCallback } from "react";
import { paymentMethodsApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Client note 11: repointed Supabase → Django (apps/wallets payment-methods). The
// exported interface is UNCHANGED so SavedCardsManager renders exactly as before.
// Only the non-sensitive card reference (brand/last4/expiry/holder) is stored — no PAN.

export interface SavedCard {
  id: string;
  card_brand: string;
  card_last_four: string;
  card_expiry_month: number;
  card_expiry_year: number;
  cardholder_name: string;
  is_default: boolean;
}

export function useSavedCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCards = useCallback(async () => {
    if (!user) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await paymentMethodsApi.listCards();
      setCards((data as SavedCard[]) || []);
    } catch {
      toast({ title: "خطأ", description: "تعذر تحميل البطاقات المحفوظة", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const saveCard = async (cardData: {
    card_brand: string;
    card_last_four: string;
    card_expiry_month: number;
    card_expiry_year: number;
    cardholder_name: string;
  }) => {
    if (!user) {
      toast({ title: "يرجى تسجيل الدخول", description: "يجب تسجيل الدخول لحفظ البطاقات", variant: "destructive" });
      return null;
    }
    try {
      const data = (await paymentMethodsApi.addCard(cardData)) as SavedCard;
      toast({ title: "تم الحفظ", description: "تم حفظ البطاقة بنجاح" });
      await fetchCards();
      return data;
    } catch {
      toast({ title: "خطأ", description: "تعذر حفظ البطاقة", variant: "destructive" });
      return null;
    }
  };

  const deleteCard = async (cardId: string) => {
    try {
      await paymentMethodsApi.deleteCard(cardId);
      toast({ title: "تم الحذف", description: "تم حذف البطاقة بنجاح" });
      await fetchCards();
    } catch {
      toast({ title: "خطأ", description: "تعذر حذف البطاقة", variant: "destructive" });
    }
  };

  const setDefaultCard = async (cardId: string) => {
    if (!user) return;
    try {
      await paymentMethodsApi.setDefaultCard(cardId);
      toast({ title: "تم التحديث", description: "تم تعيين البطاقة كافتراضية" });
      await fetchCards();
    } catch {
      toast({ title: "خطأ", description: "تعذر تعيين البطاقة كافتراضية", variant: "destructive" });
    }
  };

  return {
    cards,
    isLoading,
    isAuthenticated: !!user,
    saveCard,
    deleteCard,
    setDefaultCard,
    refetch: fetchCards,
  };
}
