import { CreditCard, Smartphone, Wallet, Coins, FileText, Shield, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentMethod, InvestmentData } from "@/pages/Checkout";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMethod: PaymentMethod | null;
  investment: InvestmentData;
  finalAmount: number;
  pronovaDiscount: number;
  onConfirm: () => void;
}

const methodIcons: Record<PaymentMethod, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  apple_pay: Smartphone,
  google_pay: Wallet,
  crypto: Coins,
  pronova: Coins,
  sukuk: FileText,
  balance: Wallet,
};

const methodNames: Record<PaymentMethod, { en: string; ar: string }> = {
  card: { en: "Credit/Debit Card", ar: "بطاقة ائتمان / خصم" },
  apple_pay: { en: "Apple Pay", ar: "Apple Pay" },
  google_pay: { en: "Google Pay", ar: "Google Pay" },
  crypto: { en: "Cryptocurrency", ar: "العملات الرقمية" },
  pronova: { en: "Pronova Token", ar: "توكن برونوفا" },
  sukuk: { en: "Nova Sukuk", ar: "صكوك نوفا" },
  balance: { en: "Pay from Balance", ar: "الدفع من الرصيد" },
};

export function PaymentConfirmationModal({
  open,
  onOpenChange,
  selectedMethod,
  investment,
  finalAmount,
  pronovaDiscount,
  onConfirm,
}: PaymentConfirmationModalProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";

  if (!selectedMethod) return null;

  const Icon = methodIcons[selectedMethod];
  const method = methodNames[selectedMethod];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {isArabic ? "تأكيد الدفع" : "Confirm Payment"}
          </DialogTitle>
          <DialogDescription>
            {isArabic
              ? "يرجى مراجعة تفاصيل الدفع قبل التأكيد"
              : "Please review the payment details before confirming"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Property */}
          <div className="p-4 bg-muted rounded-xl">
            <div className="text-sm text-muted-foreground mb-1">
              {isArabic ? "العقار" : "Property"}
            </div>
            <div className="font-semibold text-foreground">
              {isArabic ? investment.propertyNameAr : investment.propertyName}
            </div>
          </div>

          {/* Payment Method */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                {isArabic ? "طريقة الدفع" : "Payment method"}
              </div>
              <div className="font-semibold text-foreground">
                {isArabic ? method.ar : method.en}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">
                {isArabic ? "المبلغ الإجمالي" : "Total amount"}
              </span>
              <span className="text-2xl font-bold text-gradient-gold">
                ${finalAmount.toLocaleString()}
              </span>
            </div>
            {pronovaDiscount > 0 && (
              <Badge className="bg-success text-success-foreground">
                {isArabic
                  ? `خصم 5% مُطبق (-$${pronovaDiscount.toLocaleString()})`
                  : `5% discount applied (-$${pronovaDiscount.toLocaleString()})`}
              </Badge>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {isArabic
                ? 'بالنقر على "تأكيد الدفع"، أنت توافق على إتمام هذه المعاملة. لا يمكن إلغاء المعاملة بعد التأكيد.'
                : 'By clicking "Confirm Payment", you agree to complete this transaction. It cannot be cancelled after confirmation.'}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button variant="hero" onClick={onConfirm} className="flex-1">
            {isArabic ? "تأكيد الدفع" : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}