import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Coins, 
  TrendingUp, 
  Building2,
  Calendar,
  DollarSign,
  Percent,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useOwnershipTokens, OwnershipToken } from "@/hooks/useOwnershipTokens";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface TokenHoldingsProps {
  walletId: string | null;
}

export function TokenHoldings({ walletId }: TokenHoldingsProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { tokens, loading, error, totalValue, totalTokens, refreshTokens } = useOwnershipTokens(walletId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refreshTokens} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {isArabic ? "إعادة المحاولة" : "Try Again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!walletId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Coins className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isArabic 
              ? "يرجى إنشاء محفظة أولاً لعرض الرموز"
              : "Please create a wallet first to view tokens"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? "إجمالي الرموز" : "Total Tokens"}
                </p>
                <p className="text-xl font-bold">{totalTokens.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? "القيمة الإجمالية" : "Total Value"}
                </p>
                <p className="text-xl font-bold">${totalValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? "العقارات" : "Properties"}
                </p>
                <p className="text-xl font-bold">{tokens.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Token Holdings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            {isArabic ? "رموز الملكية" : "Ownership Tokens"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={refreshTokens}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {tokens.length > 0 ? (
            <div className="space-y-4">
              {tokens.map((token) => (
                <TokenCard key={token.id} token={token} isArabic={isArabic} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {isArabic 
                  ? "لا توجد رموز ملكية بعد"
                  : "No ownership tokens yet"}
              </p>
              <Link to="/marketplace">
                <Button>
                  {isArabic ? "استكشف الفرص" : "Explore Opportunities"}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface TokenCardProps {
  token: OwnershipToken;
  isArabic: boolean;
}

function TokenCard({ token, isArabic }: TokenCardProps) {
  const getStatusBadge = () => {
    switch (token.status) {
      case "active":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            {isArabic ? "نشط" : "Active"}
          </Badge>
        );
      case "locked":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            {isArabic ? "مقفل" : "Locked"}
          </Badge>
        );
      case "sold":
        // Our OwnershipToken model uses active|sold; surface "sold" explicitly so a
        // disposed position renders a badge instead of nothing (Phase 4 reconcile).
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {isArabic ? "مُباع" : "Sold"}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline">
            {isArabic ? "معلق" : "Pending"}
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Token Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">{token.property_name}</h4>
              <p className="text-xs text-muted-foreground font-mono">{token.token_symbol}</p>
            </div>
            {getStatusBadge()}
          </div>

          {/* Token Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="h-3 w-3" />
                {isArabic ? "الرموز" : "Tokens"}
              </div>
              <p className="font-semibold">{Number(token.token_amount).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                {isArabic ? "القيمة" : "Value"}
              </div>
              <p className="font-semibold text-green-500">${Number(token.token_value_usd).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Percent className="h-3 w-3" />
                {isArabic ? "الملكية" : "Ownership"}
              </div>
              <p className="font-semibold">{Number(token.ownership_percentage).toFixed(4)}%</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {isArabic ? "التوزيعات" : "Distributions"}
              </div>
              <p className="font-semibold">${Number(token.total_distributions).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link to={`/property/${token.property_id}`}>
            <Button variant="outline" size="sm" className="w-full gap-1">
              <ExternalLink className="h-3 w-3" />
              {isArabic ? "التفاصيل" : "Details"}
            </Button>
          </Link>
          <div className="text-xs text-muted-foreground text-center">
            <Calendar className="h-3 w-3 inline mr-1" />
            {format(new Date(token.acquisition_date), "MMM d, yyyy")}
          </div>
        </div>
      </div>
    </div>
  );
}