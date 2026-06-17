import { useState, useEffect } from "react";
import { 
  Building2,
  Plus,
  Eye,
  Edit,
  BarChart3,
  DollarSign,
  Users,
  TrendingUp,
  FileText,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Calendar,
  MapPin,
  Percent,
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
import { ownerApi } from "@/integrations/api/client";
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

const ownerStats = {
  totalAssets: 3,
  activeAssets: 2,
  pendingAssets: 1,
  totalRaised: 2500000,
  totalInvestors: 156,
  totalDistributed: 187500,
  pendingDistribution: 62500,
};

const assets = [
  {
    id: "1",
    name: "برج مارينا باي التجاري",
    nameEn: "Marina Bay Commercial Tower",
    location: "دبي، الإمارات",
    type: "تجاري",
    status: "active",
    totalValue: 1500000,
    unitsSold: 150,
    totalUnits: 150,
    investors: 98,
    yield: 9.5,
    raised: 1500000,
    distributed: 142500,
    nextDistribution: "2025-01-15",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400",
    submittedDate: "2024-01-15",
    listedDate: "2024-02-01",
  },
  {
    id: "2",
    name: "مساكن النخلة الفاخرة",
    nameEn: "Palm Luxury Residences",
    location: "دبي، الإمارات",
    type: "سكني",
    status: "construction",
    totalValue: 2000000,
    unitsSold: 180,
    totalUnits: 200,
    investors: 58,
    yield: 25,
    raised: 1800000,
    distributed: 0,
    progress: 65,
    completionDate: "2025-Q4",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400",
    submittedDate: "2024-06-01",
    listedDate: "2024-07-15",
  },
  {
    id: "3",
    name: "المجمع التجاري الجديد",
    nameEn: "New Commercial Complex",
    location: "الرياض، السعودية",
    type: "تجاري",
    status: "under_review",
    totalValue: 3000000,
    unitsSold: 0,
    totalUnits: 300,
    investors: 0,
    yield: 11,
    raised: 0,
    distributed: 0,
    image: "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=400",
    submittedDate: "2024-12-20",
    reviewNotes: "في انتظار مستندات التقييم",
  },
];

const recentUpdates = [
  { id: 1, type: "distribution", asset: "برج مارينا باي", message: "تم توزيع $45,000 للمستثمرين", date: "2024-12-15" },
  { id: 2, type: "milestone", asset: "مساكن النخلة", message: "اكتمال مرحلة الهيكل الخارجي", date: "2024-12-10" },
  { id: 3, type: "investor", asset: "مساكن النخلة", message: "انضم 5 مستثمرين جدد", date: "2024-12-08" },
  { id: 4, type: "document", asset: "برج مارينا باي", message: "تم رفع التقرير المالي الربعي", date: "2024-12-01" },
];

const platformMessages = [
  { id: 1, subject: "مطلوب: تقرير التقييم المحدث", asset: "المجمع التجاري الجديد", date: "2024-12-22", status: "pending" },
  { id: 2, subject: "تأكيد موعد التوزيع القادم", asset: "برج مارينا باي", date: "2024-12-18", status: "read" },
];

export default function OwnerDashboard() {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
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
                <Button variant="outline" className="gap-2">
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
              {/* Platform Messages */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">رسائل المنصة</h3>
                  </div>
                  <Badge variant="gold">{platformMessages.filter(m => m.status === "pending").length}</Badge>
                </div>

                <div className="space-y-3">
                  {platformMessages.map((message) => (
                    <div 
                      key={message.id}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-colors",
                        message.status === "pending" ? "bg-primary/5 border border-primary/20" : "bg-muted"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-medium text-foreground">{message.subject}</h4>
                        {message.status === "pending" && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{message.asset}</p>
                      <p className="text-xs text-muted-foreground">{message.date}</p>
                    </div>
                  ))}
                </div>

                <Button variant="ghost" className="w-full mt-4">عرض كل الرسائل</Button>
              </div>

              {/* Recent Updates */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">آخر التحديثات</h3>
                </div>

                <div className="space-y-4">
                  {recentUpdates.map((update) => (
                    <div key={update.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        update.type === "distribution" ? "bg-success/10" :
                        update.type === "milestone" ? "bg-info/10" :
                        update.type === "investor" ? "bg-primary/10" :
                        "bg-muted"
                      )}>
                        {update.type === "distribution" && <DollarSign className="w-4 h-4 text-success" />}
                        {update.type === "milestone" && <CheckCircle2 className="w-4 h-4 text-info" />}
                        {update.type === "investor" && <Users className="w-4 h-4 text-primary" />}
                        {update.type === "document" && <FileText className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{update.message}</p>
                        <p className="text-xs text-muted-foreground">{update.asset} • {update.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <h3 className="font-semibold text-foreground mb-4">إجراءات سريعة</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Upload className="w-4 h-4" />
                    رفع مستندات
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Send className="w-4 h-4" />
                    إرسال تحديث
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <BarChart3 className="w-4 h-4" />
                    عرض التقارير
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
