import { useEffect, useState } from "react";
import { lpApi, secondaryMarketApi } from "@/integrations/api/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft, Zap, Store, TrendingUp, XCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { format } from "date-fns";

type LPListing = {
  id: string;
  property_name: string;
  token_amount: number;
  total_value: number;
  net_amount: number;
  platform_fee_amount: number;
  status: string;
  listed_at: string;
};
type SecListing = {
  id: string;
  property_name: string;
  token_amount: number;
  total_value: number;
  net_amount: number;
  platform_fee_amount: number;
  status: string;
  listed_at: string;
};

export default function ExitsHub() {
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";
  const [lp, setLp] = useState<LPListing[]>([]);
  const [sec, setSec] = useState<SecListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Both markets now come from Django: the seller's own LP-market listings and
      // their own peer secondary-market listings (Phase 6 Wave 3).
      const [lpMarket, secMarket] = await Promise.all([
        lpApi.market(),
        secondaryMarketApi.market(),
      ]);
      setLp((lpMarket.my_listings as LPListing[]) || []);
      setSec((secMarket.my_listings as SecListing[]) || []);
    } catch {
      setLp([]);
      setSec([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cancelLP = async (id: string) => {
    try {
      await lpApi.cancelListing(id);
      toast.success(isAr ? "تم الإلغاء" : "Cancelled");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel");
    }
  };
  const cancelSec = async (id: string) => {
    try {
      await secondaryMarketApi.cancelListing(id);
      toast.success(isAr ? "تم الإلغاء" : "Cancelled");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel");
    }
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );

  const renderListing = (l: LPListing | SecListing, fee: string, onCancel: () => void) => (
    <div key={l.id} className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="font-semibold">{l.property_name}</h4>
          <p className="text-xs text-muted-foreground font-mono">
            {format(new Date(l.listed_at), "yyyy-MM-dd HH:mm")}
          </p>
        </div>
        <Badge variant={l.status === "listed" ? "default" : "secondary"}>{l.status}</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Stat label={isAr ? "وحدات" : "Units"} value={String(l.token_amount)} />
        <Stat label={isAr ? "القيمة الكلية" : "Total"} value={`$${Number(l.total_value).toLocaleString()}`} />
        <Stat label={`${isAr ? "رسوم" : "Fee"} (${fee})`} value={`$${Number(l.platform_fee_amount).toLocaleString()}`} />
        <Stat label={isAr ? "الصافي" : "Net"} value={`$${Number(l.net_amount).toLocaleString()}`} />
      </div>
      {l.status === "listed" && (
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
          <XCircle className="h-4 w-4" />
          {isAr ? "إلغاء العرض" : "Cancel Listing"}
        </Button>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {isAr ? "مركز الخروج المباشر" : "Live Exits Hub"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAr ? "تتبع وإدارة جميع عروض البيع الخاصة بك في الوقت الفعلي" : "Track and manage all your live sell-orders in real time"}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                {isAr ? "خروج فوري عبر LP" : "Instant LP Exit"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {isAr ? "تنفيذ فوري · رسوم 1% · تحويل خلال دقائق" : "Instant fill · 1% fee · settlement in minutes"}
            </CardContent>
          </Card>
          <Card className="border-accent/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4" />
                {isAr ? "السوق الثانوي بين المستثمرين" : "Peer Secondary Market"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {isAr ? "أعلى عائد محتمل · رسوم 0.5% · بانتظار مشتري" : "Higher net proceeds · 0.5% fee · awaits a buyer"}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lp" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="lp" className="gap-2">
              <Zap className="h-4 w-4" />
              LP ({lp.filter(x => x.status === "listed").length})
            </TabsTrigger>
            <TabsTrigger value="sec" className="gap-2">
              <Store className="h-4 w-4" />
              {isAr ? "ثانوي" : "Secondary"} ({sec.filter(x => x.status === "listed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lp" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{isAr ? "جارٍ التحميل..." : "Loading..."}</p>
            ) : lp.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {isAr ? "لا توجد عروض LP حالياً" : "No LP listings yet"}
              </CardContent></Card>
            ) : lp.map(l => renderListing(l, "1%", () => cancelLP(l.id)))}
          </TabsContent>

          <TabsContent value="sec" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{isAr ? "جارٍ التحميل..." : "Loading..."}</p>
            ) : sec.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {isAr ? "لا توجد عروض ثانوية حالياً" : "No secondary listings yet"}
              </CardContent></Card>
            ) : sec.map(l => renderListing(l, "0.5%", () => cancelSec(l.id)))}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
