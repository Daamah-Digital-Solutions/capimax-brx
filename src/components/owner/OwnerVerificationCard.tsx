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
  Building2,
} from "lucide-react";
import { ownerApi } from "@/integrations/api/client";
import { KybDocumentVault } from "@/components/kyb/KybDocumentVault";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOwnerProfile } from "@/hooks/useOwnerProfile";

/**
 * Property-owner ENTITY verification (business KYB) — Phase 7 Wave A.
 *
 * Mirrors KycVerification's flow for the owner role: apply → submit business info →
 * request a Sumsub WebSDK access token (owner business level) → mount the SDK when
 * keys are configured, otherwise degrade clearly to the dev path (dev_grant_owner_kyb).
 * Approval itself is driven by the signed webhook on the backend — this card re-polls
 * status. NO property submission / title docs here (later wave).
 *
 * Self-contained: a minimal KYB status + verify entry for the owner dashboard,
 * consistent with how the LP/investor KYB is presented. Does not redesign the page.
 */
export function OwnerVerificationCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { ownerProfile, loading, applyAsOwner, submitKYB, refresh } = useOwnerProfile();

  const [busy, setBusy] = useState(false);

  const [biz, setBiz] = useState({
    business_type: "",
    business_registration_number: "",
    tax_id: "",
    business_address: "",
    business_description: "",
  });

  const status = ownerProfile?.status ?? null;
  const kyb = ownerProfile?.kyb_status ?? "not_started";

  const apply = async () => {
    setBusy(true);
    try {
      await applyAsOwner({
        contact_name: user?.email?.split("@")[0] || "Owner",
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
          <Building2 className="h-4 w-4 text-primary" />
          {isArabic ? "توثيق المالك (KYB)" : "Owner Verification (KYB)"}
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
            ? "تم توثيق كيانك. يمكنك تقديم العقارات بمجرد إتاحة هذه الميزة."
            : "Your entity is verified. You can submit properties once that feature is available."}
        </p>
      ) : !ownerProfile ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "ابدأ كمالك عقار: قدّم طلبك ثم أكمل توثيق الكيان (KYB)."
              : "Get started as a property owner: apply, then complete entity verification (KYB)."}
          </p>
          <Button onClick={apply} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {isArabic ? "التقديم كمالك" : "Apply as Owner"}
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
          {status === "rejected" && ownerProfile?.kyb_rejection_reason && (
            <p className="text-sm text-red-400">
              {isArabic ? "سبب الرفض: " : "Rejection reason: "}
              {ownerProfile.kyb_rejection_reason}
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
          once an owner profile exists and until approved (mirrors the LP KYB docs). */}
      {ownerProfile && status !== "approved" && (
        <KybDocumentVault
          isArabic={isArabic}
          list={ownerApi.kybDocuments}
          upload={ownerApi.uploadKYBDocument}
          download={ownerApi.downloadKYBDocument}
          onUploaded={refresh}
        />
      )}

    </div>
  );
}
