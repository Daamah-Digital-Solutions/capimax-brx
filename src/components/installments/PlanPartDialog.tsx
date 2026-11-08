import { useEffect, useState } from "react";
import { ArrowLeftRight, Droplets, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  installmentsApi,
  lpApi,
  secondaryMarketApi,
  type InstallmentPlanRow,
  type PlanPartPreview,
  type PlanScheduleRow,
} from "@/integrations/api/client";
import { cn } from "@/lib/utils";

// Selling or transferring PART of an installment plan: any number of its units (at least one).
// The other party gets a plan of their own for those units — their share of what was paid and
// of every remaining installment, same dates — and the holder keeps a plan for the rest. The
// figures shown come from the server (GET /installments/plans/{id}/part/), never estimated here.

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Mode = "market" | "lp" | "transfer";

export const PART_ERRORS: Record<string, { en: string; ar: string }> = {
  overdue_installments: {
    en: "This plan has an overdue installment. Pay it first — then you can sell or transfer part of the plan.",
    ar: "على هذه الخطة قسط متأخر. سدّده أولًا، وبعدها يمكنك بيع جزء من الخطة أو تحويله.",
  },
  exceeds_free_units: {
    en: "That's more units than are free in this plan — the rest are already offered on a market or in a pending transfer.",
    ar: "هذا العدد أكبر من الوحدات الحرة في الخطة، فالباقي معروض بالفعل في سوق أو في تحويل قيد الانتظار.",
  },
  min_one_unit: { en: "Choose at least 1 unit.", ar: "اختر وحدة واحدة على الأقل." },
  below_remaining: {
    en: "At this price the units don't cover their share of the remaining installments. Raise the price.",
    ar: "بهذا السعر لا تغطي الوحدات نصيبها من الأقساط المتبقية. ارفع السعر.",
  },
  already_listed: {
    en: "This plan already has an open listing. Cancel it to list again.",
    ar: "لهذه الخطة عرض مفتوح بالفعل. ألغِه لتعرض من جديد.",
  },
  not_minted: { en: "The plan's units are issued once the down payment settles.", ar: "تُصدر وحدات الخطة بعد تأكيد الدفعة المقدمة." },
  pledged: { en: "This plan's units are pledged to Nova Finance.", ar: "وحدات هذه الخطة مرهونة لصالح Nova Finance." },
  not_active: { en: "Only an active plan can be sold or transferred.", ar: "يمكن بيع أو تحويل الخطط النشطة فقط." },
};

export function partError(err: any, isAr: boolean): string {
  const code = err?.data?.code;
  const known = typeof code === "string" ? PART_ERRORS[code] : undefined;
  if (known) return isAr ? known.ar : known.en;
  return err?.message || (isAr ? "تعذّرت العملية" : "Something went wrong");
}

export function PlanPartDialog({
  plan,
  open,
  onOpenChange,
  onChanged,
  onTransfer,
}: {
  plan: InstallmentPlanRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onTransfer: (units: number) => void;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const pos = plan.position!;
  const free = pos.freeUnits ?? 0;
  const [units, setUnits] = useState(1);
  const [mode, setMode] = useState<Mode>("market");
  const [price, setPrice] = useState(pos.currentPrice);
  const [preview, setPreview] = useState<PlanPartPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUnits(1);
    setMode("market");
    setPrice(pos.currentPrice);
  }, [open, pos.currentPrice]);

  useEffect(() => {
    if (!open || units < 1 || units > free) {
      setPreview(null);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      installmentsApi
        .partPreview(plan.id, units, price > 0 ? price : undefined)
        .then((p) => {
          if (!live) return;
          setPreview(p);
          setError(null);
        })
        .catch((e) => {
          if (!live) return;
          setPreview(null);
          setError(partError(e, isAr));
        })
        .finally(() => live && setLoading(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, plan.id, units, price, free, isAr]);

  const overdue = (pos.overdueInstallments ?? 0) > 0;
  const cash = mode === "market" ? preview?.market.cash ?? 0 : mode === "lp" ? preview?.lp.net ?? 0 : 0;
  const canSubmit = !!preview && !overdue && !busy && (mode === "transfer" || cash > 0);

  const submit = async () => {
    if (mode === "transfer") {
      onOpenChange(false);
      onTransfer(units);
      return;
    }
    setBusy(true);
    try {
      if (mode === "market") {
        await secondaryMarketApi.listPosition({ plan_id: plan.id, units, price_per_unit: price });
        toast.success(
          isAr ? `تم عرض ${units} وحدة من الخطة في السوق الثانوي` : `${units} unit(s) of the plan listed on the secondary market`,
        );
      } else {
        await lpApi.listAsset({ property_id: plan.propertyId, token_amount: units, plan_id: plan.id });
        toast.success(
          isAr ? `أُرسل طلب بيع ${units} وحدة لمزودي السيولة` : `Request to sell ${units} unit(s) sent to the liquidity providers`,
        );
      }
      onOpenChange(false);
      onChanged();
    } catch (e: any) {
      toast.error(partError(e, isAr));
    } finally {
      setBusy(false);
    }
  };

  const modes: { id: Mode; icon: typeof Store; en: string; ar: string }[] = [
    { id: "market", icon: Store, en: "Secondary market", ar: "السوق الثانوي" },
    { id: "lp", icon: Droplets, en: "Liquidity provider", ar: "مزود السيولة" },
    { id: "transfer", icon: ArrowLeftRight, en: "Transfer to someone", ar: "تحويل لشخص آخر" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "بيع أو تحويل جزء من الخطة" : "Sell or transfer part of the plan"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "اختر عدد الوحدات. الطرف الآخر يحصل على خطة باسمه بنصيبها من المدفوع ومن كل قسط متبقٍ بنفس المواعيد، وتبقى لك خطة بباقي الوحدات."
              : "Choose how many units. The other party gets a plan in their name with those units' share of what was paid and of every remaining installment, on the same dates; you keep a plan for the rest."}
          </DialogDescription>
        </DialogHeader>

        {overdue ? (
          <p className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {PART_ERRORS.overdue_installments[isAr ? "ar" : "en"]}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "p-2 rounded-lg border text-xs flex flex-col items-center gap-1 transition-colors",
                    mode === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                  )}
                >
                  <m.icon className="w-4 h-4" />
                  {isAr ? m.ar : m.en}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">{isAr ? "عدد الوحدات" : "Units"}</label>
                <input
                  type="number"
                  min={1}
                  max={free}
                  value={units}
                  onChange={(e) => setUnits(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full h-10 bg-muted rounded-lg px-3 font-semibold outline-none focus:ring-2 focus:ring-primary"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr ? `${free} وحدة حرة من ${pos.units}` : `${free} free of ${pos.units} units`}
                </p>
              </div>
              {mode === "market" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">{isAr ? "سعرك للوحدة ($)" : "Your price per unit ($)"}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 bg-muted rounded-lg px-3 font-semibold outline-none focus:ring-2 focus:ring-primary"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? `السعر الحالي ${money(pos.currentPrice)}` : `Current price ${money(pos.currentPrice)}`}
                  </p>
                </div>
              )}
            </div>

            {units > free && (
              <p className="text-xs text-destructive">{PART_ERRORS.exceeds_free_units[isAr ? "ar" : "en"]}</p>
            )}
            {error && units <= free && <p className="text-xs text-destructive">{error}</p>}
            {loading && !preview && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {preview && (
              <>
                <div className="p-4 bg-muted rounded-xl space-y-2 text-sm">
                  {mode === "market" && (
                    <>
                      <Line label={isAr ? "قيمة الوحدات" : "Value of the units"} value={money(preview.market.value)} />
                      <Line label={isAr ? "نصيبها من الأقساط المتبقية" : "Their share of the remaining installments"} value={`− ${money(preview.taker.remaining)}`} />
                      <Total label={isAr ? "ستستلم" : "You receive"} value={money(preview.market.cash)} />
                      <p className="text-xs text-muted-foreground">
                        {isAr
                          ? `يدفع المشتري رسوم إعادة البيع ${preview.market.feePercent}% فوق هذا المبلغ. يمكن للمشتري أخذ جزء من الوحدات المعروضة ويبقى الباقي معروضًا.`
                          : `The buyer pays the ${preview.market.feePercent}% resale fee on top. A buyer can take some of the units offered; the rest stay listed.`}
                      </p>
                    </>
                  )}
                  {mode === "lp" && (
                    <>
                      <Line
                        label={isAr ? `سعر المنصة (−${preview.lp.discountPercent}%)` : `Platform price (−${preview.lp.discountPercent}%)`}
                        value={`${units} × ${money(preview.lp.pricePerUnit)}`}
                      />
                      <Line label={isAr ? "نصيبها من الأقساط المتبقية" : "Their share of the remaining installments"} value={`− ${money(preview.taker.remaining)}`} />
                      <Line label={isAr ? `رسوم السيولة ${preview.lp.feePercent}%` : `Liquidity fee ${preview.lp.feePercent}%`} value={`− ${money(preview.lp.fee)}`} />
                      <Total label={isAr ? "ستستلم" : "You receive"} value={money(preview.lp.net)} />
                    </>
                  )}
                  {mode === "transfer" && (
                    <p className="text-muted-foreground">
                      {isAr
                        ? `المستلم يحصل على ${units} وحدة ويكمّل نصيبها من الأقساط (${money(preview.taker.remaining)} أصل). لا يُدفع لك مقابل.`
                        : `The recipient gets ${units} unit(s) and continues their share of the installments (${money(preview.taker.remaining)} principal). You aren't paid for it.`}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <ScheduleBox
                    title={mode === "transfer" ? (isAr ? "يكمّلها المستلم" : "The recipient continues") : isAr ? "يكمّلها المشتري" : "The buyer continues"}
                    units={units}
                    rows={preview.taker.schedule}
                    isAr={isAr}
                  />
                  <ScheduleBox title={isAr ? "تبقى عليك" : "You keep paying"} units={preview.keptUnits} rows={preview.keeper.schedule} isAr={isAr} />
                </div>
              </>
            )}

            <Button variant="hero" className="w-full gap-2" disabled={!canSubmit} onClick={submit}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "market"
                ? isAr ? "اعرض الوحدات للبيع" : "List these units"
                : mode === "lp"
                  ? isAr ? "أرسل طلب البيع لمزودي السيولة" : "Send the request to the liquidity providers"
                  : isAr ? "متابعة التحويل" : "Continue to the transfer"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleBox({
  title,
  units,
  rows,
  isAr,
}: {
  title: string;
  units: number;
  rows: PlanScheduleRow[];
  isAr: boolean;
}) {
  const total = rows.reduce((s, r) => s + r.charge, 0);
  return (
    <div className="rounded-lg border border-border text-xs">
      <div className="p-2 border-b border-border flex justify-between gap-2">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{isAr ? `${units} وحدة` : `${units} unit(s)`}</span>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-border">
        {rows.map((r) => (
          <div key={r.sequence} className={cn("flex justify-between px-2 py-1", r.overdue && "text-destructive")}>
            <span dir="ltr">#{r.sequence} · {r.due_date}</span>
            <span dir="ltr">{money(r.charge)}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border flex justify-between font-medium">
        <span>{isAr ? `${rows.length} قسط` : `${rows.length} installments`}</span>
        <span dir="ltr">{money(total)}</span>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span dir="ltr" className="shrink-0">{value}</span>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between pt-2 border-t border-border">
      <span className="font-medium">{label}</span>
      <span className="font-bold text-success" dir="ltr">{value}</span>
    </div>
  );
}
