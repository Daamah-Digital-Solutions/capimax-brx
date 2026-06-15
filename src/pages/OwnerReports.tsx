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
  ArrowUpRight,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const assetPerformance = [
  { name: "Marina Bay Tower", nameAr: "برج مارينا باي", value: 2500000, occupancy: 95, yield: 9.5, status: "active" },
  { name: "Palm Residences", nameAr: "مساكن النخلة", value: 5000000, progress: 65, yield: 0, status: "construction" },
  { name: "Industrial Complex", nameAr: "المجمع الصناعي", value: 3200000, occupancy: 88, yield: 11.2, status: "active" },
];

const recentDistributions = [
  { property: "Marina Bay Tower", propertyAr: "برج مارينا باي", amount: 23750, date: "2024-12-15", investors: 156 },
  { property: "Industrial Complex", propertyAr: "المجمع الصناعي", amount: 35840, date: "2024-12-01", investors: 89 },
];

const ownerMetrics = {
  totalAssetValue: 10700000,
  totalInvestors: 312,
  avgOccupancy: 91.5,
  totalDistributed: 487500,
  activeProperties: 2,
  underConstruction: 1,
};

export default function OwnerReports() {
  const { t, language } = useLanguage();
  const [period, setPeriod] = useState("year");
  const [property, setProperty] = useState("all");

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
                <Button variant="outline" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {language === "ar" ? "تحديث" : "Refresh"}
                </Button>
                <Button variant="hero" className="gap-2">
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
                  {language === "ar" ? "إجمالي قيمة الأصول" : "Total Asset Value"}
                </span>
                <Badge variant="success" className="gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  +8.5%
                </Badge>
              </div>
              <div className="text-3xl font-bold text-gradient-gold">
                ${(ownerMetrics.totalAssetValue / 1000000).toFixed(1)}M
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "المستثمرون" : "Investors"}
              </div>
              <div className="text-2xl font-bold text-foreground">{ownerMetrics.totalInvestors}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "متوسط الإشغال" : "Avg. Occupancy"}
              </div>
              <div className="text-2xl font-bold text-foreground">{ownerMetrics.avgOccupancy}%</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "التوزيعات" : "Distributed"}
              </div>
              <div className="text-2xl font-bold text-success">
                ${(ownerMetrics.totalDistributed / 1000).toFixed(0)}K
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-sm text-muted-foreground mb-1">
                {language === "ar" ? "العقارات النشطة" : "Active Properties"}
              </div>
              <div className="text-2xl font-bold text-foreground">
                {ownerMetrics.activeProperties} / {ownerMetrics.activeProperties + ownerMetrics.underConstruction}
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

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid gap-4">
                {assetPerformance.map((asset, index) => (
                  <div 
                    key={index}
                    className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {language === "ar" ? asset.nameAr : asset.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {asset.status === "active" ? (
                              <Badge variant="success">{language === "ar" ? "نشط" : "Active"}</Badge>
                            ) : (
                              <Badge variant="construction">{language === "ar" ? "قيد البناء" : "Under Construction"}</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-8">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {language === "ar" ? "القيمة" : "Value"}
                          </div>
                          <div className="font-semibold text-foreground">
                            ${(asset.value / 1000000).toFixed(1)}M
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {asset.status === "active" 
                              ? (language === "ar" ? "الإشغال" : "Occupancy")
                              : (language === "ar" ? "التقدم" : "Progress")
                            }
                          </div>
                          <div className="font-semibold text-foreground">
                            {asset.status === "active" ? `${asset.occupancy}%` : `${asset.progress}%`}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {language === "ar" ? "العائد" : "Yield"}
                          </div>
                          <div className={cn(
                            "font-semibold",
                            asset.yield > 0 ? "text-success" : "text-muted-foreground"
                          )}>
                            {asset.yield > 0 ? `${asset.yield}%` : "N/A"}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Button variant="outline" size="sm">
                            {language === "ar" ? "تفاصيل" : "Details"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Distributions Tab */}
            <TabsContent value="distributions" className="space-y-6">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {language === "ar" ? "سجل التوزيعات" : "Distribution History"}
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {recentDistributions.map((dist, index) => (
                    <div key={index} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {language === "ar" ? dist.propertyAr : dist.property}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {dist.date} • {dist.investors} {language === "ar" ? "مستثمر" : "investors"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-success">
                          ${dist.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {language === "ar" ? "موزع" : "Distributed"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">312</div>
                    <div className="text-xs text-muted-foreground">
                      {language === "ar" ? "إجمالي" : "Total"}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">45</div>
                    <div className="text-xs text-muted-foreground">
                      {language === "ar" ? "جدد" : "New"}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">89%</div>
                    <div className="text-xs text-muted-foreground">
                      {language === "ar" ? "متكررون" : "Returning"}
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
