import { useState } from "react";
import { Layers, Loader2, TrendingDown, TrendingUp, X } from "lucide-react";
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
import { secondaryMarketApi, type InstallmentPlanRow } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

// Off-plan §6.3 (seller): an active plan valued as ONE position at today's unit price — the
// holder's share of it and their gain from their own entry price — and "Sell this position".
// A running plan's units are sold only together; the buyer takes over the installments.

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BLOCKED: Record<string, { en: string; ar: string }> = {
  below_remaining: {
    en: "At today's price the position is worth less than the remaining installments, so it can't be sold right now. Nothing is owed because of this.",
    ar: "بسعر اليوم أصبحت قيمة المركز أقل من الأقساط المتبقية، لذا لا يمكن بيعه حاليًا. ولا يترتب عليك أي مبلغ بسبب ذلك.",
  },
  not_minted: {
    en: "The position can be sold once the down payment has settled.",
    ar: "يمكن بيع المركز بعد تأكيد الدفعة المقدمة.",
  },
  not_active: {
    en: "Only an active plan can be sold.",
    ar: "يمكن بيع الخطط النشطة فقط.",
  },
  pledged: {
    en: "This plan's down payment was made with a Nova Sukuk certificate, so its units are pledged to Nova Finance and can't be sold until Nova issues its clearance.",
    ar: "دُفع مقدّم هذه الخطة بشهادة Nova Sukuk، لذا وحداتها مرهونة لصالح Nova Finance ولا يمكن بيعها حتى صدور خطاب إخلاء الطرف.",
  },
  fully_paid: {
    en: "All installments are paid — these are regular units now; sell them from the secondary market.",
    ar: "تم سداد كل الأقساط — أصبحت وحدات عادية يمكنك بيعها من السوق الثانوي.",
  },
};

export function PositionSaleCard({ plan, onChanged }: { plan: InstallmentPlanRow; onChanged: () => void }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const pos = plan.position;
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<number>(pos?.currentPrice ?? 0);
  const [busy, setBusy] = useState(false);
  if (!pos) return null;

  const value = pos.units * price;
  const cash = Math.max(0, Math.round((value - pos.remainingPrincipal) * 100) / 100);
  const floor = pos.units ? pos.remainingPrincipal / pos.units : 0;
  const fee = Math.round(cash * pos.feePercent) / 100;

  const list = async () => {
    setBusy(true);
    try {
      await secondaryMarketApi.listPosition({ plan_id: plan.id, price_per_unit: price });
      toast.success(isAr ? "تم عرض المركز في السوق الثانوي" : "Position listed on the secondary market");
      setOpen(false);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "تعذّر عرض المركز" : "Failed to list the position"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!pos.listingId) return;
    setBusy(true);
    try {
      await secondaryMarketApi.cancelListing(pos.listingId);
      toast.success(isAr ? "تم إلغاء العرض" : "Listing cancelled");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || (isAr ? "تعذّر الإلغاء" : "Failed to cancel"));
    } finally {
      setBusy(false);
    }
  };

  const gainUp = pos.gain >= 0;

  return (
    <div className="mb-6 p-4 rounded-xl border border-border bg-muted/40">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
        <Layers className="w-4 h-4 text-primary" />
        {isAr ? "مركزك اليوم" : "Your position today"}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
        <Stat label={isAr ? "سعر الوحدة الآن" : "Unit price now"} value={money(pos.currentPrice)} />
        <Stat
          label={isAr ? "قيمة المركز" : "Position value"}
          value={money(pos.value)}
          hint={`${pos.units} × ${money(pos.currentPrice)}`}
        />
        <Stat label={isAr ? "نصيبك منه" : "Your share"} value={money(pos.equity)} />
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">{isAr ? "ربحك" : "Your gain"}</div>
          <div className={cn("font-semibold flex items-center gap-1", gainUp ? "text-success" : "text-destructive")} dir="ltr">
            {gainUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {gainUp ? "+" : "−"}{money(Math.abs(pos.gain))}
          </div>
        </div>
      </div>

      {pos.listingId ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <span>
            {isAr
              ? `معروض للبيع بسعر ${money(pos.listingPrice ?? 0)} للوحدة — ستستلم ${money(pos.listingCash ?? 0)}. يزيد المبلغ بأصل كل قسط تسدده أثناء العرض.`
              : `Listed at ${money(pos.listingPrice ?? 0)} per unit — you'd receive ${money(pos.listingCash ?? 0)}. It rises by each installment you pay while listed.`}
          </span>
          <Button variant="outline" size="sm" className="gap-1 shrink-0" disabled={busy} onClick={cancel}>
            <X className="w-4 h-4" />
            {isAr ? "إلغاء العرض" : "Cancel listing"}
          </Button>
        </div>
      ) : pos.blocked ? (
        <p className="text-xs text-muted-foreground">
          {(BLOCKED[pos.blocked] ?? BLOCKED.not_active)[isAr ? "ar" : "en"]}
        </p>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            setPrice(pos.currentPrice);
            setOpen(true);
          }}
        >
          <Layers className="w-4 h-4" />
          {isAr ? "بيع هذا المركز" : "Sell this position"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "بيع المركز" : "Sell this position"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "تُباع الخطة كاملة: كل وحداتها، والمشتري يتولى سداد الأقساط المتبقية."
                : "The whole plan is sold: all its units, and the buyer takes over the remaining installments."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {isAr ? "سعر البيع للوحدة ($)" : "Your price per unit ($)"}
              </label>
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
                {isAr
                  ? `السعر الحالي ${money(pos.currentPrice)} (سعر استرشادي)`
                  : `Current price ${money(pos.currentPrice)} (guide price)`}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-xl space-y-2 text-sm">
              <Line label={isAr ? "قيمة المركز" : "Position value"} value={money(value)} />
              <Line label={isAr ? "الأقساط المتبقية (أصل)" : "Remaining installments (principal)"} value={`− ${money(pos.remainingPrincipal)}`} />
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-medium">{isAr ? "ستستلم" : "You receive"}</span>
                <span className="font-bold text-success" dir="ltr">{money(cash)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? `يدفع المشتري رسوم إعادة البيع ${pos.feePercent}% (${money(fee)}) فوق هذا المبلغ. رسوم التقسيط التي دفعتها لا تُسترد.`
                  : `The buyer pays the ${pos.feePercent}% resale fee (${money(fee)}) on top. Installment fees you paid are not refunded.`}
              </p>
            </div>
            {cash <= 0 && (
              <p className="text-xs text-destructive">
                {isAr
                  ? `يجب أن يغطي السعر الأقساط المتبقية: أعلى من ${money(floor)} للوحدة.`
                  : `The price must cover the remaining installments: above ${money(floor)} per unit.`}
              </p>
            )}
            <Button variant="hero" className="w-full gap-2" disabled={busy || cash <= 0} onClick={list}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {isAr ? "اعرض المركز للبيع" : "List this position"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="font-semibold text-foreground" dir="ltr">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground" dir="ltr">{hint}</div>}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span dir="ltr">{value}</span>
    </div>
  );
}
