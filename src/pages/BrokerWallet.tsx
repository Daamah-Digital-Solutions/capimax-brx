import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { OwnerWithdrawDialog } from "@/components/owner/OwnerWithdrawDialog";
import { BankAccountsManager } from "@/components/wallet/BankAccountsManager";
import { CryptoWalletsManager } from "@/components/wallet/CryptoWalletsManager";
import { VisaCardsSection } from "@/components/wallet/VisaCardsSection";
import { CreateVirtualCardButton } from "@/components/wallet/CreateVirtualCardButton";
import { BackendPendingNotice } from "@/components/wallet/BackendPendingNotice";
import { walletsApi } from "@/integrations/api/client";
import { useBrokerCommissions } from "@/hooks/useBrokerCommissions";
import { Wallet, ArrowDownToLine, Award, Clock, Building, Coins } from "lucide-react";

// Broker Wallet (client note 18): a standalone Wallet page + sidebar icon, mirroring the
// other roles, WITHOUT removing the Commissions page. A broker's commission is credited to
// the SAME internal UserBalance as everyone else (platform-borne, additive at settlement),
// so this reads walletsApi.balance() for the withdrawable balance and the broker commission
// endpoint for the earned/pending totals; withdrawal reuses the shared owner/broker dialog.
export default function BrokerWallet() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const { data, balance, refresh: refreshCommissions } = useBrokerCommissions();
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  const refreshWithdrawals = useCallback(async () => {
    const wds = await walletsApi.withdrawals().catch(() => [] as any[]);
    const pending = (wds || [])
      .filter((w: any) => w.status === "pending" || w.status === "processing")
      .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
    setPendingWithdrawals(pending);
  }, []);

  useEffect(() => {
    refreshWithdrawals();
  }, [refreshWithdrawals]);

  const refresh = () => {
    refreshCommissions();
    refreshWithdrawals();
  };

  const num = (s?: string) => Number(s || 0);
  const totalCommission = num(data?.stats.total_commission);
  const pendingCommission = num(data?.stats.pending_commission);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {isAr ? "محفظة الوسيط" : "Broker Wallet"}
                </h1>
                <p className="text-muted-foreground">
                  {isAr
                    ? "رصيدك القابل للسحب وعمولاتك وطرق الدفع"
                    : "Your withdrawable balance, commissions, and payout methods"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CreateVirtualCardButton roleLabel="Broker" />
                <Button variant="hero" className="gap-2" onClick={() => setWithdrawalOpen(true)}>
                  <ArrowDownToLine className="w-4 h-4" />
                  {isAr ? "طلب سحب" : "Request Withdrawal"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Balance Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <Badge variant="success" className="text-xs">
                    {isAr ? "متاح" : "Available"}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-gradient-gold">
                  ${balance.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAr ? "الرصيد المتاح للسحب" : "Available for withdrawal"}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <ArrowDownToLine className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  ${pendingWithdrawals.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAr ? "سحوبات معلقة" : "Pending Withdrawals"}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-5 h-5 text-success" />
                </div>
                <div className="text-2xl font-bold text-success">
                  ${totalCommission.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAr ? "إجمالي العمولات" : "Total Commission"}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-info" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  ${pendingCommission.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isAr ? "عمولات معلقة" : "Pending Commission"}
                </p>
              </CardContent>
            </Card>
          </div>

          <BackendPendingNotice />

          {/* Payout methods */}
          <Tabs defaultValue="bank" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="bank" className="gap-2">
                <Building className="w-4 h-4" />
                {isAr ? "الحسابات البنكية" : "Bank Accounts"}
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-2">
                <Coins className="w-4 h-4" />
                {isAr ? "المحافظ الرقمية" : "Crypto Wallets"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bank">
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isAr ? "إدارة الحسابات البنكية" : "Bank Account Management"}
                  </CardTitle>
                  <CardDescription>
                    {isAr
                      ? "أضف أو عدّل حساباتك البنكية لاستقبال السحوبات"
                      : "Add or edit your bank accounts for receiving withdrawals"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BankAccountsManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crypto">
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isAr ? "إدارة المحافظ الرقمية" : "Crypto Wallet Management"}
                  </CardTitle>
                  <CardDescription>
                    {isAr
                      ? "أضف أو عدّل محافظك الرقمية لاستقبال السحوبات"
                      : "Add or edit your crypto wallets for receiving withdrawals"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CryptoWalletsManager />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Virtual cards */}
          <div className="mt-6">
            <VisaCardsSection
              walletBalance={balance}
              roleLabel={{ en: "Broker", ar: "وسيط" }}
            />
          </div>

          {/* Info Section */}
          <Card className="mt-6 bg-muted/30 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isAr ? "ملاحظة هامة" : "Important Note"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isAr
                      ? "تُضاف العمولات إلى رصيدك تلقائياً عند إتمام صفقات إحالاتك. تُعالج طلبات السحب خلال 1-3 أيام عمل — تأكد من صحة بيانات السحب أولاً."
                      : "Commissions are added to your balance automatically when your referrals' deals settle. Withdrawal requests are processed within 1-3 business days — please confirm your payout details first."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <OwnerWithdrawDialog
        open={withdrawalOpen}
        onOpenChange={setWithdrawalOpen}
        availableBalance={balance}
        onSuccess={refresh}
      />
    </MainLayout>
  );
}
