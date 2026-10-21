import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";

/** Six-digit authenticator code (always left-to-right, also on the Arabic site). */
export function OtpCodeInput({ value, onChange, onComplete, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div dir="ltr" className="flex justify-center">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={(v) => onChange(v.replace(/\D/g, ""))}
        onComplete={onComplete}
        disabled={disabled}
        inputMode="numeric"
        autoFocus
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

/**
 * Sign-in step for accounts with two-factor on: asks for the code from the authenticator
 * app, then calls `onSubmit(code)`. `onSubmit` resolves to an error message (shown here)
 * or null when the sign-in went through.
 */
export function TwoFactorPrompt({ open, onOpenChange, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (code: string) => Promise<string | null>;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  const submit = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const problem = await onSubmit(value);
    setBusy(false);
    if (problem) {
      setError(problem);
      setCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {isAr ? "التحقق بخطوتين" : "Two-factor verification"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة على هاتفك."
              : "Enter the 6-digit code from the authenticator app on your phone."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <OtpCodeInput value={code} onChange={setCode} onComplete={(v) => void submit(v)} disabled={busy} />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="w-4 h-4 animate-spin me-2" />}
            {isAr ? "تأكيد" : "Verify"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function otpErrorMessage(code: string | undefined, isAr: boolean, fallback: string): string {
  if (code === "otp_invalid") return isAr ? "الرمز غير صحيح أو انتهت صلاحيته." : "The code is incorrect or expired.";
  return fallback;
}
