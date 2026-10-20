import { Building2, Tag, Percent, DollarSign, Edit3 } from "lucide-react";
import { propertyLabel } from "@/lib/propertyLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvestmentData } from "@/pages/Checkout";
import { useLanguage } from "@/contexts/LanguageContext";

interface InvestmentSummaryPanelProps {
  investment: InvestmentData;
  pronovaDiscount: number;
  // Reinvestment (wallet purchase) discount, and the family-rate switch when eligible.
  reinvest?: {
    amount: number;
    rate: number;
    familyEligible: boolean;
    family: boolean;
    familyRate: number;
    onFamilyChange: (v: boolean) => void;
  };
  finalAmount: number;
  onEdit: () => void;
  /**
   * Off-plan §4 installment purchase: what is charged NOW is the down payment + the
   * installment fee on it (no platform/management fee). Omitted for a full purchase.
   */
  installment?: { downPayment: number; downPct: number; feeRate: number; fee: number };
}

export function InvestmentSummaryPanel({
  investment,
  pronovaDiscount,
  reinvest,
  finalAmount,
  onEdit,
  installment,
}: InvestmentSummaryPanelProps) {
  const { t, language } = useLanguage();
  const propertyName = language === "ar" ? investment.propertyNameAr : investment.propertyName;
  const assetType = propertyLabel(investment.assetTypeEn || investment.assetType, language === "ar");

  return (
    <div className="sticky top-24 p-6 bg-card rounded-2xl border border-border shadow-card animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {t("checkout.investmentSummary")}
        </h2>
        <Button variant="ghost" size="sm" onClick={onEdit} className="gap-2">
          <Edit3 className="w-4 h-4" />
          {t("checkout.edit")}
        </Button>
      </div>

      {/* Property Info */}
      <div className="p-4 bg-muted rounded-xl mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {propertyName}
            </h3>
            <Badge variant="secondary" className="mt-2">
              {assetType}
            </Badge>
          </div>
        </div>
      </div>

      {/* Investment Details */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between py-2">
          <span className="text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            {t("checkout.investmentAmount")}
          </span>
          <span className="font-semibold text-foreground">
            ${investment.investmentAmount.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-2">
            <Tag className="w-4 h-4" />
            {t("checkout.numberOfUnits")}
          </span>
          <span className="font-semibold text-foreground">
            {investment.units} {language === "ar" ? "وحدات" : "units"}
          </span>
        </div>

        {installment ? (
          <>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-muted-foreground">
                {language === "ar"
                  ? `الدفعة المقدمة الآن (${installment.downPct}%)`
                  : `Down payment now (${installment.downPct}%)`}
              </span>
              <span className="text-foreground">${installment.downPayment.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-muted-foreground">
                {language === "ar"
                  ? `رسوم التقسيط (${installment.feeRate}%)`
                  : `Installment fee (${installment.feeRate}%)`}
              </span>
              <span className="text-foreground">${installment.fee.toLocaleString()}</span>
            </div>
          </>
        ) : (
          <>
        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-muted-foreground">{t("checkout.platformFee")} (1.5%)</span>
          <span className="text-foreground">
            ${investment.platformFee.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-border">
          <span className="text-muted-foreground">{t("checkout.managementFee")} (0.5%)</span>
          <span className="text-foreground">
            ${investment.managementFee.toLocaleString()}
          </span>
        </div>
          </>
        )}

        {reinvest && (
          <div className="py-2 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-success flex items-center gap-2">
                <Percent className="w-4 h-4" />
                {language === "ar" ? "خصم إعادة الاستثمار" : "Reinvestment discount"} ({reinvest.rate}%)
              </span>
              <span className="font-semibold text-success" dir="ltr">
                -${reinvest.amount.toLocaleString()}
              </span>
            </div>
            {reinvest.familyEligible && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={reinvest.family}
                  onChange={(e) => reinvest.onFamilyChange(e.target.checked)}
                />
                {language === "ar"
                  ? `إعادة استثمار عائلية (خصم ${reinvest.familyRate}%)`
                  : `Family reinvestment (${reinvest.familyRate}% discount)`}
              </label>
            )}
          </div>
        )}

        {pronovaDiscount > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-success flex items-center gap-2">
              <Percent className="w-4 h-4" />
              {t("checkout.pronovaDiscount")} (5%)
            </span>
            <span className="font-semibold text-success">
              -${pronovaDiscount.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/30">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">{t("checkout.totalAmount")}</span>
          <div className="text-end">
            {pronovaDiscount > 0 && (
              <span className="text-sm text-muted-foreground line-through block">
                ${(installment ? installment.downPayment + installment.fee : investment.totalPayable).toLocaleString()}
              </span>
            )}
            <span className="text-2xl font-bold text-gradient-gold">
              ${finalAmount.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2 text-center">
          {t("checkout.currency")}: {investment.currency}
        </div>
      </div>

      {/* Discount Badge */}
      {pronovaDiscount > 0 && (
        <div className="mt-4 p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center">
            <Percent className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-success">{t("checkout.discountApplied")}</p>
            <p className="text-xs text-muted-foreground">{t("checkout.pronovaPayment")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
