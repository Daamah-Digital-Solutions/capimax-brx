import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Download,
  Eye,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Shield,
  Building2,
  Calendar,
  Copy,
} from "lucide-react";
import { useCertificates, Certificate } from "@/hooks/useCertificates";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CertificatesSection() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const {
    certificates,
    loading,
    error,
    downloadCertificate,
    refreshCertificates,
  } = useCertificates();

  const handleDownload = async (cert: Certificate) => {
    setDownloading(cert.id);
    const result = await downloadCertificate(cert);
    setDownloading(null);

    if (result.success) {
      toast.success(isArabic ? "تم تحميل الشهادة" : "Certificate downloaded");
    } else {
      toast.error(result.error || (isArabic ? "فشل التحميل" : "Download failed"));
    }
  };

  const copyVerificationCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(isArabic ? "تم نسخ رمز التحقق" : "Verification code copied");
    } catch {
      toast.error(isArabic ? "فشل النسخ" : "Failed to copy");
    }
  };

  const getStatusBadge = (status: Certificate["status"]) => {
    switch (status) {
      case "final":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
            <CheckCircle className="h-3 w-3" />
            {isArabic ? "نهائي" : "Final"}
          </Badge>
        );
      case "provisional":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
            <Clock className="h-3 w-3" />
            {isArabic ? "مؤقت" : "Provisional"}
          </Badge>
        );
      case "revoked":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
            <XCircle className="h-3 w-3" />
            {isArabic ? "ملغي" : "Revoked"}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={refreshCertificates} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            {isArabic ? "إعادة المحاولة" : "Try Again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isArabic ? "شهادات الاستثمار" : "Investment Certificates"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {isArabic
                  ? "شهادات ملكيتك الرقمية"
                  : "Your digital ownership certificates"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={refreshCertificates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {certificates.length > 0 ? (
            <div className="space-y-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {cert.certificate_id}
                        </span>
                        {getStatusBadge(cert.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {cert.property_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(cert.issue_date), "MMM d, yyyy")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            {isArabic ? "المبلغ" : "Amount"}:
                          </span>
                          <span className="font-semibold ml-1">
                            ${Number(cert.investment_amount).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            {isArabic ? "الوحدات" : "Units"}:
                          </span>
                          <span className="font-semibold ml-1">
                            {Number(cert.units_purchased)}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            {isArabic ? "الملكية" : "Ownership"}:
                          </span>
                          <span className="font-semibold ml-1">
                            {Number(cert.ownership_percentage).toFixed(4)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCert(cert)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {isArabic ? "عرض" : "View"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownload(cert)}
                        disabled={downloading === cert.id}
                      >
                        {downloading === cert.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-1" />
                        )}
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">
                {isArabic ? "لا توجد شهادات بعد" : "No certificates yet"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {isArabic
                  ? "ستظهر شهاداتك هنا بعد إتمام الاستثمار"
                  : "Your certificates will appear here after completing investments"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificate Detail Modal */}
      <Dialog open={!!selectedCert} onOpenChange={() => setSelectedCert(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isArabic ? "تفاصيل الشهادة" : "Certificate Details"}
            </DialogTitle>
          </DialogHeader>

          {selectedCert && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold">
                  {selectedCert.certificate_id}
                </span>
                {getStatusBadge(selectedCert.status)}
              </div>

              {/* Investor */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                  {isArabic ? "المستثمر" : "Investor"}
                </h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="font-medium">{selectedCert.investor_name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedCert.investor_id_masked}
                  </p>
                </div>
              </div>

              {/* Property */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                  {isArabic ? "العقار" : "Property"}
                </h4>
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="font-medium">{selectedCert.property_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCert.spv_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCert.property_location}
                  </p>
                </div>
              </div>

              {/* Investment */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                  {isArabic ? "الاستثمار" : "Investment"}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "المبلغ" : "Amount"}
                    </p>
                    <p className="font-semibold">
                      ${Number(selectedCert.investment_amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "الوحدات" : "Units"}
                    </p>
                    <p className="font-semibold">
                      {Number(selectedCert.units_purchased)}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "سعر الوحدة" : "Unit Price"}
                    </p>
                    <p className="font-semibold">
                      ${Number(selectedCert.unit_price).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {isArabic ? "الملكية" : "Ownership"}
                    </p>
                    <p className="font-semibold">
                      {Number(selectedCert.ownership_percentage).toFixed(4)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                  {isArabic ? "التحقق" : "Verification"}
                </h4>
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {isArabic ? "رمز التحقق" : "Verification Code"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">
                        {selectedCert.verification_code}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          copyVerificationCode(selectedCert.verification_code)
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => handleDownload(selectedCert)}
                  disabled={downloading === selectedCert.id || !selectedCert.pdf_path}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isArabic ? "تحميل PDF" : "Download PDF"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedCert(null)}
                >
                  {isArabic ? "إغلاق" : "Close"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}