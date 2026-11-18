import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, Coins, Users, Wallet, ArrowRight, ExternalLink, Plus, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ownerApi, type OwnerAsset } from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";

export const usd = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const num = (n: number) => Number(n || 0).toLocaleString("en-US");

/**
 * My Assets — the owner's own properties with their real figures (units sold, investors,
 * money raised, distributions paid), each opening its own detail page. Data: GET /owner/assets/.
 */
export default function OwnerAssets() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const L = (en: string, ar: string) => (isAr ? ar : en);
  const { data, isLoading, isError } = useQuery({ queryKey: ["owner-assets"], queryFn: ownerApi.assets });
  const assets = data ?? [];

  const totals = assets.reduce(
    (t, a) => ({
      units: t.units + a.units_sold,
      raised: t.raised + a.raised,
      investors: t.investors + a.investors,
      paid: t.paid + a.distributions_paid,
    }),
    { units: 0, raised: 0, investors: 0, paid: 0 },
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{L("My Assets", "أصولي")}</h1>
            <p className="text-muted-foreground mt-1">
              {L("Your properties on the platform and how each one is doing.", "عقاراتك على المنصة وأداء كل عقار منها.")}
            </p>
          </div>
          <Button variant="gold" asChild>
            <Link to="/submit-property">
              <Plus className="w-4 h-4 me-2" />
              {L("Submit a property", "أضف عقارًا")}
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Building2, label: L("Properties", "العقارات"), value: num(assets.length) },
            { icon: Coins, label: L("Units sold", "الوحدات المباعة"), value: num(totals.units) },
            { icon: Wallet, label: L("Amount raised", "المبلغ المجمَّع"), value: usd(totals.raised) },
            { icon: Users, label: L("Distributions paid", "التوزيعات المدفوعة"), value: usd(totals.paid) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <s.icon className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {L("Your assets could not be loaded. Please try again.", "تعذّر تحميل أصولك. حاول مرة أخرى.")}
            </CardContent>
          </Card>
        ) : assets.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="font-medium">{L("You don't have any properties on the platform yet.", "ليس لديك عقارات على المنصة بعد.")}</p>
              <p className="text-sm text-muted-foreground">
                {L("Once a property you submit is approved, it appears here.", "بعد اعتماد العقار الذي تقدّمه يظهر هنا.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {assets.map((a) => (
              <Card key={a.slug} className="overflow-hidden flex flex-col">
                {a.image ? (
                  <img src={a.image} alt={isAr ? a.name_ar || a.name : a.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 bg-muted flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <CardContent className="p-5 flex-1 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{isAr ? a.name_ar || a.name : a.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{isAr ? a.location_ar || a.location : a.location}</p>
                    </div>
                    <Badge variant={a.is_published ? "default" : "secondary"}>
                      {a.is_published ? L("Listed", "معروض") : L("Not listed", "غير معروض")}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{L("Units sold", "الوحدات المباعة")}</span>
                      <span dir="ltr">
                        {num(a.units_sold)} / {num(a.token_supply)} ({a.funded_pct}%)
                      </span>
                    </div>
                    <Progress value={Math.min(100, a.funded_pct)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{L("Unit price", "سعر الوحدة")}</p>
                      <p className="font-semibold">{usd(a.token_price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{L("Investors", "المستثمرون")}</p>
                      <p className="font-semibold">{num(a.investors)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{L("Amount raised", "المبلغ المجمَّع")}</p>
                      <p className="font-semibold">{usd(a.raised)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{L("Distributions paid", "التوزيعات المدفوعة")}</p>
                      <p className="font-semibold">{usd(a.distributions_paid)}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button variant="gold" size="sm" className="flex-1" asChild>
                      <Link to={`/owner-assets/${a.slug}`}>
                        {L("View details", "عرض التفاصيل")}
                        <ArrowRight className="w-4 h-4 ms-1 rtl:rotate-180" />
                      </Link>
                    </Button>
                    {a.is_published && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/property/${a.slug}`} aria-label={L("Public page", "الصفحة العامة")}>
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
