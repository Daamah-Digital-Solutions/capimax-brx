import { useState } from "react";
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
  Loader2,
  HardHat,
} from "lucide-react";
import { developerApi } from "@/integrations/api/client";
import { KybDocumentVault } from "@/components/kyb/KybDocumentVault";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDeveloperProfile } from "@/hooks/useDeveloperProfile";

/**
 * Property-developer ENTITY verification (business KYB) — Phase 8 Wave A.
 *
 * Mirrors OwnerVerificationCard for the developer role: apply → submit business info →
 * request a Sumsub WebSDK access token (developer business level) → mount the SDK when
 * keys are configured, otherwise degrade clearly to the dev path
 * (dev_grant_developer_kyb). Approval itself is driven by the signed webhook on the
 * backend — this card re-polls status. No property submission here (later wave, which
 * reuses the owner submit wizard).
 *
 * Self-contained: a minimal KYB status + verify entry for the (merged Owner/Developer)
 * dashboard, presented consistently with the owner KYB card. Does not redesign the page.
 * NOTE: unrelated to the /developers API hub (that targets software developers).
 */
export function DeveloperVerificationCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { developerProfile, loading, applyAsDeveloper, submitKYB, refresh } = useDeveloperProfile();

  const [busy, setBusy] = useState(false);

  const [biz, setBiz] = useState({
    business_type: "",
    business_registration_number: "",
    tax_id: "",
    business_address: "",
    business_description: "",
  });

  const status = developerProfile?.status ?? null;
  const kyb = developerProfile?.kyb_status ?? "not_started";

  const apply = async () => {
    setBusy(true);
    try {
      await applyAsDeveloper({
        contact_name: user?.email?.split("@")[0] || "Developer",
        email: user?.email || "",
      });
    } finally {
      setBusy(false);
    }
  };

  const startVerification = async () => {
    setBusy(true);
    try {
      // KYB is MANUAL ADMIN REVIEW (form + uploaded documents → an admin approves or
      // rejects) — there is NO Sumsub widget here. Persist the business info + advance KYB
      // to under_review; submitKYB updates the profile in place, so the card re-renders to
      // the "under review" state.
      await submitKYB(biz);
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

  const statusBadge = () => {
    if (status === "approved") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          {isArabic ? "معتمد" : "Approved"}
        </Badge>
      );
    }
    if (kyb === "under_review") {
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

  const bizValid =
    biz.business_type.trim() &&
    biz.business_registration_number.trim() &&
    biz.business_address.trim();

  return (
    <div className="p-6 bg-card rounded-2xl border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <HardHat className="h-4 w-4 text-primary" />
          {isArabic ? "توثيق المطوّر (KYB)" : "Developer Verification (KYB)"}
        </div>
        {statusBadge()}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isArabic ? "جارٍ التحميل..." : "Loading..."}
        </div>
      ) : status === "approved" ? (
        <p className="text-sm text-green-500">
          {isArabic
            ? "تم توثيق كيانك. يمكنك تقديم مشاريعك بمجرد إتاحة هذه الميزة."
            : "Your entity is verified. You can submit your projects once that feature is available."}
        </p>
      ) : !developerProfile ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "ابدأ كمطوّر عقاري: قدّم طلبك ثم أكمل توثيق الكيان (KYB)."
              : "Get started as a property developer: apply, then complete entity verification (KYB)."}
          </p>
          <Button onClick={apply} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {isArabic ? "التقديم كمطوّر" : "Apply as Developer"}
          </Button>
        </div>
      ) : kyb === "under_review" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "طلبك قيد المراجعة من قبل فريقنا. سنخطرك بمجرد الموافقة عليه."
              : "Your application is under review by our team. You'll be notified once it's approved."}
          </p>
          <Button variant="outline" size="sm" onClick={refreshStatus} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isArabic ? "تحديث الحالة" : "Refresh status"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {status === "rejected" && developerProfile?.kyb_rejection_reason && (
            <p className="text-sm text-red-400">
              {isArabic ? "سبب الرفض: " : "Rejection reason: "}
              {developerProfile.kyb_rejection_reason}
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
          once a developer profile exists and until approved (mirrors the LP KYB docs). */}
      {developerProfile && status !== "approved" && (
        <KybDocumentVault
          isArabic={isArabic}
          list={developerApi.kybDocuments}
          upload={developerApi.uploadKYBDocument}
          download={developerApi.downloadKYBDocument}
          onUploaded={refresh}
        />
      )}

    </div>
  );
}
