import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Landmark, Coins, AlertTriangle } from "lucide-react";
import { walletsApi } from "@/integrations/api/client";
import { useInvestorBankAccounts } from "@/hooks/useInvestorBankAccounts";
import { useInvestorCryptoWallets } from "@/hooks/useInvestorCryptoWallets";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface OwnerWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
  onSuccess?: () => void;
}

const maskAddress = (addr: string) =>
  addr && addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

/**
 * Owner/investor payout — Phase 7 Wave D. Withdraws from the internal UserBalance via the
 * shared Django endpoint (POST /api/wallets/withdrawals/). The payout is now routed to one of
 * the caller's SAVED methods (bank account / crypto wallet) so the operator has a real
 * destination — the confirm button stays disabled until a saved method is chosen, and if none
 * exist the user is told to add one in Payment Methods first.
 */
export function OwnerWithdrawDialog({
  open,
  onOpenChange,
  availableBalance,
  onSuccess,
}: OwnerWithdrawDialogProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bank" | "crypto">("bank");
  const [destId, setDestId] = useState("");
  const [busy, setBusy] = useState(false);

  const { accounts } = useInvestorBankAccounts();
  const { wallets } = useInvestorCryptoWallets();

  // The saved destinations for the chosen method type.
  const destinations = useMemo(
    () =>
      method === "bank"
        ? accounts.map((a) => ({
            id: a.id,
            label: `${a.bank_name} · ${a.account_number_masked}`,
            isDefault: a.is_default,
          }))
        : wallets.map((w) => ({
            id: w.id,
            label: `${w.network} · ${w.wallet_label || maskAddress(w.wallet_address)}`,
            isDefault: w.is_default,
          })),
    [method, accounts, wallets],
  );

  // Keep a valid destination selected — default to the user's default (or first) method.
  useEffect(() => {
    if (!destinations.some((d) => d.id === destId)) {
      const def = destinations.find((d) => d.isDefault) ?? destinations[0];
      setDestId(def?.id ?? "");
    }
  }, [destinations, destId]);

  const numeric = Number(amount);
  const hasDestination = destinations.length > 0 && !!destId;
  const valid = numeric > 0 && numeric <= availableBalance && hasDestination;

  const submit = async () => {
    if (!valid) {
      toast.error(
        !hasDestination
          ? isAr
            ? "اختر وجهة سحب محفوظة أولاً"
            : "Choose a saved payout destination first"
          : isAr
            ? "أدخل مبلغاً صحيحاً ضمن رصيدك"
            : "Enter a valid amount within your balance",
      );
      return;
    }
    setBusy(true);
    try {
      await walletsApi.requestWithdrawal({
        amount: numeric,
        method,
        ...(method === "bank" ? { bank_account_id: destId } : { crypto_wallet_id: destId }),
      });
      toast.success(isAr ? "تم إرسال طلب السحب" : "Withdrawal request submitted");
      setAmount("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "تعذّر السحب" : "Withdrawal failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "طلب سحب" : "Request Withdrawal"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? `الرصيد المتاح: $${availableBalance.toLocaleString()}`
              : `Available balance: $${availableBalance.toLocaleString()}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{isAr ? "المبلغ (USD)" : "Amount (USD)"}</Label>
            <Input
              type="number"
              min={0}
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{isAr ? "طريقة السحب" : "Method"}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as "bank" | "crypto")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">
                  <span className="flex items-center gap-2">
                    <Landmark className="w-4 h-4" />
                    {isAr ? "تحويل بنكي" : "Bank transfer"}
                  </span>
                </SelectItem>
                <SelectItem value="crypto">
                  <span className="flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    {isAr ? "عملات رقمية" : "Crypto"}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Destination — a saved payout method of the chosen type */}
          <div className="space-y-1.5">
            <Label>{isAr ? "الوجهة" : "Destination"}</Label>
            {destinations.length > 0 ? (
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={isAr ? "اختر وجهة محفوظة" : "Choose a saved destination"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                      {d.isDefault ? (isAr ? " (افتراضي)" : " (default)") : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  {method === "bank"
                    ? isAr
                      ? "لا يوجد حساب بنكي محفوظ. أضِف حساباً من «طرق الدفع» أولاً."
                      : "No saved bank account. Add one in Payment Methods first."
                    : isAr
                      ? "لا توجد محفظة محفوظة. أضِف محفظة من «طرق الدفع» أولاً."
                      : "No saved crypto wallet. Add one in Payment Methods first."}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={busy || !valid}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isAr ? "تأكيد السحب" : "Confirm withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
