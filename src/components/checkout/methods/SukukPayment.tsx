import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Upload, Loader2, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInvestment } from "@/hooks/useInvestment";
import { investmentsApi, type ApiError } from "@/integrations/api/client";
import { NovaFinancePledgeNotice } from "@/components/legal/NovaFinancePledgeNotice";
import { toast } from "sonner";

// Nova certificate (Sukuk) — the manual, admin-approved payment rail. The buyer uploads a
// Nova certificate PDF (+ reviewer metadata); it creates a PENDING investment (no charge,
// no mint) and submits the certificate for admin review. On approval the investment settles
// exactly like any completed buy (tokens + owner/broker credit + the buyer-borne fee); on
// rejection it fails with a reason. Fully separate from card/crypto/balance and the future
// PRN on-chain path. Bilingual EN/AR.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (matches the server cap)

export interface SukukPaymentProps {
  propertyId: string;
  tokenAmount: number;
  /** Token value + the buyer-borne fee — the amount the certificate must cover. */
  finalAmount: number;
  /** True only when the terms/risk gating in the parent is satisfied. */
  ready: boolean;
  /** Terms & risk declarations, rendered inline directly ABOVE the submit button. */
  declarations?: ReactNode;
  onRouteToKyc: () => void;
  onProcessing: () => void;
}

export function SukukPayment(props: SukukPaymentProps) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();
  const { processInvestment } = useInvestment();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sukukId, setSukukId] = useState("");
  const [issuer, setIssuer] = useState("");
  const [claimedValue, setClaimedValue] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error(isArabic ? "يُقبل ملف PDF فقط." : "Only a PDF file is accepted.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error(isArabic ? "الملف كبير جدًا (الحد 10 ميغابايت)." : "File too large (max 10 MB).");
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || busy) return;
    setBusy(true);
    props.onProcessing();
    try {
      // 1) Create the PENDING sukuk investment (no charge, no mint).
      const created = await processInvestment({
        property_id: props.propertyId,
        token_amount: props.tokenAmount,
        payment_method: "sukuk",
      });
      if (!created.success || !created.investment_id) {
        if (created.code === "kyc_required") {
          props.onRouteToKyc();
          return;
        }
        toast.error(created.error || (isArabic ? "تعذّر إنشاء الاستثمار" : "Could not start the investment"));
        return;
      }
      // 2) Attach the certificate → awaiting admin review (no mint here).
      await investmentsApi.uploadSukukCertificate(created.investment_id, file, {
        sukukId,
        issuer,
        claimedValue,
        validityDate,
      });
      setSubmitted(true);
      toast.success(isArabic ? "تم إرسال الشهادة للمراجعة" : "Certificate submitted for review");
    } catch (err) {
      toast.error((err as ApiError)?.message || (isArabic ? "تعذّر إرسال الشهادة" : "Could not submit the certificate"));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-warning/30 bg-warning/5">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-warning" />
          </div>
          <h3 className="font-display text-xl font-bold text-foreground mb-1">
            {isArabic ? "الشهادة قيد المراجعة" : "Certificate under review"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isArabic
              ? "استلمنا شهادة نوفا الخاصة بك. سيراجعها فريقنا وتظهر رموزك بمجرد الموافقة. سنخطرك بالنتيجة."
              : "We've received your Nova certificate. Our team will review it, and your tokens appear once it's approved. We'll notify you of the outcome."}
          </p>
          <Button variant="hero" className="w-full" onClick={() => navigate("/portfolio")}>
            {isArabic ? "الذهاب إلى المحفظة" : "Go to Portfolio"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Info */}
      <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground mb-1">
              {isArabic ? "الدفع بشهادة نوفا (صكوك)" : "Pay with a Nova certificate (Sukuk)"}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isArabic
                ? "ارفع شهادة نوفا بصيغة PDF. يراجعها فريقنا يدويًا وتُصدر رموزك بعد الموافقة."
                : "Upload your Nova certificate (PDF). Our team reviews it manually; your tokens are issued once approved."}
            </p>
          </div>
        </div>
      </div>

      {/* Amount the certificate must cover (token value + buyer-borne fee) */}
      <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
        <span className="text-sm text-muted-foreground">
          {isArabic ? "المبلغ المطلوب تغطيته" : "Amount the certificate must cover"}
        </span>
        <span className="text-lg font-bold text-primary">${props.finalAmount.toLocaleString()}</span>
      </div>

      {/* Reviewer metadata */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sukukId">{isArabic ? "رقم الصك" : "Certificate ID"}</Label>
          <Input id="sukukId" value={sukukId} onChange={(e) => setSukukId(e.target.value)} dir="ltr" placeholder="NOVA-..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuer">{isArabic ? "الجهة المُصدرة" : "Issuer"}</Label>
          <Input id="issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Nova Digital Finance" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="claimedValue">{isArabic ? "قيمة الصك" : "Certificate value"}</Label>
          <Input id="claimedValue" type="number" value={claimedValue} onChange={(e) => setClaimedValue(e.target.value)} dir="ltr" placeholder={String(props.finalAmount)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validityDate">{isArabic ? "تاريخ الصلاحية" : "Validity date"}</Label>
          <Input id="validityDate" type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} dir="ltr" />
        </div>
      </div>

      {/* File upload */}
      <div className="space-y-2">
        <Label>{isArabic ? "شهادة نوفا (PDF)" : "Nova certificate (PDF)"}</Label>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/30 rounded-lg">
            <FileText className="w-5 h-5 text-success" />
            <span className="flex-1 text-sm font-medium text-foreground truncate">{file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <span className="text-sm font-medium">{isArabic ? "اختر ملف PDF" : "Choose a PDF file"}</span>
              <span className="text-xs">{isArabic ? "PDF فقط · حتى 10 ميغابايت" : "PDF only · up to 10 MB"}</span>
            </div>
          </button>
        )}
      </div>

      {props.declarations}

      {/* Submit */}
      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!file || !props.ready || busy}
        onClick={handleSubmit}
      >
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {isArabic ? "جارٍ الإرسال..." : "Submitting..."}
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            {isArabic ? "إرسال الشهادة للمراجعة" : "Submit certificate for review"}
          </>
        )}
      </Button>
      {!props.ready && (
        <p className="text-xs text-muted-foreground text-center">
          {isArabic ? "يرجى قبول الشروط وإقرار المخاطر أعلاه أولاً." : "Please accept the terms and risk disclosure above first."}
        </p>
      )}

      {/* Mandatory pledge / mortgage disclosure */}
      <NovaFinancePledgeNotice />
    </div>
  );
}
