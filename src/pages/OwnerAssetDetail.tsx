import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, ExternalLink, Loader2, FileText } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ownerApi } from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { num, usd } from "./OwnerAssets";

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

/**
 * One of the owner's properties in detail: figures, unit-price history, paid distributions,
 * investors (masked) and data-room documents. Data: GET /owner/assets/<slug>/ (owner-scoped).
 */
export default function OwnerAssetDetail() {
  const { slug = "" } = useParams();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const L = (en: string, ar: string) => (isAr ? ar : en);
  const { data: a, isLoading, isError } = useQuery({
    queryKey: ["owner-asset", slug],
    queryFn: () => ownerApi.asset(slug),
    enabled: !!slug,
  });

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/owner-assets">
        <ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />
        {L("My Assets", "أصولي")}
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }
  if (isError || !a) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 space-y-4">
          {back}
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {L("This asset was not found in your account.", "هذا الأصل غير موجود في حسابك.")}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const name = isAr ? a.name_ar || a.name : a.name;
  const stats = [
    { label: L("Unit price", "سعر الوحدة"), value: usd(a.token_price) },
    { label: L("Property value", "قيمة العقار"), value: usd(a.total_value) },
    { label: L("Units sold", "الوحدات المباعة"), value: `${num(a.units_sold)} / ${num(a.token_supply)}` },
    { label: L("Units available", "الوحدات المتاحة"), value: num(a.units_available) },
    { label: L("Investors", "المستثمرون"), value: num(a.investors) },
    { label: L("Amount raised", "المبلغ المجمَّع"), value: usd(a.raised) },
    { label: L("Distributions paid", "التوزيعات المدفوعة"), value: usd(a.distributions_paid) },
    { label: L("Last distribution", "آخر توزيع"), value: day(a.last_distribution_date) },
  ];
  const empty = (en: string, ar: string) => <p className="text-sm text-muted-foreground py-4 text-center">{L(en, ar)}</p>;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {back}
        <Card className="overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {a.image ? (
              <img src={a.image} alt={name} className="md:w-72 h-48 md:h-auto object-cover" />
            ) : (
              <div className="md:w-72 h-48 bg-muted flex items-center justify-center">
                <Building2 className="w-10 h-10 text-muted-foreground" />
              </div>
            )}
            <CardContent className="p-6 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{name}</h1>
                <Badge variant={a.is_published ? "default" : "secondary"}>
                  {a.is_published ? L("Listed", "معروض") : L("Not listed", "غير معروض")}
                </Badge>
              </div>
              <p className="text-muted-foreground">{isAr ? a.location_ar || a.location : a.location}</p>
              <div className="space-y-1 max-w-md">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{L("Funded", "نسبة التمويل")}</span>
                  <span>{a.funded_pct}%</span>
                </div>
                <Progress value={Math.min(100, a.funded_pct)} />
              </div>
              {a.is_published && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/property/${a.slug}`}>
                    <ExternalLink className="w-4 h-4 me-2" />
                    {L("Open the public page", "فتح الصفحة العامة")}
                  </Link>
                </Button>
              )}
            </CardContent>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold"><span dir="ltr">{s.value}</span></p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{L("Unit price history", "سجل سعر الوحدة")}</CardTitle>
            </CardHeader>
            <CardContent>
              {a.prices.length === 0
                ? empty("No price change recorded yet.", "لم يُسجَّل أي تغيير في السعر بعد.")
                : (
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground text-xs">
                      <tr><th className="text-start py-2">{L("Date", "التاريخ")}</th><th className="text-start">{L("From", "من")}</th><th className="text-start">{L("To", "إلى")}</th></tr>
                    </thead>
                    <tbody>
                      {a.prices.map((p, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-2">{day(p.date)}</td><td>{usd(p.previous_price)}</td><td className="font-semibold">{usd(p.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{L("Distributions paid", "التوزيعات المدفوعة")}</CardTitle>
            </CardHeader>
            <CardContent>
              {a.distributions.length === 0
                ? empty("No distribution paid yet.", "لم يُدفع أي توزيع بعد.")
                : (
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground text-xs">
                      <tr><th className="text-start py-2">{L("Pay date", "تاريخ الدفع")}</th><th className="text-start">{L("Period", "الفترة")}</th><th className="text-start">{L("Amount", "المبلغ")}</th></tr>
                    </thead>
                    <tbody>
                      {a.distributions.map((d, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-2">{day(d.pay_date)}</td><td>{d.period || "—"}</td><td className="font-semibold">{usd(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{L("Investors", "المستثمرون")}</CardTitle>
            </CardHeader>
            <CardContent>
              {a.investors_list.length === 0
                ? empty("No investor yet.", "لا يوجد مستثمرون بعد.")
                : (
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground text-xs">
                      <tr><th className="text-start py-2">{L("Investor", "المستثمر")}</th><th className="text-start">{L("Units", "الوحدات")}</th><th className="text-start">{L("Value", "القيمة")}</th></tr>
                    </thead>
                    <tbody>
                      {a.investors_list.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-2" dir="ltr">{r.investor}</td><td>{num(r.units)}</td><td>{usd(r.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              <p className="text-xs text-muted-foreground mt-3">
                {L("Investor emails are masked to protect their privacy.", "تُخفى عناوين بريد المستثمرين حفاظًا على خصوصيتهم.")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{L("Documents", "المستندات")}</CardTitle>
            </CardHeader>
            <CardContent>
              {a.documents.length === 0
                ? empty("No document in the data room yet.", "لا توجد مستندات في غرفة البيانات بعد.")
                : (
                  <ul className="space-y-2">
                    {a.documents.map((d, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span>{isAr ? d.title_ar || d.title : d.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
