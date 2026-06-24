import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Download,
  Calendar,
  Building2,
  DollarSign,
  PieChart,
  RefreshCw,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ownerApi, reportsApi, type OwnerPeriod } from "@/integrations/api/client";
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
type EarningsProperty = Awaited<ReturnType<typeof ownerApi.earnings>>["properties"][number];
type DistributionsData = Awaited<ReturnType<typeof ownerApi.distributions>>;
type InvestorsData = Awaited<ReturnType<typeof ownerApi.investors>>;

export default function OwnerReports() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { exporting, run: runExport } = useExport();
  const [period, setPeriod] = useState<OwnerPeriod>("year");
  const [earnings, setEarnings] = useState({
    total_net_proceeds: 0,
    total_units_sold: 0,
    total_investors: 0,
    properties: [] as EarningsProperty[],
  });
  // Real distributions + investors for THIS owner's properties (period-filtered).
  const [distributions, setDistributions] = useState<DistributionsData>({
    total_distributed: 0,
    distribution_count: 0,
    properties: [],
  });
  const [investors, setInvestors] = useState<InvestorsData>({
    total_investors: 0,
    total_units: 0,
    total_value: 0,
    investors: [],
    by_property: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  // Single loader reused by mount + period change + the Refresh button. All three
  // surfaces are REAL Django + filtered by the SELECTED period (end-to-end).
  const load = useCallback(async (notify = false) => {
    try {
      const [e, d, i] = await Promise.all([
        ownerApi.earnings(period),
        ownerApi.distributions(period),
        ownerApi.investors(period),
      ]);
      setEarnings({
        total_net_proceeds: e.total_net_proceeds || 0,
        total_units_sold: e.total_units_sold || 0,
        total_investors: e.total_investors || 0,
        properties: e.properties || [],
      });
      setDistributions(d);
      setInvestors(i);
      if (notify) toast.success(isAr ? "تم تحديث التقارير" : "Reports refreshed");
    } catch {
      if (notify) toast.error(isAr ? "تعذّر التحديث" : "Couldn't refresh");
    }
  }, [isAr, period]);

  // Reload whenever the period changes (mount + filter change).
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
  const fmtUsd = (n: number) => `$${(n || 0).toLocaleString()}`;

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

            {/* REAL: total rental-yield distributed across THIS owner's properties
                (aggregated from the distributions domain, period-filtered). $0 only when
                genuinely none yet — never a fabricated figure. */}
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {isAr ? "التوزيعات" : "Distributed"}
              </div>
              <div className={cn(
                "text-2xl font-bold",
                distributions.total_distributed > 0 ? "text-foreground" : "text-muted-foreground",
              )}>
                {fmtUsd(distributions.total_distributed)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isAr ? "عائد موزّع على المستثمرين" : "Yield paid to investors"}
              </p>
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
                <Select value={period} onValueChange={(v) => setPeriod(v as OwnerPeriod)}>
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

            {/* Distributions Tab — REAL: the rental-yield distribution history of THIS
                owner's properties (the cash their properties paid token HOLDERS), aggregated
                from the distributions domain, period-filtered. Honest empty when none. */}
            <TabsContent value="distributions" className="space-y-6">
              {/* Period total banner. */}
              <div className="flex items-center justify-between bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {isAr ? "إجمالي العائد الموزّع" : "Total Yield Distributed"}
                  </div>
                  <div className="text-3xl font-bold text-gradient-gold">
                    {fmtUsd(distributions.total_distributed)}
                  </div>
                </div>
                <Badge variant="outline" className="gap-1">
                  <DollarSign className="w-3 h-3" />
                  {distributions.distribution_count} {isAr ? "توزيع" : "payouts"}
                </Badge>
              </div>

              {distributions.properties.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-10 text-center">
                  <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                    {isAr ? "لا توجد توزيعات بعد" : "No distributions yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {isAr
                      ? "لم تُعلَن توزيعات عائد إيجاري لعقاراتك في هذه الفترة بعد."
                      : "No rental-yield distributions have been declared for your properties in this period yet."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {distributions.properties.map((prop, index) => (
                    <div
                      key={prop.property_id}
                      className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-success" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{prop.property_name}</h3>
                            <div className="text-xs text-muted-foreground">
                              {prop.distribution_count} {isAr ? "توزيع" : "payouts"}
                              {prop.last_pay_date && (
                                <> · {isAr ? "آخر دفعة" : "last"} {new Date(prop.last_pay_date).toLocaleDateString()}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{isAr ? "الإجمالي" : "Total"}</div>
                          <div className="font-bold text-success">{fmtUsd(prop.total_distributed)}</div>
                        </div>
                      </div>

                      {/* Per-distribution history rows (newest first). */}
                      <div className="divide-y divide-border/50 border-t border-border/50">
                        {prop.distributions.map((d, di) => (
                          <div key={di} className="flex items-center justify-between py-2.5">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-foreground">{new Date(d.pay_date).toLocaleDateString()}</span>
                              {d.period_label && (
                                <Badge variant="outline" className="text-xs">{d.period_label}</Badge>
                              )}
                              {d.dist_type && (
                                <span className="text-xs text-muted-foreground capitalize">{d.dist_type}</span>
                              )}
                            </div>
                            <span className="font-medium text-foreground">{fmtUsd(d.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Investors Tab — REAL: the distinct investor base across the owner's
                properties (per-investor list with MASKED PII + per-property breakdown),
                period-filtered. Honest empty when none. */}
            <TabsContent value="investors" className="space-y-6">
              {/* Summary cards (distinct count + units + value). */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-card rounded-2xl border border-border text-center">
                  <div className="text-2xl font-bold text-foreground">{investors.total_investors}</div>
                  <div className="text-xs text-muted-foreground">{isAr ? "مستثمرون متمايزون" : "Distinct Investors"}</div>
                </div>
                <div className="p-5 bg-card rounded-2xl border border-border text-center">
                  <div className="text-2xl font-bold text-foreground">{investors.total_units.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{isAr ? "إجمالي الوحدات" : "Total Units Held"}</div>
                </div>
                <div className="p-5 bg-card rounded-2xl border border-border text-center">
                  <div className="text-2xl font-bold text-success">{fmtUsd(investors.total_value)}</div>
                  <div className="text-xs text-muted-foreground">{isAr ? "إجمالي الاستثمار" : "Total Invested"}</div>
                </div>
              </div>

              {investors.investors.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-10 text-center">
                  <PieChart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                    {isAr ? "لا يوجد مستثمرون بعد" : "No investors yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {isAr
                      ? "لا يوجد مستثمرون في عقاراتك في هذه الفترة بعد."
                      : "No investors in your properties for this period yet."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Per-property investor breakdown. */}
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="px-6 py-3 border-b border-border bg-muted/30 text-sm font-semibold text-foreground">
                      {isAr ? "حسب العقار" : "By Property"}
                    </div>
                    <div className="divide-y divide-border/50">
                      {investors.by_property.map((bp) => (
                        <div key={bp.property_id} className="flex items-center justify-between px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Building2 className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">{bp.property_name}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <span className="text-muted-foreground">{bp.investors} {isAr ? "مستثمر" : "investors"}</span>
                            <span className="text-muted-foreground">{bp.units.toLocaleString()} {isAr ? "وحدة" : "units"}</span>
                            <span className="font-medium text-foreground">{fmtUsd(bp.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-investor list (PII masked server-side; sorted by value). */}
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="px-6 py-3 border-b border-border bg-muted/30 text-sm font-semibold text-foreground">
                      {isAr ? "المستثمرون" : "Investors"}
                    </div>
                    <div className="divide-y divide-border/50">
                      {investors.investors.map((inv, idx) => (
                        <div key={idx} className="flex items-center justify-between px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {inv.label.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{inv.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {inv.property_count} {isAr ? "عقار" : inv.property_count === 1 ? "property" : "properties"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <span className="text-muted-foreground">{inv.units.toLocaleString()} {isAr ? "وحدة" : "units"}</span>
                            <span className="font-medium text-foreground">{fmtUsd(inv.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
