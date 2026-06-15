import { useState } from "react";
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
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const reportCategories = [
  { id: "financial", name: "التقارير المالية", nameEn: "Financial Reports", icon: DollarSign, count: 12 },
  { id: "investment", name: "تقارير الاستثمار", nameEn: "Investment Reports", icon: TrendingUp, count: 8 },
  { id: "property", name: "تقارير العقارات", nameEn: "Property Reports", icon: Building2, count: 15 },
  { id: "valuation", name: "تقارير التقييم", nameEn: "Valuation Reports", icon: BarChart3, count: 6 },
  { id: "distribution", name: "تقارير التوزيعات", nameEn: "Distribution Reports", icon: PieChart, count: 24 },
  { id: "tax", name: "التقارير الضريبية", nameEn: "Tax Reports", icon: FileText, count: 4 },
];

const recentReports = [
  { id: 1, name: "التقرير المالي الربعي Q4 2024", category: "financial", property: "برج مارينا باي", date: "2024-12-31", status: "new" },
  { id: 2, name: "تقرير التوزيعات الشهري", category: "distribution", property: "جميع العقارات", date: "2024-12-15", status: "read" },
  { id: 3, name: "تقرير تقييم محدث", category: "valuation", property: "مساكن النخلة", date: "2024-12-10", status: "read" },
  { id: 4, name: "تقرير أداء المحفظة", category: "investment", property: "جميع العقارات", date: "2024-12-01", status: "read" },
  { id: 5, name: "تقرير تقدم البناء", category: "property", property: "مساكن النخلة", date: "2024-11-30", status: "read" },
];

const portfolioMetrics = {
  totalValue: 145000,
  change: 11.5,
  properties: 6,
  avgYield: 9.8,
  totalDistributions: 18750,
  ytdReturn: 12.3,
};

const propertyPerformance = [
  { name: "برج مارينا باي", value: 17250, change: 15.0, yield: 9.5 },
  { name: "مساكن النخلة", value: 62500, change: 25.0, yield: 0 },
  { name: "المجمع الصناعي", value: 33600, change: 12.0, yield: 11.2 },
  { name: "برج المكاتب", value: 21800, change: 9.0, yield: 8.5 },
  { name: "مشروع الواحة", value: 13200, change: 10.0, yield: 0 },
  { name: "مركز التسوق", value: 3150, change: 5.0, yield: 10.0 },
];

export default function Reports() {
  const [period, setPeriod] = useState("all");
  const [property, setProperty] = useState("all");
  const [category, setCategory] = useState("all");

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
                <Button variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  تحديث
                </Button>
                <Button variant="hero" className="gap-2">
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
                <Badge variant="success" className="gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  +{portfolioMetrics.change}%
                </Badge>
              </div>
              <div className="text-3xl font-bold text-gradient-gold">${portfolioMetrics.totalValue.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="text-sm text-muted-foreground mb-1">العقارات</div>
              <div className="text-2xl font-bold text-foreground">{portfolioMetrics.properties}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-sm text-muted-foreground mb-1">متوسط العائد</div>
              <div className="text-2xl font-bold text-foreground">{portfolioMetrics.avgYield}%</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="text-sm text-muted-foreground mb-1">التوزيعات</div>
              <div className="text-2xl font-bold text-success">${(portfolioMetrics.totalDistributions / 1000).toFixed(1)}K</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-sm text-muted-foreground mb-1">عائد السنة</div>
              <div className="text-2xl font-bold text-success">+{portfolioMetrics.ytdReturn}%</div>
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
                    {propertyPerformance.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Portfolio Value Chart */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display text-lg font-semibold text-foreground">قيمة المحفظة</h3>
                    <Select defaultValue="6m">
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1m">شهر</SelectItem>
                        <SelectItem value="3m">3 أشهر</SelectItem>
                        <SelectItem value="6m">6 أشهر</SelectItem>
                        <SelectItem value="1y">سنة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-64 bg-muted/30 rounded-xl flex items-end justify-around px-4 gap-2">
                    {[65, 72, 68, 85, 78, 92, 88, 95, 90, 98, 94, 100].map((h, i) => (
                      <div
                        key={i}
                        className="bg-gradient-gold rounded-t flex-1"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-4 text-xs text-muted-foreground">
                    <span>يناير</span>
                    <span>فبراير</span>
                    <span>مارس</span>
                    <span>أبريل</span>
                    <span>مايو</span>
                    <span>يونيو</span>
                  </div>
                </div>

                {/* Allocation Chart */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-6">توزيع المحفظة</h3>
                  <div className="flex items-center justify-center">
                    <div className="relative w-48 h-48">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="16" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="16" strokeDasharray="80 171" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(142 76% 36%)" strokeWidth="16" strokeDasharray="50 201" strokeDashoffset="-80" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(199 89% 48%)" strokeWidth="16" strokeDasharray="40 211" strokeDashoffset="-130" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(38 92% 50%)" strokeWidth="16" strokeDasharray="30 221" strokeDashoffset="-170" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <div className="text-2xl font-bold text-foreground">6</div>
                        <div className="text-sm text-muted-foreground">عقارات</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm text-muted-foreground">سكني (35%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-success" />
                      <span className="text-sm text-muted-foreground">تجاري (28%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-info" />
                      <span className="text-sm text-muted-foreground">صناعي (22%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-warning" />
                      <span className="text-sm text-muted-foreground">مكاتب (15%)</span>
                    </div>
                  </div>
                </div>

                {/* Distributions Chart */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-6">التوزيعات الشهرية</h3>
                  <div className="h-48 bg-muted/30 rounded-xl flex items-end justify-around px-4 gap-2">
                    {[1200, 1400, 1350, 1600, 1550, 1800].map((amount, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-success rounded-t"
                          style={{ height: `${(amount / 1800) * 100}%` }}
                        />
                        <span className="text-xs text-muted-foreground mt-2">${(amount / 1000).toFixed(1)}K</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Returns Chart */}
                <div className="bg-card rounded-2xl border border-border p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-6">العوائد حسب العقار</h3>
                  <div className="space-y-4">
                    {propertyPerformance.slice(0, 4).map((property, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-foreground">{property.name}</span>
                          <span className={cn(
                            "font-medium",
                            property.change > 10 ? "text-success" : "text-foreground"
                          )}>
                            +{property.change}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-gold rounded-full"
                            style={{ width: `${(property.change / 25) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports">
              <div className="grid lg:grid-cols-4 gap-6">
                {/* Report Categories */}
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
                        <cat.icon className={cn(
                          "w-5 h-5",
                          category === cat.id ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className={cn(
                          "text-sm font-medium",
                          category === cat.id ? "text-primary" : "text-foreground"
                        )}>
                          {cat.name}
                        </span>
                      </div>
                      <Badge variant="outline">{cat.count}</Badge>
                    </button>
                  ))}
                </div>

                {/* Recent Reports */}
                <div className="lg:col-span-3">
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <h3 className="font-display text-lg font-semibold text-foreground">أحدث التقارير</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {recentReports.map((report) => (
                        <div key={report.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{report.name}</span>
                                {report.status === "new" && (
                                  <Badge variant="gold" className="text-xs">جديد</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {report.property} • {report.date}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="w-4 h-4" />
                            تحميل
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Performance Tab */}
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
                      {propertyPerformance.map((property, index) => (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-primary" />
                              </div>
                              <span className="font-medium text-foreground">{property.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-foreground">
                            ${property.value.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <div className={cn(
                              "flex items-center gap-1 font-medium",
                              property.change > 0 ? "text-success" : "text-destructive"
                            )}>
                              {property.change > 0 ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                              {property.change > 0 ? "+" : ""}{property.change}%
                            </div>
                          </td>
                          <td className="px-6 py-4 text-foreground">
                            {property.yield > 0 ? `${property.yield}%` : "-"}
                          </td>
                          <td className="px-6 py-4">
                            <Button variant="ghost" size="sm">عرض التفاصيل</Button>
                          </td>
                        </tr>
                      ))}
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
