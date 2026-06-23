import { useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationPrefs, type PrefKey } from "@/hooks/useNotificationPrefs";
import { categoryOf, renderNotificationCopy, relativeTime, type NotificationCategory } from "@/lib/notifications";
import {
  Bell,
  BellOff,
  DollarSign,
  TrendingUp,
  Building2,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  MailOpen,
  Settings,
  Filter,
  ChevronRight,
} from "lucide-react";

// The 7 per-type toggles. `id` matches the backend preference key (NotificationPreferences);
// `enabled` is the UI preset, used only as the fallback while the saved prefs load.
const notificationSettingsData: { id: PrefKey; labelKey: string; enabled: boolean }[] = [
  { id: "distributions", labelKey: "notifications.distributionsNotif", enabled: true },
  { id: "installments", labelKey: "notifications.installmentsNotif", enabled: true },
  { id: "newProperties", labelKey: "notifications.newProperties", enabled: true },
  { id: "reports", labelKey: "notifications.reportsNotif", enabled: true },
  { id: "priceAlerts", labelKey: "notifications.priceAlerts", enabled: false },
  { id: "marketUpdates", labelKey: "notifications.marketUpdates", enabled: true },
  { id: "security", labelKey: "notifications.security", enabled: true },
];

export default function Notifications() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  // Phase 10: real notifications from the API (was a static mock array).
  const { notifications: notifs, unreadCount, markRead, markAllRead, remove } = useNotifications();
  // Per-type toggles now PERSIST server-side (was local-only useState that reset on
  // reload). Channel/digest toggles stay UI-only "Coming soon" (no mailer/SMS/scheduler).
  const { prefs, saving, toggle } = useNotificationPrefs();
  const settingsRef = useRef<HTMLDivElement>(null);

  const getTypeIcon = (type: NotificationCategory) => {
    switch (type) {
      case "financial":
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case "investment":
        return <TrendingUp className="w-5 h-5 text-primary" />;
      case "report":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "system":
        return <Shield className="w-5 h-5 text-muted-foreground" />;
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
  };

  const getTypeBg = (type: NotificationCategory) => {
    switch (type) {
      case "financial":
        return "bg-emerald-500/10";
      case "investment":
        return "bg-primary/10";
      case "report":
        return "bg-blue-500/10";
      case "system":
        return "bg-muted/50";
      case "alert":
        return "bg-amber-500/10";
    }
  };

  const filteredNotifs = notifs.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return categoryOf(n.type) === activeTab;
  });

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {t("notifications.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {unreadCount > 0 ? `${unreadCount} ${t("notifications.unread")}` : t("notifications.noNew")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <MailOpen className="w-4 h-4 mr-2" />
              {t("notifications.markAllRead")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title={t("notifications.settings")}
              onClick={() => settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Notifications List */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="all" className="text-xs">
                  {t("notifications.all")}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {notifs.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">
                  {t("notifications.unreadTab")}
                  {unreadCount > 0 && (
                    <Badge className="ml-2 text-xs bg-primary">{unreadCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="financial" className="text-xs">
                  {t("notifications.financial")}
                </TabsTrigger>
                <TabsTrigger value="investment" className="text-xs">
                  {t("notifications.investment")}
                </TabsTrigger>
                <TabsTrigger value="alert" className="text-xs">
                  {t("notifications.alerts")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-0">
                    {filteredNotifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <BellOff className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">{t("notifications.noNotifications")}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {filteredNotifs.map((notif) => {
                          const category = categoryOf(notif.type);
                          const copy = renderNotificationCopy(notif, t);
                          return (
                          <div
                            key={notif.id}
                            className={`flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors ${
                              !notif.read ? "bg-primary/5" : ""
                            }`}
                            onClick={() => markRead(notif.id)}
                          >
                            <div
                              className={`w-10 h-10 rounded-lg ${getTypeBg(category)} flex items-center justify-center shrink-0`}
                            >
                              {getTypeIcon(category)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-medium text-foreground">
                                    {copy.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {copy.description}
                                  </p>
                                </div>
                                {!notif.read && (
                                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {relativeTime(notif.created_at, language)}
                                </span>
                                <div className="flex items-center gap-2">
                                  {notif.action_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-7"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markRead(notif.id);
                                        navigate(notif.action_url);
                                      }}
                                    >
                                      {copy.actionLabel}
                                      <ChevronRight className="w-3 h-3 mr-1" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      remove(notif.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Settings Panel */}
          <div ref={settingsRef} className="space-y-4 scroll-mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {t("notifications.settings")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Per-type toggles — bound to the user's REAL saved prefs (persist on
                    change). While loading, fall back to the UI preset (`setting.enabled`). */}
                {notificationSettingsData.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{t(setting.labelKey)}</p>
                    </div>
                    <Switch
                      checked={prefs ? prefs[setting.id] : setting.enabled}
                      disabled={!prefs || saving === setting.id}
                      onCheckedChange={(checked) => toggle(setting.id, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Channels — IN-APP is the only real delivery channel. Email/SMS need an
                external mailer/SMS provider that doesn't exist yet → disabled "Coming soon"
                (kept, not faked: toggling them would persist/deliver nothing). */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  {t("notifications.channels")}
                  <Badge variant="outline" className="text-[10px]">{t("support.comingSoon")}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.email")}</span>
                  <Switch disabled />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.inApp")}</span>
                  {/* In-app delivery is always on (the real channel) — shown checked + locked. */}
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.sms")}</span>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>

            {/* Digest — needs a scheduler/mailer that doesn't exist → disabled "Coming soon". */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  {t("notifications.digest")}
                  <Badge variant="outline" className="text-[10px]">{t("support.comingSoon")}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.dailyDigest")}</span>
                  <Switch disabled />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.weeklyDigest")}</span>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
