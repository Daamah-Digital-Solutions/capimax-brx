import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  Download,
  Calendar,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Filter,
} from "lucide-react";

interface Commission {
  id: string;
  property: string;
  propertyEn: string;
  investor: string;
  investmentAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: "pending" | "processing" | "paid";
  date: string;
  paidDate?: string;
}

const commissions: Commission[] = [
  {
    id: "1",
    property: "برج المارينا السكني",
    propertyEn: "Marina Tower Residence",
    investor: "أحمد محمد",
    investmentAmount: 25000,
    commissionRate: 2.5,
    commissionAmount: 625,
    status: "paid",
    date: "2024-01-15",
    paidDate: "2024-01-20",
  },
  {
    id: "2",
    property: "مجمع الواحة التجاري",
    propertyEn: "Oasis Commercial Complex",
    investor: "فاطمة أحمد",
    investmentAmount: 50000,
    commissionRate: 3.0,
    commissionAmount: 1500,
    status: "paid",
    date: "2024-01-10",
    paidDate: "2024-01-15",
  },
  {
    id: "3",
    property: "برج المارينا السكني",
    propertyEn: "Marina Tower Residence",
    investor: "خالد العلي",
    investmentAmount: 15000,
    commissionRate: 2.5,
    commissionAmount: 375,
    status: "processing",
    date: "2024-01-18",
  },
  {
    id: "4",
    property: "فندق النخيل الفاخر",
    propertyEn: "Palm Luxury Hotel",
    investor: "سارة حسين",
    investmentAmount: 100000,
    commissionRate: 3.5,
    commissionAmount: 3500,
    status: "pending",
    date: "2024-01-22",
  },
];

const monthlyStats = [
  { month: "يناير", earned: 5500, paid: 4000 },
  { month: "ديسمبر", earned: 4200, paid: 4200 },
  { month: "نوفمبر", earned: 3800, paid: 3800 },
  { month: "أكتوبر", earned: 2900, paid: 2900 },
];

export default function Commissions() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");

  const totalEarned = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalPaid = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalPending = commissions
    .filter((c) => c.status === "pending" || c.status === "processing")
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  const getStatusBadge = (status: Commission["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning">{t("commissions.pending")}</Badge>;
      case "processing":
        return <Badge variant="info">{t("commissions.processingStatus")}</Badge>;
      case "paid":
        return <Badge variant="success">{t("commissions.paid")}</Badge>;
    }
  };

  const filteredCommissions = commissions.filter((c) => {
    if (activeTab === "all") return true;
    return c.status === activeTab;
  });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t("commissions.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("commissions.subtitle")}</p>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            {t("commissions.exportReport")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-gold text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 opacity-70" />
              </div>
              <p className="text-3xl font-bold">${totalEarned.toLocaleString()}</p>
              <p className="text-sm opacity-80 mt-1">{t("commissions.totalEarned")}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <span className="text-emerald-500 text-sm font-medium">
                  +{((totalPaid / totalEarned) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-3xl font-bold text-foreground">${totalPaid.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("commissions.totalPaid")}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <span className="text-amber-500 text-sm font-medium">{t("commissions.processing")}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">${totalPending.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("commissions.totalPending")}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="all">
                    {t("commissions.all")}
                    <Badge variant="outline" className="ml-2">
                      {commissions.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="pending">{t("commissions.pending")}</TabsTrigger>
                  <TabsTrigger value="processing">{t("commissions.processingStatus")}</TabsTrigger>
                  <TabsTrigger value="paid">{t("commissions.paid")}</TabsTrigger>
                </TabsList>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>

              <TabsContent value={activeTab}>
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-0">
                    {filteredCommissions.length === 0 ? (
                      <div className="p-12 text-center">
                        <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-foreground font-medium">{t("commissions.noCommissions")}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {filteredCommissions.map((commission) => (
                          <div key={commission.id} className="p-4 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Building2 className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-foreground">
                                    {language === "ar" ? commission.property : commission.propertyEn}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {t("commissions.investor")}: {commission.investor}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span>
                                      {t("commissions.investment")}: ${commission.investmentAmount.toLocaleString()}
                                    </span>
                                    <span>×</span>
                                    <span>{commission.commissionRate}%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-lg font-bold text-primary">
                                  ${commission.commissionAmount.toLocaleString()}
                                </p>
                                <div className="mt-1">{getStatusBadge(commission.status)}</div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  <Calendar className="w-3 h-3 inline mr-1" />
                                  {commission.date}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {t("commissions.monthlySummary")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {monthlyStats.map((stat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                  >
                    <span className="text-foreground font-medium">{stat.month}</span>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">${stat.earned.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("commissions.paid")}: ${stat.paid.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  {t("commissions.paymentMethod")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{t("commissions.bankAccount")}</p>
                  <p className="font-mono text-foreground">•••• •••• •••• 4567</p>
                  <p className="text-xs text-muted-foreground mt-2">Emirates NBD</p>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  {t("commissions.updatePayment")}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground font-medium">{t("commissions.tip")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("commissions.tipText")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
