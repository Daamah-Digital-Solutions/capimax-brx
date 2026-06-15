import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  MapPin,
  TrendingUp,
  DollarSign,
  Coins,
  Calendar,
  Layers,
  Clock,
  KeyRound,
  Users2,
  ShieldCheck,
  CreditCard,
  Wallet,
  Building,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type ModelSlug =
  | "ready-yield"
  | "installment"
  | "phasing"
  | "future"
  | "option"
  | "shared"
  | "portfolios-ready"
  | "portfolios-under-construction";

interface Props {
  model: ModelSlug;
}

// ---------- Sample data per model ----------
const SAMPLES: Record<ModelSlug, {
  nameEn: string; nameAr: string;
  locationEn: string; locationAr: string;
  image: string;
  roi: string;
  totalValue: string;
  funded: number;
  minTokens: number;
  badge?: { en: string; ar: string };
}> = {
  "ready-yield": {
    nameEn: "Marina Heights Residences", nameAr: "أبراج مارينا هايتس",
    locationEn: "Dubai Marina, UAE", locationAr: "مرسى دبي، الإمارات",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    roi: "9.2%", totalValue: "$4,800,000", funded: 72, minTokens: 1,
    badge: { en: "Income Producing", ar: "تشغيلي مدر للدخل" },
  },
  "installment": {
    nameEn: "Palm Towers — Installment Plan", nameAr: "أبراج النخلة — بالتقسيط",
    locationEn: "Riyadh, Saudi Arabia", locationAr: "الرياض، السعودية",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    roi: "11.5%", totalValue: "$6,200,000", funded: 41, minTokens: 1,
    badge: { en: "Flexible Installments", ar: "أقساط مرنة" },
  },
  "phasing": {
    nameEn: "Aurora Skyline Phase II", nameAr: "أورورا سكاي لاين — المرحلة الثانية",
    locationEn: "Istanbul, Turkey", locationAr: "إسطنبول، تركيا",
    image: "https://images.unsplash.com/photo-1518883734063-83fbef9f1c92?w=1200&q=80",
    roi: "14.0%", totalValue: "$9,400,000", funded: 28, minTokens: 1,
    badge: { en: "Phase Pricing Active", ar: "تسعير مرحلي نشط" },
  },
  "future": {
    nameEn: "Horizon Bay — Future Allocation", nameAr: "هورايزون باي — تخصيص آجل",
    locationEn: "Lisbon, Portugal", locationAr: "لشبونة، البرتغال",
    image: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80",
    roi: "12.8%", totalValue: "$5,100,000", funded: 18, minTokens: 1,
    badge: { en: "Future Settlement", ar: "تسوية مستقبلية" },
  },
  "option": {
    nameEn: "Riviera Lofts — Option Reserve", nameAr: "ريفييرا لوفتس — احتياطي بالخيار",
    locationEn: "Nice, France", locationAr: "نيس، فرنسا",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80",
    roi: "13.5%", totalValue: "$3,700,000", funded: 22, minTokens: 1,
    badge: { en: "Option Available", ar: "خيار متاح" },
  },
  "shared": {
    nameEn: "Cedar Plaza — Shared with Owner", nameAr: "سيدر بلازا — مشتركة مع المالك",
    locationEn: "Beirut, Lebanon", locationAr: "بيروت، لبنان",
    image: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80",
    roi: "10.4%", totalValue: "$2,900,000", funded: 55, minTokens: 1,
    badge: { en: "Co-Ownership", ar: "ملكية مشتركة" },
  },
  "portfolios-ready": {
    nameEn: "Gulf Income Portfolio I", nameAr: "محفظة دخل الخليج الأولى",
    locationEn: "GCC Multi-City", locationAr: "متعدد المدن — دول الخليج",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80",
    roi: "9.8%", totalValue: "$18,500,000", funded: 64, minTokens: 1,
    badge: { en: "Diversified Yield", ar: "عائد متنوع" },
  },
  "portfolios-under-construction": {
    nameEn: "MENA Growth Portfolio", nameAr: "محفظة نمو الشرق الأوسط",
    locationEn: "MENA Multi-Project", locationAr: "متعدد المشاريع — منطقة مينا",
    image: "https://images.unsplash.com/photo-1577415124269-fc1140a69e91?w=1200&q=80",
    roi: "13.2%", totalValue: "$22,000,000", funded: 35, minTokens: 1,
    badge: { en: "Development Basket", ar: "سلة تطوير" },
  },
};

// ---------- Model-specific section ----------
function ModelSection({ model }: { model: ModelSlug }) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (model === "installment") {
    const schedule = [
      { label: isAr ? "الدفعة الأولى" : "Down payment", pct: 20, status: "paid" },
      { label: isAr ? "القسط 1" : "Installment 1", pct: 20, status: "paid" },
      { label: isAr ? "القسط 2" : "Installment 2", pct: 20, status: "due" },
      { label: isAr ? "القسط 3" : "Installment 3", pct: 20, status: "upcoming" },
      { label: isAr ? "القسط النهائي" : "Final installment", pct: 20, status: "upcoming" },
    ];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {isAr ? "جدول الأقساط" : "Installment Schedule"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {schedule.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm font-medium">{s.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{s.pct}%</span>
                <Badge
                  variant={s.status === "paid" ? "default" : s.status === "due" ? "destructive" : "outline"}
                >
                  {s.status === "paid" ? (isAr ? "مدفوع" : "Paid") : s.status === "due" ? (isAr ? "مستحق" : "Due") : (isAr ? "قادم" : "Upcoming")}
                </Badge>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span>{isAr ? "اكتمال البناء" : "Construction completion"}</span>
              <span className="font-semibold">42%</span>
            </div>
            <Progress value={42} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (model === "phasing") {
    const phases = [
      { name: isAr ? "المرحلة 1" : "Phase 1", price: "$100", status: "completed" },
      { name: isAr ? "المرحلة 2 (الحالية)" : "Phase 2 (current)", price: "$118", status: "current" },
      { name: isAr ? "المرحلة 3" : "Phase 3", price: "$135", status: "upcoming" },
      { name: isAr ? "التسليم" : "Delivery", price: "$160", status: "upcoming" },
    ];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            {isAr ? "مراحل تسعير التوكن" : "Token Pricing Phases"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {phases.map((p, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border-2 ${
                  p.status === "current"
                    ? "border-primary bg-primary/5"
                    : p.status === "completed"
                    ? "border-muted bg-muted/30 opacity-70"
                    : "border-dashed border-muted-foreground/30"
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1">{p.name}</p>
                <p className="text-xl font-bold text-foreground">{p.price}</p>
                {p.status === "current" && (
                  <Badge className="mt-2" variant="default">{isAr ? "الآن" : "Now"}</Badge>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {isAr
              ? "الأسعار مدعومة بتقارير تقييم مستقلة وتُحدّث عند إنجاز كل محطة."
              : "Prices backed by independent valuation reports, updated as each milestone completes."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (model === "future") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {isAr ? "الجدول الزمني للتفعيل والتسوية" : "Activation & Settlement Timeline"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { date: "2026-06-01", event: isAr ? "إغلاق الاكتتاب" : "Subscription closes" },
            { date: "2027-01-15", event: isAr ? "تنفيذ العقد" : "Contract execution" },
            { date: "2027-04-30", event: isAr ? "تفعيل الملكية" : "Ownership activation" },
            { date: "2027-05-15", event: isAr ? "بدء التوزيعات" : "Distributions begin" },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/40">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm font-mono text-muted-foreground">{t.date}</span>
              <span className="text-sm font-medium flex-1">{t.event}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (model === "option") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {isAr ? "شروط الخيار" : "Option Terms"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: isAr ? "علاوة الخيار" : "Option premium", value: "$5 / unit" },
              { label: isAr ? "سعر التنفيذ" : "Strike price", value: "$100" },
              { label: isAr ? "صلاحية الخيار" : "Option validity", value: isAr ? "9 أشهر" : "9 months" },
              { label: isAr ? "تاريخ الانتهاء" : "Expiry date", value: "2027-02-28" },
              { label: isAr ? "تقييم مستقبلي متوقع" : "Expected future value", value: "$140 / unit" },
              { label: isAr ? "العائد المحتمل" : "Potential return", value: "+40%" },
            ].map((it, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">{it.label}</p>
                <p className="text-base font-bold text-foreground mt-1">{it.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (model === "shared") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-primary" />
            {isAr ? "هيكل الملكية المشتركة" : "Co-Ownership Structure"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>{isAr ? "المالك الأصلي" : "Original Owner"}</span>
                <span className="font-bold">55%</span>
              </div>
              <Progress value={55} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>{isAr ? "حاملو التوكن" : "Token Holders"}</span>
                <span className="font-bold">45%</span>
              </div>
              <Progress value={45} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {isAr
              ? "تُوزّع الإيرادات شهرياً بحسب نسبة الملكية، مع حقوق نقل وخروج محددة في وثائق الـ SPV."
              : "Revenue is distributed monthly pro-rata, with transfer and exit rights defined in the SPV documents."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (model === "portfolios-ready" || model === "portfolios-under-construction") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            {isAr ? "أصول المحفظة" : "Portfolio Holdings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: isAr ? "برج المرسى" : "Marina Tower", w: 28 },
            { name: isAr ? "بلازا الواحة" : "Oasis Plaza", w: 22 },
            { name: isAr ? "ريزيدنس النخيل" : "Palm Residence", w: 20 },
            { name: isAr ? "سيتي مول" : "City Mall", w: 18 },
            { name: isAr ? "أصول أخرى" : "Other assets", w: 12 },
          ].map((h, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span>{h.name}</span>
                <span className="font-semibold">{h.w}%</span>
              </div>
              <Progress value={h.w} />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // ready-yield
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {isAr ? "تفاصيل الدخل التشغيلي" : "Operational Yield Breakdown"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {[
          { label: isAr ? "الإيجار الشهري" : "Monthly rent", value: "$36,800" },
          { label: isAr ? "نسبة الإشغال" : "Occupancy rate", value: "94%" },
          { label: isAr ? "تكاليف التشغيل" : "Operating costs", value: "18%" },
          { label: isAr ? "صافي العائد السنوي" : "Net annual yield", value: "9.2%" },
        ].map((it, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/40">
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <p className="text-base font-bold text-foreground mt-1">{it.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------- Main template ----------
export function PropertyModelTemplate({ model }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const sample = SAMPLES[model];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="aspect-[16/7] bg-muted overflow-hidden relative">
          <img
            src={sample.image}
            alt={isAr ? sample.nameAr : sample.nameEn}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {sample.badge && (
            <Badge className="absolute top-4 left-4 rtl:right-4 rtl:left-auto" variant="default">
              {isAr ? sample.badge.ar : sample.badge.en}
            </Badge>
          )}
        </div>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {isAr ? sample.nameAr : sample.nameEn}
              </h2>
              <p className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                {isAr ? sample.locationAr : sample.locationEn}
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {isAr ? "عيّنة توضيحية" : "Sample Preview"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: TrendingUp, label: isAr ? "العائد المتوقع" : "Expected ROI", value: sample.roi },
              { icon: DollarSign, label: isAr ? "قيمة الأصل" : "Asset value", value: sample.totalValue },
              { icon: Coins, label: isAr ? "سعر التوكن" : "Token price", value: "$100" },
              { icon: Building, label: isAr ? "الحد الأدنى" : "Min ownership", value: `${sample.minTokens} ${isAr ? "توكن" : "token"}` },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/40 text-center">
                <s.icon className="w-4 h-4 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{isAr ? "نسبة التمويل" : "Funded"}</span>
              <span className="font-semibold">{sample.funded}%</span>
            </div>
            <Progress value={sample.funded} />
          </div>
        </CardContent>
      </Card>

      {/* Model-specific block */}
      <ModelSection model={model} />

      {/* Insurance + Documents notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {isAr ? "التأمين والمستندات" : "Insurance & Documents"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>{isAr ? "العقار مؤمَّن لدى شركة تأمين معتمدة." : "Property is insured with a licensed insurance provider."}</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>{isAr ? "أموال المستثمرين محمية ومؤمَّنة." : "Investor funds are protected and insured."}</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <span>
              {isAr
                ? "تُحفظ جميع المستندات والاتفاقيات بأمان لدى مجموعة CIM المالية."
                : "All documents and agreements are securely stored with CIM Financial Group."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment methods (BELOW property details, per spec) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {isAr ? "طرق الدفع" : "Payment Methods"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: CreditCard, label: isAr ? "بطاقة فيزا" : "Visa Card" },
              { icon: Wallet, label: isAr ? "محفظة المنصة" : "Platform Wallet" },
              { icon: Coins, label: isAr ? "عملات رقمية" : "Crypto" },
              { icon: Building, label: isAr ? "تحويل بنكي" : "Bank Transfer" },
            ].map((p, i) => (
              <div key={i} className="p-4 rounded-lg border border-border text-center hover:border-primary transition-colors">
                <p.icon className="w-5 h-5 mx-auto text-primary mb-2" />
                <p className="text-xs font-medium">{p.label}</p>
              </div>
            ))}
          </div>
          <Button className="w-full mt-4" size="lg">
            {isAr ? "تملّك الآن" : "Own Now"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
