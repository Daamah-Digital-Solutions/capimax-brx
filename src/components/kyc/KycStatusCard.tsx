import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { kycApi, type KycStatus } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

/**
 * The user's real identity-verification (KYC) status: red "Complete KYC" with a 3-step
 * progress until it is approved, then green "Verified". Reads the live status every time.
 */
export function KycStatusCard({ className, hideWhenVerified = false }: { className?: string; hideWhenVerified?: boolean }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [kyc, setKyc] = useState<KycStatus | null>(null);

  useEffect(() => {
    if (!user) return;
    kycApi.me().then(setKyc).catch(() => setKyc(null));
  }, [user]);

  if (!user) return null;
  const status = kyc?.status ?? "pending";
  const approved = status === "approved";
  if (hideWhenVerified && (approved || kyc === null)) return null;
  const steps = [
    { done: !!user.is_email_verified, en: "Email confirmed", ar: "تأكيد البريد الإلكتروني" },
    { done: status === "submitted" || approved, en: "Identity documents submitted", ar: "رفع مستندات الهوية" },
    { done: approved, en: "Identity approved", ar: "اعتماد الهوية" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card
      className={cn(
        approved ? "bg-emerald-500/5 border-emerald-500/30" : "bg-destructive/5 border-destructive/40",
        className,
      )}
    >
      <CardContent className="p-6 space-y-4" dir={isAr ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                approved ? "bg-emerald-500/10" : "bg-destructive/10",
              )}
            >
              {approved ? (
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-destructive" />
              )}
            </div>
            <div>
              <h3 className={cn("font-semibold", approved ? "text-emerald-600" : "text-destructive")}>
                {approved
                  ? isAr ? "تم التحقق" : "Verified"
                  : isAr ? "استكمل التحقق من هويتك (KYC)" : "Complete KYC"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {approved
                  ? isAr ? "هويتك موثّقة ويمكنك الاستثمار والشحن والسحب." : "Your identity is verified — you can invest, top up and withdraw."
                  : status === "rejected"
                    ? isAr ? "لم تُقبل مستنداتك. راجع الملاحظات وأعد الإرسال." : "Your documents weren't accepted. Review the notes and submit again."
                    : status === "submitted"
                      ? isAr ? "مستنداتك قيد المراجعة." : "Your documents are under review."
                      : isAr ? "مطلوب لتتمكن من الاستثمار وشحن المحفظة والسحب." : "Required to invest, top up your wallet and withdraw."}
              </p>
            </div>
          </div>
          {!approved && (
            <Button variant="destructive" asChild>
              <Link to="/kyc">{isAr ? "استكمل التحقق" : "Complete KYC"}</Link>
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isAr ? "تقدّم التحقق" : "Verification progress"}</span>
            <span>{doneCount} / {steps.length}</span>
          </div>
          <Progress
            value={(doneCount / steps.length) * 100}
            className={cn("h-2", approved ? "[&>div]:bg-emerald-500" : "[&>div]:bg-destructive")}
          />
          <div className="grid sm:grid-cols-3 gap-2 pt-1">
            {steps.map((s) => (
              <div key={s.en} className="flex items-center gap-2 text-xs">
                {s.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{isAr ? s.ar : s.en}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
