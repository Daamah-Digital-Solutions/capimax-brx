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
import { LPHolding } from "@/hooks/useLPHoldings";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Repeat, 
  CheckCircle2, 
  Building2,
  Loader2,
  Store,
  TrendingUp,
  Percent,
  AlertCircle,
  DollarSign
} from "lucide-react";

interface ResaleFormProps {
  holding: LPHolding;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmResale: (holdingId: string, target: "lp" | "secondary", price: number) => Promise<{ success: boolean; error?: string }>;
}

export function ResaleForm({
  holding,
  open,
  onOpenChange,
  onConfirmResale
}: ResaleFormProps) {
  const { language } = useLanguage();
  const [targetMarket, setTargetMarket] = useState<"lp" | "secondary">("lp");
  const [salePrice, setSalePrice] = useState(holding.current_value.toString());
  const [tokenAmount, setTokenAmount] = useState(holding.token_amount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const price = parseFloat(salePrice) || 0;
  const tokens = parseFloat(tokenAmount) || 0;
  const totalValue = price;
  
  // Fee calculations
  const lpFeePercent = 1;
  const secondaryFeePercent = 0.5;
  const feePercent = targetMarket === "lp" ? lpFeePercent : secondaryFeePercent;
  const feeAmount = totalValue * (feePercent / 100);
  const netAmount = totalValue - feeAmount;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const result = await onConfirmResale(holding.id, targetMarket, price);
    setIsSubmitting(false);

    if (result.success) {
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSalePrice(holding.current_value.toString());
    setTokenAmount(holding.token_amount.toString());
    setTargetMarket("lp");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            {language === "ar" ? "إعادة بيع الأصل" : "Resell Asset"}
          </DialogTitle>
          <DialogDescription>
            {language === "ar"
              ? "اختر السوق المستهدف وحدد سعر البيع"
              : "Choose target market and set your sale price"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Asset Info */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-10 w-10 text-primary p-2 bg-primary/10 rounded-lg" />
                <div className="flex-1">
                  <h4 className="font-semibold">{holding.property_name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{holding.token_symbol}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {holding.token_amount} tokens
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{language === "ar" ? "القيمة الحالية" : "Current Value"}</p>
                  <p className="font-semibold text-primary">${holding.current_value.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Market Selection */}
          <div className="space-y-3">
            <Label>{language === "ar" ? "السوق المستهدف" : "Target Market"}</Label>
            <RadioGroup value={targetMarket} onValueChange={(v) => setTargetMarket(v as "lp" | "secondary")}>
              <div className="grid grid-cols-2 gap-3">
                <label 
                  className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                    targetMarket === "lp" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="lp" className="sr-only" />
                  <Store className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="font-medium">{language === "ar" ? "سوق LP" : "LP Market"}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? "رسوم 1%" : "1% Fee"}
                    </p>
                  </div>
                  {targetMarket === "lp" && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </label>

                <label 
                  className={`flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                    targetMarket === "secondary" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="secondary" className="sr-only" />
                  <TrendingUp className="h-8 w-8 text-info" />
                  <div className="text-center">
                    <p className="font-medium">{language === "ar" ? "السوق الثانوي" : "Secondary Market"}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? "رسوم 0.5%" : "0.5% Fee"}
                    </p>
                  </div>
                  {targetMarket === "secondary" && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Sale Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "كمية التوكنات" : "Token Amount"}</Label>
              <Input
                type="number"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                max={holding.token_amount}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "سعر البيع" : "Sale Price"}</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="pl-9"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Fee Breakdown */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Percent className="h-4 w-4" />
                {language === "ar" ? "تفاصيل الرسوم" : "Fee Breakdown"}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "ar" ? "إجمالي البيع" : "Sale Total"}</span>
                  <span className="font-medium">${totalValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {language === "ar" ? `رسوم المنصة (${feePercent}%)` : `Platform Fee (${feePercent}%)`}
                  </span>
                  <span className="text-destructive">-${feeAmount.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-medium">{language === "ar" ? "المبلغ الصافي" : "Net Amount"}</span>
                  <span className="text-lg font-bold text-success">${netAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Notice */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-muted-foreground">
              {targetMarket === "lp"
                ? (language === "ar"
                    ? "سيتم عرض أصلك لمزودي السيولة المعتمدين للشراء الفوري"
                    : "Your asset will be listed for approved LPs to purchase instantly")
                : (language === "ar"
                    ? "سيتم عرض أصلك في السوق الثانوي لجميع المستثمرين"
                    : "Your asset will be listed on the secondary market for all investors")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isSubmitting || price <= 0 || tokens <= 0}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {language === "ar" ? "تأكيد العرض" : "Confirm Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
