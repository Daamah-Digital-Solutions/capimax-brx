import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  Calculator, 
  CreditCard, 
  DollarSign, 
  Clock,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InstallmentCalculatorProps {
  propertyId: string;
  totalPropertyPrice: number;
  downPaymentPercent: number;
  installmentDurations: { months: number; label: string; labelAr: string }[];
  unitPrice: number;
  expectedGrowth: number;
  constructionProgress: number;
  expectedCompletion: string;
}

export function InstallmentCalculator({
  propertyId,
  totalPropertyPrice,
  downPaymentPercent,
  installmentDurations,
  unitPrice,
  expectedGrowth,
  constructionProgress,
  expectedCompletion,
}: InstallmentCalculatorProps) {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  
  const [units, setUnits] = useState(1);
  const [selectedDuration, setSelectedDuration] = useState(installmentDurations[0]?.months || 12);
  const [showSchedule, setShowSchedule] = useState(false);

  const calculation = useMemo(() => {
    const totalInvestment = units * unitPrice;
    const downPayment = Math.round(totalInvestment * (downPaymentPercent / 100));
    const remainingBalance = totalInvestment - downPayment;
    const installmentAmount = Math.round(remainingBalance / selectedDuration);
    const platformFee = Math.round(totalInvestment * 0.015);
    const totalWithFees = totalInvestment + platformFee;
    const downPaymentWithFee = Math.round(downPayment + (platformFee * (downPaymentPercent / 100)));
    
    // Generate payment schedule
    const schedule = [];
    const today = new Date();
    
    // Down payment
    schedule.push({
      id: 0,
      type: "down_payment",
      amount: downPaymentWithFee,
      date: today.toISOString().split('T')[0],
      status: "pending"
    });
    
    // Installments
    for (let i = 1; i <= selectedDuration; i++) {
      const installmentDate = new Date(today);
      installmentDate.setMonth(installmentDate.getMonth() + i);
      schedule.push({
        id: i,
        type: "installment",
        amount: installmentAmount,
        date: installmentDate.toISOString().split('T')[0],
        status: "upcoming"
      });
    }

    return {
      totalInvestment,
      downPayment,
      downPaymentWithFee,
      remainingBalance,
      installmentAmount,
      platformFee,
      totalWithFees,
      schedule,
      numberOfInstallments: selectedDuration
    };
  }, [units, unitPrice, downPaymentPercent, selectedDuration]);

  const handleUnitsChange = (delta: number) => {
    const newUnits = Math.max(1, Math.min(100, units + delta));
    setUnits(newUnits);
  };

  const handleInvest = () => {
    // Wave B: carry the full installment terms so Checkout charges the DOWN-PAYMENT
    // (down% + n installments + frequency). This calculator's plan is monthly.
    const params = new URLSearchParams({
      property: propertyId,
      units: String(units),
      type: "installment",
      down: String(downPaymentPercent),
      duration: String(selectedDuration),
      frequency: "monthly",
    });
    navigate(`/checkout?${params.toString()}`);
  };

  const durationLabel = (months: number) => {
    const duration = installmentDurations.find(d => d.months === months);
    return language === "ar" ? duration?.labelAr : duration?.label;
  };

  return (
    <div className="p-6 bg-card rounded-2xl border-2 border-primary/30 shadow-card animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
            <Calculator className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {t("installmentCalc.title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("installmentCalc.subtitle")}</p>
          </div>
        </div>
        <Badge variant="construction" className="gap-1">
          <Clock className="w-3 h-3" />
          {t("property.underConstruction")}
        </Badge>
      </div>

      {/* Construction Progress */}
      <div className="mb-6 p-4 bg-muted rounded-xl">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">{t("installmentCalc.constructionProgress")}</span>
          <span className="font-semibold text-primary">{constructionProgress}%</span>
        </div>
        <Progress value={constructionProgress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span>{t("installmentCalc.started")}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {t("installmentCalc.expectedCompletion")}: {expectedCompletion}
          </span>
        </div>
      </div>

      {/* Property Price Info */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-muted rounded-xl">
          <div className="text-xs text-muted-foreground mb-1">{t("installmentCalc.unitPrice")}</div>
          <div className="font-bold text-foreground">${unitPrice.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-success/10 rounded-xl">
          <div className="text-xs text-muted-foreground mb-1">{t("installmentCalc.expectedGrowth")}</div>
          <div className="font-bold text-success flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            +{expectedGrowth}%
          </div>
        </div>
      </div>

      {/* Units Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          {t("propertyDetail.numberOfUnits")}
        </label>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleUnitsChange(-1)}
            disabled={units <= 1}
            className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-muted/80 text-xl font-medium disabled:opacity-50"
          >
            -
          </button>
          <input
            type="number"
            value={units}
            onChange={(e) => setUnits(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="flex-1 h-10 bg-muted rounded-lg text-center font-semibold outline-none focus:ring-2 focus:ring-primary"
          />
          <button 
            onClick={() => handleUnitsChange(1)}
            disabled={units >= 100}
            className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-muted/80 text-xl font-medium disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>

      {/* Duration Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          {t("installmentCalc.installmentDuration")}
        </label>
        <Select value={selectedDuration.toString()} onValueChange={(v) => setSelectedDuration(parseInt(v))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("installmentCalc.selectDuration")} />
          </SelectTrigger>
          <SelectContent>
            {installmentDurations.map((duration) => (
              <SelectItem key={duration.months} value={duration.months.toString()}>
                {language === "ar" ? duration.labelAr : duration.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calculation Summary */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("installmentCalc.totalInvestment")}</span>
          <span className="font-semibold">${calculation.totalInvestment.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-muted-foreground flex items-center gap-1">
            {t("installmentCalc.downPayment")} ({downPaymentPercent}%)
            <Info className="w-3 h-3" />
          </span>
          <span className="font-bold text-primary">${calculation.downPayment.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("installmentCalc.remainingBalance")}</span>
          <span className="font-semibold">${calculation.remainingBalance.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("installmentCalc.numberOfInstallments")}</span>
          <span className="font-semibold">{selectedDuration} {t("installmentCalc.months")}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("installmentCalc.monthlyInstallment")}</span>
          <span className="font-bold text-foreground">${calculation.installmentAmount.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("checkout.platformFee")} (1.5%)</span>
          <span className="text-sm">${calculation.platformFee.toLocaleString()}</span>
        </div>
      </div>

      {/* Payment at Checkout */}
      <div className="p-4 bg-gradient-gold/10 rounded-xl border border-primary/20 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground">{t("installmentCalc.payAtCheckout")}</span>
        </div>
        <div className="text-2xl font-bold text-gradient-gold">
          ${calculation.downPaymentWithFee.toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t("installmentCalc.downPaymentNote")}
        </p>
      </div>

      {/* Payment Schedule Toggle */}
      <button
        onClick={() => setShowSchedule(!showSchedule)}
        className="w-full flex items-center justify-between p-3 bg-muted rounded-xl mb-4 hover:bg-muted/80 transition-colors"
      >
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {t("installmentCalc.viewSchedule")}
        </span>
        {showSchedule ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Payment Schedule */}
      {showSchedule && (
        <div className="mb-6 p-4 bg-muted/50 rounded-xl max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {calculation.schedule.slice(0, 7).map((payment, index) => (
              <div
                key={payment.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg text-sm",
                  payment.type === "down_payment" ? "bg-primary/10" : "bg-background"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    payment.type === "down_payment" ? "bg-primary" : "bg-muted-foreground"
                  )} />
                  <span className="text-muted-foreground">
                    {payment.type === "down_payment" 
                      ? t("installmentCalc.downPaymentLabel")
                      : `${t("installments.installment")} ${index}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{payment.date}</span>
                  <span className="font-medium">${payment.amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {calculation.schedule.length > 7 && (
              <div className="text-center text-xs text-muted-foreground py-2">
                +{calculation.schedule.length - 7} {t("installmentCalc.morePayments")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <Button 
        variant="hero" 
        size="lg" 
        className="w-full gap-2"
        onClick={handleInvest}
      >
        <DollarSign className="w-5 h-5" />
        {t("installmentCalc.investWithInstallments")}
      </Button>

      {/* Info Note */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        {t("installmentCalc.infoNote")}
      </p>
    </div>
  );
}
