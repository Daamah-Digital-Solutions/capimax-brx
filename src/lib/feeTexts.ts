import { pct } from "@/hooks/useExitTerms";
import type { ExitTerms } from "@/integrations/api/client";

/**
 * The trading-fee wording, in one place, from the fee schedule the server charges
 * (apps/secondary_market/fees.py, client document 2026-11):
 *   ordinary secondary sale        seller 0.5% · buyer 1.5%
 *   an LP buys on the LP market    seller 1.5% · LP 0% (the LP gets 0.5% of it)
 *   an LP resells its LP units     LP 0% · buyer 1.5% (the LP gets 0.5% of it)
 * French comes from fr-extra.json (templates with {0}, {1}).
 */
export const secondarySellerPct = (t: ExitTerms) => t.secondary_seller_fee_percent ?? 0.5;
export const secondaryBuyerPct = (t: ExitTerms) => t.secondary_buyer_fee_percent ?? t.secondary_fee_percent;
export const lpSellerPct = (t: ExitTerms) => t.lp_market_seller_fee_percent ?? t.fee_percent;
export const lpSharePct = (t: ExitTerms) => t.lp_fee_share_percent ?? 0.5;

/** "0.5% seller fee + 1.5% buyer fee" */
export function secondaryFees(t: ExitTerms, isAr: boolean): string {
  const s = pct(secondarySellerPct(t));
  const b = pct(secondaryBuyerPct(t));
  return isAr ? `رسوم ${s} على البائع و${b} على المشتري` : `${s} seller fee + ${b} buyer fee`;
}

/** "Seller 0.5% · Buyer 1.5%" (a short badge) */
export function secondaryFeesShort(t: ExitTerms, isAr: boolean): string {
  const s = pct(secondarySellerPct(t));
  const b = pct(secondaryBuyerPct(t));
  return isAr ? `البائع ${s} · المشتري ${b}` : `Seller ${s} · Buyer ${b}`;
}

/** "at the unit price, with a 1.5% fee paid by the seller" (+ the discount if one is set) */
export function lpExitFees(t: ExitTerms, isAr: boolean): string {
  const f = pct(lpSellerPct(t));
  if (t.discount_percent > 0) {
    const d = pct(t.discount_percent);
    return isAr
      ? `بسعر أقل من سعر الوحدة بـ ${d}، مع رسوم ${f} على البائع`
      : `at ${d} below the unit price, with a ${f} fee paid by the seller`;
  }
  return isAr ? `بسعر الوحدة الحالي، مع رسوم ${f} على البائع` : `at the current unit price, with a ${f} fee paid by the seller`;
}

/** "Seller 1.5%" (a short badge) */
export function lpFeesShort(t: ExitTerms, isAr: boolean): string {
  const f = pct(lpSellerPct(t));
  return isAr ? `البائع ${f}` : `Seller ${f}`;
}

/** What the LP gets out of the schedule, for the LP pages. */
export function lpBenefits(t: ExitTerms, isAr: boolean): string[] {
  const share = pct(lpSharePct(t));
  const lpFee = pct(lpSellerPct(t));
  const buyer = pct(secondaryBuyerPct(t));
  return isAr
    ? [
        `عند الشراء من المستثمرين في سوق مزود السيولة تدفع قيمة الحصص فقط دون رسوم شراء، ويُضاف إلى رصيدك ${share} من قيمة الصفقة من رسوم البائع (${lpFee}) بعد اكتمال التسوية.`,
        "خلال فترة الاحتفاظ تحصل على العوائد المستحقة للحصص وفق شروط الفرصة، وإذا أعدت البيع بسعر أعلى تستفيد من فرق السعر.",
        `عند إعادة بيع هذه الحصص في السوق الثانوي لا تدفع رسوم بيع، وتحصل على كامل قيمة البيع، ويُضاف إلى رصيدك ${share} من قيمة الصفقة من رسوم المشتري (${buyer}).`,
      ]
    : [
        `When you buy from investors on the LP market you pay only the value of the units, with no buying fee, and ${share} of the deal value from the seller's fee (${lpFee}) is added to your balance once the deal settles.`,
        "While you hold the units you receive the returns due on them under the opportunity's terms, and if you resell at a higher price you also gain the price difference.",
        `When you resell these units on the secondary market you pay no selling fee, you receive the full sale value, and ${share} of the deal value from the buyer's fee (${buyer}) is added to your balance.`,
      ];
}
