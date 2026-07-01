import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, Landmark, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { authApi } from "@/integrations/api/client";

// Sets a new password from the emailed link ({FRONTEND_URL}/reset-password?uid=..&token=..).
export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, isRTL } = useLanguage();
  const ar = language === "ar";

  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";
  const linkValid = Boolean(uid && token);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const err = (msg: string) =>
    toast({ title: ar ? "خطأ" : "Error", description: msg, variant: "destructive" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      err(ar ? "يجب أن تكون كلمة المرور 8 أحرف على الأقل" : "Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      err(ar ? "كلمات المرور غير متطابقة" : "Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset({ uid, token, new_password: password });
      toast({
        title: ar ? "تم" : "Success",
        description: ar ? "تم تحديث كلمة المرور. سجّل الدخول الآن." : "Password updated. You can log in now.",
      });
      navigate("/auth");
    } catch {
      err(
        ar
          ? "الرابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً."
          : "This link is invalid or expired. Please request a new one."
      );
    } finally {
      setIsLoading(false);
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
            {ar ? "تعيين كلمة مرور جديدة" : "Set a new password"}
          </h1>
        </div>

        {!linkValid ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto" />
            <p className="text-foreground">
              {ar
                ? "رابط إعادة التعيين غير صالح أو غير مكتمل."
                : "This reset link is invalid or incomplete."}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/forgot-password">{ar ? "اطلب رابطاً جديداً" : "Request a new link"}</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card p-8 space-y-5"
          >
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={ar ? "كلمة المرور الجديدة" : "New password"}
                className="w-full h-11 ps-10 pe-10 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={ar ? "تأكيد كلمة المرور" : "Confirm password"}
                className="w-full h-11 ps-10 pe-4 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
              {isLoading
                ? ar
                  ? "جارٍ التحديث..."
                  : "Updating..."
                : ar
                ? "تحديث كلمة المرور"
                : "Update password"}
            </Button>
            <Link
              to="/auth"
              className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {ar ? "العودة لتسجيل الدخول" : "Back to login"}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
