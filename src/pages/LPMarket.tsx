import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLPMarket } from "@/hooks/useLPMarket";
import { useLiquidityProvider } from "@/hooks/useLiquidityProvider";
import { useOwnershipTokens } from "@/hooks/useOwnershipTokens";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useLPHoldings } from "@/hooks/useLPHoldings";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { InvestorAssetsView } from "@/components/lp-market/InvestorAssetsView";
import { LPMarketplaceView } from "@/components/lp-market/LPMarketplaceView";
import { LPHoldingsView } from "@/components/lp-market/LPHoldingsView";
import { lpApi, secondaryMarketApi } from "@/integrations/api/client";
import { toast } from "sonner";
import { 
  Store, 
  ShoppingCart, 
  Package, 
  DollarSign, 
  AlertCircle,
  User,
  Briefcase,
  Loader2,
  CheckCircle
} from "lucide-react";

type ViewMode = "investor" | "marketplace" | "holdings";

export default function LPMarket() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { 
    listings, 
    myListings, 
    loading, 
    isApprovedLP, 
    listAssetForSale, 
    cancelListing, 
    purchaseAsset 
  } = useLPMarket();
  const { lpProfile } = useLiquidityProvider();
  const { wallet } = useUserWallet();
  const { tokens } = useOwnershipTokens(wallet?.id || null);
  const { 
    holdings, 
    loading: holdingsLoading, 
    stats: holdingsStats,
    updateHoldingStatus 
  } = useLPHoldings();
  const [searchParams] = useSearchParams();
  
  // Determine default view based on user role
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // If URL has asset parameter, default to investor view
    if (searchParams.get("asset")) return "investor";
    // Default to investor view
    return "investor";
  });

  // Get preselected asset from URL
  const preselectedAssetId = searchParams.get("asset");

  // Update view mode when LP status changes
  useEffect(() => {
    if (isApprovedLP && !preselectedAssetId) {
      setViewMode("marketplace");
    }
  }, [isApprovedLP, preselectedAssetId]);

  // Handle resale from LP holdings
  const handleResale = async (holdingId: string, target: "lp" | "secondary", price: number) => {
    if (!lpProfile) {
      return { success: false, error: "LP profile required" };
    }

    const holding = holdings.find(h => h.id === holdingId);
    if (!holding) {
      return { success: false, error: "Holding not found" };
    }

    try {
      const payload = {
        property_id: holding.property_id,
        property_name: holding.property_name,
        token_symbol: holding.token_symbol,
        token_amount: holding.token_amount,
        unit_price: price / holding.token_amount,
      };
      // Both markets escrow-lock the LP's tokens server-side + compute the
      // (backend-configurable) fee — LP market 1%, peer secondary 0.5%.
      if (target === "lp") {
        await lpApi.listAsset(payload);
      } else {
        await secondaryMarketApi.listAsset(payload);
      }

      await updateHoldingStatus(
        holdingId,
        target === "lp" ? "listed_lp" : "listed_secondary",
        new Date().toISOString()
      );

      toast.success(
        target === "lp" ? "Asset listed on LP Market" : "Asset listed on Secondary Market"
      );
      return { success: true };
    } catch (err: any) {
      toast.error(err.message || "Failed to list asset");
      return { success: false, error: err.message };
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Store className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {language === "ar" ? "تسجيل الدخول مطلوب" : "Login Required"}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            {language === "ar"
              ? "يرجى تسجيل الدخول للوصول إلى سوق مزودي السيولة"
              : "Please log in to access the LP Market"}
          </p>
          <Button asChild>
            <a href="/auth">
              {language === "ar" ? "تسجيل الدخول" : "Log In"}
            </a>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Store className="h-8 w-8 text-primary" />
              {language === "ar" ? "سوق مزودي السيولة" : "LP Market"}
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl">
              {viewMode === "investor"
                ? (language === "ar" 
                    ? "بيع أصولك مباشرة لمزودي السيولة بتنفيذ فوري ورسوم منخفضة" 
                    : "Sell your assets directly to Liquidity Providers with instant execution and low fees")
                : viewMode === "marketplace"
                ? (language === "ar"
                    ? "شراء الأصول من المستثمرين وإضافتها إلى محفظتك"
                    : "Purchase assets from investors and add them to your portfolio")
                : (language === "ar"
                    ? "إدارة أصولك المشتراة وإعادة بيعها"
                    : "Manage your purchased assets and resell them")}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Role Status Badge */}
            {isApprovedLP && (
              <Badge variant="success" className="text-sm py-1 px-3">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                {language === "ar" ? "مزود سيولة معتمد" : "Approved LP"}
              </Badge>
            )}
            
            {/* LP Balance Card */}
            {isApprovedLP && lpProfile && (viewMode === "marketplace" || viewMode === "holdings") && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">LP Balance</p>
                      <p className="text-lg font-bold">${lpProfile.current_balance.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
          <TabsList className={`grid w-full max-w-lg ${isApprovedLP ? "grid-cols-3" : "grid-cols-1"}`}>
            <TabsTrigger value="investor" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {language === "ar" ? "بيع أصولي" : "Sell My Assets"}
            </TabsTrigger>
            {isApprovedLP && (
              <>
                <TabsTrigger value="marketplace" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {language === "ar" ? "سوق LP" : "LP Marketplace"}
                </TabsTrigger>
                <TabsTrigger value="holdings" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {language === "ar" ? "محفظتي" : "My Holdings"}
                  {holdingsStats.totalHoldings > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {holdingsStats.totalHoldings}
                    </Badge>
                  )}
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Info Banner for Non-LPs */}
          {!isApprovedLP && viewMode === "investor" && (
            <Card className="bg-muted/50 border-primary/20 mt-4">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">
                        {language === "ar" ? "رسوم المنصة: 1% فقط" : "Platform Fee: Only 1%"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === "ar"
                          ? "عند إدراج أصولك، ستكون متاحة لمزودي السيولة المعتمدين للشراء الفوري. التنفيذ مضمون!"
                          : "When you list your assets, they become available to approved LPs for instant purchase. Execution guaranteed!"}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <a href="/liquidity-provider">
                      {language === "ar" ? "انضم كمزود سيولة" : "Become an LP"}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Based on View Mode */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
              </p>
            </div>
          ) : (
            <>
              <TabsContent value="investor" className="mt-4">
                <InvestorAssetsView
                  tokens={tokens}
                  myListings={myListings}
                  loading={loading}
                  onListAsset={listAssetForSale}
                  onCancelListing={cancelListing}
                  preselectedAssetId={preselectedAssetId}
                />
              </TabsContent>

              {isApprovedLP && (
                <>
                  <TabsContent value="marketplace" className="mt-4">
                    <LPMarketplaceView
                      listings={listings}
                      loading={loading}
                      lpBalance={lpProfile?.current_balance || 0}
                      onPurchase={purchaseAsset}
                    />
                  </TabsContent>

                  <TabsContent value="holdings" className="mt-4">
                    <LPHoldingsView
                      holdings={holdings}
                      loading={holdingsLoading}
                      stats={holdingsStats}
                      onResale={handleResale}
                    />
                  </TabsContent>
                </>
              )}
            </>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
