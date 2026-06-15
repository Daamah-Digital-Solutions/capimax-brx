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
};

const methodNames: Record<PaymentMethod, string> = {
  card: "بطاقة ائتمان / خصم",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  crypto: "العملات الرقمية",
  pronova: "توكن برونوفا",
  sukuk: "صكوك نوفا",
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
  if (!selectedMethod) return null;

  const Icon = methodIcons[selectedMethod];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            تأكيد الدفع
          </DialogTitle>
          <DialogDescription>
            يرجى مراجعة تفاصيل الدفع قبل التأكيد
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Property */}
          <div className="p-4 bg-muted rounded-xl">
            <div className="text-sm text-muted-foreground mb-1">العقار</div>
            <div className="font-semibold text-foreground">{investment.propertyNameAr}</div>
          </div>

          {/* Payment Method */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">طريقة الدفع</div>
              <div className="font-semibold text-foreground">{methodNames[selectedMethod]}</div>
            </div>
          </div>

          {/* Amount */}
          <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground">المبلغ الإجمالي</span>
              <span className="text-2xl font-bold text-gradient-gold">
                ${finalAmount.toLocaleString()}
              </span>
            </div>
            {pronovaDiscount > 0 && (
              <Badge className="bg-success text-success-foreground">
                خصم 5% مُطبق (-${pronovaDiscount.toLocaleString()})
              </Badge>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              بالنقر على "تأكيد الدفع"، أنت توافق على إتمام هذه المعاملة. 
              لا يمكن إلغاء المعاملة بعد التأكيد.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            إلغاء
          </Button>
          <Button variant="hero" onClick={onConfirm} className="flex-1">
            تأكيد الدفع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}