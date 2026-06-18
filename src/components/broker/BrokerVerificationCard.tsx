import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Clock,
  XCircle,
  ShieldCheck,
  Loader2,
  FileText,
  Upload,
  Copy,
  Link2,
} from "lucide-react";
import { KycVerification } from "@/components/kyc/KycVerification";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBrokerProfile } from "@/hooks/useBrokerProfile";
import { toast } from "sonner";

/**
 * Broker verification (Phase 12 Wave A; BROKER_SURFACE.md) — HYBRID:
 *   (1) IDENTITY via the reused investor <KycVerification/> (personal KYC), and
 *   (2) a professional LICENCE (number/authority + a document upload) approved by an
 *       ADMIN — the sanctioned hinge, which requires KYC approved first.
 * Once the licence is approved (status === approved) the broker role goes live and the
 * card surfaces the broker's REFERRAL CODE + share link (`/ref/<code>`).
 *
 * THIS WAVE has NO money/commission — that is Wave B.
 */
export function BrokerVerificationCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { brokerProfile, kycStatus, loading, applyAsBroker, submitLicense, uploadLicense, refresh } =
    useBrokerProfile();

  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lic, setLic] = useState({ license_number: "", license_authority: "", license_expiry: "" });

  useEffect(() => {
    if (!brokerProfile) return;
    setLic({
      license_number: brokerProfile.license_number ?? "",
      license_authority: brokerProfile.license_authority ?? "",
      license_expiry: brokerProfile.license_expiry ?? "",
    });
  }, [brokerProfile?.id]);

  const status = brokerProfile?.status ?? null;
  const kycApproved = (kycStatus?.status ?? "pending") === "approved";

  const apply = async () => {
    setBusy(true);
    try {
      await applyAsBroker({
        contact_name: user?.email?.split("@")[0] || "Broker",
        email: user?.email || "",
      });
    } finally {
      setBusy(false);
    }
  };

  const saveLicense = async () => {
    setBusy(true);
    try {
      await submitLicense(lic);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await uploadLicense(file);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    if (!brokerProfile) return;
    const url = `${window.location.origin}${brokerProfile.referral_link}`;
    navigator.clipboard.writeText(url);
    toast.success(isArabic ? "تم نسخ رابط الإحالة" : "Referral link copied");
  };

  const licValid = lic.license_number.trim() && lic.license_authority.trim();

  const licenseBadge = () => {
    if (status === "approved") {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          {isArabic ? "ترخيص موثّق" : "Licence Verified"}
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
        {isArabic ? "قيد المراجعة" : "Pending review"}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-card rounded-2xl border border-border flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isArabic ? "جارٍ التحميل..." : "Loading..."}
      </div>
    );
  }

  // Approved → show the broker their referral code + link (the Wave-A deliverable).
  if (brokerProfile && status === "approved") {
    return (
      <div className="p-6 bg-card rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            {isArabic ? "حساب الوسيط مُفعّل" : "Broker account active"}
          </div>
          {licenseBadge()}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="h-4 w-4 text-primary" />
            {isArabic ? "رابط الإحالة الخاص بك" : "Your referral link"}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-sm text-foreground truncate">
              {`${window.location.origin}${brokerProfile.referral_link}`}
            </code>
            <Button variant="outline" size="icon" onClick={copyLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? `الرمز: ${brokerProfile.referral_code} — يُربط المستثمرون الذين يسجّلون عبر هذا الرابط بك تلقائيًا.`
              : `Code: ${brokerProfile.referral_code} — investors who register via this link are linked to you automatically.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card rounded-2xl border border-border space-y-6">
      {/* --- Step 1: identity (reused investor KYC) ------------------------- */}
      {!brokerProfile ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {isArabic ? "كن وسيطًا" : "Become a broker"}
          </div>
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "ابدأ كوسيط: قدّم طلبك، ثم أكمل التحقق من الهوية وارفع رخصتك المهنية. تكسب عمولة على إحالاتك بعد التفعيل."
              : "Get started as a broker: apply, then complete identity verification and upload your professional licence. You earn commission on referrals once activated."}
          </p>
          <Button onClick={apply} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {isArabic ? "التقديم كوسيط" : "Apply as Broker"}
          </Button>
        </div>
      ) : (
        <>
          {/* Identity half — the reused, unified investor-KYC flow. */}
          <KycVerification kycStatus={kycStatus} onUpdated={refresh} />

          {/* --- Step 2: professional licence (admin-approved hinge) -------- */}
          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                {isArabic ? "الرخصة المهنية" : "Professional licence"}
              </div>
              {licenseBadge()}
            </div>

            {status === "rejected" && brokerProfile.review_notes && (
              <p className="text-sm text-red-400">
                {isArabic ? "سبب الرفض: " : "Rejection reason: "}
                {brokerProfile.review_notes}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {isArabic
                ? "يوافق المشرف على رخصتك بعد اعتماد هويتك (KYC) — وهي خطوة منفصلة. عندها يُفعّل حساب الوسيط."
                : "An admin approves your licence after your identity (KYC) is approved — a separate step. The broker account activates then."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "رقم الرخصة" : "Licence number"}</Label>
                <Input
                  value={lic.license_number}
                  onChange={(e) => setLic({ ...lic, license_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "جهة الإصدار" : "Issuing authority"}</Label>
                <Input
                  value={lic.license_authority}
                  onChange={(e) => setLic({ ...lic, license_authority: e.target.value })}
                  placeholder={isArabic ? "مثال: ريرا / دائرة الأراضي" : "e.g. RERA / Land Dept."}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isArabic ? "تاريخ الانتهاء (اختياري)" : "Expiry (optional)"}</Label>
                <Input
                  type="date"
                  value={lic.license_expiry}
                  onChange={(e) => setLic({ ...lic, license_expiry: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={saveLicense} disabled={busy || !licValid}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {isArabic ? "حفظ بيانات الرخصة" : "Save licence details"}
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload className="h-4 w-4 mr-2" />
                {brokerProfile.has_license_document
                  ? isArabic ? "استبدال المستند" : "Replace document"
                  : isArabic ? "رفع مستند الرخصة" : "Upload licence document"}
              </Button>
              {brokerProfile.has_license_document && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {isArabic ? "تم رفع المستند" : "Document uploaded"}
                </span>
              )}
            </div>

            {!kycApproved && (
              <p className="text-xs text-yellow-500">
                {isArabic
                  ? "أكمل التحقق من الهوية أولاً حتى يتمكن المشرف من اعتماد رخصتك."
                  : "Complete identity verification first so the admin can approve your licence."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
