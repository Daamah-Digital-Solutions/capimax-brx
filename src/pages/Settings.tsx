import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { PWASettingsSection } from "@/components/settings/PWASettingsSection";
import { RoleAccessCard } from "@/components/roles/RoleAccessCard";
import { KycStatusCard } from "@/components/kyc/KycStatusCard";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { kycApi, accountApi, apiErrorCode } from "@/integrations/api/client";
import { countryOptions } from "@/lib/countries";
import { getThemeMode, setThemeMode, type ThemeMode } from "@/lib/theme";
import { useNotificationPrefs, type PrefKey } from "@/hooks/useNotificationPrefs";
import { PasswordCard, TwoFactorCard, SessionsCard } from "@/components/settings/AccountSecurity";
import { DangerZone } from "@/components/settings/DangerZone";
import { SavedCardsManager } from "@/components/wallet/SavedCardsManager";
import { PaymentReceipts } from "@/components/wallet/PaymentReceipts";
import {
  User,
  Shield,
  Bell,
  Globe,
  CreditCard,
  Mail,
  Camera,
  Check,
  Loader2,
  Monitor,
  Moon,
  Sun,
  Settings2,
  Trash2,
} from "lucide-react";

// The per-type toggles; `id` matches the backend preference key (same list as the Notifications page).
const NOTIFICATION_TYPES: { id: PrefKey; labelKey: string }[] = [
  { id: "distributions", labelKey: "notifications.distributionsNotif" },
  { id: "installments", labelKey: "notifications.installmentsNotif" },
  { id: "newProperties", labelKey: "notifications.newProperties" },
  { id: "reports", labelKey: "notifications.reportsNotif" },
  { id: "priceAlerts", labelKey: "notifications.priceAlerts" },
  { id: "marketUpdates", labelKey: "notifications.marketUpdates" },
  { id: "security", labelKey: "notifications.security" },
];

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState(
    () => new URLSearchParams(window.location.search).get("tab") || "profile",
  );

  // Admin gate — read the real role from the Django session (AuthContext), not Supabase.
  const { user, refreshUser } = useAuth();
  const { prefs, saving: savingPref, toggle: togglePref } = useNotificationPrefs();
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode);
  const pickTheme = (mode: ThemeMode) => {
    setTheme(mode);
    setThemeMode(mode);
  };

  const isAdmin = user?.profile?.role === 'admin';

  // Real identity from the authenticated profile — never a placeholder persona.
  const isAr = language === "ar";
  const profileName = user?.profile?.full_name || user?.email || "";
  const avatarInitial = (profileName || "U").trim().charAt(0).toUpperCase();
  const roleKey = user?.profile?.role;
  const roleLabels: Record<string, { en: string; ar: string }> = {
    investor: { en: "Investor", ar: "مستثمر" },
    owner: { en: "Owner", ar: "مالك" },
    developer: { en: "Developer", ar: "مطور" },
    lp: { en: "Liquidity Provider", ar: "مزود السيولة" },
    broker: { en: "Broker", ar: "وسيط" },
    partner: { en: "Partner", ar: "شريك" },
    admin: { en: "Admin", ar: "مسؤول" },
  };
  const roleLabel = roleKey ? roleLabels[roleKey]?.[isAr ? "ar" : "en"] ?? roleKey : "";
  // The "Verified" badge reflects the real identity (KYC) status.
  const [kycApproved, setKycApproved] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    kycApi.me().then((k) => setKycApproved(k?.status === "approved")).catch(() => setKycApproved(null));
  }, [user]);

  // Personal-info form: prefill from the real profile, then stay editable so the
  // user edits their own data (not a fixed placeholder). Re-syncs once the profile
  // resolves after mount.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneField, setPhoneField] = useState("");
  const [countryField, setCountryField] = useState("");
  const [cityField, setCityField] = useState("");
  useEffect(() => {
    const parts = (user?.profile?.full_name || "").trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" "));
    setPhoneField(user?.profile?.phone || "");
    setCountryField(user?.profile?.country || "");
    setCityField(user?.profile?.city || "");
  }, [user]);

  const [savingProfile, setSavingProfile] = useState(false);
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await accountApi.updateProfile({
        first_name: firstName, last_name: lastName, phone: phoneField, country: countryField, city: cityField,
      });
      await refreshUser();
      toast.success(isAr ? "تم حفظ التغييرات." : "Changes saved.");
    } catch (e) {
      toast.error(
        apiErrorCode(e) === "name_required"
          ? isAr ? "اكتب اسمك." : "Enter your name."
          : isAr ? "تعذر حفظ التغييرات." : "Could not save the changes.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const avatarUrl = user?.profile?.avatar_url || null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isAr ? "حجم الصورة يجب ألا يتجاوز 5 ميجابايت." : "The photo must be 5 MB or less.");
      return;
    }
    setAvatarBusy(true);
    try {
      await accountApi.uploadAvatar(file);
      await refreshUser();
      toast.success(isAr ? "تم تحديث الصورة." : "Photo updated.");
    } catch (e) {
      toast.error(
        apiErrorCode(e) === "avatar_type"
          ? isAr ? "ارفع صورة JPG أو PNG أو WebP." : "Upload a JPG, PNG or WebP image."
          : isAr ? "تعذر رفع الصورة." : "Could not upload the photo.",
      );
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await accountApi.removeAvatar();
      await refreshUser();
    } catch {
      toast.error(isAr ? "تعذر حذف الصورة." : "Could not remove the photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {t("settings.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t("settings.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t("settings.security")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t("settings.notifications")}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t("settings.preferences")}
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {t("settings.billing")}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                {t("settings.admin")}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6 space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("settings.personalInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover shadow-gold" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
                        <span className="text-3xl font-bold text-primary-foreground">
                          {avatarInitial}
                        </span>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => uploadAvatar(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={avatarBusy}
                      title={isAr ? "تغيير الصورة" : "Change photo"}
                      className="absolute bottom-0 end-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg"
                    >
                      {avatarBusy ? (
                        <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 text-primary-foreground" />
                      )}
                    </button>
                    {avatarUrl && !avatarBusy && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        title={isAr ? "حذف الصورة" : "Remove photo"}
                        className="absolute bottom-0 start-0 w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shadow-lg"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {profileName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{roleLabel}</p>
                    {kycApproved ? (
                      <Badge variant="success" className="mt-2">
                        <Check className="w-3 h-3 mr-1" />
                        {t("settings.verified")}
                      </Badge>
                    ) : kycApproved === false ? (
                      <Link to="/kyc">
                        <Badge variant="outline" className="mt-2 hover:border-primary">
                          {isAr ? "الهوية غير موثّقة — وثّقها الآن" : "Identity not verified — verify now"}
                        </Badge>
                      </Link>
                    ) : null}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.firstName")}</label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.lastName")}</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.email")}</label>
                    <Input type="email" value={user?.email || ""} readOnly disabled dir="ltr" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isAr ? "لتغيير البريد الإلكتروني تواصل مع الدعم." : "To change your email, contact support."}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.phone")}</label>
                    <Input type="tel" dir="ltr" value={phoneField} onChange={(e) => setPhoneField(e.target.value)} placeholder="+971 50 000 0000" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.country")}</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3"
                      value={countryField}
                      onChange={(e) => setCountryField(e.target.value)}
                    >
                      <option value="">{isAr ? "اختر الدولة" : "Select a country"}</option>
                      {countryOptions(language).map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.city")}</label>
                    <Input value={cityField} onChange={(e) => setCityField(e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-gradient-gold hover:opacity-90" onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile && <Loader2 className="w-4 h-4 animate-spin me-2" />}
                    {t("settings.saveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KYC Status — the user's real verification state */}
            <KycStatusCard />
            {user && <RoleAccessCard />}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="mt-6 space-y-6">
            <PasswordCard />
            <TwoFactorCard />
            <SessionsCard />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("settings.notificationSettings")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {NOTIFICATION_TYPES.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                    >
                      <span className="text-foreground">{t(item.labelKey)}</span>
                      <Switch
                        checked={prefs ? !!prefs[item.id] : false}
                        disabled={!prefs || savingPref === item.id}
                        onCheckedChange={(v) => togglePref(item.id, v)}
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h4 className="font-medium text-foreground mb-4">{t("settings.deliveryChannels")}</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <span>{t("settings.inAppChannel")}</span>
                      </div>
                      <Switch checked disabled aria-label={t("settings.inAppChannel")} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <span>{t("settings.emailChannel")}</span>
                          <p className="text-xs text-muted-foreground">
                            {isAr
                              ? "تنبيهات الأمان والسحب تصلك بالبريد دائمًا."
                              : "Security and withdrawal alerts are always emailed."}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={prefs ? prefs.emailEnabled !== false : false}
                        disabled={!prefs || savingPref === "emailEnabled"}
                        onCheckedChange={(v) => togglePref("emailEnabled", v)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="mt-6 space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("settings.languageAppearance")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("settings.language")}</label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "ar" | "en")}
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-4 block">{t("settings.appearance")}</label>
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { mode: "dark", Icon: Moon, label: t("settings.dark") },
                      { mode: "light", Icon: Sun, label: t("settings.light") },
                      { mode: "auto", Icon: Monitor, label: t("settings.auto") },
                    ] as const).map(({ mode, Icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => pickTheme(mode)}
                        aria-pressed={theme === mode}
                        className={
                          theme === mode
                            ? "p-4 rounded-lg border-2 border-primary bg-muted/30 text-center"
                            : "p-4 rounded-lg border border-border bg-muted/30 text-center hover:border-primary/50 transition-colors"
                        }
                      >
                        <Icon className="w-6 h-6 mx-auto mb-2" />
                        <span className="text-sm">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>

            <DangerZone />
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="mt-6 space-y-6">
            <SavedCardsManager />
            <PaymentReceipts />
          </TabsContent>

          {/* Admin Tab */}
          {isAdmin && (
            <TabsContent value="admin" className="mt-6 space-y-6">
              <PWASettingsSection />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
