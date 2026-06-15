import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, Webhook, Shield, Zap, Database, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DeveloperHub() {
  const { isRTL } = useLanguage();
  const isAr = isRTL;

  const endpoints = [
    { method: "GET", path: "/v1/properties", desc: isAr ? "قائمة الأصول العقارية المتاحة" : "List available real estate assets" },
    { method: "GET", path: "/v1/properties/:id", desc: isAr ? "تفاصيل أصل واحد بما في ذلك العائد والحالة" : "Single asset detail incl. yield and status" },
    { method: "POST", path: "/v1/orders", desc: isAr ? "إنشاء طلب شراء وحدات" : "Create a unit purchase order" },
    { method: "GET", path: "/v1/portfolio", desc: isAr ? "مراكز المستثمر الحالية والتوزيعات" : "Investor positions and distributions" },
    { method: "POST", path: "/v1/exits/lp", desc: isAr ? "خروج فوري عبر LP (رسوم 1%)" : "Instant LP exit (1% fee)" },
    { method: "POST", path: "/v1/exits/secondary", desc: isAr ? "إدراج في السوق الثانوي (رسوم 0.5%)" : "List on secondary market (0.5% fee)" },
    { method: "GET", path: "/v1/audit-log", desc: isAr ? "سجل التدقيق غير القابل للتعديل" : "Immutable audit log" },
    { method: "POST", path: "/v1/webhooks", desc: isAr ? "اشترك في الأحداث (الاكتتاب، التوزيع، الخروج)" : "Subscribe to events (subscription, distribution, exit)" },
  ];

  const features = [
    { icon: Shield, t: isAr ? "أمان مؤسسي" : "Institutional security", d: isAr ? "OAuth2 + توقيع HMAC للويب هوكس + تدقيق كامل" : "OAuth2 + HMAC webhook signing + full audit trail" },
    { icon: Zap, t: isAr ? "وقت استجابة منخفض" : "Low latency", d: isAr ? "p95 < 120ms عبر CDN عالمي" : "p95 < 120ms via global edge" },
    { icon: Database, t: isAr ? "جاهز للبلوكتشين" : "Blockchain-ready", d: isAr ? "هويات أصول EVM متوافقة مع ERC-3643" : "EVM asset IDs compatible with ERC-3643" },
    { icon: Webhook, t: isAr ? "ويب هوكس فورية" : "Real-time webhooks", d: isAr ? "أحداث محاولات إعادة قابلة للتكوين" : "Configurable retry attempts" },
  ];

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-8 space-y-8" dir={isAr ? "rtl" : "ltr"}>
        <div className="space-y-3">
          <Badge variant="outline" className="gap-1">
            <Code2 className="h-3 w-3" />
            {isAr ? "للمطورين والشركاء" : "Developers & Partners"}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            {isAr ? "مركز المطورين والـ API" : "Developer & API Hub"}
          </h1>
          <p className="text-muted-foreground md:text-lg max-w-3xl">
            {isAr
              ? "ادمج بورصة Capimax BRX مباشرة في أنظمة الخزينة والتحليلات الخاصة بك. واجهة برمجية REST آمنة وجاهزة للبلوكتشين."
              : "Integrate the Capimax BRX exchange directly into your treasury, analytics, and trading systems. Secure REST surface, blockchain-ready."}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <Card key={f.t}>
              <CardContent className="p-5 space-y-2">
                <div className="p-2 rounded-lg bg-primary/10 w-fit"><f.icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold">{f.t}</h3>
                <p className="text-sm text-muted-foreground">{f.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {isAr ? "نقاط النهاية الأساسية" : "Core Endpoints"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {endpoints.map((e) => (
              <div key={e.path} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-lg border bg-card font-mono text-sm">
                <Badge
                  variant={e.method === "GET" ? "secondary" : "default"}
                  className="w-16 justify-center shrink-0"
                >
                  {e.method}
                </Badge>
                <code className="text-primary shrink-0">{e.path}</code>
                <span className="text-muted-foreground text-xs md:text-sm md:ms-auto font-sans">
                  {e.desc}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold">{isAr ? "مثال طلب" : "Example request"}</h3>
            <pre className="text-xs md:text-sm bg-background p-4 rounded-lg overflow-x-auto border">
{`curl https://api.capimax.exchange/v1/properties \\
  -H "Authorization: Bearer $CAPIMAX_API_KEY" \\
  -H "Content-Type: application/json"`}
            </pre>
            <p className="text-xs text-muted-foreground">
              {isAr ? "API في الإصدار التجريبي للشركاء المعتمدين فقط. تواصل مع المبيعات للحصول على مفتاح." : "API in private beta for approved partners. Contact sales for an access key."}
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
