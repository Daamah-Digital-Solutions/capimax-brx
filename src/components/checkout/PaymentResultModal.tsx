import { Check, X, RefreshCw, ArrowRight, Coins, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentMethod, PaymentStatus, InvestmentData } from "@/pages/Checkout";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

interface PaymentResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: PaymentStatus;
  investment: InvestmentData;
  finalAmount: number;
  selectedMethod: PaymentMethod | null;
  onRetry: () => void;
  onGoToPortfolio: () => void;
  tokensMinted?: boolean;
}

const methodNames: Record<PaymentMethod, { en: string; ar: string }> = {
  card: { en: "Credit/Debit Card", ar: "بطاقة ائتمان / خصم" },
  apple_pay: { en: "Apple Pay", ar: "Apple Pay" },
  google_pay: { en: "Google Pay", ar: "Google Pay" },
  crypto: { en: "Cryptocurrency", ar: "العملات الرقمية" },
  pronova: { en: "Pronova Token", ar: "توكن برونوفا" },
  sukuk: { en: "Nova Sukuk", ar: "صكوك نوفا" },
  balance: { en: "Pay from Balance", ar: "الدفع من الرصيد" },
};

export function PaymentResultModal({
  open,
  onOpenChange,
  status,
  investment,
  finalAmount,
  selectedMethod,
  onRetry,
  onGoToPortfolio,
  tokensMinted = false,
}: PaymentResultModalProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const isSuccess = status === "success";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Accessible title for screen readers; the visible heading is the h2 below. */}
        <DialogTitle className="sr-only">
          {isSuccess
            ? isArabic ? "تم الدفع بنجاح" : "Payment Successful"
            : isArabic ? "فشل الدفع" : "Payment Failed"}
        </DialogTitle>
        <div className="flex flex-col items-center text-center py-6">
          {/* Status Icon */}
          <div
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mb-6",
              isSuccess ? "bg-success/20" : "bg-destructive/20"
            )}
          >
            {isSuccess ? (
              <Check className="w-10 h-10 text-success" />
            ) : (
              <X className="w-10 h-10 text-destructive" />
            )}
          </div>

          {/* Title */}
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            {isSuccess 
              ? (isArabic ? "تم الدفع بنجاح!" : "Payment Successful!") 
              : (isArabic ? "فشل الدفع" : "Payment Failed")}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isSuccess
              ? (isArabic 
                  ? "تم تأكيد استثمارك وإضافته إلى محفظتك" 
                  : "Your investment has been confirmed and added to your portfolio")
              : (isArabic 
                  ? "حدث خطأ أثناء معالجة الدفع. يرجى المحاولة مرة أخرى." 
                  : "An error occurred while processing payment. Please try again.")}
          </p>

          {/* Token Minting Status */}
          {isSuccess && (
            <div className="w-full mb-4">
              {tokensMinted ? (
                <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <Coins className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-500">
                    {isArabic ? "تم إصدار رموز الملكية!" : "Ownership tokens minted!"}
                  </span>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {investment.units} {isArabic ? "رمز" : "tokens"}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Wallet className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm text-yellow-500">
                    {isArabic
                      ? "إصدار الرموز قيد المعالجة — تابع الحالة في محفظتك"
                      : "Token minting is pending — track it in your wallet"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Details */}
          {isSuccess && (
            <div className="w-full p-4 bg-muted rounded-xl mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {isArabic ? "العقار" : "Property"}
                </span>
                <span className="font-medium text-foreground">
                  {isArabic ? investment.propertyNameAr : investment.propertyName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {isArabic ? "طريقة الدفع" : "Payment Method"}
                </span>
                <span className="font-medium text-foreground">
                  {selectedMethod && (isArabic ? methodNames[selectedMethod].ar : methodNames[selectedMethod].en)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {isArabic ? "المبلغ المدفوع" : "Amount Paid"}
                </span>
                <span className="font-bold text-primary">${finalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {isArabic ? "الوحدات المُشتراة" : "Units Purchased"}
                </span>
                <span className="font-medium text-foreground">
                  {investment.units} {isArabic ? "وحدات" : "units"}
                </span>
              </div>
            </div>
          )}

          {/* Transaction ID for success */}
          {isSuccess && (
            <div className="w-full p-3 bg-success/10 border border-success/30 rounded-lg mb-6">
              <p className="text-xs text-muted-foreground mb-1">
                {isArabic ? "رقم المعاملة" : "Transaction ID"}
              </p>
              <p className="font-mono text-sm text-foreground">TXN-{Date.now()}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3">
          {isSuccess ? (
            <>
              <Button variant="hero" className="w-full" onClick={onGoToPortfolio}>
                {isArabic ? "الذهاب إلى المحفظة" : "Go to Portfolio"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {!tokensMinted && (
                <Link to="/portfolio?tab=wallet" className="w-full">
                  <Button variant="outline" className="w-full gap-2">
                    <Wallet className="w-4 h-4" />
                    {isArabic ? "عرض المحفظة وحالة الرموز" : "View Wallet & Token Status"}
                  </Button>
                </Link>
              )}
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                {isArabic ? "إغلاق" : "Close"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="hero" className="w-full" onClick={onRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {isArabic ? "إعادة المحاولة" : "Try Again"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                {isArabic ? "تغيير طريقة الدفع" : "Change Payment Method"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}