import { useState } from "react";
import { FileText, Upload, Calendar, Building2, AlertCircle, Clock, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type SukukStatus = "pending" | "under_review" | "accepted" | "rejected";

export function SukukPayment() {
  const { t, isRTL } = useLanguage();
  const [sukukId, setSukukId] = useState("");
  const [issuer, setIssuer] = useState("");
  const [sukukValue, setSukukValue] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  
  // Mock status for demo
  const [status, setStatus] = useState<SukukStatus>("pending");

  const handleFileUpload = () => {
    // Simulated file upload
    setUploadedFile("sukuk_certificate_2024.pdf");
  };

  const getStatusDisplay = () => {
    switch (status) {
      case "pending":
        return { label: t("sukuk.pending"), icon: Clock, color: "text-muted-foreground", bg: "bg-muted" };
      case "under_review":
        return { label: t("sukuk.underReview"), icon: Clock, color: "text-warning", bg: "bg-warning/10" };
      case "accepted":
        return { label: t("sukuk.accepted"), icon: Check, color: "text-success", bg: "bg-success/10" };
      case "rejected":
        return { label: t("sukuk.rejected"), icon: X, color: "text-destructive", bg: "bg-destructive/10" };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground mb-1">{t("sukuk.title")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("sukuk.description")}
            </p>
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      <div className={cn("flex items-center gap-3 p-3 rounded-lg", statusDisplay.bg)}>
        <StatusIcon className={cn("w-5 h-5", statusDisplay.color)} />
        <span className={cn("font-medium", statusDisplay.color)}>{statusDisplay.label}</span>
      </div>

      {/* Sukuk ID */}
      <div className="space-y-2">
        <Label htmlFor="sukukId">{t("sukuk.sukukId")}</Label>
        <Input
          id="sukukId"
          type="text"
          placeholder={t("sukuk.sukukIdPlaceholder")}
          value={sukukId}
          onChange={(e) => setSukukId(e.target.value)}
          dir="ltr"
        />
      </div>

      {/* Issuer */}
      <div className="space-y-2">
        <Label htmlFor="issuer">{t("sukuk.issuer")}</Label>
        <div className="relative">
          <Input
            id="issuer"
            type="text"
            placeholder={t("sukuk.issuerPlaceholder")}
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className={isRTL ? "pr-10" : "pl-10"}
          />
          <Building2 className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
            isRTL ? "right-3" : "left-3"
          )} />
        </div>
      </div>

      {/* Sukuk Value */}
      <div className="space-y-2">
        <Label htmlFor="sukukValue">{t("sukuk.sukukValue")}</Label>
        <Input
          id="sukukValue"
          type="number"
          placeholder="10000"
          value={sukukValue}
          onChange={(e) => setSukukValue(e.target.value)}
          dir="ltr"
        />
      </div>

      {/* Validity Date */}
      <div className="space-y-2">
        <Label htmlFor="validityDate">{t("sukuk.validityDate")}</Label>
        <div className="relative">
          <Input
            id="validityDate"
            type="date"
            value={validityDate}
            onChange={(e) => setValidityDate(e.target.value)}
            className={isRTL ? "pr-10" : "pl-10"}
            dir="ltr"
          />
          <Calendar className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
            isRTL ? "right-3" : "left-3"
          )} />
        </div>
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <Label>{t("sukuk.confirmationDoc")}</Label>
        {uploadedFile ? (
          <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/30 rounded-lg">
            <FileText className="w-5 h-5 text-success" />
            <span className="flex-1 text-sm font-medium text-foreground">{uploadedFile}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUploadedFile(null)}
              className="text-destructive hover:text-destructive"
            >
              {t("sukuk.remove")}
            </Button>
          </div>
        ) : (
          <button
            onClick={handleFileUpload}
            className="w-full p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <span className="text-sm font-medium">{t("sukuk.uploadDoc")}</span>
              <span className="text-xs">{t("sukuk.uploadFormats")}</span>
            </div>
          </button>
        )}
      </div>

      {/* Submit for Review */}
      {status === "pending" && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setStatus("under_review")}
          disabled={!sukukId || !issuer || !sukukValue}
        >
          <FileText className="w-4 h-4 me-2" />
          {t("sukuk.submitForReview")}
        </Button>
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
        <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          {t("sukuk.verificationNote")}
        </p>
      </div>
    </div>
  );
}
