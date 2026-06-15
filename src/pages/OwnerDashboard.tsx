import { useState } from "react";
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
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="info">{ownerStats.pendingAssets} قيد المراجعة</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">إجمالي الأصول</div>
              <div className="text-2xl font-bold text-foreground">{ownerStats.totalAssets} عقارات</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">إجمالي التمويل</div>
              <div className="text-2xl font-bold text-success">${(ownerStats.totalRaised / 1000000).toFixed(1)}M</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">المستثمرين</div>
              <div className="text-2xl font-bold text-foreground">{ownerStats.totalInvestors}</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <TrendingUp className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">التوزيعات</div>
              <div className="text-2xl font-bold text-gradient-gold">${(ownerStats.totalDistributed / 1000).toFixed(0)}K</div>
              <div className="text-xs text-muted-foreground mt-1">
                ${(ownerStats.pendingDistribution / 1000).toFixed(0)}K معلق
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

                <TabsContent value="all" className="space-y-4">
                  {assets.map((asset, index) => (
                    <div 
                      key={asset.id}
                      className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex flex-col lg:flex-row">
                        <div className="lg:w-48 h-32 lg:h-auto relative">
                          <img 
                            src={asset.image} 
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            {asset.status === "active" && <Badge variant="success">نشط</Badge>}
                            {asset.status === "construction" && <Badge variant="construction">تحت الإنشاء</Badge>}
                            {asset.status === "under_review" && <Badge variant="warning">قيد المراجعة</Badge>}
                          </div>
                        </div>

                        <div className="flex-1 p-4 lg:p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="font-display text-lg font-semibold text-foreground">{asset.name}</h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {asset.location}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="icon" asChild>
                                <Link to={`/property/${asset.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button variant="outline" size="icon">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="icon">
                                <BarChart3 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Progress for construction */}
                          {asset.status === "construction" && asset.progress && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">تقدم البناء</span>
                                <span className="text-primary font-medium">{asset.progress}%</span>
                              </div>
                              <Progress value={asset.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground mt-1">التسليم: {asset.completionDate}</p>
                            </div>
                          )}

                          {/* Review notes */}
                          {asset.status === "under_review" && asset.reviewNotes && (
                            <div className="mb-4 p-3 bg-warning/10 rounded-lg border border-warning/20 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-foreground">ملاحظة المراجعة</p>
                                <p className="text-sm text-muted-foreground">{asset.reviewNotes}</p>
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-muted-foreground">الوحدات المباعة</div>
                              <div className="font-semibold text-foreground">{asset.unitsSold}/{asset.totalUnits}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">المستثمرين</div>
                              <div className="font-semibold text-foreground">{asset.investors}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">التمويل</div>
                              <div className="font-semibold text-success">${(asset.raised / 1000).toFixed(0)}K</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">العائد</div>
                              <div className="font-semibold text-foreground">{asset.yield}%</div>
                            </div>
                          </div>

                          {/* Sales Progress */}
                          {asset.status !== "under_review" && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">تقدم المبيعات</span>
                                <span className="text-foreground">{Math.round((asset.unitsSold / asset.totalUnits) * 100)}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-gold rounded-full"
                                  style={{ width: `${(asset.unitsSold / asset.totalUnits) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                {/* Other tabs would filter the same content */}
                <TabsContent value="active">
                  {/* Active assets only */}
                </TabsContent>
                <TabsContent value="construction">
                  {/* Construction assets only */}
                </TabsContent>
                <TabsContent value="pending">
                  {/* Pending assets only */}
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
