import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LPMarketListing } from "@/hooks/useLPMarket";
import { useLanguage } from "@/contexts/LanguageContext";
import { PurchaseForm } from "./PurchaseForm";
import { 
  ShoppingCart, 
  Building2,
  Loader2,
  Search,
  Filter,
  TrendingUp,
  Package,
  Clock,
  Wallet
} from "lucide-react";

interface LPMarketplaceViewProps {
  listings: LPMarketListing[];
  loading: boolean;
  lpBalance: number;
  onPurchase: (listingId: string, paymentMethod: string) => Promise<{ success: boolean; error?: string }>;
}

export function LPMarketplaceView({
  listings,
  loading,
  lpBalance,
  onPurchase
}: LPMarketplaceViewProps) {
  const { language } = useLanguage();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<LPMarketListing | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "value-high" | "value-low">("newest");

  // Calculate stats
  const totalListings = listings.length;
  const totalMarketValue = listings.reduce((sum, l) => sum + l.total_value, 0);
  const avgListingValue = totalListings > 0 ? totalMarketValue / totalListings : 0;

  // Filter and sort listings
  const filteredListings = listings
    .filter(listing => 
      listing.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.token_symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "value-high":
          return b.total_value - a.total_value;
        case "value-low":
          return a.total_value - b.total_value;
        case "newest":
        default:
          return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
      }
    });

  const handlePurchase = async (listingId: string, paymentMethod: string) => {
    const result = await onPurchase(listingId, paymentMethod);
    
    if (result.success) {
      setPurchaseDialogOpen(false);
      setSelectedListing(null);
    }
    return result;
  };

  const openPurchaseDialog = (listing: LPMarketListing) => {
    setSelectedListing(listing);
    setPurchaseDialogOpen(true);
  };

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
                  {language === "ar" ? "رصيدك" : "Your Balance"}
                </p>
                <p className="text-xl font-bold">${lpBalance.toLocaleString()}</p>
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
                  {language === "ar" ? "القوائم المتاحة" : "Available Listings"}
                </p>
                <p className="text-xl font-bold">{totalListings}</p>
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
                  {language === "ar" ? "إجمالي قيمة السوق" : "Total Market Value"}
                </p>
                <p className="text-xl font-bold">${totalMarketValue.toLocaleString()}</p>
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
                  {language === "ar" ? "متوسط القيمة" : "Avg. Listing Value"}
                </p>
                <p className="text-xl font-bold">${avgListingValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === "ar" ? "البحث عن عقار أو رمز..." : "Search by property or symbol..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">
                    {language === "ar" ? "الأحدث أولاً" : "Newest First"}
                  </SelectItem>
                  <SelectItem value="value-high">
                    {language === "ar" ? "القيمة الأعلى" : "Highest Value"}
                  </SelectItem>
                  <SelectItem value="value-low">
                    {language === "ar" ? "القيمة الأقل" : "Lowest Value"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {language === "ar" ? "الأصول المعروضة للبيع" : "Assets Listed for Sale"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "تصفح وشراء الأصول المعروضة من المستثمرين"
              : "Browse and purchase assets listed by investors"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-16 bg-muted/30 rounded-lg">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">
                {searchTerm 
                  ? (language === "ar" ? "لا توجد نتائج" : "No Results Found")
                  : (language === "ar" ? "لا توجد أصول متاحة" : "No Assets Available")}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {searchTerm
                  ? (language === "ar" 
                      ? "جرب البحث بكلمات مختلفة"
                      : "Try searching with different keywords")
                  : (language === "ar"
                      ? "لا توجد قوائم نشطة حالياً من المستثمرين. تحقق لاحقاً للحصول على فرص جديدة."
                      : "No active listings from investors at the moment. Check back later for new opportunities.")}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "العقار" : "Property"}</TableHead>
                      <TableHead>{language === "ar" ? "الرمز" : "Symbol"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "الكمية" : "Tokens"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "سعر الوحدة" : "Unit Price"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "القيمة الإجمالية" : "Total Value"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "التاريخ" : "Listed"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "الإجراء" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.map((listing) => (
                      <TableRow key={listing.id} className="group">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {listing.property_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{listing.token_symbol}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{listing.token_amount}</TableCell>
                        <TableCell className="text-right">${listing.unit_price}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          ${listing.total_value.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {new Date(listing.listed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => openPurchaseDialog(listing)}
                            disabled={listing.total_value > lpBalance}
                          >
                            {listing.total_value > lpBalance 
                              ? (language === "ar" ? "رصيد غير كافٍ" : "Insufficient")
                              : (language === "ar" ? "شراء" : "Purchase")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid gap-4">
                {filteredListings.map((listing) => (
                  <Card key={listing.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <h4 className="font-medium">{listing.property_name}</h4>
                              <Badge variant="outline" className="mt-1">{listing.token_symbol}</Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t">
                          <div>
                            <p className="text-muted-foreground text-xs">Tokens</p>
                            <p className="font-medium">{listing.token_amount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Unit Price</p>
                            <p className="font-medium">${listing.unit_price}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Total</p>
                            <p className="font-semibold text-primary">${listing.total_value.toLocaleString()}</p>
                          </div>
                        </div>
                        
                        <Button
                          className="w-full"
                          onClick={() => openPurchaseDialog(listing)}
                          disabled={listing.total_value > lpBalance}
                        >
                          {listing.total_value > lpBalance 
                            ? (language === "ar" ? "رصيد غير كافٍ" : "Insufficient Balance")
                            : (language === "ar" ? "شراء الآن" : "Purchase Now")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Purchase Form Dialog */}
      {selectedListing && (
        <PurchaseForm
          listing={selectedListing}
          lpBalance={lpBalance}
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          onConfirmPurchase={handlePurchase}
        />
      )}
    </div>
  );
}
