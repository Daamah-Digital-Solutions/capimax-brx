import { useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  PieChart,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useOwnershipTokens } from "@/hooks/useOwnershipTokens";
import { useDistributions } from "@/hooks/useDistributions";
import { useExport } from "@/hooks/useExport";
import { reportsApi } from "@/integrations/api/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The page now derives every figure from the same real sources as Portfolio/Distributions
// (useOwnershipTokens incl. token→Property enrichment + cost basis; useDistributions) and
// triggers the real Phase-13 reportsApi exports. Two things have NO backend yet and show an
// honest placeholder instead of a fabricated value (DELETE NOTHING, never fake):
//   • Portfolio-VALUE time series (the value chart + its change %): no value-snapshot history.
//   • Saved-reports catalog (category counts + a "recent reports" list): our model is
//     on-demand export, not stored reports.

// Report categories — the count badges are NOT derivable (no saved-reports store) → "—".
const reportCategories = [
  { id: "financial", name: "التقارير المالية", nameEn: "Financial Reports", icon: DollarSign },
  { id: "investment", name: "تقارير الاستثمار", nameEn: "Investment Reports", icon: TrendingUp },
  { id: "property", name: "تقارير العقارات", nameEn: "Property Reports", icon: Building2 },
  { id: "valuation", name: "تقارير التقييم", nameEn: "Valuation Reports", icon: BarChart3 },
  { id: "distribution", name: "تقارير التوزيعات", nameEn: "Distribution Reports", icon: PieChart },
  { id: "tax", name: "التقارير الضريبية", nameEn: "Tax Reports", icon: FileText },
];

// Donut palette (matches the legend order).
const ALLOC_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(0 72% 55%)",
];
const DONUT_C = 2 * Math.PI * 40; // circumference for r=40

export default function Reports() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [period, setPeriod] = useState("all");
  const [property, setProperty] = useState("all");
  const [category, setCategory] = useState("all");

  // Real sources (same as Portfolio / Distributions).
  const { wallet } = useUserWallet();
  const { tokens, totalValue, refreshTokens } = useOwnershipTokens(wallet?.id ?? null);
  const { stats: distributionStats, distributions, refresh: refreshDistributions } = useDistributions();
  const { exporting, run } = useExport();

  // --- Portfolio overview (real, derived) --------------------------------- //
  const propertiesCount = tokens.length;
  const totalInvested = tokens.reduce((s, t) => (t.invested_usd != null ? s + t.invested_usd : s), 0);
  const hasCostBasis = tokens.some((t) => t.invested_usd != null);
  const returnPercent =
    hasCostBasis && totalInvested > 0 ? (totalValue / totalInvested - 1) * 100 : null;
  // Value-weighted average expected yield over holdings that carry a Property yield.
  const avgYield = useMemo(() => {
    const withYield = tokens.filter((t) => t.expected_yield != null && Number(t.token_value_usd) > 0);
    if (!withYield.length) return null;
    const wv = withYield.reduce((s, t) => s + Number(t.token_value_usd), 0);
    if (wv <= 0) return null;
    return withYield.reduce((s, t) => s + (t.expected_yield as number) * Number(t.token_value_usd), 0) / wv;
  }, [tokens]);

  const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

  // --- Per-property performance (real) ------------------------------------ //
  const perfRows = useMemo(
    () =>
      tokens.map((t) => {
        const value = Number(t.token_value_usd) || 0;
        const invested = t.invested_usd ?? null;
        const change = invested && invested > 0 ? ((value - invested) / invested) * 100 : null;
        return {
          id: t.property_id,
          name: t.property_name,
          value,
          change, // null → "—" (no cost basis yet)
          yield: t.expected_yield ?? null,
        };
      }),
    [tokens],
  );
  const filteredPerf = property === "all" ? perfRows : perfRows.filter((r) => r.id === property);

  // --- Allocation by asset type (real, mirrors Portfolio's split) --------- //
  const allocation = useMemo(() => {
    const byType = new Map<string, number>();
    let total = 0;
    for (const t of tokens) {
      const type = t.category || t.asset_type || (isAr ? "غير مصنّف" : "Uncategorized");
      const v = Number(t.token_value_usd) || 0;
      byType.set(type, (byType.get(type) || 0) + v);
      total += v;
    }
    const entries = [...byType.entries()]
      .map(([type, value]) => ({ type, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
    return { entries, total };
  }, [tokens, isAr]);

  // --- Monthly distributions (real, grouped from distribution history) ---- //
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of distributions) {
      const key = (d.date || "").slice(0, 7); // YYYY-MM
      if (!key) continue;
      m.set(key, (m.get(key) || 0) + (Number(d.amount) || 0));
    }
    let keys = [...m.keys()].sort();
    const n = period === "month" ? 1 : period === "quarter" ? 3 : period === "year" ? 12 : keys.length;
    keys = keys.slice(-n);
    return keys.map((k) => ({ key: k, amount: m.get(k) || 0 }));
  }, [distributions, period]);
  const monthlyMax = monthly.reduce((mx, p) => Math.max(mx, p.amount), 0);
  const perfChangeMax = Math.max(1, ...filteredPerf.map((p) => Math.abs(p.change ?? 0)));

  const refreshAll = () => {
    refreshTokens();
    refreshDistributions();
  };

  // "Export Full" fans out to the real per-context exports (wallet + distributions +
  // tax) — each is a real Phase-13 document. No aggregate endpoint is faked.
  const exportFull = () =>
    run("full", async () => {
      await reportsApi.export("wallet", "pdf");
      await reportsApi.export("distributions", "pdf");
      await reportsApi.tax();
    });

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  التقارير والتحليلات / Reports & Analytics
                </h1>
                <p className="text-muted-foreground">تحليل شامل لمحفظتك الاستثمارية</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={refreshAll}>
                  <RefreshCw className="w-4 h-4" />
                  تحديث
                </Button>
                <Button variant="hero" className="gap-2" onClick={exportFull} disabled={exporting !== null}>
                  <Download className="w-4 h-4" />
                  تصدير شامل
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Portfolio Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <div className="col-span-2 p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">إجمالي قيمة المحفظة</span>
                {/* Period-over-period change needs a value-snapshot history (none yet) → "—". */}
                <Badge variant="outline" className="gap-1 text-muted-foreground">—</Badge>
              </div>
              <div className="text-3xl font-bold text-gradient-gold">${totalValue.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {isAr ? "المستثمر" : "Invested"}: {hasCostBasis ? `$${totalInvested.toLocaleString()}` : "—"}
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="text-sm text-muted-foreground mb-1">العقارات</div>
              <div className="text-2xl font-bold text-foreground">{propertiesCount}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-sm text-muted-foreground mb-1">متوسط العائد</div>
              <div className="text-2xl font-bold text-foreground">{avgYield == null ? "—" : `${avgYield.toFixed(1)}%`}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="text-sm text-muted-foreground mb-1">التوزيعات</div>
              <div className="text-2xl font-bold text-success">${distributionStats.totalReceived.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-sm text-muted-foreground mb-1">عائد المحفظة</div>
              <div className="text-2xl font-bold text-success">{fmtPct(returnPercent)}</div>
            </div>
          </div>

          <Tabs defaultValue="analytics" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="analytics">التحليلات</TabsTrigger>
                <TabsTrigger value="reports">التقارير</TabsTrigger>
                <TabsTrigger value="performance">أداء العقارات</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-3">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-36">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="الفترة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفترات</SelectItem>
                    <SelectItem value="month">هذا الشهر</SelectItem>
                    <SelectItem value="quarter">هذا الربع</SelectItem>
                    <SelectItem value="year">هذا العام</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={property} onValueChange={setProperty}>
                  <SelectTrigger className="w-48">
                    <Building2 className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="العقار" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العقارات</SelectItem>
                    {perfRows.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Portfolio Value Chart — needs value-snapshot history (deferred) → honest empty. */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display text-lg font-semibold text-foreground">قيمة المحفظة</h3>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {isAr ? "قريباً" : "Coming soon"}
                    </Badge>
                  </div>
                  <div className="h-64 bg-muted/30 rounded-xl flex flex-col items-center justify-center text-center px-6">
                    <BarChart3 className="w-10 h-10 text-muted-foreground/50 mb-3" />
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                    <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                      {isAr
                        ? "تتبّع قيمة المحفظة عبر الزمن قيد التطوير (لا يوجد سجل لقطات للقيمة بعد)."
                        : "Historical value tracking is coming (no value-snapshot history yet)."}
                    </p>
                  </div>
                </div>

                {/* Allocation Chart — real split by asset type (value-weighted). */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-6">توزيع المحفظة</h3>
                  {allocation.entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <PieChart className="w-10 h-10 text-muted-foreground/50 mb-3" />
                      <span className="text-muted-foreground">—</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center">
                        <div className="relative w-48 h-48">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
                            {(() => {
                              let offset = 0;
                              return allocation.entries.map((e, i) => {
                                const len = (e.pct / 100) * DONUT_C;
                                const seg = (
                                  <circle
                                    key={e.type}
                                    cx="50" cy="50" r="40" fill="none"
                                    stroke={ALLOC_COLORS[i % ALLOC_COLORS.length]}
                                    strokeWidth="16"
                                    strokeDasharray={`${len} ${DONUT_C - len}`}
                                    strokeDashoffset={`-${offset}`}
                                  />
                                );
                                offset += len;
                                return seg;
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <div className="text-2xl font-bold text-foreground">{propertiesCount}</div>
                            <div className="text-sm text-muted-foreground">عقارات</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-6">
                        {allocation.entries.map((e, i) => (
                          <div key={e.type} className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
                            />
                            <span className="text-sm text-muted-foreground truncate">
                              {e.type} ({e.pct.toFixed(0)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Distributions Chart — real monthly totals from distribution history. */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-6">التوزيعات الشهرية</h3>
                  {monthly.length === 0 || monthlyMax <= 0 ? (
                    <div className="h-48 bg-muted/30 rounded-xl flex items-center justify-center text-muted-foreground">
                      —
                    </div>
                  ) : (
                    <div className="h-48 bg-muted/30 rounded-xl flex items-end justify-around px-4 gap-2">
                      {monthly.map((p) => (
                        <div key={p.key} className="flex-1 flex flex-col items-center justify-end">
                          <div
                            className="w-full bg-success rounded-t"
                            style={{ height: `${Math.max(4, (p.amount / monthlyMax) * 100)}%` }}
                          />
                          <span className="text-xs text-muted-foreground mt-2" dir="ltr">
                            {p.amount >= 1000 ? `$${(p.amount / 1000).toFixed(1)}K` : `$${p.amount.toFixed(0)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Returns Chart — real per-property return% (cost basis); "—" when none. */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-6">العوائد حسب العقار</h3>
                  {filteredPerf.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">—</div>
                  ) : (
                    <div className="space-y-4">
                      {filteredPerf.slice(0, 6).map((p) => (
                        <div key={p.id}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-foreground">{p.name}</span>
                            <span className={cn("font-medium", (p.change ?? 0) > 0 ? "text-success" : "text-foreground")}>
                              {fmtPct(p.change)}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-gold rounded-full"
                              style={{ width: `${p.change == null ? 0 : Math.min(100, (Math.abs(p.change) / perfChangeMax) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports">
              <div className="grid lg:grid-cols-4 gap-6">
                {/* Report Categories — counts not derivable (no saved-reports store) → "—". */}
                <div className="lg:col-span-1 space-y-2">
                  {reportCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl transition-colors",
                        category === cat.id
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-card border border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <cat.icon className={cn("w-5 h-5", category === cat.id ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", category === cat.id ? "text-primary" : "text-foreground")}>
                          {isAr ? cat.name : cat.nameEn}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-muted-foreground">—</Badge>
                    </button>
                  ))}
                </div>

                {/* On-demand exports — real Phase-13 reportsApi (no saved-reports catalog). */}
                <div className="lg:col-span-3">
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="p-6 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="font-display text-lg font-semibold text-foreground">أحدث التقارير</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" className="gap-2" disabled={exporting !== null}
                          onClick={() => run("dist", () => reportsApi.export("distributions", "pdf"))}>
                          <Download className="w-4 h-4" />
                          {isAr ? "التوزيعات (PDF)" : "Distributions (PDF)"}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" disabled={exporting !== null}
                          onClick={() => run("wallet", () => reportsApi.export("wallet", "pdf"))}>
                          <Download className="w-4 h-4" />
                          {isAr ? "كشف المحفظة (PDF)" : "Wallet (PDF)"}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" disabled={exporting !== null}
                          onClick={() => run("tax", () => reportsApi.tax())}>
                          <FileText className="w-4 h-4" />
                          {isAr ? "ملخص ضريبي (PDF)" : "Tax summary (PDF)"}
                        </Button>
                      </div>
                    </div>
                    {/* No saved-reports store — reports are generated on demand (buttons above). */}
                    <div className="p-10 text-center">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">
                        {isAr
                          ? "لا توجد تقارير محفوظة — يتم إنشاء التقارير عند الطلب."
                          : "No saved reports — reports are generated on demand."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Performance Tab — real per-property value / change% / yield. */}
            <TabsContent value="performance">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h3 className="font-display text-lg font-semibold text-foreground">أداء العقارات</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">العقار</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">القيمة الحالية</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">التغير</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">العائد السنوي</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPerf.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                            {isAr ? "لا توجد عقارات في محفظتك بعد" : "No properties in your portfolio yet"}
                          </td>
                        </tr>
                      ) : (
                        filteredPerf.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Building2 className="w-5 h-5 text-primary" />
                                </div>
                                <span className="font-medium text-foreground">{p.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-foreground">
                              ${p.value.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              {p.change == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className={cn("flex items-center gap-1 font-medium", p.change >= 0 ? "text-success" : "text-destructive")}>
                                  {p.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                  {p.change >= 0 ? "+" : ""}{p.change.toFixed(1)}%
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-foreground">
                              {p.yield == null ? "—" : `${p.yield}%`}
                            </td>
                            <td className="px-6 py-4">
                              <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
                                {isAr ? "قريباً" : "Coming soon"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
