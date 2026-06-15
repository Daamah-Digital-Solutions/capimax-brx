import { useState } from "react";
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
import { WithdrawalDialog } from "@/components/wallet/WithdrawalDialog";

const walletData = {
  balance: 12500,
  pendingDeposits: 0,
  pendingWithdrawals: 0,
  totalDeposited: 150000,
  totalWithdrawn: 137500,
  lastUpdated: "2025-01-03 14:30",
};

const transactions = [
  { id: "1", type: "deposit", method: "bank", amount: 5000, status: "completed", date: "2024-12-28", reference: "TXN-2024-001234" },
  { id: "2", type: "investment", property: "Marina Bay Tower", propertyAr: "برج مارينا باي", amount: -3000, status: "completed", date: "2024-12-25", reference: "INV-2024-005678" },
  { id: "3", type: "distribution", property: "Industrial Complex", propertyAr: "المجمع الصناعي", amount: 840, status: "completed", date: "2024-12-01", reference: "DIST-2024-001122" },
  { id: "4", type: "withdrawal", method: "bank", amount: -2000, status: "completed", date: "2024-11-20", reference: "WDR-2024-003344" },
  { id: "5", type: "deposit", method: "card", amount: 10000, status: "completed", date: "2024-11-15", reference: "TXN-2024-005566" },
];

const paymentMethods = [
  { id: "card", nameAr: "بطاقة ائتمان/خصم", nameEn: "Credit/Debit Card", icon: CreditCard, available: true },
  { id: "bank", nameAr: "تحويل بنكي", nameEn: "Bank Transfer", icon: Building2, available: true },
  { id: "apple", nameAr: "Apple Pay", nameEn: "Apple Pay", icon: Smartphone, available: true },
  { id: "google", nameAr: "Google Pay", nameEn: "Google Pay", icon: Smartphone, available: true },
  { id: "crypto", nameAr: "عملات رقمية", nameEn: "Cryptocurrency", icon: Bitcoin, available: true },
  { id: "pronova", nameAr: "توكن Pronova", nameEn: "Pronova Token", icon: Coins, discount: 5, available: true },
  { id: "sukuk", nameAr: "Nova Sukuk", nameEn: "Nova Sukuk", icon: FileText, available: true },
];

export default function Wallet() {
  const { t, language } = useLanguage();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositStep, setDepositStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredTransactions = transactions.filter(t => {
    if (filter === "all") return true;
    if (filter === "deposits") return t.type === "deposit";
    if (filter === "withdrawals") return t.type === "withdrawal";
    if (filter === "investments") return t.type === "investment";
    if (filter === "distributions") return t.type === "distribution";
    return true;
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowDownLeft className="w-4 h-4 text-success" />;
      case "withdrawal": return <ArrowUpRight className="w-4 h-4 text-destructive" />;
      case "investment": return <Building2 className="w-4 h-4 text-primary" />;
      case "distribution": return <Coins className="w-4 h-4 text-success" />;
      default: return <WalletIcon className="w-4 h-4" />;
    }
  };

  const getTransactionLabel = (tx: typeof transactions[0]) => {
    const isAr = language === "ar";
    switch (tx.type) {
      case "deposit": return `${t("wallet.deposit")} - ${tx.method === "bank" ? t("wallet.depositBank") : t("wallet.depositCard")}`;
      case "withdrawal": return `${t("wallet.withdraw")} - ${tx.method === "bank" ? t("wallet.depositBank") : t("wallet.depositCard")}`;
      case "investment": return `${t("wallet.investment")} - ${isAr ? tx.propertyAr : tx.property}`;
      case "distribution": return `${t("wallet.distribution")} - ${isAr ? tx.propertyAr : tx.property}`;
      default: return t("wallet.transaction");
    }
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
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">{t("wallet.availableBalance")}</div>
                  <div className="text-4xl font-bold text-gradient-gold mb-2">
                    ${walletData.balance.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("wallet.lastUpdated")}: {walletData.lastUpdated}
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
                        <div className="text-xl font-bold text-foreground">${walletData.totalDeposited.toLocaleString()}</div>
                      </div>
                    </div>
                    {walletData.pendingDeposits > 0 && (
                      <Badge variant="warning" className="gap-1 mt-2">
                        <Clock className="w-3 h-3" />
                        ${walletData.pendingDeposits.toLocaleString()} {t("wallet.pending")}
                      </Badge>
                    )}
                  </div>

                  <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("wallet.totalWithdrawals")}</div>
                        <div className="text-xl font-bold text-foreground">${walletData.totalWithdrawn.toLocaleString()}</div>
                      </div>
                    </div>
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
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        {t("wallet.export")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center">
                      <WalletIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">{t("wallet.noTransactions")}</h3>
                      <p className="text-muted-foreground">{t("wallet.noTransactionsDesc")}</p>
                    </div>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <div key={transaction.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            transaction.amount > 0 ? "bg-success/10" : "bg-muted"
                          )}>
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{getTransactionLabel(transaction)}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{transaction.date}</span>
                              <span>•</span>
                              <span className="font-mono">{transaction.reference}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "text-lg font-semibold",
                            transaction.amount > 0 ? "text-success" : "text-foreground"
                          )}>
                            {transaction.amount > 0 ? "+" : ""}{transaction.amount.toLocaleString()} USD
                          </div>
                          <Badge variant={transaction.status === "completed" ? "success" : "warning"}>
                            {transaction.status === "completed" ? t("wallet.completed") : t("wallet.pending")}
                          </Badge>
                          <Button variant="ghost" size="icon">
                            <Receipt className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <ReinvestReturnsCard
                availableReturns={walletData.balance > 0 ? Math.min(walletData.balance, 4250) : 0}
                totalReinvested={2500}
                totalBonus={175}
              />

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
                      {method.discount && (
                        <Badge variant="success">{t("payment.discount")} {method.discount}%</Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                {selectedMethod === "pronova" && amount && (
                  <div className="p-4 bg-success/10 rounded-xl border border-success/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{t("wallet.pronovaDiscount")} (5%)</span>
                      <span className="font-semibold text-success">-${(parseFloat(amount) * 0.05).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-medium">{t("wallet.finalAmount")}</span>
                      <span className="font-bold text-primary">${(parseFloat(amount) * 0.95).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDepositStep(1)} className="flex-1">
                    {t("common.back")}
                  </Button>
                  <Button variant="hero" onClick={() => setDepositStep(3)} className="flex-1" disabled={!amount}>
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
                    <span className="font-semibold">${parseFloat(amount).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDepositStep(2)} className="flex-1">
                    {t("common.back")}
                  </Button>
                  <Button variant="hero" onClick={resetDepositFlow} className="flex-1">
                    {t("wallet.confirmAndPay")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Withdraw Dialog - New Enhanced Version */}
        <WithdrawalDialog
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          availableBalance={walletData.balance}
        />
      </div>
    </MainLayout>
  );
}
