import { BadgePercent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExitTerms, pct } from "@/hooks/useExitTerms";
import { useLanguage } from "@/contexts/LanguageContext";
import { lpBenefits, lpSellerPct, lpSharePct, secondaryBuyerPct } from "@/lib/feeTexts";

/**
 * How a liquidity provider gains from the 2026-11 fee schedule: no buying fee on the LP market,
 * no selling fee when reselling those units, a share of both deals' fees, the returns while
 * holding and the price difference — with the client's worked example. Rates from the server.
 */
export function LPFeeBenefitsCard() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const terms = useExitTerms();
  const share = lpSharePct(terms);
  const buyIn = 10000;
  const resale = 11000;
  const shareBuy = (buyIn * share) / 100;
  const shareSell = (resale * share) / 100;
  const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BadgePercent className="w-5 h-5 text-primary" />
          {isAr ? "كيف تستفيد كمزود سيولة" : "How you gain as a liquidity provider"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal ps-5">
          {lpBenefits(terms, isAr).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <div className="rounded-lg bg-background/60 border border-border p-3 text-sm space-y-1">
          <p className="font-medium">{isAr ? "مثال" : "Example"}</p>
          <p className="text-muted-foreground">
            {isAr
              ? `تشتري حصصًا بقيمة ${money(buyIn)} (يستلم البائع ${money(buyIn - (buyIn * lpSellerPct(terms)) / 100)} بعد رسومه ${pct(lpSellerPct(terms))})، وتُضاف إلى رصيدك ${money(shareBuy)}. ثم تعيد بيعها في السوق الثانوي بـ ${money(resale)} (يدفع المشتري ${money(resale + (resale * secondaryBuyerPct(terms)) / 100)})، فيُقيَّد لك ${money(resale + shareSell)}.`
              : `You buy units worth ${money(buyIn)} (the seller receives ${money(buyIn - (buyIn * lpSellerPct(terms)) / 100)} after its ${pct(lpSellerPct(terms))} fee) and ${money(shareBuy)} is added to your balance. You then resell them on the secondary market for ${money(resale)} (the buyer pays ${money(resale + (resale * secondaryBuyerPct(terms)) / 100)}), and ${money(resale + shareSell)} is credited to you.`}
          </p>
          <p className="font-semibold text-success">
            {isAr
              ? `إجمالي استفادتك ${money(resale - buyIn + shareBuy + shareSell)}: ${money(resale - buyIn)} فرق السعر و${money(shareBuy + shareSell)} حصتك من الرسوم، إضافة إلى العوائد المستحقة خلال فترة الاحتفاظ.`
              : `Your total gain is ${money(resale - buyIn + shareBuy + shareSell)}: ${money(resale - buyIn)} price difference and ${money(shareBuy + shareSell)} your share of the fees, plus any returns due while you hold the units.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
