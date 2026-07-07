import { useState } from "react";
import {
  Building2,
  Award,
  Star,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  FileText,
  Download,
  Eye,
  ShieldCheck,
  Lock,
  Coins,
  Layers,
  Scale,
  Banknote,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Camera,
  Video,
  HardHat,
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Globe,
  Hammer,
  Image as ImageIcon,
  Map,
  Sparkles,
  Users2,
  Wallet,
  ChevronDown,
  ChevronRight,
  Percent,
  CircleDollarSign,
  Shield,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Property } from "@/data/properties";
import { DynamicInstallmentPlanner } from "@/components/property/DynamicInstallmentPlanner";
import type { InstallmentPreview } from "@/integrations/api/client";
import type { InstallmentTerms } from "@/hooks/useInstallmentPreview";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function SectionHeader({
  icon: Icon,
  en,
  ar,
  hint,
  hintAr,
  isAr,
}: {
  icon: React.ElementType;
  en: string;
  ar: string;
  hint?: string;
  hintAr?: string;
  isAr: boolean;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
          {isAr ? ar : en}
        </h2>
        {(hint || hintAr) && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAr ? hintAr : hint}
          </p>
        )}
      </div>
    </div>
  );
}

function KV({
  label,
  labelAr,
  value,
  isAr,
}: {
  label: string;
  labelAr: string;
  value: React.ReactNode;
  isAr: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{isAr ? labelAr : label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Property specifications & amenities
// ─────────────────────────────────────────────────────────────
function SpecsSection({ p, isAr }: { p: Property; isAr: boolean }) {
  const specs = [
    { en: "Asset Class", ar: "فئة الأصل", v: p.assetType },
    { en: "Property Type", ar: "نوع العقار", v: p.assetType },
    { en: "Country", ar: "الدولة", v: p.country.toUpperCase() },
    { en: "City", ar: "المدينة", v: p.city },
    { en: "Status", ar: "الحالة", v: p.status === "ready" ? (isAr ? "جاهز" : "Ready") : (isAr ? "قيد الإنشاء" : "Under Construction") },
    { en: "Yield Type", ar: "نوع العائد", v: p.yieldType },
    { en: "Risk Level", ar: "مستوى المخاطر", v: p.riskLevel },
    { en: "Investment Duration", ar: "مدة الاستثمار", v: isAr ? p.durationAr : p.duration },
    { en: "Total Value", ar: "القيمة الإجمالية", v: fmtMoney(p.totalValue) },
    { en: "Token Price", ar: "سعر الرمز", v: `$${p.tokenPrice}` },
    { en: "Min. Investment", ar: "الحد الأدنى", v: `$${p.minInvestment}` },
    { en: "Funded", ar: "نسبة التمويل", v: `${p.funded}%` },
    { en: "Investors", ar: "المستثمرون", v: p.investors },
    { en: "Exit Availability", ar: "توفر التخارج", v: p.exitAvailability },
  ];

  const amenities = [
    { en: "24/7 Security", ar: "أمن 24/7" },
    { en: "Smart Building Systems", ar: "أنظمة المبنى الذكية" },
    { en: "Underground Parking", ar: "موقف سيارات تحت الأرض" },
    { en: "Fitness Center", ar: "مركز لياقة" },
    { en: "Concierge Service", ar: "خدمة الكونسيرج" },
    { en: "Premium Finishes", ar: "تشطيبات فاخرة" },
    { en: "Sustainability Certified", ar: "معتمد للاستدامة" },
    { en: "EV Charging", ar: "شحن السيارات الكهربائية" },
  ];

  const landmarks = [
    { en: "International Airport — 18 min", ar: "المطار الدولي — 18 دقيقة" },
    { en: "Central Business District — 6 min", ar: "وسط الأعمال — 6 دقائق" },
    { en: "Premium Shopping Mall — 4 min", ar: "مركز تسوق فاخر — 4 دقائق" },
    { en: "Healthcare Center — 5 min", ar: "مركز صحي — 5 دقائق" },
    { en: "International Schools — 8 min", ar: "مدارس دولية — 8 دقائق" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="w-5 h-5 text-primary" />
          {isAr ? "مواصفات وتفاصيل العقار" : "Property Specifications & Details"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-x-8">
          {specs.map((s) => (
            <KV key={s.en} label={s.en} labelAr={s.ar} value={s.v as React.ReactNode} isAr={isAr} />
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {isAr ? "المرافق والخدمات" : "Amenities"}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((a) => (
                <div key={a.en} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {isAr ? a.ar : a.en}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              {isAr ? "أماكن قريبة" : "Nearby Landmarks"}
            </h4>
            <ul className="space-y-2">
              {landmarks.map((l) => (
                <li key={l.en} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0" />
                  {isAr ? l.ar : l.en}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Media gallery placeholders */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="aspect-video rounded-lg bg-muted/40 border border-border flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="w-6 h-6 mb-1" />
            <span className="text-xs">{isAr ? "معرض صور" : "Gallery"}</span>
          </div>
          <div className="aspect-video rounded-lg bg-muted/40 border border-border flex flex-col items-center justify-center text-muted-foreground">
            <Video className="w-6 h-6 mb-1" />
            <span className="text-xs">{isAr ? "فيديو" : "Video Tour"}</span>
          </div>
          <div className="aspect-video rounded-lg bg-muted/40 border border-border flex flex-col items-center justify-center text-muted-foreground">
            <Map className="w-6 h-6 mb-1" />
            <span className="text-xs">{isAr ? "خريطة" : "Interactive Map"}</span>
          </div>
          <div className="aspect-video rounded-lg bg-muted/40 border border-border flex flex-col items-center justify-center text-muted-foreground">
            <Layers className="w-6 h-6 mb-1" />
            <span className="text-xs">{isAr ? "مخطط الطوابق" : "Floor Plans"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Developer information
// ─────────────────────────────────────────────────────────────
function DeveloperSection({ p, isAr }: { p: Property; isAr: boolean }) {
  const developer = {
    name: "Capimax Real Estate Partners",
    nameAr: "كابيماكس لشراكات العقار",
    overview:
      "An institutional-grade developer with a 22-year track record across the GCC. Specialised in income-producing commercial, residential, and hospitality assets.",
    overviewAr:
      "مطور بمستوى مؤسسي ولديه سجل أداء 22 سنة عبر دول الخليج. متخصص في الأصول التشغيلية التجارية والسكنية والضيافة المدرّة للدخل.",
    years: 22,
    completed: 47,
    ongoing: 12,
    rating: 4.8,
    location: "Dubai International Financial Centre",
    locationAr: "مركز دبي المالي العالمي",
    email: "investors@capimax-developer.com",
    phone: "+971 4 000 0000",
    related: [
      { en: "Marina Bay Tower", ar: "برج مارينا باي" },
      { en: "Riyadh Logistics Hub", ar: "محور الرياض اللوجستي" },
      { en: "Doha Bayfront", ar: "دوحة بايفرونت" },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Hammer className="w-5 h-5 text-primary" />
          {isAr ? "معلومات المطور" : "Developer Information"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">
              {isAr ? developer.nameAr : developer.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {isAr ? developer.overviewAr : developer.overview}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Calendar, label: isAr ? "سنوات الخبرة" : "Experience", v: `${developer.years} yrs` },
            { icon: Award, label: isAr ? "مشاريع منجزة" : "Completed", v: developer.completed },
            { icon: HardHat, label: isAr ? "قيد التنفيذ" : "Ongoing", v: developer.ongoing },
            { icon: Star, label: isAr ? "تقييم السوق" : "Rating", v: `${developer.rating} / 5` },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-lg bg-muted/40 border border-border">
              <m.icon className="w-4 h-4 text-primary mb-2" />
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-bold text-foreground">{m.v}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
            <h4 className="text-sm font-semibold">{isAr ? "بيانات الاتصال" : "Contact"}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> {isAr ? developer.locationAr : developer.location}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> {developer.email}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> {developer.phone}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/40 border border-border">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              {isAr ? "مشاريع ذات صلة" : "Related Projects"}
            </h4>
            <ul className="space-y-1.5">
              {developer.related.map((r) => (
                <li key={r.en} className="text-xs text-muted-foreground flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-primary" />
                  {isAr ? r.ar : r.en}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Tokenization & legal structure
// ─────────────────────────────────────────────────────────────
function TokenizationSection({ p, isAr }: { p: Property; isAr: boolean }) {
  const totalSupply = Math.round(p.totalValue / p.tokenPrice);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="w-5 h-5 text-primary" />
          {isAr ? "هيكل الترميز والقانون" : "Tokenization & Legal Structure"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {isAr ? "بيانات الرمز" : "Token Details"}
            </h4>
            <KV label="Network" labelAr="الشبكة" value="Ethereum (ERC-1155)" isAr={isAr} />
            <KV label="Contract" labelAr="العقد الذكي" value={
              <span className="font-mono text-xs">0x7a23…f3a4 <ExternalLink className="w-3 h-3 inline ml-1" /></span>
            } isAr={isAr} />
            <KV label="Total Supply" labelAr="إجمالي الإصدار" value={totalSupply.toLocaleString()} isAr={isAr} />
            <KV label="Token Price" labelAr="سعر الرمز" value={`$${p.tokenPrice}`} isAr={isAr} />
            <KV label="Standard" labelAr="المعيار" value="ERC-1155 fractional" isAr={isAr} />
            <KV label="Verified" labelAr="موثَّق" value={<Badge variant="outline" className="border-emerald-500/40 text-emerald-600">{isAr ? "نعم" : "Yes"}</Badge>} isAr={isAr} />
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              {isAr ? "هيكل SPV" : "SPV Structure"}
            </h4>
            <KV label="SPV Name" labelAr="اسم الشركة" value="Capimax Asset SPV Ltd" isAr={isAr} />
            <KV label="Jurisdiction" labelAr="الولاية القضائية" value="DIFC, UAE" isAr={isAr} />
            <KV label="Reg. Number" labelAr="رقم التسجيل" value="SPV-2026-AX1294" isAr={isAr} />
            <KV label="Established" labelAr="تأسست" value="2026-01-15" isAr={isAr} />
            <KV label="Compliance" labelAr="الامتثال" value="Reg D 506(c) / Reg S" isAr={isAr} />
            <KV label="Custody" labelAr="الحفظ" value={isAr ? "حافظ مرخّص" : "Licensed Custodian"} isAr={isAr} />
          </div>
        </div>

        {/* Token economics chips */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">{isAr ? "تخصيص للمستثمرين" : "Investor Allocation"}</p>
            <p className="text-base font-bold">85%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">{isAr ? "احتياطي SPV" : "SPV Reserve"}</p>
            <p className="text-base font-bold">10%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">{isAr ? "حوافز المنصة" : "Platform Incentives"}</p>
            <p className="text-base font-bold">3%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">{isAr ? "السيولة" : "Liquidity"}</p>
            <p className="text-base font-bold">2%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Financial information
// ─────────────────────────────────────────────────────────────
function FinancialSection({ p, isAr }: { p: Property; isAr: boolean }) {
  const yieldPct = p.expectedYield ?? 0;
  const growthPct = p.expectedGrowth ?? 0;
  const grossIncome = Math.round(p.totalValue * (yieldPct / 100));
  const opex = Math.round(grossIncome * 0.18);
  const noi = grossIncome - opex;
  const capRate = p.totalValue > 0 ? (noi / p.totalValue) * 100 : 0;

  const projection = [
    { y: "Year 1", v: yieldPct },
    { y: "Year 2", v: +(yieldPct * 1.04).toFixed(1) },
    { y: "Year 3", v: +(yieldPct * 1.08).toFixed(1) },
    { y: "Year 4", v: +(yieldPct * 1.12).toFixed(1) },
    { y: "Year 5", v: +(yieldPct * 1.15).toFixed(1) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="w-5 h-5 text-primary" />
          {isAr ? "المعلومات المالية والعائد" : "Financial Information & ROI"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <Banknote className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">{isAr ? "الدخل الإجمالي" : "Gross Income"}</p>
            <p className="text-lg font-bold">{fmtMoney(grossIncome)}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/40 border border-border">
            <TrendingDown className="w-4 h-4 text-warning mb-2" />
            <p className="text-xs text-muted-foreground">{isAr ? "المصاريف التشغيلية" : "OpEx"}</p>
            <p className="text-lg font-bold">{fmtMoney(opex)}</p>
          </div>
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <CircleDollarSign className="w-4 h-4 text-emerald-600 mb-2" />
            <p className="text-xs text-muted-foreground">NOI</p>
            <p className="text-lg font-bold">{fmtMoney(noi)}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/40 border border-border">
            <Percent className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Cap Rate</p>
            <p className="text-lg font-bold">{capRate.toFixed(2)}%</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-primary" />
            {isAr ? "توقعات العائد لخمس سنوات" : "5-Year Yield Projection"}
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {projection.map((row) => (
              <div key={row.y} className="text-center">
                <div className="h-24 flex items-end justify-center mb-2">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary/40 rounded-t-md"
                    style={{ height: `${Math.min(100, row.v * 8)}%` }}
                  />
                </div>
                <p className="text-xs font-semibold">{row.v}%</p>
                <p className="text-[10px] text-muted-foreground">{row.y}</p>
              </div>
            ))}
          </div>
        </div>

        {growthPct > 0 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold">{isAr ? "نمو رأس المال المتوقع" : "Expected Capital Appreciation"}</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">+{growthPct}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isAr ? "خلال أفق المشروع، استناداً إلى تقارير التقييم المستقلة." : "Over the project horizon, based on independent valuation reports."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Documents & Data Room
// ─────────────────────────────────────────────────────────────
function DataRoomSection({ p, isAr }: { p: Property; isAr: boolean }) {
  const groups = [
    {
      key: "ownership",
      icon: ShieldCheck,
      en: "Ownership Documents",
      ar: "وثائق الملكية",
      items: [
        { en: "Title Deed", ar: "سند الملكية" },
        { en: "Ownership Certificate", ar: "شهادة الملكية" },
        { en: "Land Registration", ar: "تسجيل الأرض" },
        { en: "Government Registration", ar: "التسجيل الحكومي" },
      ],
    },
    {
      key: "tokenization",
      icon: Coins,
      en: "Tokenization Documents",
      ar: "وثائق الترميز",
      items: [
        { en: "Tokenization Structure", ar: "هيكل الترميز" },
        { en: "Smart Contract Audit", ar: "تدقيق العقد الذكي" },
        { en: "Token Allocation", ar: "تخصيص الرموز" },
        { en: "Token Economics", ar: "اقتصاديات الرمز" },
      ],
    },
    {
      key: "spv",
      icon: Scale,
      en: "SPV Documents",
      ar: "وثائق الشركة ذات الغرض الخاص",
      items: [
        { en: "SPV Formation", ar: "تأسيس SPV" },
        { en: "SPV Ownership Structure", ar: "هيكل ملكية SPV" },
        { en: "Operating Agreement", ar: "اتفاقية التشغيل" },
        { en: "Subscription Agreement", ar: "اتفاقية الاكتتاب" },
      ],
    },
    {
      key: "financial",
      icon: BarChart3,
      en: "Financial & Investment",
      ar: "مالية واستثمارية",
      items: [
        { en: "Financial Statements", ar: "البيانات المالية" },
        { en: "ROI Report", ar: "تقرير العائد" },
        { en: "Yield Analysis", ar: "تحليل العائد" },
        { en: "Valuation Report", ar: "تقرير التقييم" },
        { en: "Cash Flow Report", ar: "تقرير التدفقات النقدية" },
        { en: "Investment Projections", ar: "توقعات الاستثمار" },
      ],
    },
    {
      key: "legal",
      icon: FileText,
      en: "Legal Documents",
      ar: "وثائق قانونية",
      items: [
        { en: "Investment Agreement", ar: "اتفاقية الاستثمار" },
        { en: "Ownership Agreement", ar: "اتفاقية الملكية" },
        { en: "Exit Agreement", ar: "اتفاقية التخارج" },
        { en: "Compliance Certificate", ar: "شهادة الامتثال" },
        { en: "Risk Disclosure", ar: "إفصاح المخاطر" },
      ],
    },
    {
      key: "insurance",
      icon: Shield,
      en: "Insurance Documents",
      ar: "وثائق التأمين",
      items: [
        { en: "Insurance Certificate", ar: "شهادة التأمين" },
        { en: "Coverage Schedule", ar: "جدول التغطية" },
        { en: "Provider Information", ar: "بيانات شركة التأمين" },
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5 text-primary" />
          {isAr ? "غرفة البيانات والوثائق" : "Documents & Data Room"}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {isAr
            ? "جميع الوثائق محفوظة بأمان ومتاحة للتحقق."
            : "All documents are securely stored and verifiable."}
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={["ownership", "tokenization"]} className="w-full">
          {groups.map((g) => (
            <AccordionItem key={g.key} value={g.key}>
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2 text-sm">
                  <g.icon className="w-4 h-4 text-primary" />
                  {isAr ? g.ar : g.en}
                  <Badge variant="outline" className="text-[10px] ml-2">{g.items.length}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-2">
                  {g.items.map((item) => (
                    <div
                      key={item.en}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{isAr ? item.ar : item.en}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "تحقق من أصالة الوثائق عبر التوقيع الرقمي."
                : "Verify document authenticity via digital signature."}
            </p>
          </div>
          <Button size="sm" variant="outline">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            {isAr ? "تحقق" : "Verify"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Construction progress (under-construction only)
// ─────────────────────────────────────────────────────────────
function ConstructionSection({ p, isAr }: { p: Property; isAr: boolean }) {
  if (p.status !== "construction") return null;
  const progress = p.constructionProgress ?? 0;
  const milestones = [
    { en: "Site Preparation", ar: "تجهيز الموقع", done: progress >= 10 },
    { en: "Foundations", ar: "الأساسات", done: progress >= 25 },
    { en: "Structural Build", ar: "البناء الإنشائي", done: progress >= 50 },
    { en: "MEP & Façade", ar: "الواجهة والأنظمة", done: progress >= 75 },
    { en: "Finishing & Handover", ar: "التشطيب والتسليم", done: progress >= 95 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HardHat className="w-5 h-5 text-primary" />
          {isAr ? "تقدم البناء" : "Construction Progress"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{isAr ? "نسبة الإنجاز" : "Completion"}</span>
            <span className="text-sm font-bold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {milestones.map((m, i) => (
            <div key={m.en} className="text-center">
              <div
                className={`w-9 h-9 rounded-full mx-auto flex items-center justify-center text-xs font-bold mb-1 ${
                  m.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {m.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">{isAr ? m.ar : m.en}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-xs">{isAr ? "صور الموقع" : "Site Photos"}</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <span className="text-xs">{isAr ? "فيديو من الدرون" : "Drone Footage"}</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="text-xs">{isAr ? "تقارير الفحص" : "Inspection Reports"}</span>
          </div>
        </div>

        {p.developerReports && p.developerReports.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">{isAr ? "تحديثات المطور" : "Developer Updates"}</h4>
            <div className="space-y-2">
              {p.developerReports.map((r) => (
                <div key={r.date} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <p className="text-sm font-medium">{isAr ? r.titleAr : r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                  <Badge variant="outline">{r.progress}%</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Installment payment schedule
// ─────────────────────────────────────────────────────────────
function InstallmentScheduleSection({
  p,
  isAr,
  preview,
}: {
  p: Property;
  isAr: boolean;
  preview?: InstallmentPreview | null;
}) {
  const inst = p.installment;
  // Prefer the investor's LIVE plan (engine preview, real per-investor rows); fall back to the
  // property's advertised EXAMPLE schedule (clearly labelled) until terms are chosen. Render
  // nothing if neither is available.
  const usingPreview = !!preview;
  if (!usingPreview && (p.model !== "installment" || !inst)) return null;

  const money = (n: number) =>
    new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(
      Math.round(n),
    );

  // Unified rows from whichever source is active.
  const rows = usingPreview
    ? preview!.rows.map((r) => ({
        num: r.sequence,
        paid: false,
        ownership: r.ownershipPercent.toFixed(1),
        amount: r.amount,
        remaining: r.balance,
        date: r.dueDate,
      }))
    : Array.from({ length: inst!.totalInstallments }).map((_, i) => {
        const num = i + 1;
        const paid = num <= inst!.paidInstallments;
        const ownership = ((num / inst!.totalInstallments) * 100).toFixed(1);
        const remaining = (inst!.totalInstallments - num) * inst!.monthlyAmount;
        const due = new Date(inst!.nextPaymentDate);
        due.setMonth(due.getMonth() + (num - inst!.paidInstallments - 1));
        return {
          num,
          paid,
          ownership,
          amount: inst!.monthlyAmount,
          remaining,
          date: due.toISOString().split("T")[0],
        };
      });

  // Unified summary tiles.
  const summary = usingPreview
    ? {
        headlineAmount: preview!.installmentAmount,
        freqLabel:
          preview!.frequency === "quarterly"
            ? isAr ? "ربع سنوي" : "Quarterly"
            : isAr ? "شهري" : "Monthly",
        paidInstallments: 0,
        totalInstallments: preview!.numberOfInstallments,
        nextPaymentDate: preview!.rows[0]?.dueDate ?? "—",
        activationDate: inst?.activationDate ?? "—",
      }
    : {
        headlineAmount: inst!.monthlyAmount,
        freqLabel: isAr ? "شهري" : "Monthly",
        paidInstallments: inst!.paidInstallments,
        totalInstallments: inst!.totalInstallments,
        nextPaymentDate: inst!.nextPaymentDate,
        activationDate: inst!.activationDate,
      };

  const handleDownload = (format: "csv" | "print") => {
    const headers = isAr
      ? ["#", "تاريخ الاستحقاق", "الحالة", "المبلغ (USD)", "الملكية %", "المتبقي (USD)"]
      : ["#", "Due Date", "Status", "Amount (USD)", "Ownership %", "Remaining (USD)"];
    const dataRows = rows.map((r) => {
      const statusStr = r.paid ? (isAr ? "مدفوع" : "Paid") : (isAr ? "قادم" : "Upcoming");
      return [r.num, r.date, statusStr, Math.round(r.amount), `${r.ownership}%`, Math.round(r.remaining)];
    });

    if (format === "csv") {
      const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...dataRows].map((row) => row.map(escape).join(",")).join("\n");
      // BOM for Excel UTF-8 (Arabic)
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `installment-schedule-${p.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const title = isAr ? `جدول الأقساط — ${p.nameAr}` : `Installment Schedule — ${p.name}`;
      const html = `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${title}</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;color:#555;font-weight:400;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:${isAr ? "right" : "left"}}th{background:#f3f4f6}
        .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.summary div{border:1px solid #eee;padding:8px;border-radius:6px}
        .summary p{margin:0;font-size:11px;color:#666}.summary strong{font-size:14px}</style></head><body>
        <h1>${title}</h1><h2>${isAr ? p.locationAr : p.location}</h2>
        <div class="summary">
          <div><p>${summary.freqLabel}</p><strong>$${money(summary.headlineAmount)}</strong></div>
          <div><p>${isAr ? "مدفوعة" : "Paid"}</p><strong>${summary.paidInstallments}/${summary.totalInstallments}</strong></div>
          <div><p>${isAr ? "الدفعة القادمة" : "Next Due"}</p><strong>${summary.nextPaymentDate}</strong></div>
          <div><p>${isAr ? "تاريخ التفعيل" : "Activation"}</p><strong>${summary.activationDate}</strong></div>
        </div>
        <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${dataRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <script>window.onload=()=>{window.print();}</script></body></html>`;
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5 text-primary" />
          {isAr ? "جدول الأقساط" : "Installment Schedule"}
          <Badge variant="outline" className="text-[10px]">
            {usingPreview ? (isAr ? "خطتك" : "Your plan") : isAr ? "مثال" : "Example"}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleDownload("csv")}>
            <Download className="w-3.5 h-3.5 mr-1" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload("print")}>
            <FileText className="w-3.5 h-3.5 mr-1" />
            {isAr ? "PDF / طباعة" : "PDF / Print"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">{summary.freqLabel}</p>
            <p className="text-lg font-bold">${money(summary.headlineAmount)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">{isAr ? "مدفوعة" : "Paid"}</p>
            <p className="text-lg font-bold">{summary.paidInstallments}/{summary.totalInstallments}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">{isAr ? "الدفعة القادمة" : "Next Due"}</p>
            <p className="text-sm font-bold">{summary.nextPaymentDate}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground">{isAr ? "تاريخ التفعيل" : "Activation"}</p>
            <p className="text-sm font-bold">{summary.activationDate}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-xs">{isAr ? "المبلغ" : "Amount"}</TableHead>
                <TableHead className="text-xs">{isAr ? "الملكية" : "Ownership %"}</TableHead>
                <TableHead className="text-xs">{isAr ? "المتبقي" : "Remaining"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 8).map((r) => (
                <TableRow key={r.num}>
                  <TableCell className="text-xs font-mono">{r.num}</TableCell>
                  <TableCell>
                    {r.paid ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">
                        {isAr ? "مدفوع" : "Paid"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{isAr ? "قادم" : "Upcoming"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">${money(r.amount)}</TableCell>
                  <TableCell className="text-xs">{r.ownership}%</TableCell>
                  <TableCell className="text-xs">${money(r.remaining)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > 8 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            {isAr ? `+ ${rows.length - 8} أقساط إضافية` : `+ ${rows.length - 8} more installments`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 8. Market analysis
// ─────────────────────────────────────────────────────────────
function MarketAnalysisSection({ p, isAr }: { p: Property; isAr: boolean }) {
  const cityHistory = [
    { y: "2021", v: 100 },
    { y: "2022", v: 108 },
    { y: "2023", v: 117 },
    { y: "2024", v: 126 },
    { y: "2025", v: 138 },
    { y: "2026", v: 149 },
  ];
  const max = Math.max(...cityHistory.map((c) => c.v));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="w-5 h-5 text-primary" />
          {isAr ? "تحليل السوق" : "Market Analysis"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { en: "Market Cap Rate", ar: "معدل العاصمة", v: "7.8%" },
            { en: "City Growth", ar: "نمو المدينة", v: "+9.2%" },
            { en: "Vacancy Rate", ar: "معدل الشواغر", v: "4.1%" },
            { en: "Rent Index", ar: "مؤشر الإيجار", v: "112" },
          ].map((m) => (
            <div key={m.en} className="p-3 rounded-lg bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground">{isAr ? m.ar : m.en}</p>
              <p className="text-lg font-bold">{m.v}</p>
            </div>
          ))}
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3">
            {isAr ? "تطور أسعار السوق (مؤشر = 100)" : "Market Price Index (base = 100)"}
          </h4>
          <div className="grid grid-cols-6 gap-2 items-end h-32">
            {cityHistory.map((c) => (
              <div key={c.y} className="flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-gradient-to-t from-primary/80 to-primary/30 rounded-t-md"
                  style={{ height: `${(c.v / max) * 90}%` }}
                />
                <p className="text-[10px] mt-1">{c.y}</p>
                <p className="text-[10px] text-muted-foreground">{c.v}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 9. Insurance & Risk
// ─────────────────────────────────────────────────────────────
function InsuranceRiskSection({ p, isAr }: { p: Property; isAr: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 text-primary" />
          {isAr ? "التأمين والمخاطر" : "Insurance & Risk Disclosure"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <p className="font-semibold text-sm">{isAr ? "تغطية التأمين" : "Insurance Coverage"}</p>
          </div>
          <KV label="Provider" labelAr="مزود التأمين" value="AXA Gulf" isAr={isAr} />
          <KV label="Policy" labelAr="رقم البوليصة" value="POL-2026-AX-94821" isAr={isAr} />
          <KV label="Coverage" labelAr="قيمة التغطية" value={fmtMoney(p.totalValue)} isAr={isAr} />
          <KV label="Status" labelAr="الحالة" value={
            <Badge className={p.insuranceActive ? "bg-emerald-500 text-white" : ""} variant={p.insuranceActive ? "default" : "outline"}>
              {p.insuranceActive ? (isAr ? "نشطة" : "Active") : (isAr ? "غير مفعلة" : "Inactive")}
            </Badge>
          } isAr={isAr} />
        </div>

        <div className="p-4 rounded-lg bg-warning/5 border border-warning/20 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <p className="font-semibold text-sm">{isAr ? "إفصاحات المخاطر" : "Risk Disclosures"}</p>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• {isAr ? "الاستثمار العقاري ينطوي على مخاطر تشمل خسارة رأس المال." : "Real estate investing carries risk including loss of capital."}</li>
            <li>• {isAr ? "الأداء السابق لا يضمن النتائج المستقبلية." : "Past performance does not guarantee future returns."}</li>
            <li>• {isAr ? "السيولة قد تكون محدودة قبل مرحلة التشغيل." : "Liquidity may be limited prior to operational phase."}</li>
            <li>• {isAr ? "العوائد عرضة لتقلبات السوق والإشغال." : "Returns are subject to market and occupancy fluctuations."}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// 10. FAQ
// ─────────────────────────────────────────────────────────────
function FaqSection({ isAr }: { isAr: boolean }) {
  const faqs = [
    {
      q: "How is ownership recorded?",
      qAr: "كيف يتم تسجيل الملكية؟",
      a: "Each token is recorded on-chain (ERC-1155) and is backed 1:1 by a beneficial interest in the asset-owning SPV. Records are reconciled daily.",
      aAr: "كل رمز مسجل على البلوكشين (ERC-1155) ومدعوم 1:1 بحق انتفاع في الشركة المالكة للأصل. تتم المطابقة يومياً.",
    },
    {
      q: "When are distributions paid?",
      qAr: "متى تُدفع التوزيعات؟",
      a: "Distributions follow the offering schedule, typically quarterly, and are paid in USD or USDC to your platform wallet.",
      aAr: "تتبع التوزيعات جدول العرض، عادةً ربع سنوي، وتُدفع بالدولار أو USDC إلى محفظتك على المنصة.",
    },
    {
      q: "Can I sell before maturity?",
      qAr: "هل يمكنني البيع قبل الاستحقاق؟",
      a: "Depending on availability, you may sell via the LP Market (1% fee) or the Secondary Market (0.5% fee).",
      aAr: "حسب التوفر، يمكنك البيع عبر سوق LP (رسوم 1%) أو السوق الثانوي (رسوم 0.5%).",
    },
    {
      q: "What protects investors legally?",
      qAr: "ما الذي يحمي المستثمرين قانونياً؟",
      a: "Each opportunity is held by a dedicated SPV under DIFC jurisdiction, structured under Reg D 506(c) and Reg S exemptions, with independent custody.",
      aAr: "كل فرصة محتفظ بها عبر شركة ذات غرض خاص في ولاية DIFC، مهيكلة وفق إعفاءات Reg D 506(c) و Reg S، مع حافظ مستقل.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="w-5 h-5 text-primary" />
          {isAr ? "الأسئلة الشائعة" : "FAQ"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`f-${i}`}>
              <AccordionTrigger className="text-sm hover:no-underline text-left">
                {isAr ? f.qAr : f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {isAr ? f.aAr : f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Master component
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 7b. Post-construction payment plan (separate, after handover)
// ─────────────────────────────────────────────────────────────
function PostConstructionPaymentPlan({
  p,
  isAr,
  preview,
}: {
  p: Property;
  isAr: boolean;
  preview?: InstallmentPreview | null;
}) {
  if (p.status !== "construction") return null;

  // Route (b): reflect the REAL per-investor installment plan — the DOWN-PAYMENT is the
  // handover-phase commitment; the N installments ARE the post-construction schedule. Until
  // terms are chosen (no preview) fall back to an illustrative split of the property value.
  const usingPreview = !!preview;
  const totalValue = usingPreview ? preview!.total : p.totalValue ?? 1000000;
  const handoverAmount = usingPreview ? preview!.downPayment : Math.round(totalValue * 0.3);
  const postAmount = Math.max(0, totalValue - handoverAmount);
  const handoverPct = totalValue > 0 ? Math.round((handoverAmount / totalValue) * 100) : 30;
  const postPct = 100 - handoverPct;
  const postCount = usingPreview ? preview!.numberOfInstallments : 36;
  const monthlyPost = usingPreview ? preview!.installmentAmount : Math.round(postAmount / 36);
  const isQuarterly = usingPreview && preview!.frequency === "quarterly";
  const freqLabel = isQuarterly
    ? isAr ? "ربع سنوي" : "Quarterly"
    : isAr ? "شهري" : "Monthly";
  const handoverDate =
    (usingPreview ? preview!.rows[0]?.dueDate : undefined) ??
    (p as unknown as { expectedCompletion?: string }).expectedCompletion ??
    p.installment?.activationDate ??
    "Q4 2026";

  const phases = [
    {
      en: "Handover Payment",
      ar: "دفعة التسليم",
      pct: handoverPct,
      amount: handoverAmount,
      when: isAr ? `عند التسليم (${handoverDate})` : `On handover (${handoverDate})`,
      tone: "primary" as const,
    },
    {
      en: "Post-Handover Installments",
      ar: "أقساط ما بعد التسليم",
      pct: postPct,
      amount: postAmount,
      when: isAr
        ? `${postCount} قسط (${freqLabel})`
        : `${postCount} ${isQuarterly ? "quarterly" : "monthly"} installments`,
      tone: "success" as const,
    },
  ];

  const benefits = [
    { en: "0% interest — interest-free plan", ar: "بدون فوائد" },
    { en: "Token-backed ownership from day 1", ar: "ملكية مدعومة بالتوكن من اليوم الأول" },
    { en: "Rental income offsets installments", ar: "الدخل الإيجاري يقابل الأقساط" },
    { en: "Early settlement allowed anytime", ar: "السداد المبكر متاح في أي وقت" },
  ];

  return (
    <Card className="border-success/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5 text-success" />
          {isAr ? "خطة السداد بعد التسليم" : "Payment Plan — After Construction"}
          <Badge variant="outline" className="ms-2 gap-1">
            <Sparkles className="w-3 h-3" />
            {usingPreview ? (isAr ? "خطتك" : "Your plan") : isAr ? "توضيحي" : "Illustrative"}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "نفس خطة الأقساط معروضة على مرحلتين: الدفعة المقدمة كالتزام عند التسليم، والأقساط تكمل بعد اكتمال البناء وبدء توليد الدخل."
            : "The same installment plan shown in two phases: the down-payment as the handover-stage commitment, and the installments completing after construction is done and income generation begins."}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary tiles */}
        <div className="grid md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border bg-muted/30">
            <p className="text-xs text-muted-foreground">{isAr ? "إجمالي القيمة" : "Total Value"}</p>
            <p className="text-lg font-bold">{fmtMoney(totalValue)}</p>
          </div>
          <div className="p-4 rounded-xl border bg-primary/5 border-primary/30">
            <p className="text-xs text-muted-foreground">{isAr ? "دفعة التسليم" : "Handover Payment"}</p>
            <p className="text-lg font-bold text-primary">{fmtMoney(handoverAmount)}</p>
            <p className="text-[11px] text-muted-foreground">{handoverPct}%</p>
          </div>
          <div className="p-4 rounded-xl border bg-success/5 border-success/30">
            <p className="text-xs text-muted-foreground">
              {isQuarterly ? (isAr ? "قسط ربع سنوي" : "Quarterly Installment") : isAr ? "قسط شهري" : "Monthly Installment"}
            </p>
            <p className="text-lg font-bold text-success">{fmtMoney(monthlyPost)}</p>
            <p className="text-[11px] text-muted-foreground">
              {postCount} {isAr ? "قسط" : "installments"}
            </p>
          </div>
          <div className="p-4 rounded-xl border bg-muted/30">
            <p className="text-xs text-muted-foreground">{isAr ? "تاريخ بدء الخطة" : "Plan Start Date"}</p>
            <p className="text-lg font-bold">{handoverDate}</p>
          </div>
        </div>

        {/* Phase split */}
        <div className="space-y-3">
          {phases.map((ph) => (
            <div
              key={ph.en}
              className={`p-4 rounded-xl border ${
                ph.tone === "primary"
                  ? "border-primary/30 bg-primary/5"
                  : "border-success/30 bg-success/5"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CircleDollarSign
                    className={`w-4 h-4 ${ph.tone === "primary" ? "text-primary" : "text-success"}`}
                  />
                  <span className="font-semibold">{isAr ? ph.ar : ph.en}</span>
                </div>
                <Badge variant="outline">{ph.pct}%</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{ph.when}</span>
                <span className="font-bold">{fmtMoney(ph.amount)}</span>
              </div>
              <Progress value={ph.pct} className="h-1.5 mt-2" />
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 gap-2">
          {benefits.map((b) => (
            <div key={b.en} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span className="text-sm">{isAr ? b.ar : b.en}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            {isAr ? "تنزيل خطة السداد" : "Download Payment Plan"}
          </Button>
          <Button size="sm" variant="outline" className="gap-2">
            <FileText className="w-4 h-4" />
            {isAr ? "شروط ما بعد التسليم" : "Post-Handover Terms"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyDataRoom({
  property,
  installmentTerms,
  onInstallmentTermsChange,
  installmentPreview,
}: {
  property: Property;
  // Shared installment terms + engine preview (property page only) — forwarded to the
  // Construction tab's calculators/schedule so every block reflects the same per-investor plan.
  installmentTerms?: InstallmentTerms;
  onInstallmentTermsChange?: (t: InstallmentTerms) => void;
  installmentPreview?: InstallmentPreview | null;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building2}
        en="Institutional Data Room"
        ar="غرفة البيانات المؤسسية"
        hint="A complete digital investment information center for this opportunity."
        hintAr="مركز معلومات استثمار رقمي متكامل لهذه الفرصة."
        isAr={isAr}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto justify-start">
          <TabsTrigger value="overview">{isAr ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="developer">{isAr ? "المطور" : "Developer"}</TabsTrigger>
          <TabsTrigger value="structure">{isAr ? "الهيكل" : "Structure"}</TabsTrigger>
          <TabsTrigger value="financial">{isAr ? "المالية" : "Financial"}</TabsTrigger>
          <TabsTrigger value="documents">{isAr ? "الوثائق" : "Documents"}</TabsTrigger>
          {property.status === "construction" && (
            <TabsTrigger value="construction">{isAr ? "البناء" : "Construction"}</TabsTrigger>
          )}
          <TabsTrigger value="market">{isAr ? "السوق" : "Market"}</TabsTrigger>
          <TabsTrigger value="risk">{isAr ? "المخاطر" : "Risk"}</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <SpecsSection p={property} isAr={isAr} />
        </TabsContent>
        <TabsContent value="developer" className="mt-4">
          <DeveloperSection p={property} isAr={isAr} />
        </TabsContent>
        <TabsContent value="structure" className="mt-4">
          <TokenizationSection p={property} isAr={isAr} />
        </TabsContent>
        <TabsContent value="financial" className="mt-4">
          <FinancialSection p={property} isAr={isAr} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DataRoomSection p={property} isAr={isAr} />
        </TabsContent>
        {property.status === "construction" && (
          <TabsContent value="construction" className="mt-4 space-y-4">
            <ConstructionSection p={property} isAr={isAr} />
            <DynamicInstallmentPlanner
              property={property}
              isAr={isAr}
              terms={installmentTerms}
              onTermsChange={onInstallmentTermsChange}
              preview={installmentPreview}
            />
            <InstallmentScheduleSection p={property} isAr={isAr} preview={installmentPreview} />
            <PostConstructionPaymentPlan p={property} isAr={isAr} preview={installmentPreview} />
          </TabsContent>
        )}
        <TabsContent value="market" className="mt-4">
          <MarketAnalysisSection p={property} isAr={isAr} />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <InsuranceRiskSection p={property} isAr={isAr} />
        </TabsContent>
        <TabsContent value="faq" className="mt-4">
          <FaqSection isAr={isAr} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
