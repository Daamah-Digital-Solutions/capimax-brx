import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { countryOptions } from "@/lib/countries";
import type { LiquidityProvider, LPBankDetails } from "@/hooks/useLiquidityProvider";

// The local bank / branch code each country uses for incoming transfers.
const ROUTING: Record<string, { ar: string; en: string }> = {
  USA: { ar: "رقم التوجيه (ABA)", en: "ABA routing number" },
  UK: { ar: "رمز الفرع (Sort code)", en: "Sort code" },
  IN: { ar: "رمز IFSC", en: "IFSC code" },
  AU: { ar: "رمز BSB", en: "BSB number" },
  CA: { ar: "رقم الفرع والمؤسسة", en: "Transit and institution number" },
  NZ: { ar: "رمز البنك والفرع", en: "Bank and branch code" },
  ZA: { ar: "رمز الفرع", en: "Branch code" },
  MX: { ar: "رقم CLABE", en: "CLABE number" },
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "EGP", "JOD", "CAD", "AUD", "CHF", "INR"];

export function emptyBankDetails(p: LiquidityProvider): LPBankDetails {
  return {
    bank_account_holder: p.bank_account_holder || p.company_name || p.contact_name || "",
    bank_name: p.bank_name || "",
    bank_country: p.bank_country || "",
    bank_currency: p.bank_currency || "USD",
    bank_iban: p.bank_iban || "",
    bank_account_number: p.bank_account_number || "",
    bank_routing_code: p.bank_routing_code || "",
    bank_swift: p.bank_swift || "",
    bank_intermediary_swift: p.bank_intermediary_swift || "",
    bank_address: p.bank_address || "",
    beneficiary_address: p.beneficiary_address || "",
  };
}

/** A complete payout bank account for the liquidity provider (client review §18). */
export function LPBankAccountForm({
  profile,
  onSave,
}: {
  profile: LiquidityProvider;
  onSave: (data: LPBankDetails) => Promise<{ success: boolean }>;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [data, setData] = useState<LPBankDetails>(() => emptyBankDetails(profile));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof LPBankDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));
  const routing = ROUTING[data.bank_country];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(data);
    setSaving(false);
  };

  const field = (k: keyof LPBankDetails, label: string, opts: { required?: boolean; ltr?: boolean; hint?: string; placeholder?: string } = {}) => (
    <div className="space-y-1.5">
      <Label>
        {label}
        {opts.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input value={data[k]} onChange={set(k)} required={opts.required} dir={opts.ltr ? "ltr" : undefined} placeholder={opts.placeholder} />
      {opts.hint && <p className="text-xs text-muted-foreground">{opts.hint}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {field("bank_account_holder", isAr ? "اسم صاحب الحساب" : "Account holder name", {
          required: true, hint: isAr ? "كما هو مسجّل في البنك" : "Exactly as registered at the bank",
        })}
        {field("bank_name", isAr ? "اسم البنك" : "Bank name", { required: true })}
        <div className="space-y-1.5">
          <Label>
            {isAr ? "دولة البنك" : "Bank country"}
            <span className="text-destructive"> *</span>
          </Label>
          <select
            value={data.bank_country}
            onChange={set("bank_country")}
            required
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{isAr ? "اختر الدولة" : "Select a country"}</option>
            {countryOptions(language).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>{isAr ? "عملة الحساب" : "Account currency"}</Label>
          <select
            value={data.bank_currency}
            onChange={set("bank_currency")}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            dir="ltr"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {field("bank_iban", "IBAN", {
          ltr: true, placeholder: "AE07 0331 2345 6789 0123 456",
          hint: isAr ? "مطلوب في الدول التي تستخدم IBAN" : "Required in countries that use IBAN",
        })}
        {field("bank_account_number", isAr ? "رقم الحساب" : "Account number", {
          ltr: true, hint: isAr ? "إن لم يكن لدولتك IBAN" : "If your country doesn't use IBAN",
        })}
        {field("bank_routing_code", routing ? (isAr ? routing.ar : routing.en) : (isAr ? "رمز البنك / الفرع (إن وُجد)" : "Bank / branch code (if any)"), {
          ltr: true, required: !!routing && !data.bank_iban,
        })}
        {field("bank_swift", "SWIFT / BIC", { ltr: true, placeholder: "EBILAEAD", hint: isAr ? "8 أو 11 حرفًا" : "8 or 11 characters" })}
        {field("bank_intermediary_swift", isAr ? "SWIFT البنك الوسيط (إن وُجد)" : "Intermediary bank SWIFT (if any)", { ltr: true })}
        {field("bank_address", isAr ? "عنوان البنك" : "Bank address")}
      </div>
      {field("beneficiary_address", isAr ? "عنوان صاحب الحساب" : "Account holder's address", {
        hint: isAr ? "تطلبه بعض البنوك للتحويلات الدولية" : "Some banks require it for international transfers",
      })}
      <Button type="submit" disabled={saving} className="w-full">
        {saving && <Loader2 className="w-4 h-4 animate-spin me-2" />}
        {isAr ? "حفظ الحساب البنكي" : "Save bank account"}
      </Button>
    </form>
  );
}
