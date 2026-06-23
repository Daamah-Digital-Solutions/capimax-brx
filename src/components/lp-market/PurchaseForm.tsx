import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LPMarketListing } from "@/hooks/useLPMarket";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  ShoppingCart, 
  CheckCircle2, 
  Building2,
  Loader2,
  CreditCard,
  Wallet,
  AlertTriangle,
  ArrowRight,
  DollarSign
} from "lucide-react";

interface PurchaseFormProps {
  listing: LPMarketListing;
  lpBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmPurchase: (listingId: string, paymentMethod: string) => Promise<{ success: boolean; error?: string }>;
}

export function PurchaseForm({
  listing,
  lpBalance,
  open,
  onOpenChange,
  onConfirmPurchase
}: PurchaseFormProps) {
  const { language } = useLanguage();
  const [step, setStep] = useState<"details" | "payment" | "confirm">("details");
  const [paymentMethod, setPaymentMethod] = useState<"lp_balance" | "bank_transfer">("lp_balance");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The backend settles the WHOLE listing (purchase sends only the listing id, no
  // quantity). So the buy is locked to the full block: quantity = listing.token_amount
  // and the charged total = listing.total_value — the displayed total MATCHES what the
  // backend charges (no misleading partial-buy math).
  const purchaseAmount = listing.token_amount;
  const calculatedTotal = listing.total_value;
  const insufficientBalance = listing.total_value > lpBalance;

  const handleNext = () => {
    if (step === "details") setStep("payment");
    else if (step === "payment") setStep("confirm");
  };

  const handleBack = () => {
    if (step === "payment") setStep("details");
    else if (step === "confirm") setStep("payment");
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const result = await onConfirmPurchase(listing.id, paymentMethod);
    setIsSubmitting(false);

    if (result.success) {
      onOpenChange(false);
      setStep("details");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("details");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {language === "ar" ? "شراء الأصل" : "Purchase Asset"}
          </DialogTitle>
          <DialogDescription>
            {step === "details" && (language === "ar" ? "مراجعة تفاصيل الأصل" : "Review asset details")}
            {step === "payment" && (language === "ar" ? "اختر طريقة الدفع" : "Select payment method")}
            {step === "confirm" && (language === "ar" ? "تأكيد الشراء" : "Confirm purchase")}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-2">
          {["details", "payment", "confirm"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? "bg-primary text-primary-foreground" : 
                ["details", "payment", "confirm"].indexOf(step) > i ? "bg-success text-success-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {["details", "payment", "confirm"].indexOf(step) > i ? "✓" : i + 1}
              </div>
              {i < 2 && <div className="w-8 h-0.5 bg-muted mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Asset Details */}
        {step === "details" && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-10 w-10 text-primary p-2 bg-primary/10 rounded-lg" />
                  <div className="flex-1">
                    <h4 className="font-semibold">{listing.property_name}</h4>
                    <Badge variant="outline" className="mt-1">{listing.token_symbol}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الكمية المتاحة" : "Available Tokens"}</Label>
                <Input value={listing.token_amount} disabled />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "سعر الوحدة" : "Unit Price"}</Label>
                <Input value={`$${listing.unit_price}`} disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "كمية الشراء" : "Purchase Amount"}</Label>
              {/* Whole-listing purchase: the amount is locked to the full block (the
                  backend settles the entire listing), so the total shown matches the charge. */}
              <Input type="number" value={purchaseAmount} disabled />
              <p className="text-xs text-muted-foreground">
                {language === "ar"
                  ? "يتم شراء القائمة بالكامل"
                  : "The full listing is purchased"}: {listing.token_amount} tokens
              </p>
            </div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{language === "ar" ? "المبلغ الإجمالي" : "Total Amount"}</span>
                  <span className="text-2xl font-bold text-primary">
                    ${calculatedTotal.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === "payment" && (
          <div className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <div className="space-y-3">
                <label 
                  className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === "lp_balance" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  } ${insufficientBalance ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <RadioGroupItem value="lp_balance" disabled={insufficientBalance} />
                  <div className="flex items-center gap-3 flex-1">
                    <Wallet className="h-8 w-8 text-primary p-1.5 bg-primary/10 rounded-lg" />
                    <div className="flex-1">
                      <p className="font-medium">{language === "ar" ? "رصيد LP" : "LP Balance"}</p>
                      <p className="text-sm text-muted-foreground">
                        {language === "ar" ? "الرصيد المتاح" : "Available"}: ${lpBalance.toLocaleString()}
                      </p>
                    </div>
                    {insufficientBalance && (
                      <Badge variant="destructive" className="text-xs">
                        {language === "ar" ? "رصيد غير كافٍ" : "Insufficient"}
                      </Badge>
                    )}
                  </div>
                </label>

                {/* Bank transfer has no off-balance settlement rail yet (LP settlement is
                    an instant internal-balance debit) → kept visible but disabled "Coming
                    soon", like the deferred payment providers. LP balance is the only real
                    purchase method. */}
                <label
                  className="flex items-center gap-4 p-4 border border-border rounded-lg opacity-50 cursor-not-allowed"
                >
                  <RadioGroupItem value="bank_transfer" disabled />
                  <div className="flex items-center gap-3 flex-1">
                    <CreditCard className="h-8 w-8 text-info p-1.5 bg-info/10 rounded-lg" />
                    <div>
                      <p className="font-medium">{language === "ar" ? "تحويل بنكي" : "Bank Transfer"}</p>
                      <p className="text-sm text-muted-foreground">
                        {language === "ar" ? "معالجة خلال 1-3 أيام" : "Processing 1-3 business days"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {language === "ar" ? "قريباً" : "Coming soon"}
                    </Badge>
                  </div>
                </label>
              </div>
            </RadioGroup>

            {paymentMethod === "lp_balance" && !insufficientBalance && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{language === "ar" ? "سيتم الخصم من رصيدك فوراً" : "Will be deducted from your balance instantly"}</span>
                </CardContent>
              </Card>
            )}

            {paymentMethod === "bank_transfer" && (
              <Card className="bg-warning/5 border-warning/20">
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span>{language === "ar" ? "سيتم حجز الأصل حتى اكتمال التحويل" : "Asset will be reserved until transfer completes"}</span>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirm" && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{language === "ar" ? "ملخص الشراء" : "Purchase Summary"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "الأصل" : "Asset"}</span>
                  <span className="font-medium">{listing.property_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "الكمية" : "Quantity"}</span>
                  <span className="font-medium">{purchaseAmount} {listing.token_symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "سعر الوحدة" : "Unit Price"}</span>
                  <span className="font-medium">${listing.unit_price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "طريقة الدفع" : "Payment Method"}</span>
                  <span className="font-medium">
                    {paymentMethod === "lp_balance" 
                      ? (language === "ar" ? "رصيد LP" : "LP Balance")
                      : (language === "ar" ? "تحويل بنكي" : "Bank Transfer")}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">{language === "ar" ? "المبلغ الإجمالي" : "Total"}</span>
                  <span className="text-xl font-bold text-primary">${calculatedTotal.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {paymentMethod === "lp_balance" && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "الرصيد الحالي" : "Current Balance"}</span>
                    <span>${lpBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "الخصم" : "Deduction"}</span>
                    <span className="text-destructive">-${calculatedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">{language === "ar" ? "الرصيد بعد الشراء" : "Balance After"}</span>
                    <span className="font-semibold text-success">${(lpBalance - calculatedTotal).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-center">
              {language === "ar" 
                ? "بالنقر على تأكيد، أنت توافق على شروط الشراء والتحويل"
                : "By clicking Confirm, you agree to the purchase and transfer terms"}
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step !== "details" && (
            <Button variant="outline" onClick={handleBack}>
              {language === "ar" ? "رجوع" : "Back"}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          {step !== "confirm" ? (
            <Button onClick={handleNext} disabled={step === "payment" && paymentMethod === "lp_balance" && insufficientBalance}>
              {language === "ar" ? "التالي" : "Next"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {language === "ar" ? "تأكيد الشراء" : "Confirm Purchase"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
