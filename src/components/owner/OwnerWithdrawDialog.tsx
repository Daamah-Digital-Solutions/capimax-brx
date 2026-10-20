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
import { Loader2, Landmark, Coins, AlertTriangle, Zap, ExternalLink } from "lucide-react";
import { walletsApi, type PayoutOptions } from "@/integrations/api/client";
import { cn } from "@/lib/utils";
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

// Countries an investor's bank can be in for automatic payouts (Stripe Connect).
const PAYOUT_COUNTRIES = [
  { code: "AE", en: "United Arab Emirates", ar: "الإمارات" },
  { code: "SA", en: "Saudi Arabia", ar: "السعودية" },
  { code: "QA", en: "Qatar", ar: "قطر" },
  { code: "KW", en: "Kuwait", ar: "الكويت" },
  { code: "BH", en: "Bahrain", ar: "البحرين" },
  { code: "OM", en: "Oman", ar: "عُمان" },
  { code: "EG", en: "Egypt", ar: "مصر" },
  { code: "JO", en: "Jordan", ar: "الأردن" },
  { code: "MA", en: "Morocco", ar: "المغرب" },
  { code: "TR", en: "Turkey", ar: "تركيا" },
  { code: "GB", en: "United Kingdom", ar: "المملكة المتحدة" },
  { code: "US", en: "United States", ar: "الولايات المتحدة" },
  { code: "DE", en: "Germany", ar: "ألمانيا" },
  { code: "FR", en: "France", ar: "فرنسا" },
  { code: "IN", en: "India", ar: "الهند" },
  { code: "PK", en: "Pakistan", ar: "باكستان" },
];

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
  // Automatic bank payouts (Stripe Connect) — only offered when the server enables them.
  const [payout, setPayout] = useState<PayoutOptions | null>(null);
  const [route, setRoute] = useState<"auto" | "manual">("manual");
  const [speed, setSpeed] = useState<"standard" | "instant">("standard");
  const [linking, setLinking] = useState(false);
  // The bank account's country — asked before the first link (Stripe creates the payout
  // account in that country).
  const [payoutCountry, setPayoutCountry] = useState("");

  useEffect(() => {
    if (!open) return;
    walletsApi
      .payoutOptions()
      .then((o) => {
        setPayout(o);
        setRoute(o.bank_auto && o.connect_status === "verified" ? "auto" : "manual");
      })
      .catch(() => setPayout(null));
  }, [open]);

  const linkStripe = async () => {
    setLinking(true);
    try {
      const { url } = await walletsApi.payoutConnect(payoutCountry || undefined);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "تعذّر فتح ربط الحساب" : "Could not start linking"));
      setLinking(false);
    }
  };

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
  const autoReady = !!payout?.bank_auto && payout.connect_status === "verified";
  const isAuto = method === "bank" && route === "auto" && autoReady;
  const instantOk = isAuto && !!payout?.instant_enabled && numeric <= (payout?.instant_max ?? 0);
  const isInstant = instantOk && speed === "instant";
  const instantFee = isInstant
    ? Math.ceil(numeric * (payout?.instant_fee_percent ?? 0)) / 100
    : 0;
  const hasDestination = isAuto || (destinations.length > 0 && !!destId);
  const valid =
    numeric > 0 && numeric <= availableBalance && hasDestination && (!isInstant || instantFee < numeric);

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
      await walletsApi.requestWithdrawal(
        isAuto
          ? { amount: numeric, method: "bank", route: "auto", speed: isInstant ? "instant" : "standard" }
          : {
              amount: numeric,
              method,
              ...(method === "bank" ? { bank_account_id: destId } : { crypto_wallet_id: destId }),
            },
      );
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

          {/* Automatic bank payouts via Stripe (when enabled on the server) */}
          {method === "bank" && payout?.bank_auto && (
            <div className="space-y-2">
              {autoReady ? (
                <div className="grid grid-cols-2 gap-2">
                  {(["auto", "manual"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoute(r)}
                      className={cn(
                        "p-2.5 rounded-lg border text-sm text-start transition-colors",
                        route === r ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                      )}
                    >
                      {r === "auto"
                        ? isAr ? "تلقائي (حسابك على Stripe)" : "Automatic (your Stripe account)"
                        : isAr ? "يدوي (حساب بنكي محفوظ)" : "Manual (saved bank account)"}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-2">
                  <p className="text-muted-foreground">
                    {payout.connect_status === "pending"
                      ? isAr
                        ? "ربط حسابك البنكي مع Stripe لم يكتمل بعد."
                        : "Linking your bank with Stripe isn't complete yet."
                      : isAr
                        ? "اربط حسابك البنكي مع Stripe ليصلك السحب تلقائياً."
                        : "Link your bank with Stripe to get withdrawals paid automatically."}
                  </p>
                  {payout.connect_status === "none" && (
                    <Select value={payoutCountry} onValueChange={setPayoutCountry}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={isAr ? "دولة الحساب البنكي" : "Country of your bank account"} />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYOUT_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {isAr ? c.ar : c.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={linkStripe}
                    disabled={linking || (payout.connect_status === "none" && !payoutCountry)}
                  >
                    {linking ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <ExternalLink className="w-4 h-4 me-2" />}
                    {payout.connect_status === "pending"
                      ? isAr ? "أكمل الربط" : "Finish linking"
                      : isAr ? "اربط البنك عبر Stripe" : "Link bank via Stripe"}
                  </Button>
                </div>
              )}
              {isAuto && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(["standard", "instant"] as const).map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        disabled={sp === "instant" && !instantOk}
                        onClick={() => setSpeed(sp)}
                        className={cn(
                          "p-2.5 rounded-lg border text-sm text-start transition-colors disabled:opacity-50",
                          (sp === "instant" ? isInstant : !isInstant)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          {sp === "instant" && <Zap className="w-3.5 h-3.5" />}
                          {sp === "standard" ? (isAr ? "عادي" : "Standard") : isAr ? "فوري" : "Instant"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {sp === "standard"
                            ? isAr ? "بدون رسوم · 1–3 أيام عمل" : "No fee · 1–3 business days"
                            : isAr
                              ? `رسوم ${payout.instant_fee_percent}% · لكارت الخصم`
                              : `${payout.instant_fee_percent}% fee · to your debit card`}
                        </span>
                      </button>
                    ))}
                  </div>
                  {numeric > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {isInstant
                        ? isAr
                          ? `الرسوم $${instantFee.toFixed(2)} · يصلك $${(numeric - instantFee).toFixed(2)}`
                          : `Fee $${instantFee.toFixed(2)} · you receive $${(numeric - instantFee).toFixed(2)}`
                        : null}
                      {numeric > payout.auto_approve_limit
                        ? (isInstant ? " · " : "") +
                          (isAr
                            ? `المبالغ فوق $${payout.auto_approve_limit.toLocaleString()} تُراجع قبل الدفع.`
                            : `Amounts over $${payout.auto_approve_limit.toLocaleString()} are reviewed before payment.`)
                        : null}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Destination — a saved payout method of the chosen type */}
          {!isAuto && (
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
          )}
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
