import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Landmark, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { authApi } from "@/integrations/api/client";

type State = "pending" | "success" | "error";

// Confirms an email-verification link ({FRONTEND_URL}/verify-email?uid=..&token=..).
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { language, isRTL } = useLanguage();
  const ar = language === "ar";

  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<State>("pending");
  const ran = useRef(false); // guard React 18 StrictMode double-invoke

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!uid || !token) {
      setState("error");
      return;
    }
    let active = true;
    authApi
      .verifyEmail({ uid, token })
      .then(() => active && setState("success"))
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [uid, token]);

  const content = {
    pending: {
      icon: <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />,
      text: ar ? "جارٍ التحقق من بريدك الإلكتروني..." : "Verifying your email…",
    },
    success: {
      icon: <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />,
      text: ar ? "تم تأكيد بريدك الإلكتروني بنجاح." : "Your email has been verified.",
    },
    error: {
      icon: <AlertTriangle className="w-12 h-12 text-warning mx-auto" />,
      text: ar
        ? "رابط التحقق غير صالح أو منتهي الصلاحية."
        : "This verification link is invalid or expired.",
    },
  }[state];

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
            {ar ? "تأكيد البريد الإلكتروني" : "Email verification"}
          </h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-5">
          {content.icon}
          <p className="text-foreground">{content.text}</p>
          {state !== "pending" && (
            <div className="space-y-3">
              <Button variant="hero" className="w-full" asChild>
                <Link to="/auth">{ar ? "تسجيل الدخول" : "Go to login"}</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/">{ar ? "الصفحة الرئيسية" : "Home"}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
