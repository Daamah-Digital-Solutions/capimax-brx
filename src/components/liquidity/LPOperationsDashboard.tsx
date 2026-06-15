import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LiquidityProvider, LPTransaction } from "@/hooks/useLiquidityProvider";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface LPOperationsDashboardProps {
  lpProfile: LiquidityProvider;
  transactions: LPTransaction[];
  isRTL: boolean;
  showDetails?: boolean;
}

export function LPOperationsDashboard({
  lpProfile,
  transactions,
  isRTL,
  showDetails = false,
}: LPOperationsDashboardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const stats = [
    {
      label: isRTL ? "الرصيد الحالي" : "Current Balance",
      value: formatCurrency(lpProfile.current_balance),
      icon: Wallet,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: isRTL ? "إجمالي الإيداعات" : "Total Deposited",
      value: formatCurrency(lpProfile.total_deposited),
      icon: ArrowDownRight,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: isRTL ? "إجمالي الأرباح" : "Total Earnings",
      value: formatCurrency(lpProfile.total_earnings),
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: isRTL ? "إجمالي السحوبات" : "Total Withdrawn",
      value: formatCurrency(lpProfile.total_withdrawn),
      icon: ArrowUpRight,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "success" | "destructive" | "secondary"; icon: React.ElementType }> = {
      pending: { variant: "secondary", icon: Clock },
      processing: { variant: "default", icon: RefreshCw },
      completed: { variant: "success", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const { variant, icon: Icon } = config[status] || config.pending;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownRight className="w-4 h-4 text-emerald-500" />;
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-orange-500" />;
      case "earning":
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-card/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Investment Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isRTL ? "ملخص الاستثمار" : "Investment Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {isRTL ? "مبلغ الاستثمار الأولي" : "Initial Investment Amount"}
              </p>
              <p className="text-2xl font-bold">{formatCurrency(lpProfile.investment_amount)}</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {isRTL ? "تاريخ الموافقة" : "Approval Date"}
              </p>
              <p className="text-2xl font-bold">
                {lpProfile.approved_at
                  ? new Date(lpProfile.approved_at).toLocaleDateString()
                  : "-"}
              </p>
            </div>
          </div>

          {/* LP Info */}
          {showDetails && (
            <div className="pt-4 border-t space-y-3">
              <h4 className="font-medium">{isRTL ? "معلومات الحساب" : "Account Information"}</h4>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{isRTL ? "الاسم:" : "Name:"}</span>{" "}
                  <span className="font-medium">{lpProfile.contact_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "الشركة:" : "Company:"}</span>{" "}
                  <span className="font-medium">{lpProfile.company_name || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "البريد:" : "Email:"}</span>{" "}
                  <span className="font-medium">{lpProfile.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{isRTL ? "البلد:" : "Country:"}</span>{" "}
                  <span className="font-medium">{lpProfile.country || "-"}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isRTL ? "المعاملات الأخيرة" : "Recent Transactions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{isRTL ? "لا توجد معاملات بعد" : "No transactions yet"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, showDetails ? 20 : 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {getTypeIcon(tx.tx_type)}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{tx.tx_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        tx.tx_type === "withdrawal" || tx.tx_type === "fee"
                          ? "text-destructive"
                          : "text-emerald-500"
                      }`}
                    >
                      {tx.tx_type === "withdrawal" || tx.tx_type === "fee" ? "-" : "+"}
                      {formatCurrency(tx.amount)}
                    </p>
                    {getStatusBadge(tx.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
