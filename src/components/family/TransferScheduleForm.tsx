import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Target, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TransferScheduleFormProps {
  familyAccountId: string;
  bankAccounts: Array<{
    id: string;
    bank_name: string;
    account_number_masked: string;
  }>;
  onSubmit: (data: {
    family_account_id: string;
    bank_account_id: string;
    schedule_type: "immediate" | "weekly" | "monthly" | "quarterly" | "threshold";
    threshold_amount?: number;
  }) => Promise<unknown>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const scheduleOptions = [
  { value: "immediate", icon: Zap, labelEn: "Immediate", labelAr: "فوري", descEn: "Transfer as soon as returns are available", descAr: "تحويل فور توفر العوائد" },
  { value: "weekly", icon: Calendar, labelEn: "Weekly", labelAr: "أسبوعي", descEn: "Every week on the same day", descAr: "كل أسبوع في نفس اليوم" },
  { value: "monthly", icon: Calendar, labelEn: "Monthly", labelAr: "شهري", descEn: "Once per month on a fixed date", descAr: "مرة في الشهر في تاريخ محدد" },
  { value: "quarterly", icon: Clock, labelEn: "Quarterly", labelAr: "ربع سنوي", descEn: "Every 3 months", descAr: "كل 3 أشهر" },
  { value: "threshold", icon: Target, labelEn: "Threshold", labelAr: "عند الحد", descEn: "When balance reaches a specific amount", descAr: "عند وصول الرصيد لمبلغ محدد" },
] as const;

export function TransferScheduleForm({ 
  familyAccountId, 
  bankAccounts, 
  onSubmit, 
  onCancel, 
  isSubmitting 
}: TransferScheduleFormProps) {
  const { isRTL } = useLanguage();
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"immediate" | "weekly" | "monthly" | "quarterly" | "threshold">("monthly");
  const [thresholdAmount, setThresholdAmount] = useState<string>("");

  const handleSubmit = async () => {
    if (!selectedBankId) return;
    
    await onSubmit({
      family_account_id: familyAccountId,
      bank_account_id: selectedBankId,
      schedule_type: scheduleType,
      threshold_amount: scheduleType === "threshold" ? parseFloat(thresholdAmount) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Bank Account Selection */}
      <div className="space-y-2">
        <Label>{isRTL ? "الحساب البنكي المستهدف" : "Target Bank Account"}</Label>
        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
          <SelectTrigger>
            <SelectValue placeholder={isRTL ? "اختر الحساب البنكي" : "Select bank account"} />
          </SelectTrigger>
          <SelectContent>
            {bankAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.bank_name} - {account.account_number_masked}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schedule Type Selection */}
      <div className="space-y-3">
        <Label>{isRTL ? "نوع الجدول الزمني" : "Schedule Type"}</Label>
        <div className="grid grid-cols-2 gap-3">
          {scheduleOptions.map((option) => {
            const IconComponent = option.icon;
            const isSelected = scheduleType === option.value;
            return (
              <Card
                key={option.value}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md",
                  isSelected 
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => setScheduleType(option.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isSelected ? "bg-primary/20" : "bg-muted"
                    )}>
                      <IconComponent className={cn(
                        "w-5 h-5",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isRTL ? option.labelAr : option.labelEn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? option.descAr : option.descEn}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Threshold Amount (only for threshold type) */}
      {scheduleType === "threshold" && (
        <div className="space-y-2">
          <Label>{isRTL ? "مبلغ الحد الأدنى للتحويل" : "Minimum Transfer Threshold"}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={thresholdAmount}
              onChange={(e) => setThresholdAmount(e.target.value)}
              placeholder="1000"
              className="pl-8"
              min={0}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isRTL 
              ? "سيتم تحويل العوائد تلقائياً عند وصول الرصيد لهذا المبلغ"
              : "Returns will be automatically transferred when balance reaches this amount"}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {isRTL ? "إلغاء" : "Cancel"}
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || !selectedBankId || (scheduleType === "threshold" && !thresholdAmount)}
        >
          {isSubmitting 
            ? (isRTL ? "جاري الإنشاء..." : "Creating...") 
            : (isRTL ? "إنشاء الجدول" : "Create Schedule")}
        </Button>
      </DialogFooter>
    </div>
  );
}
