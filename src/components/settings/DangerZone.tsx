import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accountApi, apiErrorCode, type ApiError } from "@/integrations/api/client";

type Action = "deactivate" | "delete";

const BLOCKERS: Record<string, { ar: string; en: string }> = {
  wallet_balance: { ar: "لديك رصيد في المحفظة — اسحبه أولًا.", en: "You have a wallet balance — withdraw it first." },
  property_units: { ar: "لديك حصص في عقارات — بِعها أولًا.", en: "You hold property units — sell them first." },
  installment_plan: { ar: "لديك خطة أقساط نشطة.", en: "You have an active installment plan." },
  pending_withdrawal: { ar: "لديك طلب سحب قيد التنفيذ.", en: "You have a withdrawal in progress." },
};

/** Settings › Preferences: deactivate (support can re-enable) or delete (only when nothing is held). */
export function DangerZone() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const openDialog = (a: Action) => {
    setAction(a);
    setPassword("");
    setConfirm("");
    setErrors([]);
  };

  const submit = async () => {
    if (!action) return;
    setBusy(true);
    setErrors([]);
    try {
      if (action === "deactivate") await accountApi.deactivate(password);
      else await accountApi.deleteAccount(password, confirm);
      setAction(null);
      await signOut();
      navigate("/");
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === "wrong_password") setErrors([isAr ? "كلمة المرور غير صحيحة." : "The password is incorrect."]);
      else if (code === "confirm_required") setErrors([isAr ? "اكتب DELETE للتأكيد." : "Type DELETE to confirm."]);
      else if (code === "account_not_empty") {
        const list = ((e as ApiError).data as { blockers?: string[] })?.blockers ?? [];
        setErrors(list.map((b) => BLOCKERS[b]?.[isAr ? "ar" : "en"] ?? b));
      } else setErrors([isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Try again."]);
    } finally {
      setBusy(false);
    }
  };

  const isDelete = action === "delete";

  return (
    <Card className="bg-destructive/5 border-destructive/20">
      <CardHeader>
        <CardTitle className="text-lg text-destructive flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {t("settings.dangerZone")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("settings.dangerZoneDesc")}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => openDialog("deactivate")}
          >
            <LogOut className="w-4 h-4 me-2" />
            {t("settings.deactivateAccount")}
          </Button>
          <Button variant="destructive" onClick={() => openDialog("delete")}>
            <Trash2 className="w-4 h-4 me-2" />
            {t("settings.deleteAccount")}
          </Button>
        </div>
      </CardContent>

      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {isDelete ? t("settings.deleteAccount") : t("settings.deactivateAccount")}
            </DialogTitle>
            <DialogDescription>
              {isDelete
                ? isAr
                  ? "يُغلق الحساب نهائيًا وتُحذف بياناتك الشخصية. تبقى سجلات الاستثمار والمعاملات محفوظة كما يطلب القانون. لا يمكن التراجع."
                  : "Your account is closed for good and your personal data is removed. Investment and transaction records are kept as the law requires. This can't be undone."
                : isAr
                  ? "يتوقف الدخول إلى حسابك ويُسجَّل خروجك من كل الأجهزة. تبقى أموالك واستثماراتك كما هي، ويمكن للدعم إعادة تفعيله."
                  : "You can no longer sign in and every device is signed out. Your money and investments stay as they are, and support can reactivate it."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <label className="text-sm font-medium mb-2 block">{isAr ? "كلمة المرور" : "Password"}</label>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                {isAr ? "إذا كنت تدخل بحساب Google فقط، اتركها فارغة." : "If you only sign in with Google, leave this empty."}
              </p>
            </div>
            {isDelete && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {isAr ? "اكتب DELETE للتأكيد" : "Type DELETE to confirm"}
                </label>
                <Input dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
              </div>
            )}
            {errors.length > 0 && (
              <ul className="text-sm text-destructive space-y-1">
                {errors.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAction(null)}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={busy || (isDelete && confirm.trim().toUpperCase() !== "DELETE")}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                {isDelete ? t("settings.deleteAccount") : t("settings.deactivateAccount")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
