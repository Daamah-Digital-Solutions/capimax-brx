import { useState, useEffect, useCallback } from "react";
import { paymentMethodsApi } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  /** Saved through Stripe → usable to pay; older label-only cards are not. */
  chargeable?: boolean;
}

export function useSavedCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const isAr = useLanguage().language === "ar";

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
      toast({ title: isAr ? "خطأ" : "Error", description: isAr ? "تعذر تحميل البطاقات المحفوظة" : "Could not load your saved cards", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, isAr]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const deleteCard = async (cardId: string) => {
    try {
      await paymentMethodsApi.deleteCard(cardId);
      toast({ title: isAr ? "تم الحذف" : "Deleted", description: isAr ? "تم حذف البطاقة بنجاح" : "The card was removed" });
      await fetchCards();
    } catch {
      toast({ title: isAr ? "خطأ" : "Error", description: isAr ? "تعذر حذف البطاقة" : "Could not remove the card", variant: "destructive" });
    }
  };

  const setDefaultCard = async (cardId: string) => {
    if (!user) return;
    try {
      await paymentMethodsApi.setDefaultCard(cardId);
      toast({ title: isAr ? "تم التحديث" : "Updated", description: isAr ? "تم تعيين البطاقة كافتراضية" : "This card is now your default" });
      await fetchCards();
    } catch {
      toast({ title: isAr ? "خطأ" : "Error", description: isAr ? "تعذر تعيين البطاقة كافتراضية" : "Could not set the default card", variant: "destructive" });
    }
  };

  return {
    cards,
    isLoading,
    isAuthenticated: !!user,
    deleteCard,
    setDefaultCard,
    refetch: fetchCards,
    refresh: fetchCards,
  };
}
