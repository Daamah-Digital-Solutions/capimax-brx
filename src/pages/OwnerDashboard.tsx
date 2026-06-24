import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  BarChart3,
  DollarSign,
  Users,
  TrendingUp,
  FileText,
  MessageSquare,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  MapPin,
  ArrowUpRight,
  Download,
  Send
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { OwnerVerificationCard } from "@/components/owner/OwnerVerificationCard";
import { DeveloperVerificationCard } from "@/components/developer/DeveloperVerificationCard";
import { ownerApi, reportsApi } from "@/integrations/api/client";
import { useExport } from "@/hooks/useExport";
import { useNotifications } from "@/hooks/useNotifications";
import { categoryOf, renderNotificationCopy, relativeTime, type NotificationCategory } from "@/lib/notifications";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

// Phase 7 Wave B: real property submissions from Django.
interface SubmissionRow {
  id: string;
  name: string;
  property_type: string;
  construction_status: string;
  country: string;
  city: string;
  district: string;
  property_value_usd: number | null;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected";
  review_notes: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  // Set once the Wave-C review publishes a catalog Property (frontend id → /property/{slug}).
  published_property_slug: string | null;
  created_at: string;
}

// Category → icon/background for the Recent Updates feed (mirrors Notifications.tsx).
const notifIcon = (c: NotificationCategory) => {
  switch (c) {
    case "financial":
      return <DollarSign className="w-4 h-4 text-success" />;
    case "investment":
      return <TrendingUp className="w-4 h-4 text-primary" />;
    case "report":
      return <FileText className="w-4 h-4 text-info" />;
    case "alert":
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    case "system":
    default:
      return <Shield className="w-4 h-4 text-muted-foreground" />;
  }
};
const notifBg = (c: NotificationCategory) => {
  switch (c) {
    case "financial":
      return "bg-success/10";
    case "investment":
      return "bg-primary/10";
    case "report":
      return "bg-info/10";
    case "alert":
      return "bg-warning/10";
    case "system":
    default:
      return "bg-muted";
  }
};

export default function OwnerDashboard() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const { exporting, run: runExport } = useExport();
  // Recent Updates = the owner's REAL in-app notification feed (Phase 10). Show the
  // latest few; honest empty state when there are none. (Was a mock array.)
  const { notifications } = useNotifications();
  const recentNotifs = notifications.slice(0, 5);
  // The sidebar persona is merged "Owner / Developer" (both use /my-assets). Surface the
  // verification card that matches the user's selected role (Phase 8 Wave A). Developer
  // and owner are separate roles/KYB entities; everything else on this page is shared.
  const isDeveloper = user?.profile?.role === "developer";

  // Real property submissions (Phase 7 Wave B) + owner primary-sale earnings (Wave D).
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [earnings, setEarnings] = useState({
    total_net_proceeds: 0,
    total_units_sold: 0,
    total_investors: 0,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rows, earn] = await Promise.all([
          ownerApi.submissions(),
          ownerApi.earnings().catch(() => null),
        ]);
        if (active) {
          setSubmissions((rows as SubmissionRow[]) || []);
          if (earn) setEarnings({
            total_net_proceeds: earn.total_net_proceeds || 0,
            total_units_sold: earn.total_units_sold || 0,
            total_investors: earn.total_investors || 0,
          });
        }
      } catch {
        if (active) setSubmissions([]);
      } finally {
        if (active) setSubsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Derived dashboard stats from REAL data (Wave D). "Raised" = sum of net
  // primary-sale proceeds across the owner's published properties.
  const pendingCount = submissions.filter(
    (s) => s.status === "submitted" || s.status === "under_review",
  ).length;

  const submissionBadge = (s: SubmissionRow["status"]) => {
    switch (s) {
      case "draft":
        return <Badge variant="secondary">{isAr ? "مسودة" : "Draft"}</Badge>;
      case "submitted":
        return <Badge variant="warning">{isAr ? "تم الإرسال" : "Submitted"}</Badge>;
      case "under_review":
        return <Badge variant="warning">{isAr ? "قيد المراجعة" : "Under Review"}</Badge>;
      case "approved":
        return <Badge variant="success">{isAr ? "معتمد" : "Approved"}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{isAr ? "مرفوض" : "Rejected"}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  لوحة تحكم المالك / Owner Dashboard
                </h1>
                <p className="text-muted-foreground">إدارة أصولك ومتابعة الأداء</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={exporting !== null}
                  onClick={() => runExport("owner", () => reportsApi.export("owner-earnings", "pdf"))}
                >
                  <Download className="w-4 h-4" />
                  تقرير شامل
                </Button>
                <Link to="/submit-property">
                  <Button variant="hero" className="gap-2">
                    <Plus className="w-4 h-4" />
                    تقديم عقار جديد
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Entity verification (KYB) — real Django-backed onboarding entry. Owner
              (Phase 7 Wave A) and Developer (Phase 8 Wave A) are separate roles/KYB
              entities sharing this merged dashboard; show the card for the user's role. */}
          <div className="mb-8">
            {isDeveloper ? <DeveloperVerificationCard /> : <OwnerVerificationCard />}
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="info">{pendingCount} {isAr ? "قيد المراجعة" : "in review"}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "إجمالي الأصول" : "Total Assets"}</div>
              <div className="text-2xl font-bold text-foreground">
                {submissions.length} {isAr ? "عقارات" : "properties"}
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "إجمالي التمويل" : "Capital Raised"}</div>
              <div className="text-2xl font-bold text-success">
                ${earnings.total_net_proceeds.toLocaleString()}
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "المستثمرين" : "Investors"}</div>
              <div className="text-2xl font-bold text-foreground">{earnings.total_investors}</div>
            </div>

            {/* Real owner metric: units sold from primary sales. (Investor rental-yield
                "distributions" are a SEPARATE, later domain — not shown as owner earnings.) */}
            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <TrendingUp className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{isAr ? "الوحدات المباعة" : "Units Sold"}</div>
              <div className="text-2xl font-bold text-gradient-gold">
                {earnings.total_units_sold.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Assets */}
              <Tabs defaultValue="all" className="space-y-6">
                <div className="flex items-center justify-between">
                  <TabsList className="bg-muted/50">
                    <TabsTrigger value="all">الكل</TabsTrigger>
                    <TabsTrigger value="active">نشط</TabsTrigger>
                    <TabsTrigger value="construction">تحت الإنشاء</TabsTrigger>
                    <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
                  </TabsList>
                </div>

                {/* Real property submissions (Phase 7 Wave B) — replaces the mock
                    asset list. Sale/earnings figures (units sold, investors, funding)
                    are NOT shown here: there are no sales until a submission is
                    reviewed→published (Wave C) and earns (Wave D). */}
                <TabsContent value="all" className="space-y-4">
                  {subsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isAr ? "جارٍ التحميل..." : "Loading..."}
                    </div>
                  ) : submissions.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border p-10 text-center">
                      <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">
                        {isAr ? "لا توجد عقارات مقدّمة بعد" : "No property submissions yet"}
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {isAr
                          ? "ابدأ بتقديم عقارك الأول للمراجعة والإدراج."
                          : "Submit your first property for review and listing."}
                      </p>
                      <Link to="/submit-property">
                        <Button variant="hero" className="gap-2">
                          <Plus className="w-4 h-4" />
                          {isAr ? "تقديم عقار جديد" : "Submit New Property"}
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    submissions.map((sub, index) => (
                      <div
                        key={sub.id}
                        className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="p-4 lg:p-6">
                          <div className="flex items-start justify-between mb-4 gap-3">
                            <div>
                              <h3 className="font-display text-lg font-semibold text-foreground">
                                {sub.name || (isAr ? "عقار بدون اسم" : "Untitled property")}
                              </h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {[sub.district, sub.city, sub.country].filter(Boolean).join(", ") || "—"}
                              </p>
                            </div>
                            {submissionBadge(sub.status)}
                          </div>

                          {/* Rejection reason (Wave-C review) */}
                          {sub.status === "rejected" && sub.review_notes && (
                            <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {isAr ? "سبب الرفض" : "Rejection reason"}
                                </p>
                                <p className="text-sm text-muted-foreground">{sub.review_notes}</p>
                              </div>
                            </div>
                          )}

                          {/* Approved → link to the now-live marketplace listing (Wave C). */}
                          {sub.status === "approved" && sub.published_property_slug && (
                            <div className="mb-4 p-3 bg-success/10 rounded-lg border border-success/20 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                <p className="text-sm text-foreground">
                                  {isAr ? "تم النشر في السوق" : "Published to the marketplace"}
                                </p>
                              </div>
                              <Link to={`/property/${sub.published_property_slug}`}>
                                <Button variant="outline" size="sm" className="gap-1">
                                  <ArrowUpRight className="w-4 h-4" />
                                  {isAr ? "عرض العقار" : "View listing"}
                                </Button>
                              </Link>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-muted-foreground">{isAr ? "النوع" : "Type"}</div>
                              <div className="font-semibold text-foreground capitalize">{sub.property_type || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">{isAr ? "الحالة الإنشائية" : "Construction"}</div>
                              <div className="font-semibold text-foreground capitalize">{sub.construction_status || "—"}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">{isAr ? "القيمة" : "Value"}</div>
                              <div className="font-semibold text-success">
                                {sub.property_value_usd ? `$${Number(sub.property_value_usd).toLocaleString()}` : "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">{isAr ? "تاريخ التقديم" : "Submitted"}</div>
                              <div className="font-semibold text-foreground">
                                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : (isAr ? "مسودة" : "Draft")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Other tabs filter the same submissions list. */}
                <TabsContent value="active" className="space-y-4">
                  {submissions.filter((s) => s.status === "approved").map((sub) => (
                    <div key={sub.id} className="bg-card rounded-2xl border border-border p-4 lg:p-6 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground">{sub.name || "—"}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {[sub.district, sub.city, sub.country].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                      {submissionBadge(sub.status)}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="construction" className="space-y-4">
                  {submissions.filter((s) => s.construction_status !== "ready").map((sub) => (
                    <div key={sub.id} className="bg-card rounded-2xl border border-border p-4 lg:p-6 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground">{sub.name || "—"}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{sub.construction_status || "—"}</p>
                      </div>
                      {submissionBadge(sub.status)}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="pending" className="space-y-4">
                  {submissions.filter((s) => s.status === "submitted" || s.status === "under_review").map((sub) => (
                    <div key={sub.id} className="bg-card rounded-2xl border border-border p-4 lg:p-6 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg font-semibold text-foreground">{sub.name || "—"}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {[sub.district, sub.city, sub.country].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                      {submissionBadge(sub.status)}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Platform Messages — an admin→owner inbox. No announcements/messaging
                  backend exists yet (same gap as the /messages link), so this is an
                  honest "Coming soon" placeholder, NOT the notifications feed (that's the
                  Recent Updates card below). Card + section kept, nothing faked. */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{isAr ? "رسائل المنصة" : "Platform Messages"}</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t("support.comingSoon")}</Badge>
                </div>

                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isAr ? "لا توجد رسائل بعد" : "No messages yet"}
                  </p>
                </div>

                <Button variant="ghost" className="w-full mt-4" disabled>
                  {isAr ? "عرض كل الرسائل" : "View all messages"}
                </Button>
              </div>

              {/* Recent Updates — the owner's REAL in-app notification feed (Phase 10),
                  latest few. Type→category icon + i18n copy mirror Notifications.tsx. */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">{isAr ? "آخر التحديثات" : "Recent Updates"}</h3>
                </div>

                {recentNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Clock className="w-8 h-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {isAr ? "لا توجد تحديثات بعد" : "No updates yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentNotifs.map((notif) => {
                      const category = categoryOf(notif.type);
                      const copy = renderNotificationCopy(notif, t);
                      return (
                        <div key={notif.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            notifBg(category),
                          )}>
                            {notifIcon(category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{copy.title}</p>
                            {copy.description && (
                              <p className="text-xs text-muted-foreground">{copy.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">{relativeTime(notif.created_at, language)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Actions — real nav where a destination exists. "Send update" has
                  no compose/broadcast backend → disabled "Coming soon" (kept, not faked). */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <h3 className="font-semibold text-foreground mb-4">{isAr ? "إجراءات سريعة" : "Quick Actions"}</h3>
                <div className="space-y-2">
                  <Link to="/owner-documents">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Upload className="w-4 h-4" />
                      {isAr ? "رفع مستندات" : "Upload documents"}
                    </Button>
                  </Link>
                  <Button variant="outline" className="w-full justify-start gap-2" disabled>
                    <Send className="w-4 h-4" />
                    {isAr ? "إرسال تحديث" : "Send update"}
                    <Badge variant="outline" className="ml-auto text-[10px]">{t("support.comingSoon")}</Badge>
                  </Button>
                  <Link to="/owner-reports">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <BarChart3 className="w-4 h-4" />
                      {isAr ? "عرض التقارير" : "View reports"}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
