import { useMemo, useState } from "react";
import {
  Building2,
  TrendingUp,
  ArrowUpRight,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Download,
  MoreVertical,
  Wallet,
  Shield,
  Coins,
  RefreshCw,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletSection } from "@/components/portfolio/WalletSection";
import { CertificatesSection } from "@/components/portfolio/CertificatesSection";
import { TokenHoldings } from "@/components/portfolio/TokenHoldings";
import { ReinvestReturnsCard } from "@/components/dashboard/ReinvestReturnsCard";
import { ExitOptionsCard } from "@/components/portfolio/ExitOptionsCard";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useOwnershipTokens } from "@/hooks/useOwnershipTokens";
import { useDistributions } from "@/hooks/useDistributions";
import { useReinvestments } from "@/hooks/useReinvestments";
import { reportsApi } from "@/integrations/api/client";
import { toast } from "sonner";

export default function Portfolio() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [searchParams] = useSearchParams();
  // Deep-link support: /portfolio?tab=wallet opens the Wallet tab directly (used by
  // the KYC-before-invest routing and the post-investment CTA). Phase 4.
  const initialTab = searchParams.get("tab") || "holdings";
  const [tab, setTab] = useState(initialTab);
  const [filter, setFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  // Real data sources (mirrors the Dashboard repoint).
  const { wallet } = useUserWallet();
  const { tokens, loading: tokensLoading, totalValue, totalTokens } = useOwnershipTokens(
    wallet?.id ?? null,
  );
  const { stats: distributionStats } = useDistributions();
  const { availableBalance } = useReinvestments();

  // Map each enriched ownership token (one per property) to a holding row. Property
  // metadata (location/type/image/construction/exit) + cost basis are joined server-side.
  const holdings = useMemo(
    () =>
      tokens.map((tk) => {
        const invested = tk.invested_usd ?? null;
        const value = Number(tk.token_value_usd) || 0;
        const yieldPct =
          invested && invested > 0 ? ((value - invested) / invested) * 100 : null;
        const underConstruction =
          tk.construction_progress != null && tk.construction_progress < 100;
        return {
          id: tk.property_id,
          name: tk.property_name,
          location: (isAr ? tk.location_ar || tk.location : tk.location) || null,
          type: tk.category || tk.asset_type || null,
          units: Number(tk.token_amount) || 0,
          invested,
          currentValue: value,
          yield: yieldPct,
          ownership: Number(tk.ownership_percentage) || 0,
          image: tk.image || null,
          status: underConstruction ? "construction" : "active",
          constructionProgress: tk.construction_progress ?? null,
          exitEligible: !!tk.exit_eligible,
        };
      }),
    [tokens, isAr],
  );

  const filteredHoldings = holdings.filter((h) => {
    if (filter === "all") return true;
    if (filter === "active") return h.status === "active";
    if (filter === "construction") return h.status === "construction";
    if (filter === "exitable") return h.exitEligible;
    return true;
  });

  // Derived summary (real). Cost-basis-dependent figures (invested / return%) show "—"
  // when no cost record exists yet, NEVER a fake number.
  const totalInvested = holdings.reduce(
    (sum, h) => (h.invested != null ? sum + h.invested : sum),
    0,
  );
  const hasCostBasis = holdings.some((h) => h.invested != null);
  const totalReturn = hasCostBasis ? totalValue - totalInvested : null;
  const returnPercent =
    hasCostBasis && totalInvested > 0 ? (totalValue / totalInvested - 1) * 100 : null;
  const propertiesCount = holdings.length;
  const pendingDistributions = distributionStats.pendingAmount;
  const exitableAssets = holdings.filter((h) => h.exitEligible).length;

  const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

  const handleExport = async () => {
    setExporting(true);
    try {
      await reportsApi.export("wallet", "pdf");
    } catch {
      toast.error(isAr ? "تعذر تصدير التقرير" : "Could not export the report");
    } finally {
      setExporting(false);
    }
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
                  {t("portfolio.title")}
                </h1>
                <p className="text-muted-foreground">{t("portfolio.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={handleExport} disabled={exporting}>
                  <Download className="w-4 h-4" />
                  {t("portfolio.exportReport")}
                </Button>
                <Link to="/marketplace">
                  <Button variant="hero" className="gap-2">
                    <Coins className="w-4 h-4" />
                    {t("portfolio.newInvestment")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Portfolio Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="success" className="gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  {fmtPct(returnPercent)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("portfolio.totalValue")}</div>
              <div className="text-2xl font-bold text-foreground">${totalValue.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("portfolio.invested")}: {hasCostBasis ? `$${totalInvested.toLocaleString()}` : "—"}
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("portfolio.totalReturns")}</div>
              <div className="text-2xl font-bold text-success">
                {totalReturn == null ? "—" : `${totalReturn >= 0 ? "+" : ""}$${totalReturn.toLocaleString()}`}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t("portfolio.returnRate")}: {fmtPct(returnPercent)}
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("portfolio.assetsTokens")}</div>
              <div className="text-2xl font-bold text-foreground">{propertiesCount} {t("portfolio.properties")}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {totalTokens.toLocaleString()} {t("portfolio.tokens")}
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <DollarSign className="w-6 h-6 text-primary-foreground" />
                </div>
                <Badge variant="gold">{exitableAssets} {t("portfolio.exitEligible")}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("portfolio.pendingDistributions")}</div>
              <div className="text-2xl font-bold text-gradient-gold">${pendingDistributions.toLocaleString()}</div>
            </div>
          </div>

          {/* Tabs for Portfolio Views */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="holdings">{t("portfolio.ownedAssets")}</TabsTrigger>
                <TabsTrigger value="wallet">{language === "ar" ? "المحفظة" : "Wallet"}</TabsTrigger>
                <TabsTrigger value="certificates">{language === "ar" ? "الشهادات" : "Certificates"}</TabsTrigger>
                <TabsTrigger value="distributions">{t("portfolio.distributions")}</TabsTrigger>
                <TabsTrigger value="tokens">{t("portfolio.tokensTab")}</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-3">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder={t("common.filter")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("portfolio.allAssets")}</SelectItem>
                    <SelectItem value="active">{t("portfolio.active")}</SelectItem>
                    <SelectItem value="construction">{t("portfolio.underConstruction")}</SelectItem>
                    <SelectItem value="exitable">{t("portfolio.exitable")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Holdings Tab */}
            <TabsContent value="holdings" className="space-y-6">
              {/* Exit Options Card - Prominent display for eligible assets */}
              {filteredHoldings.some(h => h.exitEligible) && (
                <ExitOptionsCard className="animate-fade-in" />
              )}

              {tokensLoading ? (
                <div className="bg-card rounded-2xl border border-border p-12 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredHoldings.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-12 text-center">
                  <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("portfolio.noAssets")}</h3>
                  <p className="text-muted-foreground mb-6">{t("portfolio.noAssetsDesc")}</p>
                  <Link to="/marketplace">
                    <Button variant="hero">{t("portfolio.exploreOpportunities")}</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHoldings.map((holding, index) => (
                    <div
                      key={holding.id}
                      className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex flex-col lg:flex-row">
                        {/* Property Image (real; placeholder when none) */}
                        <div className="lg:w-48 h-32 lg:h-auto relative bg-muted">
                          {holding.image ? (
                            <img
                              src={holding.image}
                              alt={holding.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Building2 className="w-10 h-10 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 flex gap-1">
                            {holding.status === "active" ? (
                              <Badge variant="success" className="text-xs">{t("portfolio.active")}</Badge>
                            ) : (
                              <Badge variant="construction" className="text-xs">
                                {t("portfolio.underConstruction")}
                                {holding.constructionProgress != null ? ` ${holding.constructionProgress}%` : ""}
                              </Badge>
                            )}
                            {holding.exitEligible && (
                              <Badge variant="gold" className="text-xs">{t("portfolio.exitEligible")}</Badge>
                            )}
                          </div>
                        </div>

                        {/* Property Details */}
                        <div className="flex-1 p-4 lg:p-6">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-display text-lg font-semibold text-foreground">
                                    {holding.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {[holding.location, holding.type].filter(Boolean).join(" • ") || "—"}
                                  </p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="shrink-0">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link to={`/property/${holding.id}`}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        {t("portfolio.viewDetails")}
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTab("tokens")}>
                                      <Shield className="w-4 h-4 mr-2" />
                                      {t("portfolio.tokenDetails")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExport}>
                                      <FileText className="w-4 h-4 mr-2" />
                                      {t("portfolio.reports")}
                                    </DropdownMenuItem>
                                    {holding.exitEligible && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                          {language === "ar" ? "خيارات البيع" : "Exit Options"}
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                          <Link to={`/secondary-market?asset=${holding.id}`}>
                                            <TrendingUp className="w-4 h-4 mr-2" />
                                            {t("portfolio.sellSecondary")}
                                            <span className="ml-auto text-xs text-muted-foreground">0.5%</span>
                                          </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                          <Link to={`/lp-market?asset=${holding.id}`}>
                                            <Coins className="w-4 h-4 mr-2" />
                                            {language === "ar" ? "بيع فوري (LP)" : "Instant Sale (LP)"}
                                            <span className="ml-auto text-xs text-muted-foreground">1%</span>
                                          </Link>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Stats */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                                <div>
                                  <div className="text-xs text-muted-foreground">{t("dashboard.units")}</div>
                                  <div className="font-semibold text-foreground">{holding.units.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">{t("portfolio.invested")}</div>
                                  <div className="font-semibold text-foreground">
                                    {holding.invested != null ? `$${holding.invested.toLocaleString()}` : "—"}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">{t("portfolio.totalValue")}</div>
                                  <div className="font-semibold text-foreground">${holding.currentValue.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">{t("portfolio.returnRate")}</div>
                                  <div className={cn(
                                    "font-semibold",
                                    holding.yield == null ? "text-muted-foreground"
                                      : holding.yield >= 0 ? "text-success" : "text-destructive",
                                  )}>
                                    {fmtPct(holding.yield)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Wallet Tab */}
            <TabsContent value="wallet">
              <WalletSection />
            </TabsContent>

            {/* Certificates Tab */}
            <TabsContent value="certificates">
              <CertificatesSection />
            </TabsContent>

            {/* Distributions Tab */}
            <TabsContent value="distributions">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-8 text-center">
                  <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("portfolio.distributions")}</h3>
                  <p className="text-muted-foreground mb-6">{t("distributions.subtitle")}</p>
                  <Link to="/distributions">
                    <Button variant="hero">{t("dashboard.viewAll")}</Button>
                  </Link>
                </div>
                <div className="lg:col-span-1">
                  <ReinvestReturnsCard availableReturns={availableBalance} />
                </div>
              </div>
            </TabsContent>

            {/* Tokens Tab — real ownership-token positions */}
            <TabsContent value="tokens">
              <TokenHoldings walletId={wallet?.id ?? null} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
