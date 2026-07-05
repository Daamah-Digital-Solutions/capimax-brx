import { Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { NovaFinancePledgeNotice } from "@/components/legal/NovaFinancePledgeNotice";

interface PronovaPaymentProps {
  totalAmount: number;
  discount: number;
}

// The Pronova method's in-selector EXPLAINER (branded discount + breakdown). The actual
// settlement happens in PronovaCheckout (the action area): a real Stripe charge for the
// discounted total, credited to the owner in full with the platform absorbing the discount.
// This panel is display-only — the old mock balance + connected-wallet blocks were removed
// (they showed fabricated figures the flow never used).
export function PronovaPayment({ totalAmount, discount }: PronovaPaymentProps) {
  const { t } = useLanguage();
  const finalAmount = totalAmount - discount;

  return (
    <div className="space-y-4">
      {/* Discount Highlight */}
      <div className="p-4 bg-gradient-to-r from-success/20 to-success/10 rounded-xl border border-success/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
            <Percent className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-success flex items-center gap-2">
              {t("pronova.discountApplied")}
              <Badge className="bg-success text-success-foreground">
                {t("pronova.saving")} ${discount.toLocaleString()}
              </Badge>
            </h4>
            <p className="text-sm text-muted-foreground">
              {t("pronova.exclusiveDiscount")}
            </p>
          </div>
        </div>
      </div>

      {/* Amount Breakdown */}
      <div className="p-4 bg-muted rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("pronova.originalAmount")}</span>
          <span className="text-foreground line-through">${totalAmount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-success">
          <span className="flex items-center gap-2">
            <Percent className="w-4 h-4" />
            {t("pronova.discountPercent")}
          </span>
          <span>-${discount.toLocaleString()}</span>
        </div>
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <span className="font-semibold text-foreground">{t("pronova.finalAmount")}</span>
          <span className="text-xl font-bold text-gradient-gold">
            ${finalAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Mandatory Pledge / Mortgage Disclosure */}
      <NovaFinancePledgeNotice />
    </div>
  );
}
