import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Landmark, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { authApi } from "@/integrations/api/client";

// Requests a password-reset link. The backend always returns 200 (no account
// enumeration), so the UI shows the same neutral confirmation either way.
export default function ForgotPassword() {
  const { language, isRTL } = useLanguage();
  const ar = language === "ar";
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
    } catch {
      // Intentionally ignored — never reveal whether the email exists.
    } finally {
      setIsLoading(false);
      setSent(true); // same outcome regardless of whether the account exists
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
            <Landmark className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {ar ? "إعادة تعيين كلمة المرور" : "Reset your password"}
          </h1>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="text-foreground">
              {ar
                ? "إذا كان هناك حساب بهذا البريد الإلكتروني، فقد أرسلنا رابطاً لإعادة تعيين كلمة المرور."
                : "If an account exists for that email, we've sent a password-reset link."}
            </p>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "لم تستلم البريد؟ تحقق من مجلد الرسائل غير المرغوب فيها."
                : "Didn't receive it? Check your spam folder."}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/auth">{ar ? "العودة لتسجيل الدخول" : "Back to login"}</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card p-8 space-y-5"
          >
            <p className="text-muted-foreground text-sm text-center">
              {ar
                ? "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور."
                : "Enter your email and we'll send you a link to reset your password."}
            </p>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ar ? "البريد الإلكتروني" : "Email address"}
                className="w-full h-11 ps-10 pe-4 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
              {isLoading
                ? ar
                  ? "جارٍ الإرسال..."
                  : "Sending..."
                : ar
                ? "إرسال رابط إعادة التعيين"
                : "Send reset link"}
            </Button>
            <Link
              to="/auth"
              className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {ar ? "العودة لتسجيل الدخول" : "Back to login"}
              <ArrowIcon className={cn("w-3.5 h-3.5", isRTL && "rotate-180")} />
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
