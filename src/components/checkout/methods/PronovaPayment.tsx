import { Coins, Percent, Check, Wallet, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { NovaFinancePledgeNotice } from "@/components/legal/NovaFinancePledgeNotice";

interface PronovaPaymentProps {
  totalAmount: number;
  discount: number;
}

export function PronovaPayment({ totalAmount, discount }: PronovaPaymentProps) {
  const { t, isRTL } = useLanguage();
  const finalAmount = totalAmount - discount;
  
  // Mock user balance
  const userBalance = 10000;
  const hasEnoughBalance = userBalance >= finalAmount;

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
            ${finalAmount.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">PNOVA</span>
          </span>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${hasEnoughBalance ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasEnoughBalance ? 'bg-success/20' : 'bg-destructive/20'}`}>
          {hasEnoughBalance ? (
            <Check className="w-5 h-5 text-success" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">{t("pronova.balance")}</span>
            <span className={`font-bold ${hasEnoughBalance ? 'text-success' : 'text-destructive'}`}>
              {userBalance.toLocaleString()} PNOVA
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {hasEnoughBalance 
              ? t("pronova.sufficientBalance")
              : t("pronova.insufficientBalance")
            }
          </p>
        </div>
      </div>

      {/* Wallet Connection (UI Only) */}
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
        <Wallet className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <span className="text-sm font-medium text-foreground">{t("pronova.connectedWallet")}</span>
          <p className="text-xs text-muted-foreground font-mono">0x7a23...f3a4</p>
        </div>
        <Badge variant="secondary" className="text-xs">{t("pronova.connected")}</Badge>
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground text-center">
        {t("pronova.deductionNote")}
      </p>

      {/* Mandatory Pledge / Mortgage Disclosure */}
      <NovaFinancePledgeNotice />
    </div>
  );
}
