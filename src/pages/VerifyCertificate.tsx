import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { certificatesApi } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  User, 
  Calendar, 
  DollarSign,
  FileText,
  Shield,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

const VerifyCertificate = () => {
  const { code } = useParams<{ code: string }>();
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";
  const L = (en: string, ar: string) => (isAr ? ar : en);
  const fmt = (d: string | Date, pattern: string) =>
    format(new Date(d), isAr ? pattern.replace("'at'", "'الساعة'") : pattern, isAr ? { locale: arLocale } : undefined);

  const { data: certificate, isLoading, error } = useQuery({
    queryKey: ['verify-certificate', code],
    queryFn: async () => {
      if (!code) throw new Error("No verification code provided");
      // Public, curated projection from the Django backend (SPEC §4.2).
      return await certificatesApi.verify(code);
    },
    enabled: !!code,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'final':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-lg px-4 py-2">
            <CheckCircle className="w-5 h-5 mr-2" />
            {L("Final - Verified", "نهائية - موثّقة")}
          </Badge>
        );
      case 'provisional':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-4 py-2">
            <Clock className="w-5 h-5 mr-2" />
            {L("Provisional", "مبدئية")}
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-2">
            <XCircle className="w-5 h-5 mr-2" />
            {L("Revoked", "ملغاة")}
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{L("Verifying certificate...", "جارٍ التحقق من الشهادة...")}</p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">{L("Certificate Not Found", "الشهادة غير موجودة")}</h1>
            <p className="text-muted-foreground mb-6">
              {L("The verification code", "رمز التحقق")} <span className="font-mono text-red-400" dir="ltr">{code}</span>{" "}
              {L("does not match any certificate in our system.", "لا يطابق أي شهادة في نظامنا.")}
            </p>
            <p className="text-sm text-muted-foreground">
              {L(
                "Please ensure you have entered the correct verification code or contact support if you believe this is an error.",
                "تأكد من إدخال رمز التحقق الصحيح، أو تواصل مع الدعم إذا كنت تعتقد أن هناك خطأ.",
              )}
            </p>
            <Link 
              to="/" 
              className="inline-block mt-6 text-primary hover:underline"
            >
              {L("Return to Home", "العودة للرئيسية")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Capimax BRX</h1>
          </div>
          <h2 className="text-xl text-muted-foreground">{L("Certificate Verification", "التحقق من الشهادة")}</h2>
        </div>

        {/* Status Card */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              {certificate.status === 'final' && (
                <CheckCircle className="w-20 h-20 text-green-400 mb-4" />
              )}
              {certificate.status === 'provisional' && (
                <Clock className="w-20 h-20 text-yellow-400 mb-4" />
              )}
              {certificate.status === 'revoked' && (
                <XCircle className="w-20 h-20 text-red-400 mb-4" />
              )}
              
              {getStatusBadge(certificate.status)}
              
              <p className="mt-4 text-muted-foreground">
                {certificate.status === 'final' && L("This certificate has been verified and is authentic.", "تم التحقق من هذه الشهادة وهي أصلية.")}
                {certificate.status === 'provisional' && L("This certificate is provisional and pending final approval.", "هذه الشهادة مبدئية وبانتظار الاعتماد النهائي.")}
                {certificate.status === 'revoked' &&
                  `${L("This certificate has been revoked. Reason:", "تم إلغاء هذه الشهادة. السبب:")} ${certificate.revocation_reason || L("Not specified", "غير محدد")}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {L("Certificate Details", "تفاصيل الشهادة")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Certificate Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{L("Certificate ID", "رقم الشهادة")}</p>
                <p className="font-mono font-semibold text-foreground">{certificate.certificate_id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{L("Issue Date", "تاريخ الإصدار")}</p>
                <p className="font-semibold text-foreground">
                  {fmt(certificate.issue_date, "MMMM dd, yyyy 'at' HH:mm")}
                </p>
              </div>
            </div>

            <Separator />

            {/* Investor Info */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <User className="w-4 h-4" />
                {L("Investor Information", "بيانات المستثمر")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">{L("Legal Name", "الاسم القانوني")}</p>
                  <p className="font-semibold text-foreground">{certificate.investor_name}</p>
                </div>
                {certificate.investor_id_masked && (
                  <div>
                    <p className="text-sm text-muted-foreground">{L("Investor ID", "رقم المستثمر")}</p>
                    <p className="font-mono text-foreground">{certificate.investor_id_masked}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* SPV / Property Info */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <Building2 className="w-4 h-4" />
                {L("Property & SPV Information", "بيانات العقار والشركة ذات الغرض الخاص")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">{L("SPV Name", "اسم الشركة ذات الغرض الخاص")}</p>
                  <p className="font-semibold text-foreground">{certificate.spv_name}</p>
                </div>
                {certificate.spv_registration_ref && (
                  <div>
                    <p className="text-sm text-muted-foreground">{L("Registration Reference", "مرجع التسجيل")}</p>
                    <p className="font-mono text-foreground">{certificate.spv_registration_ref}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{L("Property Name", "اسم العقار")}</p>
                  <p className="font-semibold text-foreground">{certificate.property_name}</p>
                </div>
                {certificate.property_location && (
                  <div>
                    <p className="text-sm text-muted-foreground">{L("Location", "الموقع")}</p>
                    <p className="text-foreground">{certificate.property_location}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{L("Listing ID", "رقم الإدراج")}</p>
                  <p className="font-mono text-foreground">{certificate.listing_id}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Investment Details */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <DollarSign className="w-4 h-4" />
                {L("Investment Details", "تفاصيل الاستثمار")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">{L("Investment Amount", "مبلغ الاستثمار")}</p>
                  <p className="font-semibold text-foreground">
                    ${Number(certificate.investment_amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{L("Units Purchased", "الوحدات المشتراة")}</p>
                  <p className="font-semibold text-foreground">
                    {Number(certificate.units_purchased).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{L("Unit Price", "سعر الوحدة")}</p>
                  <p className="font-semibold text-foreground">
                    ${Number(certificate.unit_price).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{L("Ownership Percentage", "نسبة الملكية")}</p>
                  <p className="font-semibold text-foreground">
                    {Number(certificate.ownership_percentage).toFixed(4)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{L("Subscription Date", "تاريخ الاكتتاب")}</p>
                  <p className="text-foreground">
                    {fmt(certificate.subscription_date, "MMMM dd, yyyy")}
                  </p>
                </div>
                {certificate.platform_fee && (
                  <div>
                    <p className="text-sm text-muted-foreground">{L("Platform Fee", "رسوم المنصة")}</p>
                    <p className="text-foreground">
                      ${Number(certificate.platform_fee).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Verification Info */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <Calendar className="w-4 h-4" />
                {L("Verification & Authorization", "التحقق والاعتماد")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">{L("Verification Code", "رمز التحقق")}</p>
                  <p className="font-mono text-foreground">{certificate.verification_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{L("Authorized Signatory", "المفوّض بالتوقيع")}</p>
                  <p className="text-foreground">{certificate.authorized_signatory}</p>
                </div>
                {certificate.digital_signature_hash && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">{L("Digital Signature Hash", "بصمة التوقيع الرقمي")}</p>
                    <p className="font-mono text-xs text-foreground break-all">
                      {certificate.digital_signature_hash}
                    </p>
                  </div>
                )}
                {certificate.finalized_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">{L("Finalized At", "تاريخ الاعتماد النهائي")}</p>
                    <p className="text-foreground">
                      {fmt(certificate.finalized_at, "MMMM dd, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>{L("This verification was performed on", "تم إجراء هذا التحقق في")} {fmt(new Date(), "MMMM dd, yyyy 'at' HH:mm")}</p>
          <p className="mt-2">
            {L("For questions about this certificate, please contact", "للاستفسار عن هذه الشهادة، تواصل مع")}{" "}
            <a href="mailto:support@capimax.io" className="text-primary hover:underline">
              support@capimax.io
            </a>
          </p>
          <Link to="/" className="inline-block mt-4 text-primary hover:underline">
            {L("Visit Capimax BRX", "زيارة Capimax BRX")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;
