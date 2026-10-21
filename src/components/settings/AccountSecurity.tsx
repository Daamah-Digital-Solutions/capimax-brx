import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Loader2, Lock, LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { OtpCodeInput } from "@/components/auth/TwoFactorPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accountApi, apiErrorCode, type DeviceSession } from "@/integrations/api/client";

const cardClass = "bg-card/50 backdrop-blur border-border/50";

// --------------------------------------------------------------------------- //
// Password
// --------------------------------------------------------------------------- //
export function PasswordCard() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (next.length < 8) return setError(isAr ? "كلمة المرور الجديدة 8 أحرف على الأقل." : "The new password must be at least 8 characters.");
    if (next !== confirm) return setError(isAr ? "كلمتا المرور غير متطابقتين." : "The passwords don't match.");
    setBusy(true);
    try {
      await accountApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(isAr ? "تم تغيير كلمة المرور وتسجيل الخروج من الأجهزة الأخرى." : "Password changed. Your other devices were signed out.");
    } catch (e) {
      const code = apiErrorCode(e);
      setError(
        code === "wrong_password"
          ? isAr ? "كلمة المرور الحالية غير صحيحة." : "The current password is incorrect."
          : code === "weak_password"
            ? isAr ? "كلمة المرور الجديدة ضعيفة أو شائعة. اختر كلمة أقوى." : (e as Error).message
            : isAr ? "تعذر تغيير كلمة المرور. حاول مرة أخرى." : "Could not change the password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cardClass}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {t("settings.password")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.currentPassword")}</label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="pe-10"
              />
              <button
                type="button"
                className="absolute end-3 top-1/2 -translate-y-1/2"
                onClick={() => setShow(!show)}
                aria-label={show ? (isAr ? "إخفاء" : "Hide") : (isAr ? "إظهار" : "Show")}
              >
                {show ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isAr ? "إذا كنت تدخل بحساب Google فقط، اتركها فارغة." : "If you only sign in with Google, leave this empty."}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("settings.newPassword")}</label>
              <Input type={show ? "text" : "password"} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("settings.confirmPassword")}</label>
              <Input type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={busy || !next || !confirm}>
              {busy && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {t("settings.changePassword")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------------- //
// Two-factor (authenticator app)
// --------------------------------------------------------------------------- //
export function TwoFactorCard() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { user, refreshUser } = useAuth();
  const enabled = !!user?.profile?.totp_enabled;
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badCode = isAr ? "الرمز غير صحيح أو انتهت صلاحيته." : "The code is incorrect or expired.";

  const start = async () => {
    setBusy(true);
    try {
      setSetup(await accountApi.twoFactorSetup());
      setCode("");
      setError(null);
    } catch {
      toast.error(isAr ? "تعذر بدء الإعداد. حاول مرة أخرى." : "Could not start the setup. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (setup) {
        await accountApi.twoFactorEnable(value);
        setSetup(null);
        toast.success(isAr ? "تم تفعيل التحقق بخطوتين." : "Two-factor authentication is on.");
      } else {
        await accountApi.twoFactorDisable(value);
        setDisabling(false);
        toast.success(isAr ? "تم إيقاف التحقق بخطوتين." : "Two-factor authentication is off.");
      }
      await refreshUser();
    } catch (e) {
      setError(apiErrorCode(e) === "otp_invalid" ? badCode : (isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Try again."));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const open = !!setup || disabling;

  return (
    <Card className={cardClass}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                {t("settings.twoFactorAuth")}
                <Badge variant={enabled ? "success" : "outline"} className="text-xs">
                  {enabled ? (isAr ? "مفعّل" : "On") : (isAr ? "غير مفعّل" : "Off")}
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "عند تسجيل الدخول نطلب رمزًا من تطبيق مصادقة على هاتفك (Google Authenticator أو Microsoft Authenticator أو غيرهما)."
                  : "When you sign in, we ask for a code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar)."}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={busy}
            onCheckedChange={(on) => {
              if (on) void start();
              else {
                setCode("");
                setError(null);
                setDisabling(true);
              }
            }}
            aria-label={t("settings.twoFactorAuth")}
          />
        </div>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setSetup(null);
            setDisabling(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setup ? (isAr ? "تفعيل التحقق بخطوتين" : "Turn on two-factor") : (isAr ? "إيقاف التحقق بخطوتين" : "Turn off two-factor")}
            </DialogTitle>
            <DialogDescription>
              {setup
                ? isAr
                  ? "1) امسح الرمز بتطبيق المصادقة. 2) أدخل الرمز المكوّن من 6 أرقام الذي يظهر فيه."
                  : "1) Scan the code with your authenticator app. 2) Enter the 6-digit code it shows."
                : isAr
                  ? "أدخل الرمز الحالي من تطبيق المصادقة للتأكيد."
                  : "Enter the current code from your authenticator app to confirm."}
            </DialogDescription>
          </DialogHeader>
          {setup && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG value={setup.otpauth_uri} size={176} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {isAr ? "لا يمكنك المسح؟ أدخل هذا المفتاح يدويًا:" : "Can't scan? Enter this key by hand:"}
                </p>
                <button
                  type="button"
                  dir="ltr"
                  className="font-mono text-sm break-all inline-flex items-center gap-2 px-2 py-1 rounded bg-muted hover:bg-muted/70"
                  onClick={() => {
                    navigator.clipboard?.writeText(setup.secret).then(
                      () => toast.success(isAr ? "تم النسخ" : "Copied"),
                      () => undefined,
                    );
                  }}
                >
                  {setup.secret.replace(/(.{4})/g, "$1 ").trim()}
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          )}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmCode();
            }}
          >
            <OtpCodeInput value={code} onChange={setCode} onComplete={(v) => void confirmCode(v)} disabled={busy} />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              variant={setup ? "default" : "destructive"}
              disabled={busy || code.length !== 6}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {setup ? (isAr ? "تفعيل" : "Turn on") : (isAr ? "إيقاف" : "Turn off")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --------------------------------------------------------------------------- //
// Signed-in devices
// --------------------------------------------------------------------------- //
function timeAgo(iso: string, lang: "ar" | "en") {
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const abs = Math.abs(secs);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
  return rtf.format(Math.round(secs / 86400), "day");
}

export function SessionsCard() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [rows, setRows] = useState<DeviceSession[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    accountApi.sessions().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const end = async (id: string) => {
    setBusy(id);
    try {
      await accountApi.endSession(id);
      toast.success(isAr ? "تم تسجيل خروج الجهاز." : "That device was signed out.");
      load();
    } catch {
      toast.error(isAr ? "تعذر إنهاء الجلسة." : "Could not end that session.");
    } finally {
      setBusy(null);
    }
  };

  const endOthers = async () => {
    setBusy("others");
    try {
      const { ended } = await accountApi.endOtherSessions();
      toast.success(isAr ? `تم تسجيل الخروج من ${ended} جهاز.` : `Signed out of ${ended} other device${ended === 1 ? "" : "s"}.`);
      load();
    } catch {
      toast.error(isAr ? "تعذر تسجيل الخروج من الأجهزة الأخرى." : "Could not sign out the other devices.");
    } finally {
      setBusy(null);
    }
  };

  const others = (rows ?? []).filter((r) => !r.current).length;
  const lang = isAr ? "ar" : "en";

  return (
    <Card className={cardClass}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-lg">{t("settings.activeDevices")}</CardTitle>
          {others > 0 && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={endOthers} disabled={busy !== null}>
              {busy === "others" ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <LogOut className="w-4 h-4 me-2" />}
              {isAr ? "تسجيل الخروج من الأجهزة الأخرى" : "Sign out other devices"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isAr ? "لا توجد أجهزة أخرى مسجّلة الدخول." : "No other signed-in devices."}
          </p>
        ) : (
          rows.map((s) => {
            const Icon = s.device.type === "mobile" ? Smartphone : s.device.type === "tablet" ? Tablet : Monitor;
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-foreground" dir="auto">
                        {[s.device.browser, s.device.os].filter(Boolean).join(" · ") || (isAr ? "جهاز غير معروف" : "Unknown device")}
                      </h4>
                      {s.current && (
                        <Badge variant="success" className="text-xs">
                          {t("settings.currentDevice")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isAr ? "آخر نشاط" : "Last active"} {timeAgo(s.last_seen_at, lang)} •{" "}
                      {isAr ? "دخول" : "Signed in"}{" "}
                      {new Date(s.created_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => end(s.id)} disabled={busy !== null}>
                    {busy === s.id && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                    {t("settings.endSession")}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
