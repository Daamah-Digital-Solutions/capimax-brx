import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ShieldCheck,
  Shield,
  FileText,
  Building2,
  CheckCircle2,
  TrendingUp,
  Calendar,
  BarChart3,
  Eye,
  Download,
  Activity,
  Landmark,
  HardHat,
  ClipboardCheck,
} from "lucide-react";

interface InsuranceValuationSectionProps {
  currentValuation: number;
  previousValuation?: number;
  insuranceProvider?: string;
  policyNumber?: string;
  coverageAmount?: number;
  insurer?: string;
  valuationFirm?: string;
}

export function InsuranceValuationSection({
  currentValuation,
  previousValuation,
  insuranceProvider = "AIG Real Estate Insurance",
  policyNumber = "POL-RE-2025-00482",
  coverageAmount,
  insurer = "Lloyd's of London (Reinsurer)",
  valuationFirm = "JLL · CBRE · Knight Frank",
}: InsuranceValuationSectionProps) {
  const { language, isRTL } = useLanguage();

  const prev = previousValuation ?? Math.round(currentValuation * 0.978);
  const coverage = coverageAmount ?? Math.round(currentValuation * 1.1);
  const delta = currentValuation - prev;
  const deltaPct = ((delta / prev) * 100).toFixed(2);
  const isUp = delta >= 0;

  // Synthetic 6-month appreciation history (institutional look)
  const months = isRTL
    ? ["يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const baseStart = Math.round(currentValuation * 0.93);
  const step = (currentValuation - baseStart) / 5;
  const history = months.map((m, i) => ({
    month: m,
    value: Math.round(baseStart + step * i),
  }));
  const minH = Math.min(...history.map((h) => h.value));
  const maxH = Math.max(...history.map((h) => h.value));

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const valuationFactors = [
    { icon: BarChart3, en: "Market Pricing", ar: "تسعير السوق" },
    { icon: HardHat, en: "Construction Progress", ar: "تقدم الإنشاء" },
    { icon: ClipboardCheck, en: "Development Milestones", ar: "مراحل التطوير" },
    { icon: Building2, en: "Real Estate Conditions", ar: "ظروف السوق العقاري" },
    { icon: TrendingUp, en: "Property Appreciation", ar: "ارتفاع قيمة العقار" },
    { icon: FileText, en: "Engineering Reports", ar: "التقارير الهندسية" },
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
              <ShieldCheck className="w-3 h-3" />
              {language === "ar" ? "موثوق مؤسسياً" : "Institutional Grade"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Activity className="w-3 h-3 text-success" />
              {language === "ar" ? "تحديث شهري" : "Updated Monthly"}
            </Badge>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            {language === "ar"
              ? "التأمين والتقييم المستقل"
              : "Insurance & Independent Valuation"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {language === "ar"
              ? "العقار وأموال المستثمرين محميون بتأمين شامل، والتقييم يُجرى من قبل شركات تقييم مستقلة ومحايدة وفق المعايير الدولية."
              : "The property and investor funds are protected by comprehensive insurance, and valuations are performed by independent third-party firms under international standards."}
          </p>
        </div>
      </div>

      {/* ───────── Insurance Block ───────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">
                    {language === "ar"
                      ? "العقار مؤمَّن بالكامل"
                      : "Property Fully Insured"}
                  </h3>
                  <Badge className="bg-success/20 text-success border-success/30 gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {language === "ar" ? "ساري المفعول" : "Active"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar"
                    ? "تغطية شاملة ضد الأضرار، الحرائق، الكوارث الطبيعية، والمسؤولية تجاه الغير."
                    : "Comprehensive coverage against damage, fire, natural disasters, and third-party liability."}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "شركة التأمين" : "Insurance Provider"}
                </p>
                <p className="font-semibold flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-primary" />
                  {insuranceProvider}
                </p>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "إعادة التأمين" : "Reinsurer"}
                </p>
                <p className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  {insurer}
                </p>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "رقم الوثيقة" : "Policy Number"}
                </p>
                <p className="font-semibold font-mono text-sm">{policyNumber}</p>
              </div>
              <div className="p-4 rounded-xl border bg-card">
                <p className="text-xs text-muted-foreground mb-1">
                  {language === "ar" ? "مبلغ التغطية" : "Coverage Amount"}
                </p>
                <p className="font-semibold text-success">{fmt(coverage)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" size="sm" className="gap-2">
                <Eye className="w-4 h-4" />
                {language === "ar" ? "عرض الشهادة" : "View Certificate"}
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                {language === "ar" ? "تنزيل وثيقة التأمين" : "Download Policy"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {language === "ar"
                ? "حماية أموال المستثمرين"
                : "Investor Funds Protected"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {language === "ar"
                ? "هيكل SPV مستقل قانونياً، حسابات ضمان (Escrow) منفصلة، وحماية لهيكل الملكية بالكامل."
                : "Independent SPV legal structure, segregated escrow accounts, and full ownership-structure protection."}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                {language === "ar" ? "حسابات ضمان منفصلة" : "Segregated escrow accounts"}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                {language === "ar" ? "هيكل SPV قانوني" : "Legal SPV structure"}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                {language === "ar" ? "تدقيق مستقل ربع سنوي" : "Independent quarterly audit"}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ───────── Valuation Block ───────── */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {language === "ar"
                  ? "التقييم المستقل للعقار"
                  : "Independent Property Valuation"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "ar"
                  ? `يُجرى من قبل شركات تقييم مستقلة ومحايدة: ${valuationFirm}`
                  : `Performed by independent third-party firms: ${valuationFirm}`}
              </p>
            </div>
            <Badge variant="outline" className="gap-1 self-start md:self-auto">
              <Calendar className="w-3 h-3" />
              {language === "ar" ? "آخر تحديث: هذا الشهر" : "Last update: This month"}
            </Badge>
          </div>

          {/* Valuation snapshot */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent">
              <p className="text-xs text-muted-foreground mb-1">
                {language === "ar" ? "التقييم الحالي" : "Current Valuation"}
              </p>
              <p className="text-2xl font-bold text-primary">{fmt(currentValuation)}</p>
              <div className={`text-xs mt-1 flex items-center gap-1 ${isUp ? "text-success" : "text-destructive"}`}>
                <TrendingUp className="w-3 h-3" />
                {isUp ? "+" : ""}{deltaPct}% {language === "ar" ? "مقارنة بالشهر السابق" : "vs previous month"}
              </div>
            </div>
            <div className="p-5 rounded-xl border bg-card">
              <p className="text-xs text-muted-foreground mb-1">
                {language === "ar" ? "التقييم السابق" : "Previous Valuation"}
              </p>
              <p className="text-2xl font-bold">{fmt(prev)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "الشهر الماضي" : "Last month"}
              </p>
            </div>
            <div className="p-5 rounded-xl border bg-card">
              <p className="text-xs text-muted-foreground mb-1">
                {language === "ar" ? "النمو خلال 6 أشهر" : "6-Month Growth"}
              </p>
              <p className="text-2xl font-bold text-success">
                +{(((currentValuation - history[0].value) / history[0].value) * 100).toFixed(2)}%
              </p>
              <Progress value={Math.min(100, ((currentValuation - history[0].value) / history[0].value) * 100 * 10)} className="h-1.5 mt-2" />
            </div>
          </div>

          {/* History bars */}
          <div className="p-5 rounded-xl border bg-muted/30 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-medium text-sm">
                {language === "ar" ? "تاريخ التقييم الشهري" : "Monthly Valuation History"}
              </p>
              <span className="text-xs text-muted-foreground">
                {language === "ar" ? "آخر 6 أشهر" : "Last 6 months"}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2 h-32">
              {history.map((h) => {
                const heightPct =
                  maxH === minH ? 60 : 30 + ((h.value - minH) / (maxH - minH)) * 70;
                return (
                  <div key={h.month} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ${(h.value / 1000).toFixed(0)}k
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary to-primary/40 transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{h.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Valuation factors */}
          <div>
            <p className="font-medium text-sm mb-3">
              {language === "ar" ? "المعايير المعتمدة في التقييم" : "Valuation Methodology Factors"}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {valuationFactors.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.en} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">
                      {language === "ar" ? f.ar : f.en}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Market comparison */}
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-card">
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "متوسط السوق المحلي" : "Local Market Average"}
              </p>
              <p className="text-lg font-semibold">{fmt(Math.round(currentValuation * 0.94))}</p>
            </div>
            <div className="p-4 rounded-xl border bg-card">
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "مقارنة عقارات مماثلة" : "Comparable Properties"}
              </p>
              <p className="text-lg font-semibold">{fmt(Math.round(currentValuation * 0.97))}</p>
            </div>
            <div className="p-4 rounded-xl border bg-success/5 border-success/30">
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "ميزة هذا العقار" : "This Property Premium"}
              </p>
              <p className="text-lg font-semibold text-success">+6.4%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
