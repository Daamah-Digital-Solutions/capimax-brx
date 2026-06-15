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

const VerifyCertificate = () => {
  const { code } = useParams<{ code: string }>();

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
            Final - Verified
          </Badge>
        );
      case 'provisional':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-lg px-4 py-2">
            <Clock className="w-5 h-5 mr-2" />
            Provisional
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-2">
            <XCircle className="w-5 h-5 mr-2" />
            Revoked
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
          <p className="text-muted-foreground">Verifying certificate...</p>
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Certificate Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The verification code <span className="font-mono text-red-400">{code}</span> does not match any certificate in our system.
            </p>
            <p className="text-sm text-muted-foreground">
              Please ensure you have entered the correct verification code or contact support if you believe this is an error.
            </p>
            <Link 
              to="/" 
              className="inline-block mt-6 text-primary hover:underline"
            >
              Return to Home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Capimax BRX</h1>
          </div>
          <h2 className="text-xl text-muted-foreground">Certificate Verification</h2>
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
                {certificate.status === 'final' && "This certificate has been verified and is authentic."}
                {certificate.status === 'provisional' && "This certificate is provisional and pending final approval."}
                {certificate.status === 'revoked' && `This certificate has been revoked. Reason: ${certificate.revocation_reason || 'Not specified'}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Certificate Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Certificate Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Certificate ID</p>
                <p className="font-mono font-semibold text-foreground">{certificate.certificate_id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-semibold text-foreground">
                  {format(new Date(certificate.issue_date), "MMMM dd, yyyy 'at' HH:mm")}
                </p>
              </div>
            </div>

            <Separator />

            {/* Investor Info */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <User className="w-4 h-4" />
                Investor Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">Legal Name</p>
                  <p className="font-semibold text-foreground">{certificate.investor_name}</p>
                </div>
                {certificate.investor_id_masked && (
                  <div>
                    <p className="text-sm text-muted-foreground">Investor ID</p>
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
                Property & SPV Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">SPV Name</p>
                  <p className="font-semibold text-foreground">{certificate.spv_name}</p>
                </div>
                {certificate.spv_registration_ref && (
                  <div>
                    <p className="text-sm text-muted-foreground">Registration Reference</p>
                    <p className="font-mono text-foreground">{certificate.spv_registration_ref}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Property Name</p>
                  <p className="font-semibold text-foreground">{certificate.property_name}</p>
                </div>
                {certificate.property_location && (
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="text-foreground">{certificate.property_location}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Listing ID</p>
                  <p className="font-mono text-foreground">{certificate.listing_id}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Investment Details */}
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <DollarSign className="w-4 h-4" />
                Investment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">Investment Amount</p>
                  <p className="font-semibold text-foreground">
                    ${Number(certificate.investment_amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Units Purchased</p>
                  <p className="font-semibold text-foreground">
                    {Number(certificate.units_purchased).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unit Price</p>
                  <p className="font-semibold text-foreground">
                    ${Number(certificate.unit_price).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ownership Percentage</p>
                  <p className="font-semibold text-foreground">
                    {Number(certificate.ownership_percentage).toFixed(4)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Date</p>
                  <p className="text-foreground">
                    {format(new Date(certificate.subscription_date), "MMMM dd, yyyy")}
                  </p>
                </div>
                {certificate.platform_fee && (
                  <div>
                    <p className="text-sm text-muted-foreground">Platform Fee</p>
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
                Verification & Authorization
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <p className="text-sm text-muted-foreground">Verification Code</p>
                  <p className="font-mono text-foreground">{certificate.verification_code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Authorized Signatory</p>
                  <p className="text-foreground">{certificate.authorized_signatory}</p>
                </div>
                {certificate.digital_signature_hash && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Digital Signature Hash</p>
                    <p className="font-mono text-xs text-foreground break-all">
                      {certificate.digital_signature_hash}
                    </p>
                  </div>
                )}
                {certificate.finalized_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Finalized At</p>
                    <p className="text-foreground">
                      {format(new Date(certificate.finalized_at), "MMMM dd, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>This verification was performed on {format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}</p>
          <p className="mt-2">
            For questions about this certificate, please contact{" "}
            <a href="mailto:support@capimax.io" className="text-primary hover:underline">
              support@capimax.io
            </a>
          </p>
          <Link to="/" className="inline-block mt-4 text-primary hover:underline">
            Visit Capimax BRX
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyCertificate;
