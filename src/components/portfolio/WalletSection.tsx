import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  ExternalLink,
  Copy,
  CheckCircle,
  XCircle,
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
} from "lucide-react";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { TokenHoldings } from "./TokenHoldings";
import { VisaCardsSection } from "@/components/wallet/VisaCardsSection";
import { KycVerification } from "@/components/kyc/KycVerification";

export function WalletSection() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [copied, setCopied] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);

  const {
    wallet,
    kycStatus,
    transactions,
    loading,
    error,
    createWallet,
    refreshData,
    getExplorerUrl,
    getTxExplorerUrl,
  } = useUserWallet();

  const copyAddress = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.wallet_address);
      setCopied(true);
      toast.success(isArabic ? "تم نسخ العنوان" : "Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isArabic ? "فشل النسخ" : "Failed to copy");
    }
  };

  const handleCreateWallet = async () => {
    setCreatingWallet(true);
    const result = await createWallet();
    setCreatingWallet(false);
    if (result.success) {
      toast.success(isArabic ? "تم إنشاء المحفظة بنجاح" : "Wallet created successfully");
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refreshData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {isArabic ? "إعادة المحاولة" : "Try Again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KYC Status Card — unified Phase 4 flow (Sumsub WebSDK, dev fallback). */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isArabic ? "حالة التحقق (KYC)" : "KYC Verification"}
              </CardTitle>
              <CardDescription>
                {isArabic
                  ? "التحقق مطلوب قبل الاستثمار وإنشاء المحفظة"
                  : "Verification is required before investing and wallet creation"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <KycVerification kycStatus={kycStatus} onUpdated={refreshData} />
        </CardContent>
      </Card>

      {/* Wallet Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isArabic ? "محفظة البلوكتشين" : "Blockchain Wallet"}
              </CardTitle>
              <CardDescription>
                {wallet 
                  ? (isArabic ? "محفظتك لحفظ الرموز والتوزيعات" : "Your wallet for tokens and distributions")
                  : (isArabic ? "يتم إنشاء المحفظة بعد اعتماد التحقق" : "Wallet is created after KYC approval")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {wallet ? (
            <div className="space-y-4">
              {/* Wallet Address */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {isArabic ? "عنوان المحفظة" : "Wallet Address"}
                  </p>
                  <p className="font-mono text-sm">{formatAddress(wallet.wallet_address)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={copyAddress}>
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a 
                      href={getExplorerUrl(wallet.wallet_address, wallet.network)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Wallet Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? "الشبكة" : "Network"}
                  </p>
                  <p className="font-medium capitalize">{wallet.network}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? "نوع المحفظة" : "Wallet Type"}
                  </p>
                  <p className="font-medium capitalize">{wallet.wallet_type}</p>
                </div>
              </div>

              {/* View on Explorer Button */}
              <Button variant="outline" className="w-full" asChild>
                <a 
                  href={getExplorerUrl(wallet.wallet_address, wallet.network)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {isArabic ? "عرض في مستكشف البلوكتشين" : "View on Blockchain Explorer"}
                </a>
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              {kycStatus?.status === "approved" ? (
                <>
                  <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {isArabic 
                      ? "تم اعتماد التحقق! يمكنك الآن إنشاء محفظتك"
                      : "KYC approved! You can now create your wallet"}
                  </p>
                  <Button onClick={handleCreateWallet} disabled={creatingWallet}>
                    <Wallet className="h-4 w-4 mr-2" />
                    {creatingWallet 
                      ? (isArabic ? "جاري الإنشاء..." : "Creating...")
                      : (isArabic ? "إنشاء المحفظة" : "Create Wallet")}
                  </Button>
                </>
              ) : (
                <>
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isArabic 
                      ? "يرجى إكمال التحقق أولاً لإنشاء محفظتك"
                      : "Please complete KYC verification first to create your wallet"}
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Holdings - Real-time updates */}
      {wallet && (
        <TokenHoldings walletId={wallet.id} />
      )}

      {/* Visa Cards */}
      <VisaCardsSection
        roleLabel={{ en: "Investor", ar: "مستثمر" }}
      />

      {/* Transactions Card */}
      {wallet && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isArabic ? "المعاملات الأخيرة" : "Recent Transactions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        tx.tx_type === "receive" 
                          ? "bg-green-500/20" 
                          : "bg-blue-500/20"
                      }`}>
                        {tx.tx_type === "receive" 
                          ? <ArrowDownLeft className="h-4 w-4 text-green-500" />
                          : <ArrowUpRight className="h-4 w-4 text-blue-500" />
                        }
                      </div>
                      <div>
                        <p className="font-medium capitalize">{tx.tx_type}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {tx.tx_hash.slice(0, 10)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {tx.amount && (
                        <p className="font-medium">
                          {tx.amount} {tx.token_symbol || "ETH"}
                        </p>
                      )}
                      <a 
                        href={getTxExplorerUrl(tx.tx_hash, wallet.network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {isArabic ? "عرض" : "View"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {isArabic ? "لا توجد معاملات بعد" : "No transactions yet"}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}