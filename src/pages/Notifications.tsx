import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
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

interface Notification {
  id: string;
  type: "financial" | "investment" | "report" | "system" | "alert";
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  actionLabelEn?: string;
}

const notifications: Notification[] = [
  {
    id: "1",
    type: "financial",
    title: "Distribution Received",
    titleAr: "تم استلام التوزيعات",
    description: "You received $1,250 from Marina Tower investment",
    descriptionAr: "تم استلام 1,250 دولار من استثمار برج المارينا",
    timestamp: "2h ago",
    read: false,
    actionUrl: "/distributions",
    actionLabel: "عرض التفاصيل",
    actionLabelEn: "View Details",
  },
  {
    id: "2",
    type: "investment",
    title: "New Property Listed",
    titleAr: "عقار جديد متاح",
    description: "A new property matching your preferences is now available",
    descriptionAr: "عقار جديد يتوافق مع تفضيلاتك متاح الآن",
    timestamp: "5h ago",
    read: false,
    actionUrl: "/marketplace",
    actionLabel: "استعرض الآن",
    actionLabelEn: "Browse Now",
  },
  {
    id: "3",
    type: "alert",
    title: "Installment Due Tomorrow",
    titleAr: "قسط مستحق غداً",
    description: "Your next installment of $2,500 for Palm Residences is due",
    descriptionAr: "القسط التالي بمبلغ 2,500 دولار لمشروع نخيل ريزيدنس مستحق",
    timestamp: "1 day ago",
    read: false,
    actionUrl: "/installments",
    actionLabel: "الدفع الآن",
    actionLabelEn: "Pay Now",
  },
  {
    id: "4",
    type: "report",
    title: "Q4 Report Available",
    titleAr: "تقرير الربع الرابع متاح",
    description: "New quarterly report for your investments is ready",
    descriptionAr: "التقرير الفصلي الجديد لاستثماراتك جاهز",
    timestamp: "3 days ago",
    read: true,
    actionUrl: "/reports",
    actionLabel: "عرض التقرير",
    actionLabelEn: "View Report",
  },
  {
    id: "5",
    type: "system",
    title: "KYC Verification Complete",
    titleAr: "اكتمال التحقق من الهوية",
    description: "Your identity has been verified successfully",
    descriptionAr: "تم التحقق من هويتك بنجاح",
    timestamp: "1 week ago",
    read: true,
  },
  {
    id: "6",
    type: "investment",
    title: "Secondary Market Trade Executed",
    titleAr: "تم تنفيذ صفقة السوق الثانوي",
    description: "Your sell order for 5 units was executed at $1,150/unit",
    descriptionAr: "تم تنفيذ أمر البيع الخاص بك لـ 5 وحدات بسعر 1,150 دولار/وحدة",
    timestamp: "1 week ago",
    read: true,
    actionUrl: "/secondary-market",
    actionLabel: "عرض التفاصيل",
    actionLabelEn: "View Details",
  },
];

const notificationSettingsData = [
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
  const [activeTab, setActiveTab] = useState("all");
  const [notifs, setNotifs] = useState(notifications);
  const [settings, setSettings] = useState(notificationSettingsData);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const getTypeIcon = (type: Notification["type"]) => {
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

  const getTypeBg = (type: Notification["type"]) => {
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

  const markAsRead = (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifs = notifs.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return n.type === activeTab;
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
            <Button variant="outline" size="icon">
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
                        {filteredNotifs.map((notif) => (
                          <div
                            key={notif.id}
                            className={`flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors ${
                              !notif.read ? "bg-primary/5" : ""
                            }`}
                            onClick={() => markAsRead(notif.id)}
                          >
                            <div
                              className={`w-10 h-10 rounded-lg ${getTypeBg(notif.type)} flex items-center justify-center shrink-0`}
                            >
                              {getTypeIcon(notif.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-medium text-foreground">
                                    {language === "ar" ? notif.titleAr : notif.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {language === "ar" ? notif.descriptionAr : notif.description}
                                  </p>
                                </div>
                                {!notif.read && (
                                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {notif.timestamp}
                                </span>
                                <div className="flex items-center gap-2">
                                  {notif.actionUrl && (
                                    <Button variant="ghost" size="sm" className="text-xs h-7">
                                      {language === "ar" ? notif.actionLabel : notif.actionLabelEn || notif.actionLabel}
                                      <ChevronRight className="w-3 h-3 mr-1" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notif.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Settings Panel */}
          <div className="space-y-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {t("notifications.settings")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{t(setting.labelKey)}</p>
                    </div>
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={(checked) =>
                        setSettings((prev) =>
                          prev.map((s) => (s.id === setting.id ? { ...s, enabled: checked } : s))
                        )
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("notifications.channels")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.email")}</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.inApp")}</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.sms")}</span>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("notifications.digest")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.dailyDigest")}</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("notifications.weeklyDigest")}</span>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
