import { MainLayout } from "@/components/layout/MainLayout";
import { BrokerVerificationCard } from "@/components/broker/BrokerVerificationCard";
import { RoleAccessGate } from "@/components/roles/RoleAccessGate";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ShieldCheck, Users } from "lucide-react";

/**
 * Broker onboarding / verification page.
 *
 * This is the ONE reachable place a broker completes activation: apply → identity
 * KYC → professional licence (admin-approved hinge). Mirrors the LP pattern, where
 * `/liquidity-provider` surfaces the registration flow until approved. Previously the
 * broker card lived only on the retired `BrokerDashboard` (off-nav, redirected away),
 * so a newly-registered broker had no in-app path to submit their licence — this fixes
 * that. For an already-approved broker the card shows their referral code + share link.
 */
export default function BrokerVerification() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  // Multi-role: the broker area opens once the Broker role is held (approved); a broker
  // record made through the earlier verification flow keeps its card too.
  const { holds, status } = useRoles();
  const isBroker = holds("broker") || (user?.profile?.role === "broker" && status("broker") !== "available");

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {isArabic ? "توثيق الوسيط" : "Broker Verification"}
                </h1>
                <p className="text-muted-foreground">
                  {isArabic
                    ? "قدّم طلبك، ووثّق هويتك ورخصتك المهنية لتفعيل حساب الوسيط."
                    : "Apply, then verify your identity and professional licence to activate your broker account."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="max-w-3xl mx-auto">
            {isBroker ? (
              <BrokerVerificationCard />
            ) : (
              <RoleAccessGate role="broker" />
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
