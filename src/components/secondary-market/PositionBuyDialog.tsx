import { useState } from "react";
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
import type { SecondaryListing } from "@/hooks/useSecondaryMarket";

// Off-plan §6.3 (buyer): the full breakdown of an installment position + every installment
// the buyer takes over, and an explicit commitment before paying. The amounts shown are the
// server's; the buy sends them back and is refused if they moved (POSITION_CHANGED).

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
          <DialogTitle>{isAr ? "شراء مركز تقسيط" : "Buy installment position"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "تدفع للبائع الآن، وتنتقل إليك خطة الأقساط بكل وحداتها وأقساطها المتبقية بنفس مواعيدها."
              : "You pay the seller now and take over the plan: all its units and its remaining installments on the same dates."}
          </DialogDescription>
        </DialogHeader>

        {listing && terms && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-xl space-y-2 text-sm">
              <div className="font-medium text-foreground">{listing.property_name}</div>
              <Row
                label={isAr ? "قيمة المركز" : "Position value"}
                hint={`${listing.token_amount} × ${money(listing.unit_price)}`}
                value={money(listing.position_value ?? 0)}
              />
              <Row
                label={isAr ? "الأقساط المتبقية (أصل)" : "Remaining installments (principal)"}
                value={`− ${money(listing.assumed_principal ?? 0)}`}
              />
              <Row label={isAr ? "تدفعه للبائع" : "Paid to the seller"} value={money(listing.total_value)} strong />
              <Row
                label={isAr ? `رسوم إعادة البيع (${listing.platform_fee_percent}%)` : `Resale fee (${listing.platform_fee_percent}%)`}
                value={`+ ${money(listing.platform_fee_amount)}`}
              />
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">{isAr ? "تدفع الآن" : "You pay now"}</span>
                <span className="font-bold text-primary" dir="ltr">{money(listing.buyer_total)}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {isAr
                ? `المدفوع على الخطة حتى الآن ${money(listing.paid_principal ?? 0)}`
                : `${money(listing.paid_principal ?? 0)} paid on the plan so far`}
              {terms.price_change_pct != null && (
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
                  ? `${terms.remaining_installments} قسطًا تتولى سدادها · الإجمالي ${money(terms.remaining_charge)}`
                  : `${terms.remaining_installments} installments you take over · total ${money(terms.remaining_charge)}`}
              </div>
              {terms.fee_rate > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  {isAr
                    ? `يشمل رسوم التقسيط ${terms.fee_rate}% المثبّتة على كل قسط.`
                    : `Includes the ${terms.fee_rate}% installment fee fixed on each installment.`}
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
                    {terms.rows.map((r) => (
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

            {terms.overdue_installments > 0 && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <span>
                  {isAr
                    ? `${terms.overdue_installments} قسط متأخر على البائع سيصبح عليك ويُخصم من محفظتك في أول خصم تلقائي.`
                    : `${terms.overdue_installments} overdue installment(s) become yours and are debited from your wallet at the next auto-debit.`}
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
              disabled={!agreed || buying}
              onClick={() => onConfirm(listing)}
            >
              {buying && <Loader2 className="w-4 h-4 animate-spin" />}
              {balance >= listing.buyer_total
                ? isAr
                  ? `ادفع ${money(listing.buyer_total)} واستلم الخطة`
                  : `Pay ${money(listing.buyer_total)} and take over the plan`
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
