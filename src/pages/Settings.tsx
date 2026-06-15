import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { PWASettingsSection } from "@/components/settings/PWASettingsSection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  Shield,
  Bell,
  Globe,
  CreditCard,
  Lock,
  Smartphone,
  Mail,
  Eye,
  EyeOff,
  Camera,
  Check,
  AlertTriangle,
  LogOut,
  Trash2,
  Monitor,
  Moon,
  Sun,
  Settings2,
} from "lucide-react";

const devices = [
  { id: "1", name: "iPhone 15 Pro", type: "mobile", locationAr: "دبي، الإمارات", locationEn: "Dubai, UAE", lastActiveAr: "الآن", lastActiveEn: "Now", current: true },
  { id: "2", name: "MacBook Pro", type: "desktop", locationAr: "دبي، الإمارات", locationEn: "Dubai, UAE", lastActiveAr: "منذ ساعة", lastActiveEn: "1 hour ago", current: false },
  { id: "3", name: "Windows PC", type: "desktop", locationAr: "أبوظبي، الإمارات", locationEn: "Abu Dhabi, UAE", lastActiveAr: "منذ 3 أيام", lastActiveEn: "3 days ago", current: false },
];

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);

  // Query to check if the current user is an admin
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-role'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      return data;
    },
  });

  const isAdmin = userProfile?.role === 'admin';

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
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
                      <span className="text-3xl font-bold text-primary-foreground">
                        {language === "ar" ? "م" : "M"}
                      </span>
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                      <Camera className="w-4 h-4 text-primary-foreground" />
                    </button>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {language === "ar" ? "محمد أحمد" : "Mohammed Ahmed"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{t("settings.verifiedInvestor")}</p>
                    <Badge variant="success" className="mt-2">
                      <Check className="w-3 h-3 mr-1" />
                      {t("settings.verified")}
                    </Badge>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.firstName")}</label>
                    <Input defaultValue={language === "ar" ? "محمد" : "Mohammed"} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.lastName")}</label>
                    <Input defaultValue={language === "ar" ? "أحمد" : "Ahmed"} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.email")}</label>
                    <Input type="email" defaultValue="mohammed@example.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.phone")}</label>
                    <Input type="tel" defaultValue="+971 50 XXX XXXX" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.country")}</label>
                    <Input defaultValue={language === "ar" ? "الإمارات العربية المتحدة" : "United Arab Emirates"} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.city")}</label>
                    <Input defaultValue={language === "ar" ? "دبي" : "Dubai"} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-gradient-gold hover:opacity-90">{t("settings.saveChanges")}</Button>
                </div>
              </CardContent>
            </Card>

            {/* KYC Status */}
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t("settings.kycVerification")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.kycVerified")} 15 {language === "ar" ? "يناير" : "January"} 2024
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">{t("settings.complete")}</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="mt-6 space-y-6">
            {/* Password */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  {t("settings.password")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("settings.currentPassword")}</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" />
                    <button
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.newPassword")}</label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t("settings.confirmPassword")}</label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline">{t("settings.changePassword")}</Button>
                </div>
              </CardContent>
            </Card>

            {/* 2FA */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t("settings.twoFactorAuth")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.twoFactorDesc")}
                      </p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t("settings.activeDevices")}</CardTitle>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("settings.logoutAll")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        {device.type === "mobile" ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Monitor className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{device.name}</h4>
                          {device.current && (
                            <Badge variant="success" className="text-xs">
                              {t("settings.currentDevice")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {language === "ar" ? device.locationAr : device.locationEn} • {language === "ar" ? device.lastActiveAr : device.lastActiveEn}
                        </p>
                      </div>
                    </div>
                    {!device.current && (
                      <Button variant="ghost" size="sm" className="text-destructive">
                        {t("settings.endSession")}
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("settings.notificationSettings")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { id: "distributions", labelKey: "settings.distributionsNotif", enabled: true },
                    { id: "installments", labelKey: "settings.installmentsNotif", enabled: true },
                    { id: "properties", labelKey: "settings.newProperties", enabled: true },
                    { id: "reports", labelKey: "settings.reportsNotif", enabled: true },
                    { id: "market", labelKey: "settings.marketAlerts", enabled: false },
                    { id: "security", labelKey: "settings.securityAlerts", enabled: true },
                    { id: "marketing", labelKey: "settings.marketing", enabled: false },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                    >
                      <span className="text-foreground">{t(item.labelKey)}</span>
                      <Switch defaultChecked={item.enabled} />
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h4 className="font-medium text-foreground mb-4">{t("settings.deliveryChannels")}</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <span>{t("settings.emailChannel")}</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-muted-foreground" />
                        <span>{t("settings.inAppChannel")}</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-muted-foreground" />
                        <span>{t("settings.smsChannel")}</span>
                      </div>
                      <Switch />
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
                    <button className="p-4 rounded-lg border-2 border-primary bg-muted/30 text-center">
                      <Moon className="w-6 h-6 mx-auto mb-2" />
                      <span className="text-sm">{t("settings.dark")}</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-muted/30 text-center hover:border-primary/50 transition-colors">
                      <Sun className="w-6 h-6 mx-auto mb-2" />
                      <span className="text-sm">{t("settings.light")}</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-muted/30 text-center hover:border-primary/50 transition-colors">
                      <Monitor className="w-6 h-6 mx-auto mb-2" />
                      <span className="text-sm">{t("settings.auto")}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("settings.defaultCurrency")}</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3">
                    <option value="USD">USD - {language === "ar" ? "دولار أمريكي" : "US Dollar"}</option>
                    <option value="AED">AED - {language === "ar" ? "درهم إماراتي" : "UAE Dirham"}</option>
                    <option value="EUR">EUR - {language === "ar" ? "يورو" : "Euro"}</option>
                    <option value="GBP">GBP - {language === "ar" ? "جنيه استرليني" : "British Pound"}</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="bg-destructive/5 border-destructive/20">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t("settings.dangerZone")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("settings.dangerZoneDesc")}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("settings.deactivateAccount")}
                  </Button>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("settings.deleteAccount")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-8 text-center">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{t("settings.billing")}</h3>
                <p className="text-muted-foreground">{t("settings.subtitle")}</p>
              </CardContent>
            </Card>
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
