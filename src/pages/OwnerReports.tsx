import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  Filter,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  PieChart,
  FileText,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ownerApi, reportsApi } from "@/integrations/api/client";
import { useExport } from "@/hooks/useExport";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Phase 7 Wave D: OwnerReports now renders REAL owner primary-sale earnings. Investor
// rental-yield "distributions" are a SEPARATE, later domain — the Distributions tab
// shows a pending-domain placeholder, never fabricated distribution amounts.
interface EarningsProperty {
  property_id: string;
  property_name: string;
  is_published: boolean;
  token_supply: number;
  units_sold: number;
  investors: number;
  gross_proceeds: number;
  fees: number;
  net_proceeds: number;
}

export default function OwnerReports() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { exporting, run: runExport } = useExport();
  const [period, setPeriod] = useState("year");
  const [property, setProperty] = useState("all");
  const [earnings, setEarnings] = useState({
    total_net_proceeds: 0,
    total_units_sold: 0,
    total_investors: 0,
    properties: [] as EarningsProperty[],
  });
  const [refreshing, setRefreshing] = useState(false);

  // Single loader reused by mount + the Refresh button (refetches the REAL owner earnings).
  const load = useCallback(async (notify = false) => {
    try {
      const e = await ownerApi.earnings();
      setEarnings({
        total_net_proceeds: e.total_net_proceeds || 0,
        total_units_sold: e.total_units_sold || 0,
        total_investors: e.total_investors || 0,
        properties: (e.properties as EarningsProperty[]) || [],
      });
      if (notify) toast.success(isAr ? "تم تحديث التقارير" : "Reports refreshed");
    } catch {
      if (notify) toast.error(isAr ? "تعذّر التحديث" : "Couldn't refresh");
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  const publishedCount = earnings.properties.filter((p) => p.is_published).length;

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {language === "ar" ? "تقارير المالك" : "Owner Reports"}
                </h1>
                <p className="text-muted-foreground">
                  {language === "ar" ? "تحليل شامل لأداء أصولك" : "Comprehensive analysis of your asset performance"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                  {language === "ar" ? "تحديث" : "Refresh"}
                </Button>
                <Button
                  variant="hero"
                  className="gap-2"
                  disabled={exporting !== null}
                  onClick={() => runExport("owner", () => reportsApi.export("owner-earnings", "pdf"))}
                >
                  <Download className="w-4 h-4" />
                  {language === "ar" ? "تصدير التقرير" : "Export Report"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="col-span-2 p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {isAr ? "رأس المال المُجمَّع" : "Capital Raised"}
                </span>
              </div>
              <div className="text-3xl font-bold text-gradient-gold">
                ${earnings.total_net_proceeds.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isAr ? "صافي عائدات البيع الأولي" : "Net primary-sale proceeds"}
              </p>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {isAr ? "المستثمرون" : "Investors"}
              </div>
              <div className="text-2xl font-bold text-foreground">{earnings.total_investors}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {isAr ? "الوحدات المباعة" : "Units Sold"}
              </div>
              <div className="text-2xl font-bold text-foreground">{earnings.total_units_sold.toLocaleString()}</div>
            </div>

            {/* Investor rental-yield distributions are a SEPARATE, later domain — shown
                as 0 here (no engine yet), never a fabricated figure. */}
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {isAr ? "التوزيعات" : "Distributed"}
              </div>
              <div className="text-2xl font-bold text-muted-foreground">$0</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {isAr ? "العقارات المنشورة" : "Published Properties"}
              </div>
              <div className="text-2xl font-bold text-foreground">
                {publishedCount} / {earnings.properties.length}
              </div>
            </div>
          </div>

          <Tabs defaultValue="performance" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="performance">
                  {language === "ar" ? "أداء الأصول" : "Asset Performance"}
                </TabsTrigger>
                <TabsTrigger value="distributions">
                  {language === "ar" ? "التوزيعات" : "Distributions"}
                </TabsTrigger>
                <TabsTrigger value="investors">
                  {language === "ar" ? "المستثمرون" : "Investors"}
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-3">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-36">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">{language === "ar" ? "هذا الشهر" : "This Month"}</SelectItem>
                    <SelectItem value="quarter">{language === "ar" ? "هذا الربع" : "This Quarter"}</SelectItem>
                    <SelectItem value="year">{language === "ar" ? "هذا العام" : "This Year"}</SelectItem>
                    <SelectItem value="all">{language === "ar" ? "كل الفترات" : "All Time"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Performance Tab — real per-property primary-sale earnings (Wave D). */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid gap-4">
                {earnings.properties.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border p-10 text-center text-muted-foreground">
                    {isAr ? "لا توجد عقارات منشورة بعد" : "No published properties yet"}
                  </div>
                ) : (
                  earnings.properties.map((asset, index) => (
                    <div
                      key={asset.property_id}
                      className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{asset.property_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              {asset.is_published ? (
                                <Badge variant="success">{isAr ? "منشور" : "Published"}</Badge>
                              ) : (
                                <Badge variant="construction">{isAr ? "غير منشور" : "Unpublished"}</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-8">
                          <div>
                            <div className="text-xs text-muted-foreground">{isAr ? "صافي العائد" : "Net Raised"}</div>
                            <div className="font-semibold text-success">${asset.net_proceeds.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">{isAr ? "الوحدات المباعة" : "Units Sold"}</div>
                            <div className="font-semibold text-foreground">{asset.units_sold} / {asset.token_supply}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">{isAr ? "المستثمرون" : "Investors"}</div>
                            <div className="font-semibold text-foreground">{asset.investors}</div>
                          </div>
                          <div className="flex items-center">
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/property/${asset.property_id}`}>{isAr ? "تفاصيل" : "Details"}</a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Distributions Tab — investor rental-yield distributions are a SEPARATE,
                later domain. Placeholder (no fabricated figures) until that engine ships. */}
            <TabsContent value="distributions" className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-10 text-center">
                <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                  {isAr ? "توزيعات المستثمرين" : "Investor Distributions"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {isAr
                    ? "توزيعات العائد الإيجاري لحاملي الرموز نطاق منفصل قادم. هذه الصفحة تعرض أرباح المالك من البيع الأولي فقط."
                    : "Rental-yield distributions to token holders are a separate, upcoming domain. This page shows owner primary-sale earnings only."}
                </p>
              </div>
            </TabsContent>

            {/* Investors Tab */}
            <TabsContent value="investors" className="space-y-6">
              <div className="bg-card rounded-2xl border border-border p-8 text-center">
                <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {language === "ar" ? "تحليل المستثمرين" : "Investor Analytics"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {language === "ar" 
                    ? "عرض تفصيلي لقاعدة المستثمرين في أصولك"
                    : "Detailed view of investor base across your assets"
                  }
                </p>
                <div className="max-w-xs mx-auto">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{earnings.total_investors}</div>
                    <div className="text-xs text-muted-foreground">
                      {isAr ? "إجمالي المستثمرين" : "Total Investors"}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
