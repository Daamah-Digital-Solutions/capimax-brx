import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLiquidityProvider } from "@/hooks/useLiquidityProvider";
import { LPRegistrationFlow } from "@/components/liquidity/LPRegistrationFlow";
import { LPOperationsDashboard } from "@/components/liquidity/LPOperationsDashboard";
import { LPReports } from "@/components/liquidity/LPReports";
import { LPWithdrawals } from "@/components/liquidity/LPWithdrawals";
import { VisaCardsSection } from "@/components/wallet/VisaCardsSection";
import { CreateVirtualCardButton } from "@/components/wallet/CreateVirtualCardButton";
import { LPDocuments } from "@/components/liquidity/LPDocuments";
import { LPAccountManager } from "@/components/liquidity/LPAccountManager";
import { LPAnalyticsCharts } from "@/components/liquidity/LPAnalyticsCharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  Droplets,
  FileText,
  BarChart3,
  Wallet,
  FolderOpen,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogIn,
  LineChart,
  RefreshCw,
  Shield,
  Building2,
} from "lucide-react";

export default function LiquidityProvider() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    lpProfile, 
    transactions, 
    documents, 
    loading, 
    applyAsLP, 
    submitKYB,
    uploadKYBDocument,
    updateBankDetails, 
    updateCryptoDetails, 
    requestWithdrawal, 
    uploadDocument, 
    downloadDocument, 
    deleteDocument, 
    refresh 
  } = useLiquidityProvider();
  const [activeTab, setActiveTab] = useState("overview");

  // Sidebar deep-links to this page via hash anchors (#operations / #reports /
  // #withdrawals — see AppSidebar). The tabs are useState-driven, so without this the
  // hash was ignored and every link opened Overview. Sync hash → activeTab on mount and
  // on hashchange; an empty/invalid hash falls back to overview.
  const LP_TABS = ["overview", "operations", "reports", "withdrawals", "analytics", "documents"];
  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.replace("#", "");
      setActiveTab(LP_TABS.includes(h) ? h : "overview");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL hash in sync when the user clicks a tab in-page (so a refresh / copied
  // link reopens the same tab). Overview clears the hash to keep the URL clean.
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const next = value === "overview" ? window.location.pathname : `#${value}`;
    window.history.replaceState(null, "", next);
  };

  const isRTL = language === "ar";

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <LogIn className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">
                {isRTL ? "تسجيل الدخول مطلوب" : "Login Required"}
              </h2>
              <p className="text-muted-foreground">
                {isRTL
                  ? "يرجى تسجيل الدخول للوصول إلى لوحة مزودي السيولة"
                  : "Please log in to access the Liquidity Provider Dashboard"}
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                {isRTL ? "تسجيل الدخول" : "Log In"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  // Status badge renderer
  const renderStatusBadge = () => {
    if (!lpProfile) return null;

    const statusConfig = {
      pending: {
        icon: Clock,
        text: isRTL ? "قيد المراجعة" : "Pending Review",
        className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
      },
      approved: {
        icon: CheckCircle,
        text: isRTL ? "معتمد" : "Approved",
        className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      },
      rejected: {
        icon: XCircle,
        text: isRTL ? "مرفوض" : "Rejected",
        className: "bg-destructive/10 text-destructive border-destructive/30",
      },
      suspended: {
        icon: AlertCircle,
        text: isRTL ? "معلق" : "Suspended",
        className: "bg-orange-500/10 text-orange-500 border-orange-500/30",
      },
    };

    const config = statusConfig[lpProfile.status];
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.className}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{config.text}</span>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
              <Droplets className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {isRTL ? "لوحة مزودي السيولة" : "Liquidity Provider Dashboard"}
              </h1>
              <p className="text-muted-foreground">
                {isRTL
                  ? "إدارة السيولة والتقارير والسحوبات"
                  : "Manage liquidity, reports, and withdrawals"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {lpProfile && renderStatusBadge()}
            <CreateVirtualCardButton roleLabel="Liquidity Provider" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isRTL ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Show registration flow if no LP profile or KYB not complete */}
        {!lpProfile ? (
          <LPRegistrationFlow
            onSubmitRegistration={applyAsLP}
            onSubmitKYB={submitKYB}
            onUploadDocument={uploadKYBDocument}
            isRTL={isRTL}
          />
        ) : lpProfile.status === "pending" && lpProfile.kyb_status === "not_started" ? (
          // LP registered but KYB not started - show KYB flow
          <div className="space-y-6">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {isRTL ? "التحقق من الأعمال مطلوب" : "Business Verification Required"}
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      {isRTL
                        ? "لإكمال تسجيلك، يرجى تقديم معلومات عملك ومستندات التحقق."
                        : "To complete your registration, please submit your business information and verification documents."}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        {isRTL ? "التحقق معلق" : "KYB Pending"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <LPRegistrationFlow
              onSubmitRegistration={applyAsLP}
              onSubmitKYB={submitKYB}
              onUploadDocument={uploadKYBDocument}
              isRTL={isRTL}
            />
          </div>
        ) : lpProfile.status === "pending" && lpProfile.kyb_status === "under_review" ? (
          // KYB submitted, waiting for approval
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
                <Building2 className="w-10 h-10 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold">
                {isRTL ? "طلبك قيد المراجعة" : "Your Application is Under Review"}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {isRTL
                  ? "تم استلام معلومات عملك ومستنداتك. فريقنا يراجعها الآن. يستغرق هذا عادةً 2-5 أيام عمل."
                  : "We've received your business information and documents. Our team is reviewing them now. This typically takes 2-5 business days."}
              </p>
              <div className="flex justify-center gap-4 pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{isRTL ? "تاريخ التقديم" : "Submitted"}</p>
                  <p className="font-medium">
                    {lpProfile.kyb_submitted_at
                      ? new Date(lpProfile.kyb_submitted_at).toLocaleDateString()
                      : new Date(lpProfile.applied_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{isRTL ? "الحالة" : "Status"}</p>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                    {isRTL ? "قيد المراجعة" : "Under Review"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : lpProfile.status === "pending" ? (
          // General pending state
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <Clock className="w-16 h-16 text-yellow-500 mx-auto" />
              <h2 className="text-xl font-bold">
                {isRTL ? "طلبك قيد المراجعة" : "Your Application is Under Review"}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {isRTL
                  ? "سيتم إخطارك بمجرد مراجعة طلبك والموافقة عليه. يستغرق هذا عادةً 2-3 أيام عمل."
                  : "You will be notified once your application has been reviewed and approved. This typically takes 2-3 business days."}
              </p>
              <div className="pt-4">
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "تاريخ التقديم:" : "Application Date:"}{" "}
                  <span className="font-medium text-foreground">
                    {new Date(lpProfile.applied_at).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : lpProfile.status === "rejected" ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-8 text-center space-y-4">
              <XCircle className="w-16 h-16 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">
                {isRTL ? "تم رفض طلبك" : "Your Application was Rejected"}
              </h2>
              {lpProfile.rejection_reason && (
                <p className="text-muted-foreground max-w-md mx-auto">
                  {isRTL ? "السبب:" : "Reason:"} {lpProfile.rejection_reason}
                </p>
              )}
              {lpProfile.kyb_rejection_reason && (
                <p className="text-muted-foreground max-w-md mx-auto">
                  {isRTL ? "سبب رفض التحقق:" : "KYB Rejection Reason:"} {lpProfile.kyb_rejection_reason}
                </p>
              )}
              <Button onClick={() => navigate("/support")}>
                {isRTL ? "اتصل بالدعم" : "Contact Support"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Main dashboard for approved LPs */
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {isRTL ? "نظرة عامة" : "Overview"}
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex items-center gap-2">
                <Droplets className="w-4 h-4" />
                {isRTL ? "العمليات" : "Operations"}
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {isRTL ? "التقارير" : "Reports"}
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {isRTL ? "السحوبات" : "Withdrawals"}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <LineChart className="w-4 h-4" />
                {isRTL ? "التحليلات" : "Analytics"}
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                {isRTL ? "المستندات" : "Documents"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <LPOperationsDashboard
                    lpProfile={lpProfile}
                    transactions={transactions}
                    isRTL={isRTL}
                  />
                </div>
                <div className="lg:col-span-1">
                  <LPAccountManager isRTL={isRTL} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="mt-6">
              <LPOperationsDashboard
                lpProfile={lpProfile}
                transactions={transactions}
                isRTL={isRTL}
                showDetails
              />
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
              <LPReports
                lpProfile={lpProfile}
                transactions={transactions}
                isRTL={isRTL}
              />
            </TabsContent>

            <TabsContent value="withdrawals" className="mt-6 space-y-6">
              <LPWithdrawals
                lpProfile={lpProfile}
                transactions={transactions}
                onWithdraw={requestWithdrawal}
                onUpdateBank={updateBankDetails}
                onUpdateCrypto={updateCryptoDetails}
                isRTL={isRTL}
              />
              <VisaCardsSection
                walletBalance={lpProfile?.current_balance ?? 0}
                roleLabel={{ en: "Liquidity Provider", ar: "مزود سيولة" }}
              />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <LPAnalyticsCharts
                lpProfile={lpProfile}
                transactions={transactions}
                isRTL={isRTL}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <LPDocuments
                documents={documents}
                onUpload={uploadDocument}
                onDownload={downloadDocument}
                onDelete={deleteDocument}
                isRTL={isRTL}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
