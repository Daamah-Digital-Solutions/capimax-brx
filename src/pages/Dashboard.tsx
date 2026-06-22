import { useMemo } from "react";
import {
  TrendingUp,
  Wallet,
  Building2,
  DollarSign,
  Bell,
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
import { useAuth } from "@/contexts/AuthContext";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useOwnershipTokens } from "@/hooks/useOwnershipTokens";
import { useDistributions } from "@/hooks/useDistributions";
import { useReinvestments } from "@/hooks/useReinvestments";
import { useNotifications } from "@/hooks/useNotifications";
import { renderNotificationCopy, relativeTime } from "@/lib/notifications";
import { ReinvestReturnsCard } from "@/components/dashboard/ReinvestReturnsCard";
import { ReinvestmentBanner } from "@/components/dashboard/ReinvestmentBanner";
import { ExitOptionsCard } from "@/components/portfolio/ExitOptionsCard";

// Real, derived per-property donut colors (cycled). The token model has NO property
// type/category, so the allocation is by REAL per-property VALUE SHARE (token_value_usd
// / total), not an invented Commercial/Residential/Industrial split.
const SLICE_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
];
const RING_CIRCUMFERENCE = 2 * Math.PI * 40; // r=40

export default function Dashboard() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const { wallet } = useUserWallet();
  const { tokens, loading: tokensLoading, totalValue } = useOwnershipTokens(wallet?.id ?? null);
  const { stats: distributionStats } = useDistributions();
  const { availableBalance } = useReinvestments();
  const { notifications, unreadCount, loading: activityLoading } = useNotifications();

  const userName = user?.profile?.full_name || user?.email || (isAr ? "مستثمر" : "Investor");

  // REAL available returns = the investor's internal balance (accrued distribution / sale
  // proceeds), same source the Reinvestment page uses. NO bonus/Pronova figures (deferred).
  const availableReturns = availableBalance;
  const pendingDistributions = distributionStats.pendingAmount;

  // Group ownership tokens by property (a wallet may hold several token rows per property).
  const holdings = useMemo(() => {
    const map = new Map<
      string,
      { propertyId: string; name: string; units: number; value: number; ownership: number }
    >();
    for (const tk of tokens) {
      const cur = map.get(tk.property_id) ?? {
        propertyId: tk.property_id,
        name: tk.property_name,
        units: 0,
        value: 0,
        ownership: 0,
      };
      cur.units += Number(tk.token_amount) || 0;
      cur.value += Number(tk.token_value_usd) || 0;
      cur.ownership += Number(tk.ownership_percentage) || 0;
      map.set(tk.property_id, cur);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [tokens]);

  const propertiesCount = holdings.length;

  // Donut segments = each property's share of total portfolio value (REAL, derived).
  const allocation = useMemo(() => {
    if (totalValue <= 0) return [];
    let cumulative = 0;
    return holdings.map((h, i) => {
      const pct = (h.value / totalValue) * 100;
      const dash = (pct / 100) * RING_CIRCUMFERENCE;
      const seg = {
        name: h.name,
        pct,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
        dash,
        offset: -cumulative,
      };
      cumulative += dash;
      return seg;
    });
  }, [holdings, totalValue]);

  const recentActivity = notifications.slice(0, 5);

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
          {/* Reinvestment Banner — real available balance; null when zero */}
          <ReinvestmentBanner availableReturns={availableReturns} className="mb-8" />

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.totalValue")}</div>
              <div className="text-2xl font-bold text-foreground">${totalValue.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.totalReturns")}</div>
              <div className="text-2xl font-bold text-foreground">${availableReturns.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.properties")}</div>
              <div className="text-2xl font-bold text-foreground">{propertiesCount}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <DollarSign className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("dashboard.pendingDistributions")}</div>
              <div className="text-2xl font-bold text-gradient-gold">${pendingDistributions.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Holdings */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">{t("dashboard.myInvestments")}</h2>
                  <Link to="/portfolio">
                    <Button variant="ghost" size="sm">{t("dashboard.viewAll")}</Button>
                  </Link>
                </div>

                {tokensLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : holdings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground mb-4">
                      {isAr ? "لا توجد استثمارات بعد" : "No investments yet"}
                    </p>
                    <Link to="/marketplace">
                      <Button variant="outline" className="gap-2">
                        <Coins className="w-4 h-4" />
                        {t("dashboard.newInvestment")}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {holdings.map((holding) => (
                      <Link
                        key={holding.propertyId}
                        to={`/property/${holding.propertyId}`}
                        className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{holding.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {holding.units.toLocaleString()} {t("dashboard.units")} •{" "}
                              {holding.ownership.toFixed(2)}% {isAr ? "ملكية" : "ownership"}
                            </div>
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="font-semibold text-foreground">${holding.value.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {isAr ? "القيمة الحالية" : "Current value"}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Allocation Chart — by REAL per-property value share (no invented type split) */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">{t("dashboard.portfolioAllocation")}</h2>
                </div>

                {allocation.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <Building2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {isAr ? "لا توجد أصول لعرض التوزيع" : "No holdings to allocate yet"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-64 flex items-center justify-center">
                      <div className="relative w-48 h-48">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                          {allocation.map((seg, i) => (
                            <circle
                              key={i}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke={seg.color}
                              strokeWidth="12"
                              strokeDasharray={`${seg.dash} ${RING_CIRCUMFERENCE - seg.dash}`}
                              strokeDashoffset={seg.offset}
                            />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <div className="text-2xl font-bold text-foreground">{propertiesCount}</div>
                          <div className="text-sm text-muted-foreground">{t("dashboard.properties")}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                      {allocation.map((seg, i) => (
                        <div key={i} className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className="text-sm text-muted-foreground truncate">
                            {seg.name} ({seg.pct.toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Recent Activity — real notifications */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t("dashboard.recentActivity")}</h3>
                  </div>
                  {unreadCount > 0 && (
                    <Badge variant="gold">{unreadCount} {t("dashboard.new")}</Badge>
                  )}
                </div>

                {activityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {isAr ? "لا يوجد نشاط حديث" : "No recent activity"}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((n) => {
                      const { title } = renderNotificationCopy(n, t);
                      return (
                        <div key={n.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            n.read ? "bg-muted" : "bg-primary/10"
                          )}>
                            <Bell className={cn("w-4 h-4", n.read ? "text-muted-foreground" : "text-primary")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground">{title}</div>
                            <div className="text-xs text-muted-foreground">{relativeTime(n.created_at, language)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Link to="/notifications">
                  <Button variant="ghost" className="w-full mt-4">{t("dashboard.viewAllActivity")}</Button>
                </Link>
              </div>

              {/* Reinvest Returns Card — real available balance, no fake bonus figures */}
              <ReinvestReturnsCard
                availableReturns={availableReturns}
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
                  <Link to="/reinvestment" className="contents">
                    <Button variant="outline" className="flex-col h-auto py-4 gap-2">
                      <RefreshCw className="w-5 h-5" />
                      <span className="text-xs">{isAr ? "إعادة استثمار" : "Reinvest"}</span>
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
