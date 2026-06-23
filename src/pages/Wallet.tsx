import { useState, useEffect, useCallback } from "react";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Minus,
  CreditCard,
  Building2,
  Smartphone,
  Bitcoin,
  Coins,
  Clock,
  Download,
  Filter,
  RefreshCw,
  ChevronRight,
  Receipt,
  FileText,
  Settings,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReinvestReturnsCard } from "@/components/dashboard/ReinvestReturnsCard";
import { BankAccountsManager } from "@/components/wallet/BankAccountsManager";
import { CryptoWalletsManager } from "@/components/wallet/CryptoWalletsManager";
import { SavedCardsManager } from "@/components/wallet/SavedCardsManager";
// Phase 12 finishing: the investor wallet now uses the REAL Django flow + the shared
// Django withdrawal dialog (replaces the legacy Supabase-OTP WithdrawalDialog).
import { OwnerWithdrawDialog } from "@/components/owner/OwnerWithdrawDialog";
import { DepositPayStep } from "@/components/wallet/DepositPayStep";
import { walletsApi, reportsApi, type BalanceTransactionRow } from "@/integrations/api/client";
import { useExport } from "@/hooks/useExport";
import { toast } from "sonner";

// Internal-balance ledger source → bilingual label (rendered by source, NOT a stored
// display string — same approach as Distributions/Notifications). Unknown sources are
// humanized from the source key.
const SOURCE_LABEL: Record<string, { en: string; ar: string }> = {
  distribution: { en: "Distribution", ar: "توزيع أرباح" },
  primary_sale: { en: "Primary sale proceeds", ar: "عائدات البيع الأولي" },
  secondary_sale: { en: "Secondary sale proceeds", ar: "عائدات البيع الثانوي" },
  lp_market_sale: { en: "Market sale proceeds", ar: "عائدات بيع السوق" },
  lp_market_purchase: { en: "Market purchase", ar: "شراء من السوق" },
  broker_commission: { en: "Referral commission", ar: "عمولة الإحالة" },
  withdrawal: { en: "Withdrawal", ar: "سحب" },
};

// Deposit methods. ONLY card + crypto have a real gated rail (Stripe / NOW). The others
// have no wired pay-in rail yet → kept (DELETE NOTHING) but disabled "Coming soon". The
// Pronova 5% discount + Sukuk are a deferred product (no Pronova token) — NO fake discount.
const paymentMethods = [
  { id: "card", nameAr: "بطاقة ائتمان/خصم", nameEn: "Credit/Debit Card", icon: CreditCard, available: true },
  { id: "crypto", nameAr: "عملات رقمية", nameEn: "Cryptocurrency", icon: Bitcoin, available: true },
  { id: "bank", nameAr: "تحويل بنكي", nameEn: "Bank Transfer", icon: Building2, available: false },
  { id: "apple", nameAr: "Apple Pay", nameEn: "Apple Pay", icon: Smartphone, available: false },
  { id: "google", nameAr: "Google Pay", nameEn: "Google Pay", icon: Smartphone, available: false },
  { id: "pronova", nameAr: "توكن Pronova", nameEn: "Pronova Token", icon: Coins, available: false },
  { id: "sukuk", nameAr: "Nova Sukuk", nameEn: "Nova Sukuk", icon: FileText, available: false },
];

export default function Wallet() {
  const { t, language } = useLanguage();
  const { exporting, run: runExport } = useExport();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositStep, setDepositStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [filter, setFilter] = useState("all");
  const isAr = language === "ar";

  // REAL Django data: internal balance + ledger history + withdrawals (self-scoped).
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<BalanceTransactionRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (notify = false) => {
    if (notify) setRefreshing(true);
    try {
      const [bal, txs, wds] = await Promise.all([
        walletsApi.balance().catch(() => ({ current_balance: 0, currency: "USD" })),
        walletsApi.balanceTransactions().catch(() => [] as BalanceTransactionRow[]),
        walletsApi.withdrawals().catch(() => [] as any[]),
      ]);
      setBalance(Number(bal.current_balance) || 0);
      setLedger(txs || []);
      setWithdrawals(wds || []);
      if (notify) toast.success(isAr ? "تم تحديث المحفظة" : "Wallet refreshed");
    } catch {
      if (notify) toast.error(isAr ? "تعذّر التحديث" : "Couldn't refresh");
    } finally {
      setLoading(false);
      if (notify) setRefreshing(false);
    }
  }, [isAr]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derived stat figures from the REAL ledger + withdrawals.
  const totalDeposited = ledger
    .filter((tx) => tx.entry_type === "credit")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending" || w.status === "processing")
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const lastUpdated = ledger[0]?.created_at
    ? new Date(ledger[0].created_at).toLocaleString(isAr ? "ar" : "en")
    : "—";

  // Signed amount (credit = +, debit = −) straight from the authoritative entry_type.
  const signedAmount = (tx: BalanceTransactionRow) =>
    tx.entry_type === "credit" ? Number(tx.amount) : -Number(tx.amount);

  const filteredTransactions = ledger.filter((tx) => {
    if (filter === "all") return true;
    if (filter === "deposits") return tx.entry_type === "credit";
    if (filter === "withdrawals") return tx.source.includes("withdrawal");
    if (filter === "investments") return tx.entry_type === "debit" && !tx.source.includes("withdrawal");
    if (filter === "distributions") return tx.source === "distribution";
    return true;
  });

  const getTransactionIcon = (tx: BalanceTransactionRow) => {
    if (tx.source.includes("withdrawal")) return <ArrowUpRight className="w-4 h-4 text-destructive" />;
    if (tx.source === "distribution") return <Coins className="w-4 h-4 text-success" />;
    if (tx.entry_type === "debit") return <Building2 className="w-4 h-4 text-primary" />;
    return <ArrowDownLeft className="w-4 h-4 text-success" />;
  };

  const getTransactionLabel = (tx: BalanceTransactionRow) => {
    const mapped = SOURCE_LABEL[tx.source];
    return mapped ? (isAr ? mapped.ar : mapped.en) : tx.source.replace(/_/g, " ");
  };

  const resetDepositFlow = () => {
    setShowDeposit(false);
    setDepositStep(1);
    setSelectedMethod(null);
    setAmount("");
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {t("wallet.title")}
                </h1>
                <p className="text-muted-foreground">{t("wallet.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={() => setShowWithdraw(true)}>
                  <Minus className="w-4 h-4" />
                  {t("wallet.withdraw")}
                </Button>
                <Button variant="hero" className="gap-2" onClick={() => setShowDeposit(true)}>
                  <Plus className="w-4 h-4" />
                  {t("wallet.deposit")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Balance Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-gold rounded-2xl flex items-center justify-center shadow-gold">
                      <WalletIcon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => refresh(true)} disabled={refreshing}>
                      <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">{t("wallet.availableBalance")}</div>
                  <div className="text-4xl font-bold text-gradient-gold mb-2">
                    ${balance.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("wallet.lastUpdated")}: {lastUpdated}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                        <ArrowDownLeft className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("wallet.totalDeposits")}</div>
                        <div className="text-xl font-bold text-foreground">${totalDeposited.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("wallet.totalWithdrawals")}</div>
                        <div className="text-xl font-bold text-foreground">${totalWithdrawn.toLocaleString()}</div>
                      </div>
                    </div>
                    {pendingWithdrawals > 0 && (
                      <Badge variant="warning" className="gap-1 mt-2">
                        <Clock className="w-3 h-3" />
                        ${pendingWithdrawals.toLocaleString()} {t("wallet.pending")}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in" style={{ animationDelay: "0.15s" }}>
                <div className="p-6 border-b border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="font-display text-xl font-semibold text-foreground">{t("wallet.transactionHistory")}</h2>
                    <div className="flex items-center gap-3">
                      <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-40">
                          <Filter className="w-4 h-4 mr-2" />
                          <SelectValue placeholder={t("common.filter")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("wallet.allTransactions")}</SelectItem>
                          <SelectItem value="deposits">{t("wallet.deposits")}</SelectItem>
                          <SelectItem value="withdrawals">{t("wallet.withdrawals")}</SelectItem>
                          <SelectItem value="investments">{t("wallet.investments")}</SelectItem>
                          <SelectItem value="distributions">{t("wallet.distributionsFilter")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={exporting !== null}
                        onClick={() => runExport("wallet", () => reportsApi.export("wallet", "csv"))}
                      >
                        <Download className="w-4 h-4" />
                        {t("wallet.export")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {loading ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
                      {isAr ? "جارٍ التحميل..." : "Loading..."}
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center">
                      <WalletIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">{t("wallet.noTransactions")}</h3>
                      <p className="text-muted-foreground">{t("wallet.noTransactionsDesc")}</p>
                    </div>
                  ) : (
                    filteredTransactions.map((transaction) => {
                      const amt = signedAmount(transaction);
                      return (
                      <div key={transaction.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            amt > 0 ? "bg-success/10" : "bg-muted"
                          )}>
                            {getTransactionIcon(transaction)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{getTransactionLabel(transaction)}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{new Date(transaction.created_at).toLocaleDateString(isAr ? "ar" : "en")}</span>
                              {transaction.reference && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">{transaction.reference}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "text-lg font-semibold",
                            amt > 0 ? "text-success" : "text-foreground"
                          )}>
                            {amt > 0 ? "+" : ""}{amt.toLocaleString()} USD
                          </div>
                          <Badge variant="success">
                            {t("wallet.completed")}
                          </Badge>
                          {/* Per-transaction receipt is a deferred enhancement (no receipt
                              endpoint yet) — kept, disabled, not a silent no-op. */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            title={isAr ? "قريباً" : "Coming soon"}
                          >
                            <Receipt className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Real internal balance (no clamp; mirrors Portfolio). */}
              <ReinvestReturnsCard availableReturns={balance} />

              {/* Payment Methods Management */}
              <div className="bg-card rounded-2xl border border-border p-6 space-y-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      {language === "ar" ? "طرق الدفع والسحب" : "Payment Methods"}
                    </h2>
                  </div>
                </div>

                <BankAccountsManager />
                
                <div className="border-t border-border pt-6">
                  <CryptoWalletsManager />
                </div>
                
                <div className="border-t border-border pt-6">
                  <SavedCardsManager />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deposit Dialog */}
        <Dialog open={showDeposit} onOpenChange={resetDepositFlow}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">{t("wallet.depositFunds")}</DialogTitle>
              <DialogDescription>
                {depositStep === 1 && t("wallet.selectPaymentMethod")}
                {depositStep === 2 && t("wallet.enterAmount")}
                {depositStep === 3 && t("wallet.confirmDeposit")}
              </DialogDescription>
            </DialogHeader>

            {depositStep === 1 && (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedMethod(method.id);
                      setDepositStep(2);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                      method.available 
                        ? "border-border hover:border-primary/50 hover:bg-muted/50" 
                        : "border-border/50 opacity-50 cursor-not-allowed"
                    )}
                    disabled={!method.available}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <method.icon className="w-5 h-5 text-foreground" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-foreground">{language === "ar" ? method.nameAr : method.nameEn}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.available ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Badge variant="secondary">{language === "ar" ? "قريباً" : "Coming soon"}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {depositStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("wallet.depositAmount")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-2xl font-bold h-14"
                  />
                </div>
                <div className="flex gap-2">
                  {[500, 1000, 5000, 10000].map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(preset.toString())}
                      className="flex-1"
                    >
                      ${preset.toLocaleString()}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDepositStep(1)} className="flex-1">
                    {t("common.back")}
                  </Button>
                  <Button
                    variant="hero"
                    onClick={() => setDepositStep(3)}
                    className="flex-1"
                    disabled={!amount || parseFloat(amount) <= 0}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            )}

            {depositStep === 3 && (
              <div className="space-y-6">
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("wallet.depositAmount")}</span>
                    <span className="font-semibold">${parseFloat(amount || "0").toLocaleString()}</span>
                  </div>
                </div>

                {/* REAL gated deposit — Stripe card or NOW crypto. On the confirmed
                    webhook/IPN the balance is credited (no mint); we poll + refresh.
                    With no provider keys this shows an honest "not configured" panel
                    (replaces the old silent resetDepositFlow() no-op). */}
                <DepositPayStep
                  method={selectedMethod === "crypto" ? "crypto" : "card"}
                  amount={parseFloat(amount || "0")}
                  onPaid={() => {
                    resetDepositFlow();
                    refresh();
                  }}
                />

                <Button variant="outline" onClick={() => setDepositStep(2)} className="w-full">
                  {t("common.back")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Withdraw — the real Django flow (shared with the owner wallet). Replaces the
            legacy Supabase-OTP WithdrawalDialog. On success it refetches balance + history. */}
        <OwnerWithdrawDialog
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          availableBalance={balance}
          onSuccess={refresh}
        />
      </div>
    </MainLayout>
  );
}
