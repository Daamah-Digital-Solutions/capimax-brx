import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KycVerification } from "@/components/kyc/KycVerification";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { kycApi, type KycStatus } from "@/integrations/api/client";

/** /kyc — identity verification (Sumsub). Needed before investing or topping up. */
export default function Kyc() {
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();
  const [status, setStatus] = useState<KycStatus | null>(null);

  const load = useCallback(() => {
    kycApi.me().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl" dir={isRTL ? "rtl" : "ltr"}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {isRTL ? "توثيق الهوية" : "Identity verification"}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? "وثّق هويتك لتتمكن من الاستثمار وشحن محفظتك."
                : "Verify your identity to invest and top up your wallet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !user ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <KycVerification kycStatus={status} onUpdated={load} />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
