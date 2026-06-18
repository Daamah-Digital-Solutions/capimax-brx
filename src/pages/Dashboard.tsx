import { 
  TrendingUp, 
  Wallet, 
  Building2, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Bell,
  BarChart3,
  Coins,
  FileText,
  RefreshCw,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReinvestReturnsCard } from "@/components/dashboard/ReinvestReturnsCard";
import { ReinvestmentBanner } from "@/components/dashboard/ReinvestmentBanner";
import { ExitOptionsCard } from "@/components/portfolio/ExitOptionsCard";

const portfolioStats = {
  totalValue: 45000,
  totalReturn: 4250,
  returnPercent: 9.4,
  properties: 4,
  pendingDistributions: 850,
  nextDistribution: "2025-01-15",
};

const holdings = [
  {
    id: "1",
    name: "Marina Bay Tower",
    nameAr: "برج مارينا باي",
    units: 5,
    invested: 5000,
    currentValue: 5475,
    yield: 9.5,
    status: "active",
    lastDistribution: 125,
  },
  {
    id: "2",
    name: "Palm Residences",
    nameAr: "مساكن النخلة",
    units: 10,
    invested: 25000,
    currentValue: 27500,
    yield: 25,
    status: "construction",
    progress: 65,
  },
  {
    id: "3",
    name: "Industrial Park",
    nameAr: "المجمع الصناعي",
    units: 3,
    invested: 15000,
    currentValue: 16800,
    yield: 11.2,
    status: "active",
    lastDistribution: 420,
  },
];

export default function Dashboard() {
  const { t, language } = useLanguage();
  const userName = language === "ar" ? "محمد أحمد" : "Mohamed Ahmed";

  const recentActivity = [
    { 
      type: "distribution", 
      title: language === "ar" ? "توزيعات - برج مارينا باي" : "Distribution - Marina Bay Tower", 
      amount: "+$125", 
      date: language === "ar" ? "15 ديسمبر 2024" : "Dec 15, 2024", 
      status: "success" 
    },
    { 
      type: "investment", 
      title: language === "ar" ? "استثمار جديد - المجمع الصناعي" : "New Investment - Industrial Park", 
      amount: "-$3,000", 
      date: language === "ar" ? "10 ديسمبر 2024" : "Dec 10, 2024", 
      status: "info" 
    },
    { 
      type: "distribution", 
      title: language === "ar" ? "توزيعات - المجمع الصناعي" : "Distribution - Industrial Park", 
      amount: "+$420", 
      date: language === "ar" ? "1 ديسمبر 2024" : "Dec 1, 2024", 
      status: "success" 
    },
  ];

  const upcomingPayments = [
    { 
      property: language === "ar" ? "برج مارينا باي" : "Marina Bay Tower", 
      type: t("dashboard.distribution"), 
      amount: 125, 
      date: language === "ar" ? "15 يناير 2025" : "Jan 15, 2025" 
    },
    { 
      property: language === "ar" ? "المجمع الصناعي" : "Industrial Park", 
      type: t("dashboard.distribution"), 
      amount: 420, 
      date: language === "ar" ? "1 فبراير 2025" : "Feb 1, 2025" 
    },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {t("dashboard.welcome")}, {userName}
                </h1>
                <p className="text-muted-foreground">{t("dashboard.overview")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/reports">
                  <Button variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" />
                    {t("dashboard.portfolioReport")}
                  </Button>
                </Link>
                <Link to="/marketplace">
                  <Button variant="hero" className="gap-2">
                    <Coins className="w-4 h-4" />
                    {t("dashboard.newInvestment")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Reinvestment Banner */}
          <ReinvestmentBanner 
            availableReturns={portfolioStats.totalReturn} 
            className="mb-8"
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="success" className="gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  +12%
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.totalValue")}</div>
              <div className="text-2xl font-bold text-foreground">${portfolioStats.totalValue.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <span className="text-2xl font-bold text-success">+{portfolioStats.returnPercent}%</span>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.totalReturns")}</div>
              <div className="text-2xl font-bold text-foreground">${portfolioStats.totalReturn.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.properties")}</div>
              <div className="text-2xl font-bold text-foreground">{portfolioStats.properties}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <DollarSign className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.pendingDistributions")}</div>
              <div className="text-2xl font-bold text-gradient-gold">${portfolioStats.pendingDistributions}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Holdings */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">{t("dashboard.myInvestments")}</h2>
                  <Button variant="ghost" size="sm">{t("dashboard.viewAll")}</Button>
                </div>

                <div className="space-y-4">
                  {holdings.map((holding) => (
                    <Link
                      key={holding.id}
                      to={`/property/${holding.id}`}
                      className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {language === "ar" ? holding.nameAr : holding.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {holding.units} {t("dashboard.units")} • ${holding.invested.toLocaleString()} {t("dashboard.invested")}
                          </div>
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="font-semibold text-foreground">${holding.currentValue.toLocaleString()}</div>
                        <div className={cn(
                          "text-sm flex items-center gap-1 justify-end",
                          holding.currentValue > holding.invested ? "text-success" : "text-destructive"
                        )}>
                          {holding.currentValue > holding.invested ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {holding.yield}%
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Allocation Chart */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">{t("dashboard.portfolioAllocation")}</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">{t("dashboard.byType")}</Button>
                    <Button variant="ghost" size="sm">{t("dashboard.byRegion")}</Button>
                  </div>
                </div>

                <div className="h-64 flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="12" strokeDasharray="100 151" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(142 76% 36%)" strokeWidth="12" strokeDasharray="60 191" strokeDashoffset="-100" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(199 89% 48%)" strokeWidth="12" strokeDasharray="40 211" strokeDashoffset="-160" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <div className="text-2xl font-bold text-foreground">4</div>
                      <div className="text-sm text-muted-foreground">{t("dashboard.properties")}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">{t("dashboard.commercial")} (40%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-sm text-muted-foreground">{t("dashboard.residential")} (35%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-info" />
                    <span className="text-sm text-muted-foreground">{t("dashboard.industrial")} (25%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Payments */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("dashboard.upcomingPayments")}</h3>
                </div>

                <div className="space-y-4">
                  {upcomingPayments.map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium text-foreground text-sm">{payment.property}</div>
                        <div className="text-xs text-muted-foreground">{payment.type} • {payment.date}</div>
                      </div>
                      <div className="text-sm font-semibold text-success">+${payment.amount}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.35s" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t("dashboard.recentActivity")}</h3>
                  </div>
                  <Badge variant="gold">3 {t("dashboard.new")}</Badge>
                </div>

                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        activity.status === "success" ? "bg-success/10" : "bg-info/10"
                      )}>
                        {activity.type === "distribution" && <DollarSign className={cn("w-4 h-4", activity.status === "success" ? "text-success" : "text-info")} />}
                        {activity.type === "investment" && <Building2 className="w-4 h-4 text-info" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">{activity.date}</div>
                      </div>
                      <div className={cn(
                        "text-sm font-semibold shrink-0",
                        activity.amount.startsWith("+") ? "text-success" : "text-foreground"
                      )}>
                        {activity.amount}
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="ghost" className="w-full mt-4">{t("dashboard.viewAllActivity")}</Button>
              </div>

              {/* Reinvest Returns Card */}
              <ReinvestReturnsCard
                availableReturns={portfolioStats.totalReturn}
                totalReinvested={2500}
                totalBonus={175}
                className="animate-fade-in"
                style={{ animationDelay: "0.4s" }}
              />

              {/* Exit Options Card */}
              <ExitOptionsCard 
                compact 
                className="bg-card rounded-2xl border border-border p-6 animate-fade-in"
                style={{ animationDelay: "0.42s" }}
              />

              {/* Quick Actions */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.45s" }}>
                <h3 className="font-semibold text-foreground mb-4">{t("dashboard.quickActions")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/wallet" className="contents">
                    <Button variant="outline" className="flex-col h-auto py-4 gap-2">
                      <Wallet className="w-5 h-5" />
                      <span className="text-xs">{t("dashboard.deposit")}</span>
                    </Button>
                  </Link>
                  <Link to="/secondary-market" className="contents">
                    <Button variant="outline" className="flex-col h-auto py-4 gap-2">
                      <TrendingUp className="w-5 h-5" />
                      <span className="text-xs">{t("nav.secondaryMarket")}</span>
                    </Button>
                  </Link>
                  <Link to="/marketplace" className="contents">
                    <Button variant="outline" className="flex-col h-auto py-4 gap-2">
                      <RefreshCw className="w-5 h-5" />
                      <span className="text-xs">{language === "ar" ? "إعادة استثمار" : "Reinvest"}</span>
                    </Button>
                  </Link>
                  <Link to="/documents" className="contents">
                    <Button variant="outline" className="flex-col h-auto py-4 gap-2">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs">{t("nav.documents")}</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
