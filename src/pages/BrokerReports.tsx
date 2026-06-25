import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Download,
  Calendar,
  Building2,
  DollarSign,
  Users,
  Target,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  brokerApi,
  reportsApi,
  type BrokerCommissions,
  type BrokerPropertyStats,
} from "@/integrations/api/client";
import { useExport } from "@/hooks/useExport";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Broker Listings Phase 1: BrokerReports renders REAL broker commission data — totals +
// the rate-stamped ledger + per-property breakdown (broker-scoped). Per-property LEADS are
// Phase 2 → honest "—", never a fabricated number; a legacy/null rate shows "—", never 0%.
type Period = "month" | "quarter" | "year" | "all";

const EMPTY_COMMISSIONS: BrokerCommissions = {
  stats: {
    total_referrals: 0,
    converted_referrals: 0,
    conversion_rate: 0,
    total_commission: "0",
    pending_commission: "0",
    this_month_commission: "0",
  },
  referrals: [],
  commissions: [],
};

// Client-side period window (the ledger returns full history; we filter by row date —
// no backend change). "all" → no filter.
function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function BrokerReports() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { exporting, run: runExport } = useExport();
  const [period, setPeriod] = useState<Period>("year");

  const [data, setData] = useState<BrokerCommissions>(EMPTY_COMMISSIONS);
  const [propStats, setPropStats] = useState<BrokerPropertyStats>({ broker_rate: "0", by_property: {} });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (notify = false) => {
    try {
      const [c, p] = await Promise.all([
        brokerApi.commissions(),
        brokerApi.propertyStats().catch(() => ({ broker_rate: "0", by_property: {} })),
      ]);
      setData(c || EMPTY_COMMISSIONS);
      setPropStats(p);
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

  const fmtUsd = (n: number | string) => `$${(Number(n) || 0).toLocaleString()}`;
  const periodLabel = (p: Period) =>
    p === "month" ? (isAr ? "هذا الشهر" : "Monthly")
      : p === "quarter" ? (isAr ? "هذا الربع" : "Quarterly")
      : p === "year" ? (isAr ? "هذا العام" : "Annual")
      : (isAr ? "كل الفترات" : "All time");

  // Period-filter the ledger rows client-side (by date).
  const start = periodStart(period);
  const rows = useMemo(
    () => data.commissions.filter((c) => (start ? new Date(c.date) >= start : true)),
    [data.commissions, start],
  );

  // Period-scoped totals derived from the filtered rows (honest — never fabricated).
  const periodCommission = rows.reduce((s, r) => s + (Number(r.commission) || 0), 0);
  const periodConversions = rows.length;

  // Monthly breakdown (last 6 months) derived from the rows (mirrors Commissions.tsx).
  const monthlyStats = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const r of data.commissions) {
      const key = (r.date || "").slice(0, 7); // YYYY-MM
      if (!key) continue;
      byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(r.commission) || 0));
    }
    const out: { label: string; earned: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        label: d.toLocaleDateString(isAr ? "ar" : "en", { month: "short", year: "numeric" }),
        earned: byMonth.get(key) ?? 0,
      });
    }
    return out;
  }, [data.commissions, isAr]);

  const byProperty = Object.values(propStats.by_property || {});
  const stats = data.stats;

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {isAr ? "تقارير الوسيط" : "Broker Reports"}
                </h1>
                <p className="text-muted-foreground">
                  {isAr ? "تحليل عمولاتك وإحالاتك وأدائك على كل عقار" : "Your commissions, referrals & per-property performance"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                  {isAr ? "تحديث" : "Refresh"}
                </Button>
                <Button
                  variant="hero"
                  className="gap-2"
                  disabled={exporting !== null}
                  onClick={() =>
                    runExport("broker", () =>
                      reportsApi.export("broker-commissions", "pdf", { period: periodLabel(period) }),
                    )
                  }
                >
                  <Download className="w-4 h-4" />
                  {isAr ? "تصدير التقرير" : "Export Report"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Overview Cards — all REAL from commission_ledger.stats. */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="col-span-2 p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in">
              <div className="text-sm text-muted-foreground mb-2">
                {isAr ? "إجمالي العمولات" : "Total Commission"}
              </div>
              <div className="text-3xl font-bold text-gradient-gold">{fmtUsd(stats.total_commission)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isAr ? "مُضافة إلى رصيد محفظتك" : "Credited to your wallet balance"}
              </p>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "هذا الشهر" : "This Month"}</div>
              <div className="text-2xl font-bold text-foreground">{fmtUsd(stats.this_month_commission)}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "الإحالات" : "Referrals"}</div>
              <div className="text-2xl font-bold text-foreground">{stats.total_referrals}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "تحويلات" : "Converted"}</div>
              <div className="text-2xl font-bold text-emerald-500">{stats.converted_referrals}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "معدل التحويل" : "Conversion"}</div>
              <div className="text-2xl font-bold text-foreground">{stats.conversion_rate}%</div>
            </div>
          </div>

          <Tabs defaultValue="commissions" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="commissions">{isAr ? "العمولات" : "Commissions"}</TabsTrigger>
                <TabsTrigger value="properties">{isAr ? "حسب العقار" : "By Property"}</TabsTrigger>
                <TabsTrigger value="monthly">{isAr ? "شهرياً" : "Monthly"}</TabsTrigger>
              </TabsList>

              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-36">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{isAr ? "هذا الشهر" : "This Month"}</SelectItem>
                  <SelectItem value="quarter">{isAr ? "هذا الربع" : "This Quarter"}</SelectItem>
                  <SelectItem value="year">{isAr ? "هذا العام" : "This Year"}</SelectItem>
                  <SelectItem value="all">{isAr ? "كل الفترات" : "All Time"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Commissions tab — the real rate-stamped ledger, period-filtered. */}
            <TabsContent value="commissions" className="space-y-6">
              <div className="flex items-center justify-between bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-6">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {isAr ? "عمولات هذه الفترة" : "Commission this period"}
                  </div>
                  <div className="text-3xl font-bold text-gradient-gold">{fmtUsd(periodCommission)}</div>
                </div>
                <Badge variant="outline" className="gap-1">
                  <DollarSign className="w-3 h-3" />
                  {periodConversions} {isAr ? "عمولة" : "entries"}
                </Badge>
              </div>

              {rows.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-10 text-center">
                  <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                    {isAr ? "لا توجد عمولات" : "No commissions"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {isAr
                      ? "لم تُحتسب عمولات في هذه الفترة بعد. شارك رابط الإحالة لتبدأ."
                      : "No commissions in this period yet. Share your referral link to start earning."}
                  </p>
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                          <th className="text-left py-3 px-4 font-medium">{isAr ? "التاريخ" : "Date"}</th>
                          <th className="text-left py-3 px-4 font-medium">{isAr ? "المستثمر المُحال" : "Referred investor"}</th>
                          <th className="text-left py-3 px-4 font-medium">{isAr ? "العقار" : "Property"}</th>
                          <th className="text-right py-3 px-4 font-medium">{isAr ? "الاستثمار" : "Investment"}</th>
                          <th className="text-right py-3 px-4 font-medium">{isAr ? "النسبة" : "Rate"}</th>
                          <th className="text-right py-3 px-4 font-medium">{isAr ? "العمولة" : "Commission"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((c) => (
                          <tr key={c.id} className="border-b border-border/50 last:border-0">
                            <td className="py-3 px-4 text-foreground">{c.date}</td>
                            <td className="py-3 px-4 text-foreground">{c.referral}</td>
                            <td className="py-3 px-4 text-muted-foreground">{c.property || "—"}</td>
                            <td className="py-3 px-4 text-right text-foreground">{fmtUsd(c.amount)}</td>
                            <td className="py-3 px-4 text-right text-muted-foreground">
                              {/* Stamped rate; null = legacy → "—", NEVER 0%. */}
                              {c.rate === null || c.rate === undefined
                                ? <span title={isAr ? "غير مُسجَّلة (سجل قديم)" : "Not recorded (legacy)"}>—</span>
                                : `${Number(c.rate)}%`}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-primary">{fmtUsd(c.commission)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* By-property tab — broker-scoped stats. Per-property LEADS → "—" (Phase 2). */}
            <TabsContent value="properties" className="space-y-6">
              {byProperty.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-10 text-center">
                  <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                    {isAr ? "لا توجد بيانات بعد" : "No property data yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {isAr
                      ? "بمجرد أن يستثمر أحد إحالاتك في عقار، ستظهر إحصاءاتك هنا."
                      : "Once one of your referrals invests in a property, your stats appear here."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {byProperty.map((bp, index) => (
                    <div
                      key={bp.property_id}
                      className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{bp.property_id}</h3>
                            <Button variant="outline" size="sm" asChild className="mt-1">
                              <a href={`/property/${bp.property_id}`}>{isAr ? "عرض العقار" : "View listing"}</a>
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-8">
                          <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />{isAr ? "عملاء" : "Leads"}
                            </div>
                            {/* Per-property lead attribution is Phase 2 → honest "—". */}
                            <div className="font-semibold text-foreground">—</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Target className="w-3 h-3" />{isAr ? "تحويلاتك" : "Conversions"}
                            </div>
                            <div className="font-semibold text-emerald-500">{bp.conversions}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">{isAr ? "حجم استثمارهم" : "Raised by you"}</div>
                            <div className="font-semibold text-foreground">{fmtUsd(bp.raised)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">{isAr ? "عمولتك" : "Commission"}</div>
                            <div className="font-semibold text-primary">{fmtUsd(bp.commission)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Monthly tab — derived client-side from the real ledger rows. */}
            <TabsContent value="monthly" className="space-y-6">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-6 py-3 border-b border-border bg-muted/30 text-sm font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {isAr ? "العمولات الشهرية (آخر 6 أشهر)" : "Monthly commission (last 6 months)"}
                </div>
                <div className="divide-y divide-border/50">
                  {monthlyStats.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                      {/* Honest "-" for a month with no commissions (not a fabricated 0-as-data). */}
                      <span className={cn("font-semibold", m.earned > 0 ? "text-foreground" : "text-muted-foreground")}>
                        {m.earned > 0 ? fmtUsd(m.earned) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
