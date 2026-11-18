import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Coins, Loader2, Repeat, Store, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResaleForm } from "@/components/lp-market/ResaleForm";
import { LPFeeBenefitsCard } from "@/components/liquidity/LPFeeBenefitsCard";
import { useLPHoldings, type LPHolding } from "@/hooks/useLPHoldings";
import { useLanguage } from "@/contexts/LanguageContext";
import { lpApi, secondaryMarketApi } from "@/integrations/api/client";
import { localName } from "@/lib/propertyLabels";

const money = (n: number) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/**
 * LP assets: the units the liquidity provider bought on the LP market and still holds (held or
 * listed), valued at today's unit price, with the sale started from here — on the secondary
 * market (no seller fee on these units, plus a share of the buyer's fee) or back on the LP market.
 * Data: GET /lp/holdings/ (open LPHolding rows); listing goes through the markets' own APIs.
 */
export default function LPAssets() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const L = (en: string, ar: string) => (isAr ? ar : en);
  const { holdings, loading, isApprovedLP, updateHoldingStatus, refresh } = useLPHoldings();
  const [selling, setSelling] = useState<LPHolding | null>(null);

  const open = holdings.filter((h) => h.status !== "sold");
  const value = open.reduce((s, h) => s + Number(h.current_value || 0), 0);
  const cost = open.reduce((s, h) => s + Number(h.purchase_price || 0), 0);
  const units = open.reduce((s, h) => s + Number(h.token_amount || 0), 0);

  const statusBadge = (h: LPHolding) => {
    if (h.status === "listed_secondary") return <Badge variant="secondary">{L("Listed · secondary market", "معروضة · السوق الثانوي")}</Badge>;
    if (h.status === "listed_lp") return <Badge variant="secondary">{L("Listed · LP market", "معروضة · سوق مزود السيولة")}</Badge>;
    return <Badge>{L("Held", "محتفظ بها")}</Badge>;
  };

  // The same listing calls the LP market page makes, with the units typed in the form.
  const resell = async (holdingId: string, target: "lp" | "secondary", price: number, unitsToSell: number) => {
    const h = holdings.find((x) => x.id === holdingId);
    if (!h) return { success: false, error: "Holding not found" };
    const n = Math.min(h.token_amount, Math.max(1, unitsToSell || h.token_amount));
    try {
      const payload = {
        property_id: h.property_id,
        property_name: h.property_name,
        token_symbol: h.token_symbol,
        token_amount: n,
        unit_price: Math.round((price / n) * 100) / 100,
      };
      if (target === "lp") await lpApi.listAsset(payload);
      else await secondaryMarketApi.listAsset(payload);
      await updateHoldingStatus(holdingId, target === "lp" ? "listed_lp" : "listed_secondary", new Date().toISOString());
      toast.success(target === "lp" ? L("Listed on the LP market", "عُرضت في سوق مزود السيولة") : L("Listed on the secondary market", "عُرضت في السوق الثانوي"));
      refresh();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : L("Could not list the units", "تعذّر عرض الحصص");
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">{L("LP Assets", "أصول مزود السيولة")}</h1>
          <p className="text-muted-foreground mt-1">
            {L(
              "The units you bought on the LP market and still hold. Start a sale from here.",
              "الحصص التي اشتريتها من سوق مزود السيولة وما زلت تملكها. ابدأ البيع من هنا.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Building2, label: L("Holdings", "الحيازات"), value: String(open.length) },
            { icon: Coins, label: L("Units", "الوحدات"), value: units.toLocaleString("en-US") },
            { icon: Wallet, label: L("Bought for", "تكلفة الشراء"), value: money(cost) },
            { icon: TrendingUp, label: L("Value today", "القيمة اليوم"), value: money(value) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <s.icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold" dir="ltr">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !isApprovedLP ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {L("This page is for approved liquidity providers.", "هذه الصفحة لمزودي السيولة المعتمدين.")}
            </CardContent>
          </Card>
        ) : open.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <Store className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-medium">{L("You don't hold any LP-market units yet.", "لا تملك حصصًا من سوق مزود السيولة بعد.")}</p>
              <Button variant="gold" asChild>
                <Link to="/lp-market">{L("Open the LP market", "افتح سوق مزود السيولة")}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {open.map((h) => {
              const gain = Number(h.current_value) - Number(h.purchase_price);
              return (
                <Card key={h.id}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{localName(h, language)}</h3>
                        <p className="text-xs text-muted-foreground">{h.token_symbol}</p>
                      </div>
                      {statusBadge(h)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">{L("Units", "الوحدات")}</p>
                        <p className="font-semibold">{Number(h.token_amount).toLocaleString("en-US")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{L("Bought for", "تكلفة الشراء")}</p>
                        <p className="font-semibold" dir="ltr">{money(h.purchase_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{L("Value today", "القيمة اليوم")}</p>
                        <p className="font-semibold" dir="ltr">{money(h.current_value)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{L("Price change", "فرق السعر")}</p>
                        <p className={`font-semibold ${gain >= 0 ? "text-success" : "text-destructive"}`} dir="ltr">
                          {gain >= 0 ? "+" : "−"}{money(Math.abs(gain))}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="gold" className="w-full gap-2"
                      disabled={h.status !== "held"}
                      onClick={() => setSelling(h)}
                    >
                      <Repeat className="w-4 h-4" />
                      {h.status === "held" ? L("Sell these units", "بيع هذه الحصص") : L("Already listed", "معروضة بالفعل")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <LPFeeBenefitsCard />
      </div>

      {selling && (
        <ResaleForm
          holding={selling}
          open={!!selling}
          onOpenChange={(o) => !o && setSelling(null)}
          onConfirmResale={resell}
        />
      )}
    </MainLayout>
  );
}
