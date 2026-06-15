import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  FileCheck,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  FileText,
  Eye,
  Download,
  MessageSquare,
  Filter,
  Search,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

interface AssignedAsset {
  id: string;
  name: string;
  nameEn: string;
  type: string;
  location: string;
  assignedDate: string;
  dueDate: string;
  status: "pending" | "in-progress" | "submitted" | "approved" | "revision";
  progress: number;
  deliverables: Deliverable[];
}

interface Deliverable {
  id: string;
  name: string;
  nameEn: string;
  status: "pending" | "submitted" | "approved" | "revision";
  dueDate: string;
}

const assignedAssets: AssignedAsset[] = [
  {
    id: "1",
    name: "برج المارينا السكني",
    nameEn: "Marina Tower Residence",
    type: "تقييم عقاري",
    location: "دبي، الإمارات",
    assignedDate: "2024-01-10",
    dueDate: "2024-01-25",
    status: "in-progress",
    progress: 60,
    deliverables: [
      { id: "1", name: "تقرير التقييم", nameEn: "Valuation Report", status: "submitted", dueDate: "2024-01-20" },
      { id: "2", name: "تحليل السوق", nameEn: "Market Analysis", status: "approved", dueDate: "2024-01-18" },
      { id: "3", name: "صور العقار", nameEn: "Property Photos", status: "pending", dueDate: "2024-01-22" },
    ],
  },
  {
    id: "2",
    name: "مجمع الواحة التجاري",
    nameEn: "Oasis Commercial Complex",
    type: "إدارة عقارية",
    location: "أبوظبي، الإمارات",
    assignedDate: "2024-01-05",
    dueDate: "2024-02-05",
    status: "pending",
    progress: 20,
    deliverables: [
      { id: "1", name: "خطة الإدارة", nameEn: "Management Plan", status: "pending", dueDate: "2024-01-30" },
      { id: "2", name: "تقرير الصيانة", nameEn: "Maintenance Report", status: "pending", dueDate: "2024-02-01" },
    ],
  },
  {
    id: "3",
    name: "فندق النخيل",
    nameEn: "Palm Hotel",
    type: "تأمين عقاري",
    location: "دبي، الإمارات",
    assignedDate: "2024-01-01",
    dueDate: "2024-01-15",
    status: "approved",
    progress: 100,
    deliverables: [
      { id: "1", name: "وثيقة التأمين", nameEn: "Insurance Policy", status: "approved", dueDate: "2024-01-12" },
      { id: "2", name: "تقييم المخاطر", nameEn: "Risk Assessment", status: "approved", dueDate: "2024-01-10" },
    ],
  },
];

const activityLog = [
  { id: "1", action: "تم رفع تقرير التقييم", asset: "برج المارينا", time: "منذ ساعتين" },
  { id: "2", action: "تمت الموافقة على تحليل السوق", asset: "برج المارينا", time: "منذ 5 ساعات" },
  { id: "3", action: "طلب مراجعة من المنصة", asset: "مجمع الواحة", time: "منذ يوم" },
  { id: "4", action: "تم إكمال جميع التسليمات", asset: "فندق النخيل", time: "منذ 3 أيام" },
];

export default function StrategicPartners() {
  const [activeTab, setActiveTab] = useState("assets");
  const [searchTerm, setSearchTerm] = useState("");
  const { t, isRTL, language } = useLanguage();

  const getStatusBadge = (status: AssignedAsset["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning">{t("partners.statusPending")}</Badge>;
      case "in-progress":
        return <Badge variant="info">{t("partners.statusInProgress")}</Badge>;
      case "submitted":
        return <Badge variant="outline">{t("partners.statusSubmitted")}</Badge>;
      case "approved":
        return <Badge variant="success">{t("partners.statusApproved")}</Badge>;
      case "revision":
        return <Badge variant="destructive">{t("partners.statusRevision")}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className={`p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
              <Building2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {t("partners.pageTitle")}
              </h1>
              <p className="text-muted-foreground">{t("partners.pageSubtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gold" className="px-4 py-2">
              <User className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'ar' ? 'شركة التقييم العقاري المتحدة' : 'United Real Estate Valuation Co.'}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{assignedAssets.length}</p>
                <p className="text-xs text-muted-foreground">{t("partners.assignedAssets")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {assignedAssets.filter((a) => a.status === "in-progress" || a.status === "pending").length}
                </p>
                <p className="text-xs text-muted-foreground">{t("partners.inProgress")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {assignedAssets.filter((a) => a.status === "approved").length}
                </p>
                <p className="text-xs text-muted-foreground">{t("partners.completed")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {assignedAssets.filter((a) => a.status === "revision").length}
                </p>
                <p className="text-xs text-muted-foreground">{t("partners.needsRevision")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="assets" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t("partners.tabAssets")}
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              {t("partners.tabDeliverables")}
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t("partners.tabDocuments")}
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t("partners.tabActivity")}
            </TabsTrigger>
          </TabsList>

          {/* Assigned Assets */}
          <TabsContent value="assets" className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                <Input
                  placeholder={t("partners.search")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={isRTL ? 'pr-10' : 'pl-10'}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {assignedAssets.map((asset) => (
                <Card key={asset.id} className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-foreground">{language === 'ar' ? asset.name : asset.nameEn}</h3>
                          {getStatusBadge(asset.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{language === 'ar' ? asset.nameEn : asset.name}</p>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Badge variant="outline">{asset.type}</Badge>
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            📍 {asset.location}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {t("partners.delivery")}: {asset.dueDate}
                          </span>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">{t("partners.progress")}</span>
                            <span className="font-medium text-foreground">{asset.progress}%</span>
                          </div>
                          <Progress value={asset.progress} className="h-2" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t("partners.viewDetails")}
                        </Button>
                        <Button size="sm" className="bg-gradient-gold hover:opacity-90">
                          <Upload className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t("partners.uploadFiles")}
                        </Button>
                      </div>
                    </div>

                    {/* Deliverables Preview */}
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <h4 className="text-sm font-medium text-foreground mb-3">
                        {t("partners.deliverables")} ({asset.deliverables.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {asset.deliverables.map((del) => (
                          <div
                            key={del.id}
                            className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-2 ${
                              del.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : del.status === "submitted"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : del.status === "revision"
                                    ? "bg-rose-500/10 text-rose-500"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {del.status === "approved" && <CheckCircle2 className="w-3 h-3" />}
                            {del.status === "submitted" && <Clock className="w-3 h-3" />}
                            {del.status === "revision" && <AlertCircle className="w-3 h-3" />}
                            {language === 'ar' ? del.name : del.nameEn}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Deliverables */}
          <TabsContent value="deliverables" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("partners.deliverablesList")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {assignedAssets.flatMap((asset) =>
                    asset.deliverables.map((del) => (
                      <div
                        key={`${asset.id}-${del.id}`}
                        className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              del.status === "approved"
                                ? "bg-emerald-500/10"
                                : del.status === "submitted"
                                  ? "bg-blue-500/10"
                                  : "bg-muted"
                            }`}
                          >
                            <FileText
                              className={`w-5 h-5 ${
                                del.status === "approved"
                                  ? "text-emerald-500"
                                  : del.status === "submitted"
                                    ? "text-blue-500"
                                    : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{language === 'ar' ? del.name : del.nameEn}</h4>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? asset.name : asset.nameEn}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{del.dueDate}</span>
                          {getStatusBadge(del.status as AssignedAsset["status"])}
                          <Button variant="ghost" size="icon">
                            <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{t("partners.documents")}</CardTitle>
                <Button size="sm">
                  <Upload className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t("partners.uploadDocument")}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="p-12 border-2 border-dashed border-border rounded-lg text-center">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium">{t("partners.dropFilesHere")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("partners.fileTypes")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Log */}
          <TabsContent value="activity" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("partners.activityLog")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {activityLog.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-4">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p className="text-foreground">{log.action}</p>
                        <p className="text-sm text-muted-foreground">{log.asset}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{log.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
