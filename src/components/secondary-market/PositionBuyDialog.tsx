import { useEffect, useState } from "react";
import { localName } from "@/lib/propertyLabels";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { secondaryMarketApi, type PlanPartQuote } from "@/integrations/api/client";
import type { SecondaryListing } from "@/hooks/useSecondaryMarket";

// Off-plan §6.3 (buyer): the full breakdown of an installment position + every installment
// the buyer takes over, and an explicit commitment before paying. The amounts shown are the
// server's; the buy sends them back and is refused if they moved (POSITION_CHANGED).
//
// A PART listing (some units of a plan): the buyer chooses how many of the offered units to
// take; the figures and the schedule they continue come from the server's quote for exactly
// that many units (GET /secondary-market/{id}/plan-part/?units=N).

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  listing: SecondaryListing | null;
  balance: number;
  buying: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (listing: SecondaryListing) => void;
}

export function PositionBuyDialog({ listing, balance, buying, onOpenChange, onConfirm }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [agreed, setAgreed] = useState(false);
  const terms = listing?.position;
  const isPart = !!listing?.plan_part;
  const [units, setUnits] = useState(1);
  const [quote, setQuote] = useState<PlanPartQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    setUnits(1);
    setQuote(null);
    setQuoteError(null);
  }, [listing?.id]);

  useEffect(() => {
    if (!listing || !isPart || units < 1 || units > listing.token_amount) {
      setQuote(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      secondaryMarketApi
        .planPartQuote(listing.id, units)
        .then((q) => {
          if (!live) return;
          setQuote(q);
          setQuoteError(null);
        })
        .catch((e) => {
          if (!live) return;
          setQuote(null);
          setQuoteError(e?.message || (isAr ? "تعذّر حساب المبلغ" : "Could not price these units"));
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [listing?.id, isPart, units, listing?.token_amount, isAr]);

  // One view over either the whole position (listing figures) or the chosen part (its quote).
  const view = !listing
    ? null
    : isPart
      ? quote && {
          units: quote.units,
          price: quote.price_per_unit,
          value: quote.position_value,
          assumed: quote.assumed_principal,
          paid: quote.paid_principal,
          cash: quote.cash,
          feePct: quote.fee_percent,
          fee: quote.fee,
          total: quote.buyer_total,
          rows: quote.schedule,
          remainingCharge: quote.remaining_charge,
        }
      : {
          units: listing.token_amount,
          price: listing.unit_price,
          value: listing.position_value ?? 0,
          assumed: listing.assumed_principal ?? 0,
          paid: listing.paid_principal ?? 0,
          cash: listing.total_value,
          feePct: listing.platform_fee_percent,
          fee: listing.platform_fee_amount,
          total: listing.buyer_total,
          rows: terms?.rows ?? [],
          remainingCharge: terms?.remaining_charge ?? 0,
        };
  const overdue = (view?.rows ?? []).filter((r) => r.overdue).length;
  // A part can't be bought while the seller has an overdue installment (they pay it first).
  const partBlocked = isPart && overdue > 0;

  const confirm = () => {
    if (!listing || !view) return;
    onConfirm(
      isPart
        ? { ...listing, token_amount: view.units, total_value: view.cash, platform_fee_amount: view.fee, buyer_total: view.total }
        : listing,
    );
  };

  return (
    <Dialog
      open={!!listing}
      onOpenChange={(o) => {
        if (!o) setAgreed(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isPart ? (isAr ? "شراء وحدات من خطة تقسيط" : "Buy units of an installment plan") : isAr ? "شراء مركز تقسيط" : "Buy installment position"}
          </DialogTitle>
          <DialogDescription>
            {isPart
              ? isAr
                ? `اختر عدد الوحدات من ${listing?.token_amount} وحدة معروضة. تدفع للبائع الآن، وتصبح باسمك خطة بهذه الوحدات: نصيبها من كل قسط متبقٍ بنفس المواعيد.`
                : `Choose how many of the ${listing?.token_amount} units offered. You pay the seller now and get a plan in your name for those units: their share of every remaining installment, on the same dates.`
              : isAr
                ? "تدفع للبائع الآن، وتنتقل إليك خطة الأقساط بكل وحداتها وأقساطها المتبقية بنفس مواعيدها."
                : "You pay the seller now and take over the plan: all its units and its remaining installments on the same dates."}
          </DialogDescription>
        </DialogHeader>

        {listing && isPart && (
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1.5">{isAr ? "عدد الوحدات" : "Units"}</label>
            <input
              type="number"
              min={1}
              max={listing.token_amount}
              value={units}
              onChange={(e) => setUnits(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="w-full h-10 bg-muted rounded-lg px-3 font-semibold outline-none focus:ring-2 focus:ring-primary"
              dir="ltr"
            />
            {(units < 1 || units > listing.token_amount) && (
              <p className="text-xs text-destructive mt-1">
                {isAr ? `اختر من 1 إلى ${listing.token_amount}` : `Choose 1 to ${listing.token_amount}`}
              </p>
            )}
            {quoteError && <p className="text-xs text-destructive mt-1">{quoteError}</p>}
          </div>
        )}

        {listing && isPart && !view && !quoteError && units >= 1 && units <= listing.token_amount && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {listing && view && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-xl space-y-2 text-sm">
              <div className="font-medium text-foreground">{localName(listing, language)}</div>
              <Row
                label={isPart ? (isAr ? "قيمة الوحدات" : "Value of the units") : isAr ? "قيمة المركز" : "Position value"}
                hint={`${view.units} × ${money(view.price)}`}
                value={money(view.value)}
              />
              <Row
                label={isAr ? "الأقساط المتبقية (أصل)" : "Remaining installments (principal)"}
                value={`− ${money(view.assumed)}`}
              />
              <Row label={isAr ? "تدفعه للبائع" : "Paid to the seller"} value={money(view.cash)} strong />
              <Row
                label={isAr ? `رسوم إعادة البيع (${view.feePct}%)` : `Resale fee (${view.feePct}%)`}
                value={`+ ${money(view.fee)}`}
              />
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">{isAr ? "تدفع الآن" : "You pay now"}</span>
                <span className="font-bold text-primary" dir="ltr">{money(view.total)}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {isPart
                ? isAr
                  ? `نصيب هذه الوحدات مما دُفع على الخطة حتى الآن ${money(view.paid)}`
                  : `${money(view.paid)} paid so far on these units' share of the plan`
                : isAr
                  ? `المدفوع على الخطة حتى الآن ${money(view.paid)}`
                  : `${money(view.paid)} paid on the plan so far`}
              {terms?.price_change_pct != null && (
                <>
                  {" · "}
                  {isAr ? "تغيّر السعر منذ بداية الخطة: " : "price change since the plan started: "}
                  <span dir="ltr">{terms.price_change_pct > 0 ? "+" : ""}{terms.price_change_pct}%</span>
                </>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <CalendarClock className="w-4 h-4" />
                {isAr
                  ? `${view.rows.length} قسطًا تتولى سدادها · الإجمالي ${money(view.remainingCharge)}`
                  : `${view.rows.length} installments you take over · total ${money(view.remainingCharge)}`}
              </div>
              {(terms?.fee_rate ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  {isAr
                    ? `يشمل رسوم التقسيط ${terms!.fee_rate}% المثبّتة على كل قسط.`
                    : `Includes the ${terms!.fee_rate}% installment fee fixed on each installment.`}
                </p>
              )}
              <div className="rounded-xl border border-border overflow-x-auto max-h-56">
                <table className="w-full text-xs min-w-[360px]">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-start font-medium px-3 py-2">#</th>
                      <th className="text-start font-medium px-3 py-2">{isAr ? "التاريخ" : "Due"}</th>
                      <th className="text-end font-medium px-3 py-2">{isAr ? "القسط" : "Amount"}</th>
                      <th className="text-end font-medium px-3 py-2">{isAr ? "الرسوم" : "Fee"}</th>
                      <th className="text-end font-medium px-3 py-2">{isAr ? "المستحق" : "Total"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((r) => (
                      <tr key={r.sequence} className="border-t border-border">
                        <td className="px-3 py-1.5 text-muted-foreground">{r.sequence}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {r.due_date}
                          {r.overdue && (
                            <span className="ms-1 text-destructive">{isAr ? "(متأخر)" : "(overdue)"}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-end" dir="ltr">{money(r.amount)}</td>
                        <td className="px-3 py-1.5 text-end text-muted-foreground" dir="ltr">{money(r.fee)}</td>
                        <td className="px-3 py-1.5 text-end font-medium" dir="ltr">{money(r.charge)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {overdue > 0 && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <span>
                  {partBlocked
                    ? isAr
                      ? "على البائع قسط متأخر في هذه الخطة. يمكن الشراء بعد أن يسدده."
                      : "The seller has an overdue installment on this plan. These units can be bought once it is paid."
                    : isAr
                      ? `${overdue} قسط متأخر على البائع سيصبح عليك ويُخصم من محفظتك في أول خصم تلقائي.`
                      : `${overdue} overdue installment(s) become yours and are debited from your wallet at the next auto-debit.`}
                </span>
              </div>
            )}

            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <span>
                {isAr
                  ? "أوافق على استكمال الأقساط المتبقية في مواعيدها، وتُخصم من محفظتي تلقائيًا."
                  : "I agree to pay the remaining installments on their due dates, debited from my wallet automatically."}
              </span>
            </label>

            <Button
              variant="hero"
              className="w-full gap-2"
              disabled={!agreed || buying || partBlocked}
              onClick={confirm}
            >
              {buying && <Loader2 className="w-4 h-4 animate-spin" />}
              {balance >= view.total
                ? isAr
                  ? `ادفع ${money(view.total)} واستلم الخطة`
                  : `Pay ${money(view.total)} and take over the plan`
                : isAr
                  ? "اشحن واشترِ"
                  : "Add funds & buy"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="ms-1 text-xs" dir="ltr">({hint})</span>}
      </span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"} dir="ltr">
        {value}
      </span>
    </div>
  );
}
