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
import { walletsApi, ownerApi } from "@/integrations/api/client";
import {
  Wallet,
  ArrowDownToLine,
  TrendingUp,
  Package,
  Building,
  Coins,
} from "lucide-react";

export default function OwnerWallet() {
  const { language } = useLanguage();
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);

  // Phase 7 Wave D: real owner balance + primary-sale earnings from Django.
  const [availableBalance, setAvailableBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalUnitsSold, setTotalUnitsSold] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [bal, earn, withdrawals] = await Promise.all([
        walletsApi.balance().catch(() => ({ current_balance: 0, currency: "USD" })),
        ownerApi.earnings().catch(() => ({ total_net_proceeds: 0, total_units_sold: 0 } as any)),
        walletsApi.withdrawals().catch(() => [] as any[]),
      ]);
      setAvailableBalance(bal.current_balance || 0);
      setTotalEarnings(earn.total_net_proceeds || 0);
      setTotalUnitsSold(earn.total_units_sold || 0);
      const pending = (withdrawals || [])
        .filter((w: any) => w.status === "pending" || w.status === "processing")
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
      setPendingWithdrawals(pending);
    } catch {
      /* keep prior values */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {language === "ar" ? "محفظة المالك" : "Owner Wallet"}
                </h1>
                <p className="text-muted-foreground">
                  {language === "ar"
                    ? "إدارة حساباتك المصرفية ومحافظك الرقمية"
                    : "Manage your bank accounts and crypto wallets"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CreateVirtualCardButton roleLabel="Property Owner" />
                <Button
                  variant="hero"
                  className="gap-2"
                  onClick={() => setWithdrawalOpen(true)}
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  {language === "ar" ? "طلب سحب" : "Request Withdrawal"}
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
                    {language === "ar" ? "متاح" : "Available"}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-gradient-gold">
                  ${availableBalance.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === "ar" ? "الرصيد المتاح للسحب" : "Available for withdrawal"}
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
                  {language === "ar" ? "سحوبات معلقة" : "Pending Withdrawals"}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div className="text-2xl font-bold text-success">
                  ${totalEarnings.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === "ar" ? "إجمالي أرباح المبيعات الأولية" : "Total Primary-Sale Earnings"}
                </p>
              </CardContent>
            </Card>

            {/* Real owner metric (units sold). NOTE: investor rental-yield
                "distributions" are a SEPARATE, later domain — not shown as owner earnings. */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-info" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {totalUnitsSold.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === "ar" ? "إجمالي الوحدات المباعة" : "Total Units Sold"}
                </p>
              </CardContent>
            </Card>
          </div>

          <BackendPendingNotice />

          {/* Payment Methods Tabs */}
          <Tabs defaultValue="bank" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="bank" className="gap-2">
                <Building className="w-4 h-4" />
                {language === "ar" ? "الحسابات البنكية" : "Bank Accounts"}
              </TabsTrigger>
              <TabsTrigger value="crypto" className="gap-2">
                <Coins className="w-4 h-4" />
                {language === "ar" ? "المحافظ الرقمية" : "Crypto Wallets"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bank">
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === "ar" ? "إدارة الحسابات البنكية" : "Bank Account Management"}
                  </CardTitle>
                  <CardDescription>
                    {language === "ar"
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
                    {language === "ar" ? "إدارة المحافظ الرقمية" : "Crypto Wallet Management"}
                  </CardTitle>
                  <CardDescription>
                    {language === "ar"
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

          {/* Visa Cards */}
          <div className="mt-6">
            <VisaCardsSection
              walletBalance={availableBalance}
              roleLabel={{ en: "Property Owner", ar: "مالك عقار" }}
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
                    {language === "ar" ? "ملاحظة هامة" : "Important Note"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? "يتم معالجة طلبات السحب خلال 1-3 أيام عمل. تأكد من صحة بيانات حسابك البنكي أو محفظتك الرقمية قبل طلب السحب."
                      : "Withdrawal requests are processed within 1-3 business days. Please ensure your bank account or crypto wallet details are correct before requesting a withdrawal."}
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
        availableBalance={availableBalance}
        onSuccess={refresh}
      />
    </MainLayout>
  );
}
