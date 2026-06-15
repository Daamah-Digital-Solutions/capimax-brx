import { useState } from "react";
import {
  Building2,
  Search,
  Plus,
  History,
  Coins,
  CheckCircle2,
  X,
  DollarSign,
  AlertCircle,
  Loader2,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useOwnershipTokens } from "@/hooks/useOwnershipTokens";
import { useSecondaryMarket } from "@/hooks/useSecondaryMarket";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Phase 6 Wave 3: this page was a 100% MOCK order book (inline bids/asks/trades, no
// backend). It is now a REAL investor↔investor peer market of one-shot "buy-now"
// listings wired to /api/secondary-market/ — browse + buy-now, list-my-tokens
// (escrow-locked server-side), my-listings (cancel), real trade history, plus the
// proceeds balance + withdrawal. The bid/ask ORDER BOOK + buy/sell order-entry panel
// were REMOVED (they were mock with no backend); the order book returns in a later,
// separately-scoped wave. (SECONDARY_MARKET_SURFACE.md; DECISIONS.md "Phase 6 Wave 3".)

export default function SecondaryMarket() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const { wallet } = useUserWallet();
  const { tokens } = useOwnershipTokens(wallet?.id || null);
  const {
    listings, myListings, trades, balance, loading,
    listAsset, cancelListing, buyListing, withdraw,
  } = useSecondaryMarket();

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [showSell, setShowSell] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Sell-modal state
  const [selectedToken, setSelectedToken] = useState<typeof tokens[0] | null>(null);
  const [sellUnits, setSellUnits] = useState(1);
  const [sellPrice, setSellPrice] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  // Withdraw-modal state
  const [wdAmount, setWdAmount] = useState("");
  const [wdMethod, setWdMethod] = useState<"bank" | "crypto">("bank");
  const [wdSubmitting, setWdSubmitting] = useState(false);

  const requireLogin = () => {
    toast({
      title: isAr ? "تسجيل الدخول مطلوب" : "Login Required",
      description: isAr ? "يرجى تسجيل الدخول" : "Please log in to continue",
      variant: "destructive",
    });
  };

  const openSell = () => {
    if (!user) return requireLogin();
    setSelectedToken(null);
    setSellUnits(1);
    setSellPrice(100);
    setShowSell(true);
  };

  const handleBuy = async (listingId: string) => {
    if (!user) return requireLogin();
    setBuyingId(listingId);
    await buyListing(listingId);
    setBuyingId(null);
  };

  const submitSell = async () => {
    if (!selectedToken) return;
    setSubmitting(true);
    const res = await listAsset({
      property_id: selectedToken.property_id,
      property_name: selectedToken.property_name,
      token_symbol: selectedToken.token_symbol,
      token_amount: sellUnits,
      unit_price: sellPrice,
    });
    setSubmitting(false);
    if (res.success) setShowSell(false);
  };

  const submitWithdraw = async () => {
    const amt = parseFloat(wdAmount);
    if (!amt || amt <= 0) return;
    setWdSubmitting(true);
    const res = await withdraw(amt, wdMethod);
    setWdSubmitting(false);
    if (res.success) {
      setShowWithdraw(false);
      setWdAmount("");
    }
  };

  const fee = (sellUnits * sellPrice) * 0.005; // 0.5% (display; server is source of truth)
  const youReceive = (sellUnits * sellPrice) - fee;

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <Badge variant="gold" className="mb-2">{t("secondaryMarket.title")}</Badge>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {t("secondaryMarket.title")}
                </h1>
                <p className="text-muted-foreground">{t("secondaryMarket.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-4 py-2 rounded-xl bg-muted text-right">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    {isAr ? "رصيد العائدات" : "Proceeds Balance"}
                  </div>
                  <div className="font-bold text-foreground" dir="ltr">
                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => setShowWithdraw(true)} disabled={balance <= 0}>
                  <ArrowDownToLine className="w-4 h-4" />
                  {isAr ? "سحب" : "Withdraw"}
                </Button>
                <Button variant="hero" className="gap-2" onClick={openSell}>
                  <Plus className="w-4 h-4" />
                  {t("secondaryMarket.sellMyUnits")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Real stats */}
        <div className="border-b border-border bg-card/30">
          <div className="container py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: isAr ? "قوائم متاحة" : "Available Listings", value: String(listings.length) },
                { label: isAr ? "قوائمي النشطة" : "My Active Listings", value: String(myListings.filter(l => l.status === "listed").length) },
                { label: isAr ? "صفقاتي" : "My Trades", value: String(trades.length) },
              ].map((s, i) => (
                <div key={i} className="text-center p-3 bg-background/50 rounded-lg">
                  <div className="text-lg font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container py-8">
          <Tabs defaultValue="browse" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="browse" className="rounded-lg gap-2">
                <Coins className="w-4 h-4" />
                {t("secondaryMarket.browseListings")}
              </TabsTrigger>
              <TabsTrigger value="my-listings" className="rounded-lg gap-2">
                <Building2 className="w-4 h-4" />
                {t("secondaryMarket.myListings")}
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg gap-2">
                <History className="w-4 h-4" />
                {t("secondaryMarket.history")}
              </TabsTrigger>
            </TabsList>

            {/* Browse — real listed inventory with Buy Now */}
            <TabsContent value="browse" className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : listings.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Coins className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  {isAr ? "لا توجد قوائم متاحة حالياً" : "No listings available right now"}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {listings.map((l) => (
                    <div key={l.id} className="p-5 bg-card rounded-xl border border-border hover:border-primary/50 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{l.property_name}</h3>
                            <span className="text-xs text-muted-foreground font-mono">{l.token_symbol}</span>
                          </div>
                        </div>
                        <Badge variant="success">{isAr ? "متاح" : "Available"}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="text-center p-2 bg-muted rounded-lg">
                          <div className="text-lg font-bold text-foreground">{l.token_amount}</div>
                          <div className="text-xs text-muted-foreground">{t("secondaryMarket.units")}</div>
                        </div>
                        <div className="text-center p-2 bg-muted rounded-lg">
                          <div className="text-lg font-bold text-gradient-gold" dir="ltr">${l.unit_price}</div>
                          <div className="text-xs text-muted-foreground">{t("secondaryMarket.pricePerUnit")}</div>
                        </div>
                        <div className="text-center p-2 bg-muted rounded-lg">
                          <div className="text-lg font-bold text-foreground" dir="ltr">${l.total_value.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{t("secondaryMarket.total")}</div>
                        </div>
                      </div>
                      <Button
                        variant="hero" className="w-full gap-2"
                        disabled={buyingId === l.id}
                        onClick={() => handleBuy(l.id)}
                      >
                        {buyingId === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
                        {t("secondaryMarket.buyNow")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* My listings — cancel */}
            <TabsContent value="my-listings">
              <div className="bg-card rounded-2xl border border-border p-6">
                {myListings.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">{t("secondaryMarket.myListings")}</h3>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myListings.map((l) => (
                      <div key={l.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{l.property_name}</h4>
                            <p className="text-sm text-muted-foreground" dir="ltr">
                              {l.token_amount} {t("secondaryMarket.units")} • ${l.unit_price}/{t("secondaryMarket.units")} • net ${l.net_amount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={l.status === "listed" ? "success" : "secondary"}>{l.status}</Badge>
                          {l.status === "listed" && (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => cancelListing(l.id)}>
                              <X className="w-4 h-4" />
                              {isAr ? "إلغاء" : "Cancel"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* History — real completed trades */}
            <TabsContent value="history">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {trades.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    {isAr ? "لا يوجد سجل تداول بعد" : "No trade history yet"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-start px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("secondaryMarket.property")}</th>
                          <th className="text-start px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("secondaryMarket.units")}</th>
                          <th className="text-start px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("secondaryMarket.total")}</th>
                          <th className="text-start px-6 py-4 text-xs font-medium text-muted-foreground uppercase">{t("distributions.status")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {trades.map((tr) => {
                          const sold = tr.seller_id === user?.id;
                          return (
                            <tr key={tr.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <Badge variant={sold ? "destructive" : "success"}>
                                    {sold ? t("secondaryMarket.sell") : t("secondaryMarket.buy")}
                                  </Badge>
                                  <span className="font-medium text-foreground">{tr.property_name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-foreground">{tr.token_amount}</td>
                              <td className="px-6 py-4 text-sm font-semibold text-foreground" dir="ltr">${tr.total_value.toLocaleString()}</td>
                              <td className="px-6 py-4">
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {t("wallet.completed")}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Sell My Units — list real tokens */}
      <Dialog open={showSell} onOpenChange={setShowSell}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              {isAr ? "بيع وحداتي" : "Sell My Units"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "اختر العقار وحدد السعر لإدراج وحداتك للبيع الفوري في السوق الثانوي"
                : "Pick a property and set your price to list your units for buy-now sale"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {!selectedToken ? (
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  {isAr ? "اختر العقار للبيع" : "Select Property to Sell"}
                </label>
                {tokens.filter((tk) => Number(tk.token_amount) > 0).length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {isAr ? "لا توجد وحدات للبيع" : "No units available to sell"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tokens.filter((tk) => Number(tk.token_amount) > 0).map((tk) => (
                      <button
                        key={tk.id}
                        onClick={() => { setSelectedToken(tk); setSellUnits(1); setSellPrice(100); }}
                        className="w-full p-4 bg-muted rounded-xl border border-transparent hover:border-primary/50 transition-all text-start flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{tk.property_name}</div>
                            <div className="text-sm text-muted-foreground" dir="ltr">
                              {tk.token_amount} {isAr ? "وحدة" : "units"} · {tk.token_symbol}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">{selectedToken.property_name}</div>
                    <div className="text-sm text-muted-foreground" dir="ltr">
                      {selectedToken.token_amount} {isAr ? "وحدة متاحة" : "units available"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedToken(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {isAr ? "عدد الوحدات للبيع" : "Units to Sell"}
                  </label>
                  <input
                    type="number" min={1} max={Number(selectedToken.token_amount)}
                    value={sellUnits}
                    onChange={(e) => setSellUnits(Math.min(Number(selectedToken.token_amount), Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full h-10 bg-muted rounded-lg text-center font-semibold outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {isAr ? "السعر لكل وحدة ($)" : "Price per Unit ($)"}
                  </label>
                  <input
                    type="number" min={0} value={sellPrice}
                    onChange={(e) => setSellPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 bg-muted rounded-lg px-3 font-semibold outline-none focus:ring-2 focus:ring-primary"
                    dir="ltr"
                  />
                </div>

                <div className="p-4 bg-muted rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isAr ? "الإجمالي" : "Total"}</span>
                    <span className="font-semibold" dir="ltr">${(sellUnits * sellPrice).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{isAr ? "رسوم المنصة (0.5%)" : "Platform Fee (0.5%)"}</span>
                    <span className="text-destructive" dir="ltr">-${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-medium">{isAr ? "ستستلم" : "You Receive"}</span>
                    <span className="font-bold text-success" dir="ltr">${youReceive.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  variant="hero" className="w-full gap-2"
                  onClick={submitSell}
                  disabled={submitting || sellUnits < 1 || sellPrice <= 0}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isAr ? "إدراج للبيع" : "Create Listing"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw proceeds */}
      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-primary" />
              {isAr ? "سحب العائدات" : "Withdraw Proceeds"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "اسحب رصيد عائداتك من مبيعات السوق الثانوي"
                : "Cash out your accumulated secondary-market sale proceeds"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-lg flex justify-between text-sm">
              <span className="text-muted-foreground">{isAr ? "الرصيد المتاح" : "Available"}</span>
              <span className="font-semibold" dir="ltr">${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">{isAr ? "المبلغ" : "Amount"}</label>
              <input
                type="number" min={0} max={balance} value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 bg-muted rounded-lg px-3 text-xl font-bold outline-none focus:ring-2 focus:ring-primary"
                dir="ltr"
              />
            </div>
            <div className="flex gap-2">
              {(["bank", "crypto"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setWdMethod(m)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    wdMethod === m ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                  )}
                >
                  {m === "bank" ? (isAr ? "تحويل بنكي" : "Bank") : (isAr ? "عملات رقمية" : "Crypto")}
                </button>
              ))}
            </div>
            {parseFloat(wdAmount) > balance && (
              <p className="text-destructive text-sm">{isAr ? "المبلغ أكبر من الرصيد" : "Amount exceeds balance"}</p>
            )}
            <Button
              variant="hero" className="w-full gap-2"
              onClick={submitWithdraw}
              disabled={wdSubmitting || !wdAmount || parseFloat(wdAmount) <= 0 || parseFloat(wdAmount) > balance}
            >
              {wdSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              {isAr ? "طلب السحب" : "Request Withdrawal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
