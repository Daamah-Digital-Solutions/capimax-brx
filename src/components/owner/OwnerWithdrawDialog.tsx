import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { walletsApi } from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface OwnerWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
  onSuccess?: () => void;
}

/**
 * Owner payout — Phase 7 Wave D. Withdraws from the owner's internal UserBalance via
 * the SAME Django endpoint investors/LPs use (POST /api/wallets/withdrawals/). Replaces
 * the legacy Supabase OTP WithdrawalDialog on the owner wallet (the Django flow is the
 * built source of truth; the OTP variant stays only on not-yet-migrated investor pages).
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
  const [busy, setBusy] = useState(false);

  const numeric = Number(amount);
  const valid = numeric > 0 && numeric <= availableBalance;

  const submit = async () => {
    if (!valid) {
      toast.error(
        isAr ? "أدخل مبلغاً صحيحاً ضمن رصيدك" : "Enter a valid amount within your balance",
      );
      return;
    }
    setBusy(true);
    try {
      await walletsApi.requestWithdrawal({ amount: numeric, method });
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
      <DialogContent>
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
                <SelectItem value="bank">{isAr ? "تحويل بنكي" : "Bank transfer"}</SelectItem>
                <SelectItem value="crypto">{isAr ? "عملات رقمية" : "Crypto"}</SelectItem>
              </SelectContent>
            </Select>
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
