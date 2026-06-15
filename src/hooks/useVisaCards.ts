import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CardCategory = "personal" | "family" | "dependent";

export interface VisaCard {
  id: string;
  user_id: string;
  card_type: "virtual" | "physical";
  card_brand: string;
  card_last_four: string;
  card_number_masked: string;
  cardholder_name: string | null;
  status: "active" | "frozen" | "pending" | "cancelled";
  spending_limit: number;
  spent_this_month: number;
  expiry_month: number;
  expiry_year: number;
  role_at_issue: string | null;
  shipping_status: string | null;
  card_category: CardCategory;
  nickname: string | null;
  family_account_id: string | null;
  relationship: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCardOptions {
  cardType: "virtual" | "physical";
  category?: CardCategory;
  nickname?: string;
  familyAccountId?: string;
  relationship?: string;
  cardholderName?: string;
  spendingLimit?: number;
}

export interface CardTransaction {
  id: string;
  card_id: string;
  user_id: string;
  amount: number;
  currency: string;
  tx_type: "purchase" | "refund" | "topup" | "fee";
  merchant: string | null;
  category: string | null;
  status: "completed" | "pending" | "declined" | "reversed";
  created_at: string;
}

export interface WalletBalance {
  user_id: string;
  available_balance: number;
  pending_balance: number;
  currency: string;
}

const genLast4 = () => Math.floor(1000 + Math.random() * 9000).toString();
const genMasked = (last4: string) =>
  `4539 •••• •••• ${last4}`;

export function useVisaCards(roleLabel?: string) {
  const [cards, setCards] = useState<VisaCard[]>([]);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async (uid?: string) => {
    const id = uid ?? userId;
    if (!id) return;
    const [cardsRes, txRes, balRes] = await Promise.all([
      supabase.from("visa_cards").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      supabase.from("card_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("wallet_balances").select("*").eq("user_id", id).maybeSingle(),
    ]);
    if (cardsRes.data) setCards(cardsRes.data as VisaCard[]);
    if (txRes.data) setTransactions(txRes.data as CardTransaction[]);
    setBalance((balRes.data as WalletBalance | null) ?? {
      user_id: id, available_balance: 0, pending_balance: 0, currency: "USD",
    });
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      await refresh(user.id);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) refresh(uid);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  // Realtime updates on balance & transactions
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`visa-cards-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "wallet_balances", filter: `user_id=eq.${userId}` },
        () => refresh())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "card_transactions", filter: `user_id=eq.${userId}` },
        () => refresh())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "visa_cards", filter: `user_id=eq.${userId}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  const createCard = async (
    cardTypeOrOptions: "virtual" | "physical" | CreateCardOptions,
  ) => {
    if (!userId) { toast.error("Sign in required"); return null; }
    const opts: CreateCardOptions = typeof cardTypeOrOptions === "string"
      ? { cardType: cardTypeOrOptions }
      : cardTypeOrOptions;
    const last4 = genLast4();
    const now = new Date();
    const insertRow = {
      user_id: userId,
      card_type: opts.cardType,
      card_last_four: last4,
      card_number_masked: genMasked(last4),
      status: opts.cardType === "virtual" ? "active" : "pending",
      shipping_status: opts.cardType === "physical" ? "preparing" : null,
      role_at_issue: roleLabel ?? null,
      expiry_month: 12,
      expiry_year: now.getFullYear() + 4,
      card_category: opts.category ?? "personal",
      nickname: opts.nickname ?? null,
      family_account_id: opts.familyAccountId ?? null,
      relationship: opts.relationship ?? null,
      cardholder_name: opts.cardholderName ?? null,
      ...(opts.spendingLimit && opts.spendingLimit > 0
        ? { spending_limit: opts.spendingLimit }
        : {}),
    };
    const { data, error } = await supabase.from("visa_cards").insert(insertRow).select().single();

    if (error) { toast.error(error.message); return null; }
    toast.success(opts.cardType === "virtual" ? "Virtual Visa issued" : "Physical Visa ordered");
    await refresh();
    return data as VisaCard;
  };

  const setCardStatus = async (cardId: string, status: VisaCard["status"]) => {
    const { error } = await supabase.from("visa_cards").update({ status }).eq("id", cardId);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const setSpendingLimit = async (cardId: string, limit: number) => {
    const { error } = await supabase.from("visa_cards").update({ spending_limit: limit }).eq("id", cardId);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const payWithCard = async (cardId: string, amount: number, merchant: string, category?: string) => {
    const { data, error } = await supabase.rpc("spend_with_card", {
      _card_id: cardId,
      _amount: amount,
      _merchant: merchant,
      _category: category ?? null,
    });
    if (error) { toast.error(error.message); return null; }
    toast.success(`Paid $${amount.toLocaleString()} at ${merchant}`);
    await refresh();
    return data as unknown as CardTransaction;
  };

  const topUp = async (amount: number) => {
    const { error } = await supabase.rpc("topup_wallet", { _amount: amount });
    if (error) { toast.error(error.message); return false; }
    toast.success(`Wallet topped up by $${amount.toLocaleString()}`);
    await refresh();
    return true;
  };

  return {
    loading,
    userId,
    cards,
    transactions,
    balance,
    createCard,
    setCardStatus,
    setSpendingLimit,
    payWithCard,
    topUp,
    refresh,
  };
}
