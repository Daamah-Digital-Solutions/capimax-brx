import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { LiquidityProvider, LPTransaction } from "@/hooks/useLiquidityProvider";
import {
  Wallet,
  Building2,
  Bitcoin,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface LPWithdrawalsProps {
  lpProfile: LiquidityProvider;
  transactions: LPTransaction[];
  onWithdraw: (data: { amount: number; withdrawal_method: "bank" | "crypto"; notes?: string }) => Promise<{ success: boolean }>;
  onUpdateBank: (data: { bank_name: string; bank_account_number: string; bank_iban: string; bank_swift: string }) => Promise<{ success: boolean }>;
  onUpdateCrypto: (data: { crypto_wallet_address: string; crypto_network: string }) => Promise<{ success: boolean }>;
  isRTL: boolean;
}

export function LPWithdrawals({
  lpProfile,
  transactions,
  onWithdraw,
  onUpdateBank,
  onUpdateCrypto,
  isRTL,
}: LPWithdrawalsProps) {
  const [withdrawMethod, setWithdrawMethod] = useState<"bank" | "crypto">("bank");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showCryptoForm, setShowCryptoForm] = useState(false);

  // Bank details form
  const [bankData, setBankData] = useState({
    bank_name: lpProfile.bank_name || "",
    bank_account_number: lpProfile.bank_account_number || "",
    bank_iban: lpProfile.bank_iban || "",
    bank_swift: lpProfile.bank_swift || "",
  });

  // Crypto details form
  const [cryptoData, setCryptoData] = useState({
    crypto_wallet_address: lpProfile.crypto_wallet_address || "",
    crypto_network: lpProfile.crypto_network || "ethereum",
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const withdrawalTransactions = transactions.filter((tx) => tx.tx_type === "withdrawal");

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await onWithdraw({
      amount: parseFloat(withdrawAmount),
      withdrawal_method: withdrawMethod,
      notes: notes || undefined,
    });

    setWithdrawAmount("");
    setNotes("");
    setLoading(false);
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await onUpdateBank(bankData);
    if (result.success) setShowBankForm(false);
    setLoading(false);
  };

  const handleUpdateCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await onUpdateCrypto(cryptoData);
    if (result.success) setShowCryptoForm(false);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "success" | "destructive" | "secondary"; icon: React.ElementType }> = {
      pending: { variant: "secondary", icon: Clock },
      processing: { variant: "default", icon: RefreshCw },
      completed: { variant: "success", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const { variant, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const hasBankDetails = lpProfile.bank_name && lpProfile.bank_iban;
  const hasCryptoDetails = lpProfile.crypto_wallet_address;

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "الرصيد المتاح للسحب" : "Available for Withdrawal"}
              </p>
              <p className="text-3xl font-bold">{formatCurrency(lpProfile.current_balance)}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Withdrawal Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5" />
              {isRTL ? "طلب سحب" : "Request Withdrawal"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "اختر طريقة السحب وأدخل المبلغ"
                : "Select withdrawal method and enter amount"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-6">
              {/* Method Selection */}
              <RadioGroup
                value={withdrawMethod}
                onValueChange={(v) => setWithdrawMethod(v as "bank" | "crypto")}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="bank"
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    withdrawMethod === "bank"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="bank" id="bank" />
                  <Building2 className="w-5 h-5" />
                  <span>{isRTL ? "حساب بنكي" : "Bank Account"}</span>
                </Label>
                <Label
                  htmlFor="crypto"
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    withdrawMethod === "crypto"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="crypto" id="crypto" />
                  <Bitcoin className="w-5 h-5" />
                  <span>{isRTL ? "محفظة كريبتو" : "Crypto Wallet"}</span>
                </Label>
              </RadioGroup>

              {/* Show warning if no details configured */}
              {withdrawMethod === "bank" && !hasBankDetails && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      {isRTL ? "لم يتم إعداد الحساب البنكي" : "Bank account not configured"}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-primary"
                      onClick={() => setShowBankForm(true)}
                    >
                      {isRTL ? "إضافة التفاصيل البنكية" : "Add bank details"}
                    </Button>
                  </div>
                </div>
              )}

              {withdrawMethod === "crypto" && !hasCryptoDetails && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      {isRTL ? "لم يتم إعداد محفظة الكريبتو" : "Crypto wallet not configured"}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-primary"
                      onClick={() => setShowCryptoForm(true)}
                    >
                      {isRTL ? "إضافة عنوان المحفظة" : "Add wallet address"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-2">
                <Label>{isRTL ? "مبلغ السحب" : "Withdrawal Amount"}</Label>
                <Input
                  type="number"
                  min="100"
                  max={lpProfile.current_balance}
                  step="100"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "الحد الأدنى: 100 دولار" : "Minimum: $100"}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات (اختياري)" : "Notes (Optional)"}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRTL ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                disabled={
                  loading ||
                  !withdrawAmount ||
                  parseFloat(withdrawAmount) > lpProfile.current_balance ||
                  (withdrawMethod === "bank" && !hasBankDetails) ||
                  (withdrawMethod === "crypto" && !hasCryptoDetails)
                }
                className="w-full"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    {isRTL ? "طلب السحب" : "Request Withdrawal"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <div className="space-y-6">
          {/* Bank Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {isRTL ? "التفاصيل البنكية" : "Bank Details"}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBankForm(!showBankForm)}>
                {showBankForm ? (isRTL ? "إلغاء" : "Cancel") : (isRTL ? "تعديل" : "Edit")}
              </Button>
            </CardHeader>
            <CardContent>
              {showBankForm ? (
                <form onSubmit={handleUpdateBank} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? "اسم البنك" : "Bank Name"}</Label>
                      <Input
                        value={bankData.bank_name}
                        onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? "رقم الحساب" : "Account Number"}</Label>
                      <Input
                        value={bankData.bank_account_number}
                        onChange={(e) => setBankData({ ...bankData, bank_account_number: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IBAN</Label>
                      <Input
                        value={bankData.bank_iban}
                        onChange={(e) => setBankData({ ...bankData, bank_iban: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SWIFT</Label>
                      <Input
                        value={bankData.bank_swift}
                        onChange={(e) => setBankData({ ...bankData, bank_swift: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {isRTL ? "حفظ" : "Save"}
                  </Button>
                </form>
              ) : hasBankDetails ? (
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">{isRTL ? "البنك:" : "Bank:"}</span> {lpProfile.bank_name}</div>
                  <div><span className="text-muted-foreground">IBAN:</span> {lpProfile.bank_iban}</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "لم يتم إضافة تفاصيل بنكية" : "No bank details added"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Crypto Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bitcoin className="w-5 h-5" />
                {isRTL ? "محفظة الكريبتو" : "Crypto Wallet"}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowCryptoForm(!showCryptoForm)}>
                {showCryptoForm ? (isRTL ? "إلغاء" : "Cancel") : (isRTL ? "تعديل" : "Edit")}
              </Button>
            </CardHeader>
            <CardContent>
              {showCryptoForm ? (
                <form onSubmit={handleUpdateCrypto} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "عنوان المحفظة" : "Wallet Address"}</Label>
                    <Input
                      value={cryptoData.crypto_wallet_address}
                      onChange={(e) => setCryptoData({ ...cryptoData, crypto_wallet_address: e.target.value })}
                      placeholder="0x..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "الشبكة" : "Network"}</Label>
                    <select
                      value={cryptoData.crypto_network}
                      onChange={(e) => setCryptoData({ ...cryptoData, crypto_network: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                    >
                      <option value="ethereum">Ethereum (ERC-20)</option>
                      <option value="polygon">Polygon</option>
                      <option value="bsc">BNB Smart Chain</option>
                      <option value="tron">Tron (TRC-20)</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {isRTL ? "حفظ" : "Save"}
                  </Button>
                </form>
              ) : hasCryptoDetails ? (
                <div className="space-y-2 text-sm">
                  <div className="break-all">
                    <span className="text-muted-foreground">{isRTL ? "العنوان:" : "Address:"}</span>{" "}
                    {lpProfile.crypto_wallet_address}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isRTL ? "الشبكة:" : "Network:"}</span>{" "}
                    {lpProfile.crypto_network}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "لم يتم إضافة محفظة كريبتو" : "No crypto wallet added"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isRTL ? "سجل السحوبات" : "Withdrawal History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowUpRight className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{isRTL ? "لا توجد سحوبات بعد" : "No withdrawals yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawalTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                      {tx.withdrawal_method === "crypto" ? (
                        <Bitcoin className="w-5 h-5 text-orange-500" />
                      ) : (
                        <Building2 className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium capitalize">
                        {tx.withdrawal_method === "crypto"
                          ? isRTL ? "سحب كريبتو" : "Crypto Withdrawal"
                          : isRTL ? "تحويل بنكي" : "Bank Transfer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-500">-{formatCurrency(tx.amount)}</p>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
