import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { Building, CreditCard, Shield } from "lucide-react";
import { z } from "zod";

const bankAccountSchema = z.object({
  bank_name: z.string().min(2, "Bank name is required").max(100),
  bank_code: z.string().max(20).optional(),
  account_holder_name: z.string().min(2, "Account holder name is required").max(100),
  account_number: z.string().min(4, "Account number is required").max(34),
  iban: z.string().max(34).optional(),
  currency: z.string().length(3),
});

interface BankAccountFormProps {
  familyAccountId: string;
  onSubmit: (data: {
    family_account_id: string;
    bank_name: string;
    bank_code?: string;
    account_holder_name: string;
    account_number: string;
    iban?: string;
    currency?: string;
    is_primary?: boolean;
  }) => Promise<unknown>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BankAccountForm({ familyAccountId, onSubmit, onCancel, isSubmitting }: BankAccountFormProps) {
  const { isRTL } = useLanguage();
  const [formData, setFormData] = useState({
    bank_name: "",
    bank_code: "",
    account_holder_name: "",
    account_number: "",
    iban: "",
    currency: "USD",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    try {
      const validated = bankAccountSchema.parse(formData);
      setErrors({});
      
      await onSubmit({
        family_account_id: familyAccountId,
        bank_name: validated.bank_name,
        bank_code: validated.bank_code,
        account_holder_name: validated.account_holder_name,
        account_number: validated.account_number,
        iban: validated.iban,
        currency: validated.currency,
        is_primary: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
        <Shield className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-green-700">
            {isRTL ? "معلوماتك المصرفية آمنة" : "Your banking information is secure"}
          </p>
          <p className="text-muted-foreground">
            {isRTL 
              ? "نقوم بتخزين آخر 4 أرقام فقط من حسابك. لا يتم تخزين المعلومات الكاملة."
              : "We only store the last 4 digits of your account. Full information is never stored."}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              {isRTL ? "اسم البنك" : "Bank Name"}
            </Label>
            <Input
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder={isRTL ? "مثال: بنك الإمارات" : "e.g. Emirates NBD"}
              className={errors.bank_name ? "border-destructive" : ""}
            />
            {errors.bank_name && <p className="text-xs text-destructive">{errors.bank_name}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>{isRTL ? "رمز البنك (اختياري)" : "Bank Code (Optional)"}</Label>
            <Input
              value={formData.bank_code}
              onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
              placeholder={isRTL ? "مثال: ELOBAR" : "e.g. ELOBAR"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            {isRTL ? "اسم صاحب الحساب" : "Account Holder Name"}
          </Label>
          <Input
            value={formData.account_holder_name}
            onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
            placeholder={isRTL ? "الاسم كما يظهر في البنك" : "Name as it appears on bank account"}
            className={errors.account_holder_name ? "border-destructive" : ""}
          />
          {errors.account_holder_name && <p className="text-xs text-destructive">{errors.account_holder_name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{isRTL ? "رقم الحساب" : "Account Number"}</Label>
            <Input
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              placeholder="••••••••1234"
              className={errors.account_number ? "border-destructive" : ""}
            />
            {errors.account_number && <p className="text-xs text-destructive">{errors.account_number}</p>}
          </div>
          
          <div className="space-y-2">
            <Label>{isRTL ? "رقم IBAN (اختياري)" : "IBAN (Optional)"}</Label>
            <Input
              value={formData.iban}
              onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
              placeholder="AE••••••••••••1234"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{isRTL ? "العملة" : "Currency"}</Label>
          <Select
            value={formData.currency}
            onValueChange={(value) => setFormData({ ...formData, currency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
              <SelectItem value="AED">AED - UAE Dirham</SelectItem>
              <SelectItem value="EUR">EUR - Euro</SelectItem>
              <SelectItem value="GBP">GBP - British Pound</SelectItem>
              <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {isRTL ? "إلغاء" : "Cancel"}
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting 
            ? (isRTL ? "جاري الإضافة..." : "Adding...") 
            : (isRTL ? "إضافة الحساب البنكي" : "Add Bank Account")}
        </Button>
      </DialogFooter>
    </div>
  );
}
