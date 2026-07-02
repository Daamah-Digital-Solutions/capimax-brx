import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  XCircle,
  Shield,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { kycApi, type KycStatus } from "@/integrations/api/client";
import { mountSumsubWebSdk } from "@/lib/sumsub";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface KycVerificationProps {
  kycStatus: KycStatus | null;
  /** Personal info to persist on submit (optional). */
  personalInfo?: Record<string, unknown>;
  /** Called after the status changes so the parent re-fetches wallet/KYC. */
  onUpdated?: () => void;
}

/**
 * The single, unified investor-KYC entry point (Phase 4 #7). Used by
 * WalletSection (the portfolio Wallet tab) so there is ONE flow.
 *
 * Flow: submit → request a Sumsub WebSDK access token → mount the SDK when keys are
 * configured; otherwise degrade clearly to the dev path (no break). Approval itself
 * is driven by the signed webhook on the backend — this component re-polls status.
 */
export function KycVerification({ kycStatus, personalInfo, onUpdated }: KycVerificationProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [busy, setBusy] = useState(false);
  const [devNotice, setDevNotice] = useState(false);
  const [sdkMounted, setSdkMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const status = kycStatus?.status ?? "pending";

  const startVerification = async () => {
    setBusy(true);
    setDevNotice(false);
    try {
      // Fetch the SDK access token FIRST, then mount the widget BEFORE any parent
      // refresh. onUpdated() flips the wallet section into its loading state, which
      // unmounts this whole card (and the SDK container) — so it must run only AFTER
      // the widget is open, and only when the user actually submits their documents.
      const access = await kycApi.accessToken();
      if (access.configured && access.token && containerRef.current) {
        // Persist any personal info (optional) — WITHOUT triggering a UI refresh/unmount.
        await kycApi.submit(personalInfo ?? {});
        // Launch into the live container element (always rendered below), so the
        // selector always resolves and the widget opens and stays open.
        await mountSumsubWebSdk({
          container: containerRef.current,
          accessToken: access.token,
          lang: isArabic ? "ar" : "en",
          // Move to "under review" only after the user submits docs (or the SDK
          // completes) — never on intermediate status changes.
          onSubmitted: () => onUpdated?.(),
          onComplete: () => onUpdated?.(),
        });
        setSdkMounted(true);
      } else if (!access.configured) {
        // Keys not provisioned yet → persist + show the dev path rather than break.
        await kycApi.submit(personalInfo ?? {});
        onUpdated?.();
        setDevNotice(true);
      }
    } catch {
      toast.error(
        isArabic ? "تعذّر بدء التحقق. حاول مجددًا." : "Could not start verification. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      await kycApi.me();
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = () => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            {isArabic ? "معتمد" : "Approved"}
          </Badge>
        );
      case "submitted":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
            <Clock className="h-3 w-3" />
            {isArabic ? "قيد المراجعة" : "Under Review"}
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
            <XCircle className="h-3 w-3" />
            {isArabic ? "مرفوض" : "Rejected"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {isArabic ? "لم يتم التحقق" : "Not Verified"}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-primary" />
          {isArabic ? "التحقق من الهوية (KYC)" : "Identity Verification (KYC)"}
        </div>
        {statusBadge()}
      </div>

      {status === "approved" ? (
        <p className="text-sm text-green-500">
          {isArabic
            ? "تم التحقق من هويتك. محفظتك جاهزة ويمكنك الاستثمار."
            : "Your identity is verified. Your wallet is ready and you can invest."}
        </p>
      ) : status === "submitted" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? "طلبك قيد المراجعة. ستتم الموافقة تلقائيًا بعد اكتمال التحقق."
              : "Your verification is under review. Approval is automatic once complete."}
          </p>
          <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isArabic ? "تحديث الحالة" : "Refresh status"}
          </Button>
        </div>
      ) : sdkMounted ? (
        <p className="text-sm text-muted-foreground">
          {isArabic
            ? "أكمل خطوات التحقق أدناه."
            : "Complete the verification steps below."}
        </p>
      ) : (
        <div className="space-y-3">
          {status === "rejected" && kycStatus?.rejection_reason && (
            <p className="text-sm text-red-400">
              {isArabic ? "سبب الرفض: " : "Rejection reason: "}
              {kycStatus.rejection_reason}
            </p>
          )}
          <Button onClick={startVerification} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            {status === "rejected"
              ? isArabic
                ? "إعادة التحقق"
                : "Retry verification"
              : isArabic
                ? "بدء التحقق"
                : "Start verification"}
          </Button>
        </div>
      )}

      {/* Sumsub WebSDK mounts here when the provider is configured. The container is
          always rendered (regardless of status) so its ref is stable at launch time. */}
      <div ref={containerRef} className={sdkMounted ? "min-h-[480px]" : ""} />

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
              python manage.py dev_grant_kyc --email &lt;your-email&gt;
            </code>
            <Button variant="outline" size="sm" onClick={refresh} disabled={busy} className="mt-3">
              <RefreshCw className="h-4 w-4 mr-2" />
              {isArabic ? "تحديث الحالة" : "Refresh status"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
