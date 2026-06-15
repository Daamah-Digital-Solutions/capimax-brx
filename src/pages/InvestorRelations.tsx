import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, TrendingUp, Globe2, Download, Mail, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

export default function InvestorRelations() {
  const { isRTL } = useLanguage();
  const isAr = isRTL;

  const kpis = [
    { l: isAr ? "إجمالي الأصول المرمّزة" : "Total Tokenized AUM", v: "$847M" },
    { l: isAr ? "المستثمرون النشطون" : "Active Investors", v: "12,400+" },
    { l: isAr ? "البلدان المخدومة" : "Countries Served", v: "47" },
    { l: isAr ? "متوسط العائد السنوي" : "Avg. Annual Yield", v: "11.8%" },
  ];

  const press = [
    {
      date: "2026-04-12",
      titleEn: "Capimax BRX surpasses $800M in tokenized real estate AUM",
      titleAr: "Capimax BRX تتجاوز 800 مليون دولار من الأصول العقارية المرمّزة",
    },
    {
      date: "2026-02-28",
      titleEn: "New SPV framework approved under Regulation D & S",
      titleAr: "إطار SPV جديد معتمد بموجب اللوائح D و S",
    },
    {
      date: "2025-12-09",
      titleEn: "Capimax BRX launches institutional-grade Liquidity Provider program",
      titleAr: "Capimax BRX تطلق برنامج مزودي السيولة من الدرجة المؤسسية",
    },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-10" dir={isAr ? "rtl" : "ltr"}>
        <div className="space-y-3 max-w-3xl">
          <Badge variant="outline" className="gap-1">
            <Newspaper className="h-3 w-3" />
            {isAr ? "علاقات المستثمرين والصحافة" : "Investor Relations & Press"}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            {isAr ? "بناء البنية التحتية لعقارات الجيل القادم" : "Building the infrastructure for next-generation real estate"}
          </h1>
          <p className="text-muted-foreground md:text-lg">
            {isAr
              ? "نوفر بيانات شفافة، وتقارير منتظمة، ومواد صحفية للمحللين والصحفيين والشركاء الاستراتيجيين."
              : "Transparent data, regular reporting, and press materials for analysts, journalists, and strategic partners."}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.l}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">{k.l}</p>
                <p className="text-2xl md:text-3xl font-bold">{k.v}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                {isAr ? "أحدث الأخبار" : "Latest Press"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {press.map((p) => (
                <div key={p.date} className="p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                  <p className="text-xs text-muted-foreground font-mono mb-1">{p.date}</p>
                  <p className="font-medium">{isAr ? p.titleAr : p.titleEn}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Download className="h-4 w-4" />
                  {isAr ? "حزمة الصحافة" : "Press Kit"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link to="/white-paper">{isAr ? "الورقة البيضاء" : "White Paper"}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link to="/public-reports">{isAr ? "التقارير العامة" : "Public Reports"}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link to="/public-analytics">{isAr ? "التحليلات العامة" : "Public Analytics"}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" />
                  {isAr ? "تواصل" : "Contact"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>ir@capimax.exchange</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  <span>press@capimax.exchange</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>partners@capimax.exchange</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
