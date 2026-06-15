import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calculator,
  Download,
  Eye,
  CalendarDays,
  CircleDollarSign,
  PieChart,
  TrendingUp,
  Wallet,
  FileText,
  Layers,
  Sparkles,
} from "lucide-react";

type Property = {
  id: string;
  name?: string;
  nameAr?: string;
  totalValue?: number;
  tokenPrice?: number;
  location?: string | { city?: string; country?: string };
  developer?: { name?: string } | string;
};

type Frequency = "monthly" | "quarterly";

interface Props {
  property: Property;
  isAr: boolean;
  defaultValue?: number; // total amount investor wants to allocate; falls back to totalValue
  pronova?: boolean;
}

const fmt = (n: number, isAr: boolean) =>
  new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

export function DynamicInstallmentPlanner({
  property,
  isAr,
  defaultValue,
  pronova = false,
}: Props) {
  const total = defaultValue ?? property.totalValue ?? 1_000_000;

  const [downPct, setDownPct] = useState<20 | 30 | 40>(30);
  const [years, setYears] = useState<1 | 2 | 3>(2);
  const [freq, setFreq] = useState<Frequency>("monthly");

  const plan = useMemo(() => {
    const down = (total * downPct) / 100;
    const remaining = total - down;
    const periods = freq === "monthly" ? years * 12 : years * 4;
    const installment = remaining / periods;
    const start = new Date();
    start.setMonth(start.getMonth() + 1);
    const schedule = Array.from({ length: periods }).map((_, i) => {
      const d = new Date(start);
      if (freq === "monthly") d.setMonth(d.getMonth() + i);
      else d.setMonth(d.getMonth() + i * 3);
      const cumulativePaid = down + installment * (i + 1);
      const ownership = (cumulativePaid / total) * 100;
      return {
        n: i + 1,
        date: d.toISOString().slice(0, 10),
        amount: installment,
        cumulative: cumulativePaid,
        balance: Math.max(0, total - cumulativePaid),
        ownership,
      };
    });
    return { down, remaining, periods, installment, schedule };
  }, [total, downPct, years, freq]);

  const chip = (active: boolean) =>
    `px-3 py-2 text-sm rounded-md border transition-all ${
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-background hover:bg-accent border-border"
    }`;

  const downloadCsv = () => {
    const header = [
      isAr ? "رقم القسط" : "#",
      isAr ? "تاريخ الاستحقاق" : "Due Date",
      isAr ? "قيمة القسط" : "Installment",
      isAr ? "المتراكم" : "Cumulative Paid",
      isAr ? "الرصيد المتبقي" : "Remaining Balance",
      isAr ? "نسبة الملكية" : "Ownership %",
    ];
    const meta = [
      [isAr ? "العقار" : "Property", isAr ? property.nameAr ?? "" : property.name ?? ""],
      [isAr ? "المعرف" : "Property ID", property.id],
      [isAr ? "الموقع" : "Location", typeof property.location === "string" ? property.location : `${property.location?.city ?? ""} ${property.location?.country ?? ""}`],
      [isAr ? "المطور" : "Developer", typeof property.developer === "string" ? property.developer : property.developer?.name ?? ""],
      [isAr ? "إجمالي القيمة" : "Total Value", String(total)],
      [isAr ? "الدفعة المقدمة %" : "Down Payment %", `${downPct}%`],
      [isAr ? "قيمة الدفعة المقدمة" : "Down Payment", String(plan.down)],
      [isAr ? "الرصيد الممول" : "Financed Balance", String(plan.remaining)],
      [isAr ? "المدة" : "Duration", `${years} ${isAr ? "سنة" : "year(s)"}`],
      [isAr ? "التكرار" : "Frequency", freq],
      [isAr ? "قيمة القسط" : "Per Installment", String(plan.installment)],
      [isAr ? "عدد الأقساط" : "Total Installments", String(plan.periods)],
      [isAr ? "الممول" : "Financier", pronova ? "Nova Finance" : "Direct"],
      [],
    ];
    const rows = plan.schedule.map((r) => [
      r.n,
      r.date,
      r.amount.toFixed(2),
      r.cumulative.toFixed(2),
      r.balance.toFixed(2),
      r.ownership.toFixed(2) + "%",
    ]);
    const csv =
      meta.map((m) => m.join(",")).join("\n") +
      "\n" +
      header.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-plan-${property.id}-${downPct}pct-${years}y.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              {isAr ? "مخطط الأقساط الديناميكي" : "Dynamic Installment Planner"}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isAr
                ? "صمّم خطة السداد الخاصة بك بشكل مباشر وفوري"
                : "Customize your own payment plan in real time"}
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {isAr ? "محدّث فوراً" : "Live Calculator"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {isAr ? "الدفعة المقدمة" : "Down Payment"}
            </p>
            <div className="flex gap-2">
              {([20, 30, 40] as const).map((v) => (
                <button key={v} className={chip(downPct === v)} onClick={() => setDownPct(v)}>
                  {v}%
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {isAr ? "مدة التقسيط" : "Duration"}
            </p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((v) => (
                <button key={v} className={chip(years === v)} onClick={() => setYears(v)}>
                  {v} {isAr ? "سنة" : v === 1 ? "year" : "years"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {isAr ? "تكرار السداد" : "Frequency"}
            </p>
            <div className="flex gap-2">
              <button className={chip(freq === "monthly")} onClick={() => setFreq("monthly")}>
                {isAr ? "شهري" : "Monthly"}
              </button>
              <button className={chip(freq === "quarterly")} onClick={() => setFreq("quarterly")}>
                {isAr ? "ربع سنوي" : "Quarterly"}
              </button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Live Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile
            icon={<CircleDollarSign className="h-4 w-4" />}
            label={isAr ? "الدفعة المقدمة" : "Down Payment"}
            value={fmt(plan.down, isAr)}
            sub={`${downPct}% ${isAr ? "من الإجمالي" : "of total"}`}
          />
          <SummaryTile
            icon={<Wallet className="h-4 w-4" />}
            label={isAr ? "الرصيد الممول" : "Financed"}
            value={fmt(plan.remaining, isAr)}
            sub={`${100 - downPct}% ${isAr ? "متبقي" : "remaining"}`}
          />
          <SummaryTile
            icon={<CalendarDays className="h-4 w-4" />}
            label={
              freq === "monthly"
                ? isAr
                  ? "قسط شهري"
                  : "Per Month"
                : isAr
                ? "قسط ربع سنوي"
                : "Per Quarter"
            }
            value={fmt(plan.installment, isAr)}
            sub={`${plan.periods} ${isAr ? "قسط" : "installments"}`}
          />
          <SummaryTile
            icon={<TrendingUp className="h-4 w-4" />}
            label={isAr ? "إجمالي السداد" : "Total Payable"}
            value={fmt(total, isAr)}
            sub={pronova ? "0% APR · Nova" : isAr ? "بدون فوائد" : "Interest-Free"}
          />
        </div>

        {/* Visual breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              {isAr ? "هيكل التمويل" : "Financing Structure"}
            </span>
            <span className="text-muted-foreground">
              {downPct}% / {100 - downPct}%
            </span>
          </div>
          <div className="flex h-4 w-full overflow-hidden rounded-full border">
            <div
              className="bg-primary"
              style={{ width: `${downPct}%` }}
              title={isAr ? "دفعة مقدمة" : "Down payment"}
            />
            <div
              className="bg-primary/30"
              style={{ width: `${100 - downPct}%` }}
              title={isAr ? "ممول" : "Financed"}
            />
          </div>

          {/* Installment bar chart */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              {isAr ? "نمو الملكية عبر الزمن" : "Ownership growth over time"}
            </p>
            <div className="flex items-end gap-1 h-24">
              {plan.schedule.map((s, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/70 hover:bg-primary rounded-sm transition-all"
                  style={{ height: `${s.ownership}%` }}
                  title={`${s.date} · ${s.ownership.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>
                {isAr ? "البداية" : "Start"}: {downPct}%
              </span>
              <span>
                {isAr ? "النهاية" : "End"}: 100%
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Eye className="h-4 w-4" />
                {isAr ? "عرض تفاصيل الخطة" : "View Full Plan Details"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {isAr ? "خطة السداد الكاملة" : "Full Payment Plan"} —{" "}
                  {isAr ? property.nameAr : property.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <KV k={isAr ? "إجمالي القيمة" : "Total Value"} v={fmt(total, isAr)} />
                  <KV k={isAr ? "دفعة مقدمة" : "Down Payment"} v={`${fmt(plan.down, isAr)} (${downPct}%)`} />
                  <KV k={isAr ? "ممول" : "Financed"} v={fmt(plan.remaining, isAr)} />
                  <KV k={isAr ? "المدة" : "Duration"} v={`${years} ${isAr ? "سنة" : "yr"}`} />
                  <KV k={isAr ? "التكرار" : "Frequency"} v={freq} />
                  <KV k={isAr ? "قيمة القسط" : "Installment"} v={fmt(plan.installment, isAr)} />
                  <KV k={isAr ? "عدد الأقساط" : "Total Installments"} v={String(plan.periods)} />
                  <KV
                    k={isAr ? "شروط التفعيل" : "Activation"}
                    v={isAr ? "بعد دفعة المقدمة" : "After down payment"}
                  />
                  <KV
                    k={isAr ? "الممول" : "Financier"}
                    v={pronova ? "Nova Finance (0% APR)" : isAr ? "مباشر — بدون فوائد" : "Direct — Interest-Free"}
                  />
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {isAr ? "جدول الأقساط" : "Installment Schedule"}
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2 text-start">#</th>
                          <th className="p-2 text-start">{isAr ? "التاريخ" : "Date"}</th>
                          <th className="p-2 text-end">{isAr ? "القسط" : "Amount"}</th>
                          <th className="p-2 text-end">{isAr ? "المتراكم" : "Cumulative"}</th>
                          <th className="p-2 text-end">{isAr ? "الرصيد" : "Balance"}</th>
                          <th className="p-2 text-end">{isAr ? "ملكية %" : "Ownership"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.schedule.map((r) => (
                          <tr key={r.n} className="border-t">
                            <td className="p-2">{r.n}</td>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2 text-end">{fmt(r.amount, isAr)}</td>
                            <td className="p-2 text-end">{fmt(r.cumulative, isAr)}</td>
                            <td className="p-2 text-end">{fmt(r.balance, isAr)}</td>
                            <td className="p-2 text-end font-medium">
                              {r.ownership.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-sm font-semibold mb-2">
                    {isAr ? "نمو الملكية" : "Ownership Progress"}
                  </p>
                  <Progress value={downPct} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr
                      ? `تبدأ ملكيتك من ${downPct}% وتصل إلى 100% عند سداد القسط الأخير.`
                      : `Your ownership starts at ${downPct}% and reaches 100% on the final installment.`}
                  </p>
                </div>

                <Button onClick={downloadCsv} className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  {isAr ? "تنزيل خطة السداد" : "Download Payment Plan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={downloadCsv} className="gap-2">
            <Download className="h-4 w-4" />
            {isAr ? "تنزيل خطة السداد" : "Download Payment Plan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className="text-base font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border bg-background/40 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</p>
      <p className="text-sm font-semibold">{v}</p>
    </div>
  );
}
