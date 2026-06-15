import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LiquidityProvider, LPTransaction } from "@/hooks/useLiquidityProvider";
import { FileText, Download, Calendar, TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface LPReportsProps {
  lpProfile: LiquidityProvider;
  transactions: LPTransaction[];
  isRTL: boolean;
}

export function LPReports({ lpProfile, transactions, isRTL }: LPReportsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate monthly stats
  const getMonthlyStats = () => {
    const now = new Date();
    const monthlyData: Record<string, { deposits: number; withdrawals: number; earnings: number }> = {};

    transactions.forEach((tx) => {
      const date = new Date(tx.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = { deposits: 0, withdrawals: 0, earnings: 0 };
      }

      if (tx.tx_type === "deposit") {
        monthlyData[key].deposits += tx.amount;
      } else if (tx.tx_type === "withdrawal") {
        monthlyData[key].withdrawals += tx.amount;
      } else if (tx.tx_type === "earning") {
        monthlyData[key].earnings += tx.amount;
      }
    });

    // Get last 6 months
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: date.toLocaleDateString(isRTL ? "ar" : "en", { month: "short", year: "numeric" }),
        ...monthlyData[key] || { deposits: 0, withdrawals: 0, earnings: 0 },
      });
    }

    return months;
  };

  const monthlyStats = getMonthlyStats();

  // Calculate YTD stats
  const ytdStats = transactions
    .filter((tx) => new Date(tx.created_at).getFullYear() === new Date().getFullYear())
    .reduce(
      (acc, tx) => {
        if (tx.tx_type === "deposit") acc.deposits += tx.amount;
        else if (tx.tx_type === "withdrawal") acc.withdrawals += tx.amount;
        else if (tx.tx_type === "earning") acc.earnings += tx.amount;
        return acc;
      },
      { deposits: 0, withdrawals: 0, earnings: 0 }
    );

  const calculateROI = () => {
    if (lpProfile.total_deposited === 0) return "0%";
    const roi = (lpProfile.total_earnings / lpProfile.total_deposited) * 100;
    return roi.toFixed(2) + "%";
  };

  return (
    <div className="space-y-6">
      {/* Report Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isRTL ? "تقارير الأداء" : "Performance Reports"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar className="w-5 h-5" />
              <span>{isRTL ? "تقرير شهري" : "Monthly Report"}</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar className="w-5 h-5" />
              <span>{isRTL ? "تقرير ربع سنوي" : "Quarterly Report"}</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar className="w-5 h-5" />
              <span>{isRTL ? "تقرير سنوي" : "Annual Report"}</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Download className="w-5 h-5" />
              <span>{isRTL ? "تصدير البيانات" : "Export Data"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Year-to-Date Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isRTL ? "ملخص السنة حتى الآن" : "Year-to-Date Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <ArrowDownRight className="w-4 h-4" />
                <span className="text-sm">{isRTL ? "الإيداعات" : "Deposits"}</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(ytdStats.deposits)}</p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2 text-blue-500 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">{isRTL ? "الأرباح" : "Earnings"}</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(ytdStats.earnings)}</p>
            </div>
            <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <div className="flex items-center gap-2 text-orange-500 mb-2">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-sm">{isRTL ? "السحوبات" : "Withdrawals"}</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(ytdStats.withdrawals)}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-primary mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">{isRTL ? "العائد على الاستثمار" : "ROI"}</span>
              </div>
              <p className="text-2xl font-bold">{calculateROI()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isRTL ? "التحليل الشهري" : "Monthly Breakdown"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    {isRTL ? "الشهر" : "Month"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    {isRTL ? "الإيداعات" : "Deposits"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    {isRTL ? "الأرباح" : "Earnings"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    {isRTL ? "السحوبات" : "Withdrawals"}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    {isRTL ? "الصافي" : "Net"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((month) => {
                  const net = month.deposits + month.earnings - month.withdrawals;
                  return (
                    <tr key={month.key} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">{month.label}</td>
                      <td className="py-3 px-4 text-emerald-500">
                        {month.deposits > 0 ? formatCurrency(month.deposits) : "-"}
                      </td>
                      <td className="py-3 px-4 text-blue-500">
                        {month.earnings > 0 ? formatCurrency(month.earnings) : "-"}
                      </td>
                      <td className="py-3 px-4 text-orange-500">
                        {month.withdrawals > 0 ? formatCurrency(month.withdrawals) : "-"}
                      </td>
                      <td className={`py-3 px-4 font-medium ${net >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {net !== 0 ? formatCurrency(net) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
