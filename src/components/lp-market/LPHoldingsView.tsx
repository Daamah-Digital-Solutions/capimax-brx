import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LPHolding } from "@/hooks/useLPHoldings";
import { useLanguage } from "@/contexts/LanguageContext";
import { ResaleForm } from "./ResaleForm";
import { 
  Briefcase, 
  Building2,
  Loader2,
  MoreVertical,
  TrendingUp,
  Store,
  Repeat,
  DollarSign,
  Package,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface LPHoldingsViewProps {
  holdings: LPHolding[];
  loading: boolean;
  stats: {
    totalHoldings: number;
    totalValue: number;
    totalInvested: number;
    listedCount: number;
  };
  onResale: (holdingId: string, target: "lp" | "secondary", price: number) => Promise<{ success: boolean; error?: string }>;
}

export function LPHoldingsView({
  holdings,
  loading,
  stats,
  onResale
}: LPHoldingsViewProps) {
  const { language } = useLanguage();
  const [resaleDialogOpen, setResaleDialogOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<LPHolding | null>(null);

  const getStatusBadge = (status: LPHolding["status"]) => {
    switch (status) {
      case "held":
        return <Badge variant="success">{language === "ar" ? "محتفظ" : "Held"}</Badge>;
      case "listed_lp":
        return <Badge variant="info">{language === "ar" ? "معروض LP" : "Listed LP"}</Badge>;
      case "listed_secondary":
        return <Badge variant="warning">{language === "ar" ? "معروض ثانوي" : "Listed Secondary"}</Badge>;
      case "sold":
        return <Badge variant="secondary">{language === "ar" ? "مباع" : "Sold"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenResale = (holding: LPHolding) => {
    setSelectedHolding(holding);
    setResaleDialogOpen(true);
  };

  const heldHoldings = holdings.filter(h => h.status === "held");
  const listedHoldings = holdings.filter(h => h.status === "listed_lp" || h.status === "listed_secondary");
  const soldHoldings = holdings.filter(h => h.status === "sold");

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "الأصول المحتفظ بها" : "Held Assets"}
                </p>
                <p className="text-xl font-bold">{stats.totalHoldings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "القيمة الحالية" : "Current Value"}
                </p>
                <p className="text-xl font-bold">${stats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <TrendingUp className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي المستثمر" : "Total Invested"}
                </p>
                <p className="text-xl font-bold">${stats.totalInvested.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Store className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "معروض للبيع" : "Listed for Sale"}
                </p>
                <p className="text-xl font-bold">{stats.listedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Held Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === "ar" ? "أصولك المحتفظ بها" : "Your Held Assets"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "الأصول التي اشتريتها ويمكنك إعادة بيعها"
              : "Assets you've purchased that you can resell"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : heldHoldings.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {language === "ar" ? "لا توجد أصول" : "No Assets Yet"}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {language === "ar"
                  ? "لم تقم بشراء أي أصول بعد. تصفح السوق للعثور على فرص استثمارية."
                  : "You haven't purchased any assets yet. Browse the marketplace to find investment opportunities."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "العقار" : "Property"}</TableHead>
                  <TableHead>{language === "ar" ? "الرمز" : "Symbol"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الكمية" : "Tokens"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "سعر الشراء" : "Purchase Price"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "القيمة الحالية" : "Current Value"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {heldHoldings.map((holding) => (
                  <TableRow key={holding.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {holding.property_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{holding.token_symbol}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{holding.token_amount}</TableCell>
                    <TableCell className="text-right">${holding.purchase_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      ${holding.current_value.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(holding.purchase_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenResale(holding)}>
                            <Repeat className="h-4 w-4 mr-2" />
                            {language === "ar" ? "إعادة البيع" : "Resell Asset"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Listed Assets */}
      {listedHoldings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {language === "ar" ? "الأصول المعروضة للبيع" : "Listed for Sale"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "العقار" : "Property"}</TableHead>
                  <TableHead>{language === "ar" ? "الكمية" : "Tokens"}</TableHead>
                  <TableHead>{language === "ar" ? "السوق" : "Market"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "تاريخ العرض" : "Listed Date"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listedHoldings.map((holding) => (
                  <TableRow key={holding.id}>
                    <TableCell className="font-medium">{holding.property_name}</TableCell>
                    <TableCell>{holding.token_amount}</TableCell>
                    <TableCell>
                      {holding.status === "listed_lp" 
                        ? (language === "ar" ? "سوق LP" : "LP Market")
                        : (language === "ar" ? "السوق الثانوي" : "Secondary Market")}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {holding.listed_at && format(new Date(holding.listed_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{getStatusBadge(holding.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      {soldHoldings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {language === "ar" ? "المعاملات السابقة" : "Transaction History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "العقار" : "Property"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الكمية" : "Tokens"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "سعر الشراء" : "Purchase"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "سعر البيع" : "Sold"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldHoldings.map((holding) => (
                  <TableRow key={holding.id}>
                    <TableCell className="font-medium">{holding.property_name}</TableCell>
                    <TableCell className="text-right">{holding.token_amount}</TableCell>
                    <TableCell className="text-right">${holding.purchase_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${holding.current_value.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {holding.sold_at && format(new Date(holding.sold_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resale Dialog */}
      {selectedHolding && (
        <ResaleForm
          holding={selectedHolding}
          open={resaleDialogOpen}
          onOpenChange={setResaleDialogOpen}
          onConfirmResale={onResale}
        />
      )}
    </div>
  );
}
