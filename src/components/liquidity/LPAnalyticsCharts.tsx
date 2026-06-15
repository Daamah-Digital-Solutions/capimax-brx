import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiquidityProvider, LPTransaction } from "@/hooks/useLiquidityProvider";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, PieChartIcon, BarChart3 } from "lucide-react";

interface LPAnalyticsChartsProps {
  lpProfile: LiquidityProvider;
  transactions: LPTransaction[];
  isRTL: boolean;
}

export function LPAnalyticsCharts({ lpProfile, transactions, isRTL }: LPAnalyticsChartsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate monthly data for area chart
  const getMonthlyTrendData = () => {
    const now = new Date();
    const monthlyData: Record<string, { month: string; balance: number; earnings: number; deposits: number }> = {};
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = {
        month: date.toLocaleDateString(isRTL ? "ar" : "en", { month: "short" }),
        balance: 0,
        earnings: 0,
        deposits: 0,
      };
    }

    // Aggregate transactions
    transactions.forEach((tx) => {
      const date = new Date(tx.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (monthlyData[key]) {
        if (tx.tx_type === "deposit") {
          monthlyData[key].deposits += tx.amount;
        } else if (tx.tx_type === "earning") {
          monthlyData[key].earnings += tx.amount;
        }
      }
    });

    // Calculate running balance
    let runningBalance = lpProfile.investment_amount;
    return Object.values(monthlyData).map((data) => {
      runningBalance += data.deposits + data.earnings;
      return { ...data, balance: runningBalance };
    });
  };

  // Distribution data for pie chart
  const getDistributionData = () => {
    const total = lpProfile.total_deposited + lpProfile.total_earnings;
    if (total === 0) return [];
    
    return [
      { 
        name: isRTL ? "الإيداعات" : "Deposits", 
        value: lpProfile.total_deposited,
        color: "hsl(var(--chart-1))"
      },
      { 
        name: isRTL ? "الأرباح" : "Earnings", 
        value: lpProfile.total_earnings,
        color: "hsl(var(--chart-2))"
      },
      { 
        name: isRTL ? "السحوبات" : "Withdrawn", 
        value: lpProfile.total_withdrawn,
        color: "hsl(var(--chart-3))"
      },
    ].filter(item => item.value > 0);
  };

  // Transaction type breakdown for bar chart
  const getTransactionBreakdown = () => {
    const breakdown = transactions.reduce((acc, tx) => {
      const type = tx.tx_type;
      if (!acc[type]) {
        acc[type] = { type: type.charAt(0).toUpperCase() + type.slice(1), count: 0, amount: 0 };
      }
      acc[type].count += 1;
      acc[type].amount += tx.amount;
      return acc;
    }, {} as Record<string, { type: string; count: number; amount: number }>);

    return Object.values(breakdown);
  };

  const trendData = getMonthlyTrendData();
  const distributionData = getDistributionData();
  const breakdownData = getTransactionBreakdown();

  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="space-y-6">
      {/* Balance Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {isRTL ? "اتجاه الرصيد" : "Balance Trend"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} 
                  className="text-xs" 
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name={isRTL ? "الرصيد" : "Balance"}
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorBalance)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  name={isRTL ? "الأرباح" : "Earnings"}
                  stroke="hsl(var(--chart-2))"
                  fillOpacity={1}
                  fill="url(#colorEarnings)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              {isRTL ? "توزيع الأموال" : "Fund Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {distributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {isRTL ? "لا توجد بيانات" : "No data available"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {isRTL ? "أنواع المعاملات" : "Transaction Types"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {breakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="type" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} 
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === "amount" ? formatCurrency(value) : value,
                        name === "amount" ? (isRTL ? "المبلغ" : "Amount") : (isRTL ? "العدد" : "Count")
                      ]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {isRTL ? "لا توجد معاملات" : "No transactions yet"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Summary */}
      <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">
                {lpProfile.total_deposited > 0 
                  ? ((lpProfile.total_earnings / lpProfile.total_deposited) * 100).toFixed(1) 
                  : "0"}%
              </p>
              <p className="text-sm text-muted-foreground">{isRTL ? "العائد على الاستثمار" : "ROI"}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-500">{transactions.length}</p>
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي المعاملات" : "Total Transactions"}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-500">
                {lpProfile.approved_at 
                  ? Math.floor((Date.now() - new Date(lpProfile.approved_at).getTime()) / (1000 * 60 * 60 * 24))
                  : 0}
              </p>
              <p className="text-sm text-muted-foreground">{isRTL ? "أيام نشط" : "Days Active"}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-500">
                {transactions.filter(t => t.tx_type === "earning").length}
              </p>
              <p className="text-sm text-muted-foreground">{isRTL ? "دفعات الأرباح" : "Earning Payouts"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
