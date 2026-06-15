import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FamilyAccount {
  id: string;
  investor_id: string;
  member_name: string;
  member_email: string;
  relationship: string;
  status: "pending" | "active" | "suspended";
  access_level: "view_only" | "authorized";
  allocated_returns_percent: number;
  total_transferred: number;
  linked_at: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyBankAccount {
  id: string;
  family_account_id: string;
  bank_name: string;
  bank_code: string | null;
  account_holder_name: string;
  account_number_masked: string;
  iban_masked: string | null;
  currency: string;
  is_verified: boolean;
  verified_at: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransferSchedule {
  id: string;
  family_account_id: string;
  bank_account_id: string;
  schedule_type: "immediate" | "weekly" | "monthly" | "quarterly" | "threshold";
  threshold_amount: number | null;
  next_transfer_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyTransaction {
  id: string;
  family_account_id: string;
  bank_account_id: string | null;
  transaction_type: string;
  amount: number | null;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  reference_number: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  initiated_by: string;
  created_at: string;
}

export function useFamilyAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: familyAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["family-accounts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("family_accounts")
        .select("*")
        .eq("investor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FamilyAccount[];
    },
    enabled: !!user?.id,
  });

  const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useQuery({
    queryKey: ["family-bank-accounts", user?.id],
    queryFn: async () => {
      if (!user?.id || familyAccounts.length === 0) return [];
      const familyAccountIds = familyAccounts.map((fa) => fa.id);
      const { data, error } = await supabase
        .from("family_bank_accounts")
        .select("*")
        .in("family_account_id", familyAccountIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FamilyBankAccount[];
    },
    enabled: !!user?.id && familyAccounts.length > 0,
  });

  const { data: transferSchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["family-transfer-schedules", user?.id],
    queryFn: async () => {
      if (!user?.id || familyAccounts.length === 0) return [];
      const familyAccountIds = familyAccounts.map((fa) => fa.id);
      const { data, error } = await supabase
        .from("family_transfer_schedules")
        .select("*")
        .in("family_account_id", familyAccountIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TransferSchedule[];
    },
    enabled: !!user?.id && familyAccounts.length > 0,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["family-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id || familyAccounts.length === 0) return [];
      const familyAccountIds = familyAccounts.map((fa) => fa.id);
      const { data, error } = await supabase
        .from("family_transactions")
        .select("*")
        .in("family_account_id", familyAccountIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as FamilyTransaction[];
    },
    enabled: !!user?.id && familyAccounts.length > 0,
  });

  const createFamilyAccountMutation = useMutation({
    mutationFn: async (data: {
      member_name: string;
      member_email: string;
      relationship: string;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data: result, error } = await supabase
        .from("family_accounts")
        .insert({
          investor_id: user.id,
          member_name: data.member_name,
          member_email: data.member_email,
          relationship: data.relationship,
        })
        .select()
        .single();

      if (error) throw error;

      // Log transaction
      await supabase.from("family_transactions").insert({
        family_account_id: result.id,
        transaction_type: "allocation",
        description: `Family member ${data.member_name} added`,
        initiated_by: user.id,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["family-transactions"] });
    },
  });

  const addBankAccountMutation = useMutation({
    mutationFn: async (data: {
      family_account_id: string;
      bank_name: string;
      bank_code?: string;
      account_holder_name: string;
      account_number: string;
      iban?: string;
      currency?: string;
      is_primary?: boolean;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Mask sensitive data - only store last 4 characters
      const accountNumberMasked = `****${data.account_number.slice(-4)}`;
      const ibanMasked = data.iban ? `****${data.iban.slice(-4)}` : null;

      const { data: result, error } = await supabase
        .from("family_bank_accounts")
        .insert({
          family_account_id: data.family_account_id,
          bank_name: data.bank_name,
          bank_code: data.bank_code || null,
          account_holder_name: data.account_holder_name,
          account_number_masked: accountNumberMasked,
          iban_masked: ibanMasked,
          currency: data.currency || "USD",
          is_primary: data.is_primary || false,
        })
        .select()
        .single();

      if (error) throw error;

      // Log transaction
      await supabase.from("family_transactions").insert({
        family_account_id: data.family_account_id,
        bank_account_id: result.id,
        transaction_type: "bank_linked",
        description: `Bank account ${data.bank_name} linked`,
        initiated_by: user.id,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["family-transactions"] });
    },
  });

  const createTransferScheduleMutation = useMutation({
    mutationFn: async (data: {
      family_account_id: string;
      bank_account_id: string;
      schedule_type: "immediate" | "weekly" | "monthly" | "quarterly" | "threshold";
      threshold_amount?: number;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      // Calculate next transfer date based on schedule type
      let nextTransferDate: string | null = null;
      const now = new Date();
      
      switch (data.schedule_type) {
        case "weekly":
          nextTransferDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case "monthly":
          nextTransferDate = new Date(now.setMonth(now.getMonth() + 1)).toISOString();
          break;
        case "quarterly":
          nextTransferDate = new Date(now.setMonth(now.getMonth() + 3)).toISOString();
          break;
      }

      const { data: result, error } = await supabase
        .from("family_transfer_schedules")
        .insert({
          family_account_id: data.family_account_id,
          bank_account_id: data.bank_account_id,
          schedule_type: data.schedule_type,
          threshold_amount: data.threshold_amount || null,
          next_transfer_date: nextTransferDate,
        })
        .select()
        .single();

      if (error) throw error;

      // Log transaction
      await supabase.from("family_transactions").insert({
        family_account_id: data.family_account_id,
        bank_account_id: data.bank_account_id,
        transaction_type: "schedule_created",
        description: `Auto-transfer schedule created: ${data.schedule_type}`,
        initiated_by: user.id,
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-transfer-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["family-transactions"] });
    },
  });

  const initiateTransferMutation = useMutation({
    mutationFn: async (data: {
      family_account_id: string;
      bank_account_id: string;
      amount: number;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const referenceNumber = `FT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const { data: result, error } = await supabase
        .from("family_transactions")
        .insert({
          family_account_id: data.family_account_id,
          bank_account_id: data.bank_account_id,
          transaction_type: "transfer_initiated",
          amount: data.amount,
          status: "pending",
          reference_number: referenceNumber,
          description: `Transfer of $${data.amount.toLocaleString()} initiated`,
          initiated_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-transactions"] });
      toast.success("Transfer initiated successfully");
    },
  });

  const updateAccessLevelMutation = useMutation({
    mutationFn: async (data: { accountId: string; accessLevel: "view_only" | "authorized" }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("family_accounts")
        .update({ access_level: data.accessLevel })
        .eq("id", data.accountId)
        .eq("investor_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-accounts"] });
    },
  });

  return {
    familyAccounts,
    bankAccounts,
    transferSchedules,
    transactions,
    isLoading: accountsLoading || bankAccountsLoading || schedulesLoading || transactionsLoading,
    createFamilyAccount: createFamilyAccountMutation.mutateAsync,
    addBankAccount: addBankAccountMutation.mutateAsync,
    createTransferSchedule: createTransferScheduleMutation.mutateAsync,
    initiateTransfer: initiateTransferMutation.mutateAsync,
    updateAccessLevel: updateAccessLevelMutation.mutateAsync,
    isCreating: createFamilyAccountMutation.isPending,
    isAddingBank: addBankAccountMutation.isPending,
    isCreatingSchedule: createTransferScheduleMutation.isPending,
    isTransferring: initiateTransferMutation.isPending,
  };
}
