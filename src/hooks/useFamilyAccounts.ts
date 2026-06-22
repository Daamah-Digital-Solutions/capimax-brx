import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  familyApi,
  type FamilyAccountRow,
  type FamilyBankAccountRow,
  type FamilyTransferScheduleRow,
  type FamilyTransactionRow,
} from "@/integrations/api/client";

// Family accounts — repointed off Supabase onto the Django familyApi (this removes the LAST
// Supabase data dependency). Wave A: records + allocation config ONLY — NO money, NO tokens,
// NO bank payout. A "transfer" records a pending FamilyTransaction (never executed this wave);
// banks are stored masked (last-4); members are passive sub-records. FAMILY_SURFACE.md.

// Re-export the row shapes under the legacy names the page/components already import.
export type FamilyAccount = FamilyAccountRow;
export type FamilyBankAccount = FamilyBankAccountRow;
export type TransferSchedule = FamilyTransferScheduleRow;
export type FamilyTransaction = FamilyTransactionRow;

export function useFamilyAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = (...keys: string[]) =>
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const { data: familyAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["family-accounts", user?.id],
    queryFn: () => familyApi.accounts(),
    enabled: !!user?.id,
  });

  const { data: bankAccounts = [], isLoading: bankAccountsLoading } = useQuery({
    queryKey: ["family-bank-accounts", user?.id],
    queryFn: () => familyApi.banks(),
    enabled: !!user?.id,
  });

  const { data: transferSchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["family-transfer-schedules", user?.id],
    queryFn: () => familyApi.schedules(),
    enabled: !!user?.id,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["family-transactions", user?.id],
    queryFn: () => familyApi.transactions(),
    enabled: !!user?.id,
  });

  const createFamilyAccountMutation = useMutation({
    mutationFn: (data: { member_name: string; member_email: string; relationship: string }) =>
      familyApi.createAccount(data),
    onSuccess: () => invalidate("family-accounts", "family-transactions"),
  });

  const updateAllocationMutation = useMutation({
    mutationFn: (data: { accountId: string; percent: number }) =>
      familyApi.updateAccount(data.accountId, { allocated_returns_percent: data.percent }),
    onSuccess: () => invalidate("family-accounts"),
  });

  const addBankAccountMutation = useMutation({
    // The FULL account_number/iban go to the server, which MASKS them (last-4) and stores
    // only the mask — the frontend no longer pre-masks (the server is authoritative on PII).
    mutationFn: (data: {
      family_account_id: string;
      bank_name: string;
      bank_code?: string;
      account_holder_name: string;
      account_number: string;
      iban?: string;
      currency?: string;
      is_primary?: boolean;
    }) => familyApi.addBank(data),
    onSuccess: () => invalidate("family-bank-accounts", "family-transactions"),
  });

  const createTransferScheduleMutation = useMutation({
    mutationFn: (data: {
      family_account_id: string;
      bank_account_id: string;
      schedule_type: "immediate" | "weekly" | "monthly" | "quarterly" | "threshold";
      threshold_amount?: number;
    }) => familyApi.createSchedule(data),
    onSuccess: () => invalidate("family-transfer-schedules", "family-transactions"),
  });

  const initiateTransferMutation = useMutation({
    // RECORD-ONLY: writes a pending FamilyTransaction. NO money/tokens move this wave.
    mutationFn: (data: { family_account_id: string; bank_account_id?: string; amount: number; transfer_type?: string }) =>
      familyApi.recordTransfer(data),
    onSuccess: () => {
      invalidate("family-transactions");
      toast.success("Transfer recorded (will be executed in a later release)");
    },
  });

  const updateAccessLevelMutation = useMutation({
    mutationFn: (data: { accountId: string; accessLevel: "view_only" | "authorized" }) =>
      familyApi.updateAccount(data.accountId, { access_level: data.accessLevel }),
    onSuccess: () => invalidate("family-accounts"),
  });

  return {
    familyAccounts,
    bankAccounts,
    transferSchedules,
    transactions,
    isLoading: accountsLoading || bankAccountsLoading || schedulesLoading || transactionsLoading,
    createFamilyAccount: createFamilyAccountMutation.mutateAsync,
    updateAllocation: updateAllocationMutation.mutateAsync,
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
