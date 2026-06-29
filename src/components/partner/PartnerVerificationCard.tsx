import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Clock,
  XCircle,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Handshake,
  Building2,
} from "lucide-react";
import { partnerApi } from "@/integrations/api/client";
import { KybDocumentVault } from "@/components/kyb/KybDocumentVault";
import { mountSumsubWebSdk } from "@/lib/sumsub";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePartnerProfile } from "@/hooks/usePartnerProfile";

/**
 * Strategic-partner ENTITY verification (business KYB) + public-directory details —
 * Phase 11 Wave A. Mirrors DeveloperVerificationCard for the partner role: apply →
 * submit business info → request a Sumsub WebSDK token (partner business level) → mount
 * the SDK when keys are configured, otherwise degrade to the dev path
 * (dev_grant_partner_kyb). Approval is driven by the signed webhook on the backend.
 *
 * The partner is a SERVICE VENDOR (NON-EARNING) — there is NO money here. The card
 * surfaces the TWO INDEPENDENT states:
 *   (1) KYB / verification (status + kyb_status), and
 *   (2) directory_status — whether the partner appears in the PUBLIC directory, a
 *       SEPARATE admin approve/reject step. The PARTNER fills their own directory
 *       details; the admin only approves/rejects the listing.
 *
 * The assignment/deliverable work portal is a later wave (Wave B).
 */
const CATEGORIES = [
  { value: "developers", en: "Developers", ar: "المطورين" },
  { value: "hotels", en: "Hotels", ar: "الفنادق" },
  { value: "property-management", en: "Property Management", ar: "إدارة العقارات" },
  { value: "insurance", en: "Insurance", ar: "التأمين" },
  { value: "valuation", en: "Valuation", ar: "التقييم" },
  { value: "digital-finance", en: "Digital Finance", ar: "التمويل الرقمي" },
];

export function PartnerVerificationCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { partnerProfile, loading, applyAsPartner, updateDirectory, submitKYB, refresh } =
    usePartnerProfile();

  const [busy, setBusy] = useState(false);
  const [devNotice, setDevNotice] = useState(false);
  const [sdkMounted, setSdkMounted] = useState(false);
  const containerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);

  const [biz, setBiz] = useState({
    business_type: "",
    business_registration_number: "",
    tax_id: "",
    business_address: "",
    business_description: "",
  });

  const [dir, setDir] = useState({
    company_name: "",
    company_name_ar: "",
    category: "",
    description: "",
    description_ar: "",
    logo_url: "",
    country: "",
    country_ar: "",
    website: "",
  });

  // Hydrate the directory form from the loaded profile.
  useEffect(() => {
    if (!partnerProfile) return;
    setDir({
      company_name: partnerProfile.company_name ?? "",
      company_name_ar: partnerProfile.company_name_ar ?? "",
      category: partnerProfile.category ?? "",
      description: partnerProfile.description ?? "",
      description_ar: partnerProfile.description_ar ?? "",
      logo_url: partnerProfile.logo_url ?? "",
      country: partnerProfile.country ?? "",
      country_ar: partnerProfile.country_ar ?? "",
      website: partnerProfile.website ?? "",
    });
  }, [partnerProfile?.id]);

  const status = partnerProfile?.status ?? null;
  const kyb = partnerProfile?.kyb_status ?? "not_started";
  const directoryStatus = partnerProfile?.directory_status ?? "pending";

  const apply = async () => {
    setBusy(true);
    try {
      await applyAsPartner({
        contact_name: user?.email?.split("@")[0] || "Partner",
        email: user?.email || "",
      });
    } finally {
      setBusy(false);
    }
  };

  const saveDirectory = async () => {
    setBusy(true);
    try {
      await updateDirectory(dir);
    } finally {
      setBusy(false);
    }
  };

  const startVerification = async () => {
    setBusy(true);
    setDevNotice(false);
    try {
      await submitKYB(biz);
      const access = await partnerApi.kybAccessToken();
      if (access.configured && access.token) {
        await mountSumsubWebSdk({
          containerSelector: `#${containerId}`,
          accessToken: access.token,
          lang: isArabic ? "ar" : "en",
          onStatusChanged: () => refresh(),
          onComplete: () => refresh(),
        });
        setSdkMounted(true);
      } else {
        setDevNotice(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshStatus = async () => {
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const kybBadge = () => {
    if (status === "approved") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          {isArabic ? "معتمد" : "Approved"}
        </Badge>
      );
    }
    if (kyb === "under_review" || kyb === "documents_pending") {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
          <Clock className="h-3 w-3" />
          {isArabic ? "قيد المراجعة" : "Under Review"}
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
          <XCircle className="h-3 w-3" />
          {isArabic ? "مرفوض" : "Rejected"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        {isArabic ? "لم يتم التحقق" : "Not Verified"}
      </Badge>
    );
  };

  const dirBadge = () => {
    if (directoryStatus === "approved") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          {isArabic ? "مُدرج في الدليل" : "Listed in directory"}
        </Badge>
      );
    }
    if (directoryStatus === "rejected") {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
          <XCircle className="h-3 w-3" />
          {isArabic ? "مرفوض الإدراج" : "Listing rejected"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        {isArabic ? "بانتظار موافقة الإدراج" : "Listing pending review"}
      </Badge>
    );
  };

  const bizValid =
    biz.business_type.trim() &&
    biz.business_registration_number.trim() &&
    biz.business_address.trim();

  return (
    <div className="p-6 bg-card rounded-2xl border border-border space-y-6">
      {/* --- KYB / verification --------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Handshake className="h-4 w-4 text-primary" />
            {isArabic ? "توثيق الشريك (KYB)" : "Partner Verification (KYB)"}
          </div>
          {kybBadge()}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isArabic ? "جارٍ التحميل..." : "Loading..."}
          </div>
        ) : !partnerProfile ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isArabic
                ? "ابدأ كشريك خدمات: قدّم طلبك ثم أكمل توثيق الكيان (KYB) واملأ بيانات شركتك."
                : "Get started as a service partner: apply, then complete entity verification (KYB) and fill in your company details."}
            </p>
            <Button onClick={apply} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              {isArabic ? "التقديم كشريك" : "Apply as Partner"}
            </Button>
          </div>
        ) : status === "approved" ? (
          <p className="text-sm text-green-500">
            {isArabic
              ? "تم توثيق كيانك. يمكنك تلقّي المهام بمجرد إتاحة هذه الميزة."
              : "Your entity is verified. You can receive assignments once that feature is available."}
          </p>
        ) : kyb === "under_review" || kyb === "documents_pending" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isArabic
                ? "طلب التوثيق قيد المراجعة. ستتم الموافقة تلقائيًا بعد اكتمال التحقق."
                : "Your verification is under review. Approval is automatic once complete."}
            </p>
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={busy}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {isArabic ? "تحديث الحالة" : "Refresh status"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {status === "rejected" && partnerProfile?.kyb_rejection_reason && (
              <p className="text-sm text-red-400">
                {isArabic ? "سبب الرفض: " : "Rejection reason: "}
                {partnerProfile.kyb_rejection_reason}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "نوع النشاط" : "Business type"}</Label>
                <Input
                  value={biz.business_type}
                  onChange={(e) => setBiz({ ...biz, business_type: e.target.value })}
                  placeholder={isArabic ? "مثال: شركة ذات مسؤولية محدودة" : "e.g. LLC"}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "رقم السجل التجاري" : "Registration number"}</Label>
                <Input
                  value={biz.business_registration_number}
                  onChange={(e) => setBiz({ ...biz, business_registration_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "الرقم الضريبي (اختياري)" : "Tax ID (optional)"}</Label>
                <Input
                  value={biz.tax_id}
                  onChange={(e) => setBiz({ ...biz, tax_id: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "عنوان النشاط" : "Business address"}</Label>
                <Input
                  value={biz.business_address}
                  onChange={(e) => setBiz({ ...biz, business_address: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={startVerification} disabled={busy || !bizValid}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              {status === "rejected"
                ? isArabic ? "إعادة التحقق" : "Retry verification"
                : isArabic ? "بدء التحقق" : "Start verification"}
            </Button>
          </div>
        )}

        {/* Entity-KYB document vault — upload business evidence for admin review. Shown
            once a partner profile exists and until approved. SEPARATE from Wave-B
            deliverables (work product). Mirrors the LP KYB docs. */}
        {partnerProfile && status !== "approved" && (
          <KybDocumentVault
            isArabic={isArabic}
            list={partnerApi.kybDocuments}
            upload={partnerApi.uploadKYBDocument}
            download={partnerApi.downloadKYBDocument}
            onUploaded={refresh}
          />
        )}

        {/* Sumsub WebSDK mounts here when the provider is configured. */}
        <div id={containerId} ref={containerRef} className={sdkMounted ? "min-h-[480px]" : ""} />

        {devNotice && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">
                {isArabic
                  ? "مزوّد التحقق غير مُفعّل بعد (وضع التطوير)"
                  : "Verification provider not configured yet (development)"}
              </p>
              <p className="text-muted-foreground">
                {isArabic
                  ? "تم حفظ طلبك. في بيئة التطوير، يوافق المشرف عبر:"
                  : "Your request was saved. In development, approve via:"}
              </p>
              <code className="mt-2 block rounded bg-muted px-2 py-1 text-xs font-mono">
                python manage.py dev_grant_partner_kyb --email &lt;your-email&gt;
              </code>
              <Button variant="outline" size="sm" onClick={refreshStatus} disabled={busy} className="mt-3">
                <RefreshCw className="h-4 w-4 mr-2" />
                {isArabic ? "تحديث الحالة" : "Refresh status"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* --- Public-directory details (the PARTNER fills these) --------------- */}
      {partnerProfile && (
        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              {isArabic ? "بيانات الدليل العام" : "Public directory details"}
            </div>
            {dirBadge()}
          </div>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? "تظهر شركتك في الدليل العام فقط بعد موافقة المشرف على الإدراج (خطوة منفصلة عن التوثيق)."
              : "Your company appears in the public directory only after an admin approves the listing (a step separate from KYB)."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "اسم الشركة (إنجليزي)" : "Company name (EN)"}</Label>
              <Input
                value={dir.company_name}
                onChange={(e) => setDir({ ...dir, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "اسم الشركة (عربي)" : "Company name (AR)"}</Label>
              <Input
                value={dir.company_name_ar}
                onChange={(e) => setDir({ ...dir, company_name_ar: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "الفئة" : "Category"}</Label>
              <select
                value={dir.category}
                onChange={(e) => setDir({ ...dir, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{isArabic ? "اختر الفئة" : "Select category"}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {isArabic ? c.ar : c.en}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "الموقع الإلكتروني" : "Website"}</Label>
              <Input
                value={dir.website}
                onChange={(e) => setDir({ ...dir, website: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "الدولة (إنجليزي)" : "Country (EN)"}</Label>
              <Input
                value={dir.country}
                onChange={(e) => setDir({ ...dir, country: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "الدولة (عربي)" : "Country (AR)"}</Label>
              <Input
                value={dir.country_ar}
                onChange={(e) => setDir({ ...dir, country_ar: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isArabic ? "شعار (رابط)" : "Logo URL"}</Label>
              <Input
                value={dir.logo_url}
                onChange={(e) => setDir({ ...dir, logo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label className="text-xs">{isArabic ? "الوصف (إنجليزي)" : "Description (EN)"}</Label>
              <Input
                value={dir.description}
                onChange={(e) => setDir({ ...dir, description: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">{isArabic ? "الوصف (عربي)" : "Description (AR)"}</Label>
              <Input
                value={dir.description_ar}
                onChange={(e) => setDir({ ...dir, description_ar: e.target.value })}
              />
            </div>
          </div>
          <Button variant="outline" onClick={saveDirectory} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
            {isArabic ? "حفظ بيانات الدليل" : "Save directory details"}
          </Button>
        </div>
      )}
    </div>
  );
}
