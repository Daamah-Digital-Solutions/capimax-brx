import { useState } from "react";
import { localName } from "@/lib/propertyLabels";
import { ar as arLocale } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OwnershipToken } from "@/hooks/useOwnershipTokens";
import { LPMarketListing, type LPExitTerms } from "@/hooks/useLPMarket";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Package, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Percent,
  Building2,
  Loader2,
  Wallet,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface InvestorAssetsViewProps {
  /** Decision 6: the platform's exit terms (discount, liquidity fee, validity). */
  exitTerms?: LPExitTerms | null;
  tokens: OwnershipToken[];
  myListings: LPMarketListing[];
  loading: boolean;
  onListAsset: (data: {
    property_id: string;
    property_name: string;
    token_symbol: string;
    token_amount: number;
    unit_price?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onCancelListing: (listingId: string) => Promise<{ success: boolean; error?: string }>;
  preselectedAssetId?: string | null;
}

export function InvestorAssetsView({
  exitTerms,
  tokens,
  myListings,
  loading,
  onListAsset,
  onCancelListing,
  preselectedAssetId
}: InvestorAssetsViewProps) {
  const { language } = useLanguage();
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<OwnershipToken | null>(null);
  const [sellAmount, setSellAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate stats
  const totalPortfolioValue = tokens.reduce((sum, t) => sum + t.token_value_usd, 0);
  const listedPropertyIds = myListings.filter(l => l.status === "listed").map(l => l.property_id);
  const availableForSale = tokens.filter(t => 
    t.status === "active" && !listedPropertyIds.includes(t.property_id)
  );
  const totalListedValue = myListings
    .filter(l => l.status === "listed")
    .reduce((sum, l) => sum + l.total_value, 0);
  const completedSalesValue = myListings
    .filter(l => l.status === "completed")
    .reduce((sum, l) => sum + l.net_amount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "listed":
        return <Badge variant="info">{language === "ar" ? "معروض" : "Listed"}</Badge>;
      case "pending":
        return <Badge variant="warning">{language === "ar" ? "قيد الانتظار" : "Pending"}</Badge>;
      case "completed":
        return <Badge variant="success">{language === "ar" ? "مكتمل" : "Completed"}</Badge>;
      case "cancelled":
        return <Badge variant="secondary">{language === "ar" ? "ملغى" : "Cancelled"}</Badge>;
      case "expired":
        return <Badge variant="destructive">{language === "ar" ? "منتهي" : "Expired"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenSellDialog = (token: OwnershipToken) => {
    setSelectedAsset(token);
    setSellAmount(token.token_amount.toString());
    setSellDialogOpen(true);
  };

  // Real per-token price from the held token's value (NOT a flat $100). Guards a
  // zero/empty token_amount so we never divide by zero.
  const unitPrice =
    selectedAsset && selectedAsset.token_amount > 0
      ? selectedAsset.unit_price ?? selectedAsset.token_value_usd / selectedAsset.token_amount
      : 0;
  // Decision 6: the platform quotes the exit — today's unit price minus the discount, then
  // the liquidity fee is deducted (the server recomputes the same figures).
  const discountPct = exitTerms?.discount_percent ?? 3;
  const liquidityFeePct = exitTerms?.fee_percent ?? 2;
  const ttlHours = Math.round((exitTerms?.ttl_minutes ?? 1440) / 60);
  const quotePrice = Math.round(unitPrice * (100 - discountPct)) / 100;
  const sellUnits = parseFloat(sellAmount) || 0;
  const quoteTotal = Math.round(sellUnits * quotePrice * 100) / 100;
  const quoteFee = Math.round(quoteTotal * liquidityFeePct) / 100;
  const quoteNet = Math.round((quoteTotal - quoteFee) * 100) / 100;

  const handleListAsset = async () => {
    if (!selectedAsset || !sellAmount) return;

    setIsSubmitting(true);
    const result = await onListAsset({
      property_id: selectedAsset.property_id,
      property_name: selectedAsset.property_name,
      token_symbol: selectedAsset.token_symbol,
      token_amount: parseFloat(sellAmount),
      unit_price: unitPrice,
    });
    setIsSubmitting(false);
    
    if (result.success) {
      setSellDialogOpen(false);
      setSelectedAsset(null);
      setSellAmount("");
    }
  };

  const handleCancelListing = async (listingId: string) => {
    await onCancelListing(listingId);
  };

  // Auto-open dialog if preselected
  useState(() => {
    if (preselectedAssetId && tokens.length > 0) {
      const token = tokens.find(t => t.id === preselectedAssetId || t.property_id === preselectedAssetId);
      if (token) {
        handleOpenSellDialog(token);
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي المحفظة" : "Portfolio Value"}
                </p>
                <p className="text-xl font-bold">${totalPortfolioValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Package className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "متاح للبيع" : "Available to Sell"}
                </p>
                <p className="text-xl font-bold">{availableForSale.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "قيد البيع" : "Listed Value"}
                </p>
                <p className="text-xl font-bold">${totalListedValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "المبيعات المكتملة" : "Completed Sales"}
                </p>
                <p className="text-xl font-bold">${completedSalesValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-muted/50 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">
                {language === "ar" ? "بيع فوري لمزودي السيولة" : "Instant Sale to Liquidity Providers"}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "ar"
                  ? "عند إدراج أصولك، ستكون متاحة لمزودي السيولة المعتمدين للشراء الفوري. رسوم المنصة 1% فقط."
                  : "When you list your assets, they become available to approved LPs for instant purchase. Platform fee is only 1%."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Assets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === "ar" ? "أصولك المتاحة للبيع" : "Your Assets Available for Sale"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "اختر الأصول التي تريد بيعها لمزودي السيولة"
              : "Select assets you want to sell to Liquidity Providers"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : availableForSale.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {language === "ar" ? "لا توجد أصول متاحة" : "No Assets Available"}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {language === "ar"
                  ? "ليس لديك أصول متاحة للبيع حالياً. يمكنك شراء أصول جديدة من السوق."
                  : "You don't have any assets available to sell right now. You can purchase new assets from the marketplace."}
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <a href="/marketplace">
                  {language === "ar" ? "تصفح السوق" : "Browse Marketplace"}
                </a>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableForSale.map((token) => (
                <Card 
                  key={token.id} 
                  className="hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => handleOpenSellDialog(token)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <h4 className="font-medium line-clamp-1">{localName(token, language)}</h4>
                            <Badge variant="outline" className="mt-1">{token.token_symbol}</Badge>
                          </div>
                        </div>
                        <Badge variant="success" className="shrink-0">{language === "ar" ? "نشط" : "Active"}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {language === "ar" ? "التوكنات" : "Tokens"}
                          </p>
                          <p className="font-semibold">{token.token_amount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {language === "ar" ? "القيمة" : "Value"}
                          </p>
                          <p className="font-semibold text-primary">${token.token_value_usd.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          {language === "ar" ? "الملكية" : "Ownership"}: {token.ownership_percentage.toFixed(2)}%
                        </span>
                        <Button
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {language === "ar" ? "بيع" : "Sell"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {language === "ar" ? "سجل المبيعات" : "Sales History"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "تتبع جميع مبيعاتك ومعاملاتك"
              : "Track all your sales and transactions"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {language === "ar" ? "لا توجد مبيعات سابقة" : "No sales history yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "العقار" : "Property"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الكمية" : "Amount"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "القيمة" : "Value"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الرسوم" : "Fee"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الصافي" : "Net"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myListings.map((listing) => (
                  <TableRow key={listing.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {localName(listing, language)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{listing.token_amount}</TableCell>
                    <TableCell className="text-right">${listing.total_value.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">
                      -${listing.platform_fee_amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      ${listing.net_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(listing.status)}
                      {/* Decision 6: when an open request lapses, or why it was closed. */}
                      {listing.status === "listed" && listing.expires_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {language === "ar" ? "ينتهي" : "Expires"} {format(new Date(listing.expires_at), "MMM d, HH:mm")}
                        </div>
                      )}
                      {listing.status === "expired" && listing.notes && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {listing.notes.startsWith("Closed")
                            ? language === "ar" ? "أُغلق: تغيّر سعر الوحدة" : "Closed: unit price changed"
                            : language === "ar" ? "انتهت صلاحية العرض" : "Quote lapsed"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(listing.listed_at), "MMM d, yyyy", language === "ar" ? { locale: arLocale } : undefined)}
                    </TableCell>
                    <TableCell>
                      {listing.status === "listed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelListing(listing.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {language === "ar" ? "بيع الأصل لمزود السيولة" : "Sell Asset to LP"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "سيتم عرض أصلك للشراء الفوري من قبل مزودي السيولة"
                : "Your asset will be available for instant purchase by Liquidity Providers"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedAsset && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{localName(selectedAsset, language)}</span>
                  </div>
                  <Badge variant="outline">{selectedAsset.token_symbol}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{language === "ar" ? "الرموز المتاحة" : "Available Tokens"}</p>
                    <p className="font-semibold">{selectedAsset.token_amount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{language === "ar" ? "القيمة الإجمالية" : "Total Value"}</p>
                    <p className="font-semibold">${selectedAsset.token_value_usd.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "كمية التوكنات للبيع" : "Tokens to Sell"}</Label>
                <Input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  max={selectedAsset.token_amount}
                  min={1}
                  placeholder={language === "ar" ? "أدخل الكمية" : "Enter amount"}
                />
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "الحد الأقصى" : "Maximum"}: {selectedAsset.token_amount} tokens
                </p>
              </div>

              {sellUnits > 0 && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <h4 className="font-medium text-sm">
                    {language === "ar" ? "عرض سعر المنصة" : "Platform quote"}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {language === "ar" ? "سعر الوحدة الحالي" : "Current unit price"}
                      </span>
                      <span className="font-medium">${unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {language === "ar"
                          ? `سعر السيولة (خصم ${discountPct}%) × ${sellUnits}`
                          : `Liquidity price (−${discountPct}%) × ${sellUnits}`}
                      </span>
                      <span className="font-medium">${quoteTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        {language === "ar" ? `رسوم السيولة (${liquidityFeePct}%)` : `Liquidity fee (${liquidityFeePct}%)`}
                      </span>
                      <span className="text-destructive">
                        -${quoteFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-medium">{language === "ar" ? "المبلغ الصافي" : "You Receive"}</span>
                      <span className="text-lg font-bold text-success">
                        ${quoteNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar"
                      ? `السعر تحدده المنصة. يبقى الطلب مفتوحًا ${ttlHours} ساعة، ويُغلق تلقائيًا إذا تغيّر سعر الوحدة، ولا يُنفَّذ أبدًا بسعر قديم.`
                      : `The platform sets the price. The request stays open ${ttlHours} hours and closes automatically if the unit price changes — it is never funded at an old price.`}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={handleListAsset} 
              disabled={isSubmitting || !sellAmount || parseFloat(sellAmount) <= 0}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {language === "ar" ? "تأكيد العرض" : "List for Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
