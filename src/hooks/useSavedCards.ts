import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Get current user
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

  // Fetch saved cards
  const fetchCards = useCallback(async () => {
    if (!userId) {
      setCards([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تحميل البطاقات المحفوظة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Save a new card
  const saveCard = async (cardData: {
    card_brand: string;
    card_last_four: string;
    card_expiry_month: number;
    card_expiry_year: number;
    cardholder_name: string;
  }) => {
    if (!userId) {
      toast({
        title: "يرجى تسجيل الدخول",
        description: "يجب تسجيل الدخول لحفظ البطاقات",
        variant: "destructive",
      });
      return null;
    }

    try {
      const isFirst = cards.length === 0;
      
      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          user_id: userId,
          ...cardData,
          is_default: isFirst,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "تم الحفظ",
        description: "تم حفظ البطاقة بنجاح",
      });

      await fetchCards();
      return data;
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر حفظ البطاقة",
        variant: "destructive",
      });
      return null;
    }
  };

  // Delete a card
  const deleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", cardId);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف البطاقة بنجاح",
      });

      await fetchCards();
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر حذف البطاقة",
        variant: "destructive",
      });
    }
  };

  // Set a card as default
  const setDefaultCard = async (cardId: string) => {
    if (!userId) return;

    try {
      // First, unset all defaults
      await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", userId);

      // Then set the new default
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", cardId);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تعيين البطاقة كافتراضية",
      });

      await fetchCards();
    } catch {
      toast({
        title: "خطأ",
        description: "تعذر تعيين البطاقة كافتراضية",
        variant: "destructive",
      });
    }
  };

  return {
    cards,
    isLoading,
    isAuthenticated: !!userId,
    saveCard,
    deleteCard,
    setDefaultCard,
    refetch: fetchCards,
  };
}
