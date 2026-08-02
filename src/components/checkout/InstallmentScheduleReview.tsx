import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CalendarClock,
  Download,
  Layers,
  Loader2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import {
  installmentsApi,
  type InstallmentPreview,
} from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";

// Checkout — full installment schedule review BEFORE paying the down-payment (client note:
// "before the pay button add a Review Full Installment Schedule button + download the full plan").
// The plan is the SAME cent-exact one the server persists on purchase: it comes from the public
// engine preview (POST /installments/preview/), the single source of truth every property-page
// calculator already renders from. No auth, writes nothing — safe to fetch on the checkout page.

interface Props {
  propertyId: string; // Property.slug (checkout's ?property= param)
  propertyName: string;
  propertyNameAr: string;
  units: number;
  downPct: number;
  nInstallments: number;
  frequency: "monthly" | "quarterly";
}

/** One row for the review table: the down-payment (row 0), then each scheduled installment. */
interface ScheduleRow {
  label: string;
  date: string;
  amount: number;
  cumulative: number;
  balance: number;
  ownership: number;
}

export function InstallmentScheduleReview({
  propertyId,
  propertyName,
  propertyNameAr,
  units,
  downPct,
  nInstallments,
  frequency,
}: Props) {
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";
  const [preview, setPreview] = useState<InstallmentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    installmentsApi
      .preview({
        property: propertyId,
        units,
        down_payment_percent: downPct,
        n_installments: nInstallments,
        frequency,
      })
      .then((p) => {
        if (active) {
          setPreview(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [propertyId, units, downPct, nInstallments, frequency]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(isAr ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Math.max(0, n));

  const freqLabel = (f: "monthly" | "quarterly") =>
    f === "quarterly" ? (isAr ? "ربع سنوي" : "Quarterly") : isAr ? "شهري" : "Monthly";

  // Build the display schedule: a down-payment row (paid on purchase) + every installment row,
  // all from the authoritative preview so amounts/dates equal what the server will charge.
  const buildRows = (p: InstallmentPreview): ScheduleRow[] => {
    const rows: ScheduleRow[] = [
      {
        label: isAr ? "دفعة مقدمة" : "Down payment",
        date: isAr ? "عند الشراء" : "On purchase",
        amount: p.downPayment,
        cumulative: p.downPayment,
        balance: Math.max(0, p.total - p.downPayment),
        ownership: p.total > 0 ? (p.downPayment / p.total) * 100 : 0,
      },
    ];
    p.rows.forEach((r) => {
      rows.push({
        label: `${isAr ? "قسط" : "Installment"} ${r.sequence}`,
        date: r.dueDate,
        amount: r.amount,
        cumulative: r.cumulative,
        balance: r.balance,
        ownership: r.ownershipPercent,
      });
    });
    return rows;
  };

  // Download the full plan as a CSV (dep-free, offline). Mirrors the property-page planner's
  // export shape; a UTF-8 BOM keeps Arabic property names intact in Excel.
  const downloadCsv = () => {
    if (!preview) return;
    const rows = buildRows(preview);
    const meta: string[][] = [
      [isAr ? "العقار" : "Property", isAr ? propertyNameAr : propertyName],
      [isAr ? "عدد الوحدات" : "Units", String(preview.units)],
      [isAr ? "سعر الوحدة" : "Unit price", String(preview.unitPrice)],
      [isAr ? "قيمة المركز" : "Position value", String(preview.total)],
      [isAr ? "رسوم المنصة والإدارة" : "Platform + management fee", String(preview.fee)],
      [isAr ? "الدفعة المقدمة %" : "Down payment %", `${preview.downPaymentPercent}%`],
      [isAr ? "قيمة الدفعة المقدمة" : "Down payment", String(preview.downPayment)],
      [isAr ? "المستحق الآن" : "Due now (down payment + fee)", String(preview.amountDueNow)],
      [isAr ? "الرصيد الممول" : "Financed balance", String(preview.total - preview.downPayment)],
      [isAr ? "قيمة القسط" : "Per installment", String(preview.installmentAmount)],
      [isAr ? "عدد الأقساط" : "Number of installments", String(preview.numberOfInstallments)],
      [isAr ? "التكرار" : "Frequency", freqLabel(preview.frequency)],
      [],
    ];
    const head = [
      isAr ? "البند" : "Item",
      isAr ? "التاريخ" : "Date",
      isAr ? "المبلغ (USD)" : "Amount (USD)",
      isAr ? "المتراكم" : "Cumulative",
      isAr ? "الرصيد المتبقي" : "Remaining balance",
      isAr ? "نسبة الملكية %" : "Ownership %",
    ];
    const body = rows.map((r) => [
      r.label,
      r.date,
      r.amount.toFixed(2),
      r.cumulative.toFixed(2),
      r.balance.toFixed(2),
      r.ownership.toFixed(2) + "%",
    ]);
    const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
    const csv = [...meta, head, ...body]
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
    const slug = (propertyName || "installment")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase();
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-installment-plan.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Loading / error: keep it quiet and non-blocking — the summary panel already shows "due now".
  if (loading) {
    return (
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {isAr ? "جارٍ تحضير جدول الأقساط..." : "Preparing your installment schedule..."}
      </div>
    );
  }
  if (error || !preview) {
    return (
      <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3 text-sm">
        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
        <span className="text-muted-foreground">
          {isAr
            ? "تعذّر تحميل جدول الأقساط الآن. يمكنك المتابعة — سيظهر الجدول الكامل في صفحة الأقساط بعد الدفعة المقدمة."
            : "Couldn't load the schedule right now. You can continue — the full schedule appears on the Installments page after the down-payment."}
        </span>
      </div>
    );
  }

  const rows = buildRows(preview);

  return (
    <div
      className="p-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
          <CalendarClock className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {isAr ? "خطة الأقساط" : "Your installment plan"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "راجع جدول الأقساط بالكامل قبل الدفع — التواريخ والمبالغ ونمو الملكية."
              : "Review the full schedule before you pay — dates, amounts and how your ownership grows."}
          </p>
        </div>
      </div>

      {/* At-a-glance summary (matches the server charge exactly). */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <MiniStat label={isAr ? "المستحق الآن" : "Due now"} value={fmt(preview.amountDueNow)} highlight />
        <MiniStat
          label={isAr ? "دفعة مقدمة" : "Down payment"}
          value={`${fmt(preview.downPayment)}`}
          sub={`${preview.downPaymentPercent}%`}
        />
        <MiniStat
          label={freqLabel(preview.frequency)}
          value={fmt(preview.installmentAmount)}
          sub={`${preview.numberOfInstallments} ${isAr ? "قسط" : "installments"}`}
        />
        <MiniStat label={isAr ? "قيمة المركز" : "Position"} value={fmt(preview.total)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <Button variant="hero" className="flex-1 gap-2" onClick={() => setOpen(true)}>
          <ListChecks className="w-4 h-4" />
          {isAr ? "مراجعة جدول الأقساط الكامل" : "Review Full Installment Schedule"}
        </Button>
        <Button variant="outline" className="gap-2" onClick={downloadCsv}>
          <Download className="w-4 h-4" />
          {isAr ? "تنزيل الخطة" : "Download plan"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              {isAr ? "جدول الأقساط الكامل" : "Full Installment Schedule"}
            </DialogTitle>
            <DialogDescription>
              {isAr ? propertyNameAr : propertyName} · {preview.units}{" "}
              {isAr ? "وحدة" : preview.units === 1 ? "unit" : "units"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1" dir={isRTL ? "rtl" : "ltr"}>
            {/* Summary grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <KV k={isAr ? "قيمة المركز" : "Position value"} v={fmt(preview.total)} />
              <KV
                k={isAr ? "دفعة مقدمة" : "Down payment"}
                v={`${fmt(preview.downPayment)} (${preview.downPaymentPercent}%)`}
              />
              <KV k={isAr ? "الرسوم" : "Fees"} v={fmt(preview.fee)} />
              <KV k={isAr ? "المستحق الآن" : "Due now"} v={fmt(preview.amountDueNow)} highlight />
              <KV k={isAr ? "الرصيد الممول" : "Financed"} v={fmt(preview.total - preview.downPayment)} />
              <KV k={isAr ? "قيمة القسط" : "Per installment"} v={fmt(preview.installmentAmount)} />
              <KV k={isAr ? "عدد الأقساط" : "Installments"} v={String(preview.numberOfInstallments)} />
              <KV k={isAr ? "التكرار" : "Frequency"} v={freqLabel(preview.frequency)} />
              <KV
                k={isAr ? "التفعيل" : "Activation"}
                v={isAr ? "بعد الدفعة المقدمة" : "After down payment"}
              />
            </div>

            <Separator />

            {/* Full schedule table */}
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                {isAr ? "المواعيد والمبالغ" : "Dates & amounts"}
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-start font-medium">{isAr ? "البند" : "Item"}</th>
                      <th className="p-2 text-start font-medium">{isAr ? "التاريخ" : "Date"}</th>
                      <th className="p-2 text-end font-medium">{isAr ? "المبلغ" : "Amount"}</th>
                      <th className="p-2 text-end font-medium">{isAr ? "المتراكم" : "Cumulative"}</th>
                      <th className="p-2 text-end font-medium">{isAr ? "الرصيد" : "Balance"}</th>
                      <th className="p-2 text-end font-medium">{isAr ? "ملكية %" : "Ownership"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={
                          i === 0
                            ? "border-t border-border bg-primary/5 font-medium"
                            : "border-t border-border"
                        }
                      >
                        <td className="p-2 text-foreground whitespace-nowrap">{r.label}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{r.date}</td>
                        <td className="p-2 text-end text-foreground whitespace-nowrap">{fmt(r.amount)}</td>
                        <td className="p-2 text-end text-muted-foreground whitespace-nowrap">{fmt(r.cumulative)}</td>
                        <td className="p-2 text-end text-muted-foreground whitespace-nowrap">{fmt(r.balance)}</td>
                        <td className="p-2 text-end font-medium text-foreground whitespace-nowrap">
                          {r.ownership.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ownership progress */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-foreground">
                  {isAr ? "نمو الملكية" : "Ownership growth"}
                </span>
                <Badge variant="outline" className="text-xs">
                  {preview.downPaymentPercent}% → 100%
                </Badge>
              </div>
              <Progress value={preview.downPaymentPercent} />
              <p className="text-xs text-muted-foreground mt-1">
                {isAr
                  ? `تبدأ ملكيتك من ${preview.downPaymentPercent}% بعد الدفعة المقدمة وتصل إلى 100% مع سداد القسط الأخير.`
                  : `Your ownership starts at ${preview.downPaymentPercent}% after the down-payment and reaches 100% on the final installment.`}
              </p>
            </div>

            <Button className="w-full gap-2" onClick={downloadCsv}>
              <Download className="w-4 h-4" />
              {isAr ? "تنزيل الخطة الكاملة (CSV)" : "Download the full plan (CSV)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 ${
        highlight ? "border-primary/40 bg-primary/10" : "border-border bg-background/60"
      }`}
    >
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`} dir="ltr">
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function KV({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-2 ${
        highlight ? "border-primary/40 bg-primary/10" : "border-border bg-background/40"
      }`}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`} dir="ltr">
        {v}
      </p>
    </div>
  );
}
