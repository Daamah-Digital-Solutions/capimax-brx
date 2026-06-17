import { useRef, useState } from "react";
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
  Send,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { PartnerVerificationCard } from "@/components/partner/PartnerVerificationCard";
import { useAssignments } from "@/hooks/useAssignments";
import { relativeTime } from "@/lib/notifications";
import type { ApiAssignment } from "@/integrations/api/client";
import { toast } from "sonner";

// service_type → localized badge label (the backend stays language-agnostic; mirrors the
// Arabic labels the mock used: "تقييم عقاري" / "إدارة عقارية" / "تأمين عقاري").
const SERVICE_LABEL: Record<string, { en: string; ar: string }> = {
  valuation: { en: "Property Valuation", ar: "تقييم عقاري" },
  "property-management": { en: "Property Management", ar: "إدارة عقارية" },
  insurance: { en: "Property Insurance", ar: "تأمين عقاري" },
};

// AssignmentEvent.event_type → localized activity-feed action (derived, not stored).
const EVENT_LABEL: Record<string, { en: string; ar: string }> = {
  assigned: { en: "New assignment received", ar: "تم استلام مهمة جديدة" },
  uploaded: { en: "Deliverable uploaded", ar: "تم رفع تسليم" },
  submitted: { en: "Submitted for review", ar: "تم الإرسال للمراجعة" },
  approved: { en: "Deliverable approved", ar: "تمت الموافقة على تسليم" },
  revision_requested: { en: "Revision requested from the platform", ar: "طلب مراجعة من المنصة" },
  completed: { en: "All deliverables completed", ar: "تم إكمال جميع التسليمات" },
};

export default function StrategicPartners() {
  const [activeTab, setActiveTab] = useState("assets");
  const [searchTerm, setSearchTerm] = useState("");
  const { t, isRTL, language } = useLanguage();
  const { user } = useAuth();
  // Phase 11 Wave A: a role=partner user does their entity KYB + fills their public-
  // directory details here. Wave B: the assignment work portal below is now wired to the
  // real /api/partner/assignments/ surface (mirrors how the developer KYB card surfaces).
  const isPartner = user?.profile?.role === "partner";
  const { assignments, activity, uploadDeliverable, submitAssignment } = useAssignments();

  // Hidden per-asset file inputs (real deliverable upload, preserving the mock buttons).
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const serviceLabel = (code: string) =>
    (language === "ar" ? SERVICE_LABEL[code]?.ar : SERVICE_LABEL[code]?.en) || code;

  const filteredAssets = assignments.filter((a) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.nameEn.toLowerCase().includes(q)
    );
  });

  const handleUploadClick = (assetId: string) => fileInputs.current[assetId]?.click();

  const handleFileChange = async (
    asset: ApiAssignment,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Upload to the next deliverable still needing work (pending → revision).
    const target =
      asset.deliverables.find((d) => d.status === "pending" || d.status === "revision") ||
      asset.deliverables.find((d) => d.status !== "approved");
    if (!target) {
      toast.info(language === "ar" ? "كل التسليمات مكتملة" : "All deliverables are complete");
      return;
    }
    await uploadDeliverable(target.id, file);
  };

  const getStatusBadge = (status: string) => {
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
      default:
        return null;
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
              {user?.email || (language === 'ar' ? 'شريك خدمات' : 'Service Partner')}
            </Badge>
          </div>
        </div>

        {/* Partner entity verification (KYB) + public-directory details — Phase 11 Wave A. */}
        {isPartner && <PartnerVerificationCard />}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{assignments.length}</p>
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
                  {assignments.filter((a) => a.status === "in-progress" || a.status === "pending").length}
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
                  {assignments.filter((a) => a.status === "approved").length}
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
                  {assignments.filter((a) => a.status === "revision").length}
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

            {filteredAssets.length === 0 && (
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="p-12 text-center text-muted-foreground">
                  {language === 'ar' ? 'لا توجد مهام مُسندة بعد' : 'No assignments yet'}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {filteredAssets.map((asset) => (
                <Card key={asset.id} className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-6">
                    <input
                      type="file"
                      hidden
                      ref={(el) => (fileInputs.current[asset.id] = el)}
                      onChange={(e) => handleFileChange(asset, e)}
                    />
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-foreground">{language === 'ar' ? asset.name : asset.nameEn}</h3>
                          {getStatusBadge(asset.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{language === 'ar' ? asset.nameEn : asset.name}</p>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Badge variant="outline">{serviceLabel(asset.service_type)}</Badge>
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            📍 {language === 'ar' ? (asset.location_ar || asset.location) : asset.location}
                          </span>
                          {asset.dueDate && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {t("partners.delivery")}: {asset.dueDate}
                            </span>
                          )}
                        </div>

                        {asset.status === "revision" && asset.review_notes && (
                          <p className="mt-3 text-sm text-rose-500">
                            {language === 'ar' ? 'ملاحظات المراجعة: ' : 'Revision notes: '}
                            {asset.review_notes}
                          </p>
                        )}

                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">{t("partners.progress")}</span>
                            <span className="font-medium text-foreground">{asset.progress}%</span>
                          </div>
                          <Progress value={asset.progress} className="h-2" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-gold hover:opacity-90"
                          disabled={asset.status === "approved"}
                          onClick={() => handleUploadClick(asset.id)}
                        >
                          <Upload className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t("partners.uploadFiles")}
                        </Button>
                        {(asset.status === "in-progress" || asset.status === "revision") && (
                          <Button variant="outline" size="sm" onClick={() => submitAssignment(asset.id)}>
                            <Send className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {language === 'ar' ? 'إرسال للمراجعة' : 'Submit for review'}
                          </Button>
                        )}
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
                  {assignments.flatMap((asset) =>
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
                          {del.dueDate && <span className="text-sm text-muted-foreground">{del.dueDate}</span>}
                          {getStatusBadge(del.status)}
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
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50">
                  {assignments.flatMap((asset) =>
                    asset.deliverables
                      .filter((del) => del.has_document)
                      .map((del) => (
                        <div key={`${asset.id}-${del.id}`} className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">{language === 'ar' ? del.name : del.nameEn}</h4>
                              <p className="text-sm text-muted-foreground">{language === 'ar' ? asset.name : asset.nameEn}</p>
                            </div>
                          </div>
                          {getStatusBadge(del.status)}
                        </div>
                      )),
                  )}
                  {assignments.every((a) => a.deliverables.every((d) => !d.has_document)) && (
                    <div className="p-12 border-2 border-dashed border-border rounded-lg text-center">
                      <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium">{t("partners.dropFilesHere")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("partners.fileTypes")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Log — derived from the real AssignmentEvent feed. */}
          <TabsContent value="activity" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">{t("partners.activityLog")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {activity.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      {language === 'ar' ? 'لا يوجد نشاط بعد' : 'No activity yet'}
                    </div>
                  )}
                  {activity.map((log) => {
                    const action = (language === "ar" ? EVENT_LABEL[log.event_type]?.ar : EVENT_LABEL[log.event_type]?.en) || log.event_type;
                    const asset = language === "ar" ? (log.property_ar || log.property) : log.property;
                    return (
                      <div key={log.id} className="flex items-center gap-4 p-4">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="text-foreground">
                            {action}{log.deliverable ? ` — ${log.deliverable}` : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">{asset}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">{relativeTime(log.created_at, language)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
