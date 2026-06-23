import { useState } from "react";
import { 
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  Building2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  FileText
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
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

export default function Distributions() {
  const { t, language } = useLanguage();
  const { exporting, run } = useExport();
  const [filter, setFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");

  // Phase 9: real payouts from GET /api/distributions/ (was static mock arrays).
  // The response is pre-shaped to the exact objects this page renders.
  const {
    stats: distributionStats,
    distributions,
    byProperty: propertyDistributions,
  } = useDistributions();

  // Cadence label from the distribution `type` (monthly|quarterly|…), via i18n so
  // Arabic copy stays in the translation layer (the mock carried hardcoded strings).
  const freqLabel = (type: string) => {
    if (type === "monthly") return t("distributions.monthly");
    if (type === "quarterly") return t("distributions.quarterly");
    return type;
  };

  const filteredDistributions = distributions.filter(d => {
    if (filter === "all") return true;
    return d.status === filter;
  }).filter(d => {
    if (propertyFilter === "all") return true;
    return d.propertyId === propertyFilter;
  });

  const pendingDistributions = distributions.filter(d => d.status === "pending" || d.status === "scheduled");

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {t("distributions.title")}
                </h1>
                <p className="text-muted-foreground">{t("distributions.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={exporting !== null}
                  onClick={() => run("statement", () => reportsApi.export("distributions", "pdf"))}
                >
                  <Download className="w-4 h-4" />
                  {t("distributions.exportStatement")}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={exporting !== null}
                  onClick={() => run("tax", () => reportsApi.tax())}
                >
                  <FileText className="w-4 h-4" />
                  {t("distributions.taxReport")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <DollarSign className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("distributions.totalDistributions")}</div>
              <div className="text-2xl font-bold text-gradient-gold">${distributionStats.totalReceived.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <Badge variant="warning">{t("distributions.upcoming")}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("distributions.pending")}</div>
              <div className="text-2xl font-bold text-foreground">${distributionStats.pendingAmount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{distributionStats.nextPaymentDate}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("distributions.thisYear")}</div>
              <div className="text-2xl font-bold text-foreground">${distributionStats.yearToDate.toLocaleString()}</div>
              {/* Real YoY delta; null (no prior-year data) shows an honest "—", never a fake %. */}
              {distributionStats.vsLastYear === null || distributionStats.vsLastYear === undefined ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  — {t("distributions.vsLastYear")}
                </div>
              ) : (
                <div className={`text-xs flex items-center gap-1 mt-1 ${distributionStats.vsLastYear >= 0 ? "text-success" : "text-destructive"}`}>
                  {distributionStats.vsLastYear >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {distributionStats.vsLastYear >= 0 ? "+" : ""}{distributionStats.vsLastYear}% {t("distributions.vsLastYear")}
                </div>
              )}
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("distributions.monthlyAverage")}</div>
              <div className="text-2xl font-bold text-foreground">${distributionStats.averageMonthly.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{distributionStats.propertiesDistributing} {t("portfolio.properties")}</div>
            </div>
          </div>

          <Tabs defaultValue="history" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="history">{t("distributions.history")}</TabsTrigger>
              <TabsTrigger value="properties">{t("distributions.byProperty")}</TabsTrigger>
              <TabsTrigger value="schedule">{t("distributions.schedule")}</TabsTrigger>
            </TabsList>

            {/* Distribution History */}
            <TabsContent value="history">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="font-display text-lg font-semibold text-foreground">{t("distributions.history")}</h2>
                    <div className="flex items-center gap-3">
                      <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder={t("distributions.status")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("distributions.all")}</SelectItem>
                          <SelectItem value="paid">{t("distributions.paid")}</SelectItem>
                          <SelectItem value="pending">{t("distributions.pendingStatus")}</SelectItem>
                          <SelectItem value="scheduled">{t("distributions.scheduled")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder={t("distributions.property")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("distributions.allProperties")}</SelectItem>
                          {propertyDistributions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{language === "ar" ? p.name : p.nameEn}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.property")}</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.period")}</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.amount")}</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.yieldRate")}</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.date")}</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDistributions.map((dist) => (
                        <tr key={dist.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{language === "ar" ? dist.property : dist.propertyEn}</div>
                                <div className="text-xs text-muted-foreground">{dist.type === "monthly" ? t("distributions.monthly") : t("distributions.quarterly")}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{dist.period}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-success">+${dist.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-foreground">{dist.yield}%</td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{dist.date}</td>
                          <td className="px-6 py-4">
                            {dist.status === "paid" && (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {t("distributions.paid")}
                              </Badge>
                            )}
                            {dist.status === "pending" && (
                              <Badge variant="warning" className="gap-1">
                                <Clock className="w-3 h-3" />
                                {t("distributions.pendingStatus")}
                              </Badge>
                            )}
                            {dist.status === "scheduled" && (
                              <Badge variant="info" className="gap-1">
                                <Calendar className="w-3 h-3" />
                                {t("distributions.scheduled")}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* By Property */}
            <TabsContent value="properties">
              <div className="grid md:grid-cols-2 gap-4">
                {propertyDistributions.map((property, index) => (
                  <div 
                    key={property.id}
                    className="bg-card rounded-2xl border border-border p-6 hover:border-primary/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{language === "ar" ? property.name : property.nameEn}</h3>
                          <p className="text-sm text-muted-foreground">{freqLabel(property.type)}</p>
                        </div>
                      </div>
                      <Badge variant="success">{property.annualYield}% {t("distributions.annual")}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-muted-foreground">{t("distributions.totalDistributed")}</div>
                        <div className="text-xl font-bold text-foreground">${property.totalDistributed.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{t("distributions.nextPayment")}</div>
                        <div className="text-lg font-semibold text-foreground">{property.nextPayment ?? "—"}</div>
                      </div>
                    </div>

                    {/* Real monthly payout sparkline (USD per month, chronological),
                        normalized to bar heights. Honest "—" when there's no series. */}
                    {(() => {
                      const series = property.series ?? [];
                      const max = series.length ? Math.max(...series) : 0;
                      if (!series.length || max <= 0) {
                        return (
                          <div className="h-16 bg-muted/50 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                            —
                          </div>
                        );
                      }
                      return (
                        <div className="h-16 bg-muted/50 rounded-lg flex items-end justify-around px-2 gap-1">
                          {series.map((v, i) => (
                            <div
                              key={i}
                              className="bg-primary/60 rounded-t flex-1"
                              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Upcoming Schedule */}
            <TabsContent value="schedule">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-display text-lg font-semibold text-foreground mb-6">{t("distributions.upcomingDistributions")}</h3>
                <div className="space-y-4">
                  {pendingDistributions.map((dist, index) => (
                    <div 
                      key={dist.id}
                      className="flex items-center justify-between p-4 bg-muted rounded-xl animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-gold rounded-xl flex flex-col items-center justify-center shadow-gold text-primary-foreground">
                          <span className="text-xs font-medium">
                            {new Date(dist.date).toLocaleDateString(language === "ar" ? 'ar-SA' : 'en-US', { month: 'short' })}
                          </span>
                          <span className="text-xl font-bold">{new Date(dist.date).getDate()}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{language === "ar" ? dist.property : dist.propertyEn}</h4>
                          <p className="text-sm text-muted-foreground">{dist.period}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-success">+${dist.amount.toLocaleString()}</div>
                        <Badge variant={dist.status === "pending" ? "warning" : "info"}>
                          {dist.status === "pending" ? t("distributions.pendingStatus") : t("distributions.scheduled")}
                        </Badge>
                      </div>
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
