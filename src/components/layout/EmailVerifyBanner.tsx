import { useState } from "react";
import { MailWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { authApi } from "@/integrations/api/client";

// Shown to a signed-in user whose email isn't confirmed yet: the server requires it before
// identity verification (KYC), investing, deposits and withdrawals. Admin accounts are exempt
// server-side, so they don't see it either.
export function EmailVerifyBanner() {
  const { user, refreshUser } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [sending, setSending] = useState(false);

  if (!user || user.is_email_verified || user.profile?.role === "admin") return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await authApi.resendVerification();
      if (res.verified) {
        await refreshUser();
        return;
      }
      toast.success(
        isAr
          ? `أرسلنا رابط تأكيد جديدًا إلى ${user.email}`
          : `We sent a new confirmation link to ${user.email}`,
      );
    } catch (err) {
      toast.error((err as Error)?.message || (isAr ? "تعذّر الإرسال، حاول لاحقًا" : "Couldn't send it — try again later"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="container py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
        <div className="flex items-start gap-2 flex-1">
          <MailWarning className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span className="text-foreground">
            {isAr
              ? `أكّد بريدك الإلكتروني (${user.email}) من الرابط الذي أرسلناه لك، لتتمكن من التحقق من الهوية والاستثمار والإيداع والسحب.`
              : `Confirm your email (${user.email}) with the link we sent you to verify your identity, invest, deposit and withdraw.`}
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-8" disabled={sending} onClick={resend}>
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isAr ? "أعد إرسال الرابط" : "Resend link"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => void refreshUser()}>
            {isAr ? "أكّدته" : "I've confirmed"}
          </Button>
        </div>
      </div>
    </div>
  );
}
