import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { InvestmentSummaryPanel } from "@/components/checkout/InvestmentSummaryPanel";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PaymentConfirmationModal } from "@/components/checkout/PaymentConfirmationModal";
import { PaymentResultModal } from "@/components/checkout/PaymentResultModal";
import { StripeCardCheckout } from "@/components/checkout/StripeCardCheckout";
import { NowCryptoCheckout } from "@/components/checkout/NowCryptoCheckout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Lock, Shield, ArrowLeft, ArrowRight, Plus, Minus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInvestment } from "@/hooks/useInvestment";
import { useAuth } from "@/contexts/AuthContext";
import { propertiesApi, kycApi, walletsApi } from "@/integrations/api/client";
import { toast } from "sonner";

export type PaymentMethod = "card" | "apple_pay" | "google_pay" | "crypto" | "pronova" | "sukuk" | "balance";
export type PaymentStatus = "idle" | "processing" | "success" | "failed";

export interface InvestmentData {
  propertyId: string;
  propertyName: string;
  propertyNameAr: string;
  assetType: string;
  assetTypeEn: string;
  investmentAmount: number;
  units: number;
  platformFee: number;
  managementFee: number;
  totalPayable: number;
  currency: string;
  isInstallment?: boolean;
  downPayment?: number;
  installmentAmount?: number;
  installmentDuration?: number;
}

const MIN_UNITS = 1;
// Fallback fee rates if a property doesn't carry its own (seeded properties all do).
const DEFAULT_PLATFORM_FEE_RATE = 0.015;
const DEFAULT_MANAGEMENT_FEE_RATE = 0.005;

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { processInvestment } = useInvestment();

  // Get params from URL
  const propertyId = searchParams.get("property") || "1";
  const urlUnits = parseInt(searchParams.get("units") || "1");
  // Reinvestment (REINVESTMENTS_SURFACE.md): ?reinvest=true → pre-select "Pay from balance",
  // funding the buy from the investor's accrued internal balance (no PSP). Same price/fees.
  const reinvestMode = searchParams.get("reinvest") === "true";

  // Installments (Wave B): the calculator passes type=installment + the terms. When set,
  // the server charges only the DOWN-PAYMENT (not the full price) and mints the full
  // position LOCKED on the confirmed webhook. Installments are settlement-gated → card/crypto.
  const isInstallment = searchParams.get("type") === "installment";
  const downPaymentPercent = Number(searchParams.get("down")) || 0;
  const installmentCount = parseInt(searchParams.get("duration") || "0") || 0;
  const installmentFrequency: "monthly" | "quarterly" =
    searchParams.get("frequency") === "quarterly" ? "quarterly" : "monthly";
  const installmentTerms =
    isInstallment && downPaymentPercent > 0 && installmentCount > 0
      ? {
          down_payment_percent: downPaymentPercent,
          n_installments: installmentCount,
          frequency: installmentFrequency,
        }
      : undefined;

  // Phase 3 Wave 2: read the REAL property (token_price, token_supply, fees) from the
  // Phase-2 property API. Replaces the old inline 2-property table, the hardcoded
  // /1000 ownership, and the MAX_UNITS=100 cap (the approved token-economics fix).
  const [property, setProperty] = useState<any | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [units, setUnits] = useState(
    Number.isFinite(urlUnits) && urlUnits > 0 ? urlUnits : MIN_UNITS
  );
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [tokensMinted, setTokensMinted] = useState(false);
  // Phase 4 #1: KYC is a prerequisite for investing. We check status up front so a
  // non-approved user is routed to the KYC flow gracefully (not a raw error). null
  // = unknown/not-logged-in; the backend remains the authoritative gate.
  const [kycApproved, setKycApproved] = useState<boolean | null>(null);
  // Available internal balance (distribution/sale yield) → funds a "Pay from balance"
  // reinvestment. null = unknown/not-logged-in.
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setKycApproved(null);
      setAvailableBalance(null);
      return;
    }
    let active = true;
    kycApi
      .me()
      .then((k) => active && setKycApproved(k.status === "approved"))
      .catch(() => active && setKycApproved(null));
    walletsApi
      .balance()
      .then((b) => active && setAvailableBalance(Number(b.current_balance)))
      .catch(() => active && setAvailableBalance(0));
    return () => {
      active = false;
    };
  }, [user]);

  // Shared result handler for the real-PSP flows (Stripe card / NOW crypto). Both
  // are webhook/IPN-gated, so a "success" may arrive with tokens still minting.
  const handlePspResult = ({
    status,
    tokensMinted,
  }: {
    status: "success" | "failed";
    tokensMinted: boolean;
  }) => {
    setPaymentStatus(status);
    setTokensMinted(tokensMinted);
    if (status === "success") {
      toast.success(
        tokensMinted
          ? isRTL
            ? "تم الدفع وإصدار الرموز بنجاح!"
            : "Payment confirmed and tokens minted!"
          : isRTL
            ? "تم الدفع! يتم إصدار الرموز الآن."
            : "Payment confirmed! Your tokens are being minted.",
      );
    }
    setShowResult(true);
  };

  // Send a non-approved user to the unified KYC flow (Portfolio → Wallet tab).
  const routeToKyc = () => {
    toast.info(
      isRTL
        ? "يلزم إكمال التحقق (KYC) قبل الاستثمار."
        : "Identity verification (KYC) is required before investing.",
    );
    navigate("/portfolio?tab=wallet");
  };

  useEffect(() => {
    let active = true;
    setLoadError(false);
    propertiesApi
      .detail(propertyId)
      .then((p) => {
        if (active) setProperty(p);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [propertyId]);

  // --- Real economics from the property (LOCKED policy) ---------------------- //
  const unitPrice = property ? Number(property.tokenPrice) : 0; // per-property, admin-set
  const tokenSupply = property ? Number(property.tokenSupply) : 0; // single source of truth
  // Ceiling for the unit selector. The AUTHORITATIVE available-tokens check is
  // server-side (POST /api/investments/ rejects over-purchase with 422); here we cap
  // at the total supply so the input is never the old hardcoded 100.
  const maxUnits = tokenSupply > 0 ? tokenSupply : MIN_UNITS;
  const platformRate = property?.fees
    ? Number(property.fees.platformFee) / 100
    : DEFAULT_PLATFORM_FEE_RATE;
  const managementRate = property?.fees
    ? Number(property.fees.managementFee) / 100
    : DEFAULT_MANAGEMENT_FEE_RATE;

  // Clamp the chosen unit count once the real supply is known.
  useEffect(() => {
    if (property) setUnits((u) => Math.min(maxUnits, Math.max(MIN_UNITS, u)));
  }, [property, maxUnits]);

  // Reinvest mode: pre-select "Pay from balance" once the balance is known (installments
  // are gated to card/crypto, so never auto-select balance for them).
  useEffect(() => {
    if (reinvestMode && availableBalance !== null && !isInstallment && selectedMethod === null) {
      setSelectedMethod("balance");
    }
  }, [reinvestMode, availableBalance, isInstallment, selectedMethod]);

  const investment = useMemo<InvestmentData>(() => {
    const investmentAmount = units * unitPrice;
    const platformFee = Math.round(investmentAmount * platformRate);
    const managementFee = Math.round(investmentAmount * managementRate);
    const totalPayable = investmentAmount + platformFee + managementFee;

    return {
      propertyId,
      propertyName: property?.name ?? "",
      propertyNameAr: property?.nameAr ?? "",
      assetType: property?.assetType ?? "",
      assetTypeEn: property?.assetType ?? "",
      currency: "USD",
      investmentAmount,
      units,
      platformFee,
      managementFee,
      totalPayable,
      isInstallment: false,
    };
  }, [units, unitPrice, platformRate, managementRate, property, propertyId]);

  const pronovaDiscount = selectedMethod === "pronova" ? investment.totalPayable * 0.05 : 0;
  // The down-payment for an installment = full position × down% (display; the server is
  // authoritative + cent-exact). The financed remainder is charged later (Wave C).
  const downPaymentAmount = installmentTerms
    ? Math.round(investment.investmentAmount * downPaymentPercent) / 100
    : 0;
  // The amount CHARGED now: the down-payment for an installment, else the full payable.
  const finalAmount = installmentTerms
    ? downPaymentAmount
    : investment.totalPayable - pronovaDiscount;

  const handleUnitsChange = (newUnits: number) => {
    const clamped = Math.min(maxUnits, Math.max(MIN_UNITS, newUnits));
    setUnits(clamped);
  };

  // Balance-funded buys are gated on sufficient balance (the backend debits the
  // investment amount = units × price; an insufficient balance is rejected server-side).
  const balanceInsufficient =
    selectedMethod === "balance" &&
    availableBalance !== null &&
    availableBalance < investment.investmentAmount;
  const canProceed =
    selectedMethod && termsAccepted && riskAccepted && !!property && !balanceInsufficient;

  const handleConfirmPayment = async () => {
    setShowConfirmation(false);
    setPaymentStatus("processing");

    if (!user) {
      toast.error(isRTL ? "يرجى تسجيل الدخول للاستثمار" : "Please log in to invest");
      setPaymentStatus("failed");
      setShowResult(true);
      return;
    }

    // KYC gate (backstop to the proactive check): if the user isn't approved, route
    // them to the KYC flow instead of charging / showing a raw failure.
    if (kycApproved === false) {
      setPaymentStatus("idle");
      routeToKyc();
      return;
    }

    try {
      // The server computes amount, price, ownership (from the real token_supply) and
      // the token symbol — the client only sends which property + how many tokens.
      const result = await processInvestment({
        property_id: propertyId,
        token_amount: units,
        payment_method: selectedMethod || "card",
      });

      if (result.success) {
        setPaymentStatus("success");
        setTokensMinted(result.tokens_minted || false);

        if (result.tokens_minted) {
          toast.success(
            isRTL ? "تم الاستثمار وإصدار الرموز بنجاح!" : "Investment completed and tokens minted!"
          );
        } else {
          toast.success(
            isRTL
              ? "تم الاستثمار بنجاح! أنشئ محفظتك لاستلام الرموز"
              : "Investment completed! Create a wallet to receive your tokens."
          );
        }
      } else if (result.code === "kyc_required") {
        // Server-side gate fired (e.g. status changed since the proactive check).
        // Route to KYC instead of the generic failure modal.
        setPaymentStatus("idle");
        setKycApproved(false);
        routeToKyc();
        return;
      } else {
        setPaymentStatus("failed");
        toast.error(result.error || (isRTL ? "فشل الاستثمار" : "Investment failed"));
      }
    } catch {
      setPaymentStatus("failed");
    }

    setShowResult(true);
  };

  const handleRetry = () => {
    setShowResult(false);
    setPaymentStatus("idle");
  };

  const handleGoToPortfolio = () => {
    navigate("/portfolio");
  };

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Loading / not-found guards (the page was previously synchronous over inline data).
  if (loadError) {
    return (
      <MainLayout>
        <div className="container py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {t("checkout.title")}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? "تعذّر تحميل العقار." : "Could not load this property."}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate(-1)}>
            {t("header.back")}
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (!property) {
    return (
      <MainLayout>
        <div className="container py-24 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="gap-2"
                >
                  <BackArrow className="w-4 h-4" />
                  {t("header.back")}
                </Button>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    {t("checkout.title")}
                  </h1>
                </div>
              </div>

              {/* Security Indicator */}
              <div className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-lg">
                <Lock className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-success">{t("header.securePayment")}</span>
                <Shield className="w-4 h-4 text-success" />
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Investment Summary - Left/Top */}
            <div className="lg:col-span-1 order-2 lg:order-1 space-y-6">
              {/* Units Adjustment */}
              <div className="p-6 bg-card rounded-2xl border border-border shadow-card animate-fade-in">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                  {t("checkout.adjustInvestment")}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {t("checkout.numberOfUnits")} ({MIN_UNITS} - {maxUnits.toLocaleString()})
                    </label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleUnitsChange(units - 1)}
                        disabled={units <= MIN_UNITS}
                        className="shrink-0"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        min={MIN_UNITS}
                        max={maxUnits}
                        value={units}
                        onChange={(e) => handleUnitsChange(parseInt(e.target.value) || MIN_UNITS)}
                        className="text-center text-lg font-semibold"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleUnitsChange(units + 1)}
                        disabled={units >= maxUnits}
                        className="shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t("checkout.unitPrice")}</span>
                      <span className="font-semibold">${unitPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                      <span className="text-sm font-medium">{t("checkout.investmentAmount")}</span>
                      <span className="text-lg font-bold text-primary">
                        ${investment.investmentAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Installments (Wave B): the DOWN-PAYMENT is what's charged now; the rest
                      is scheduled. The investor mints the full position, locked, with the
                      down-payment's share released. */}
                  {installmentTerms && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {isRTL ? "الدفعة المقدمة (تُدفع الآن)" : "Down payment (due now)"}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          ${downPaymentAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{isRTL ? "نسبة الدفعة المقدمة" : "Down payment %"}</span>
                        <span>{downPaymentPercent}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{isRTL ? "عدد الأقساط لاحقاً" : "Installments scheduled"}</span>
                        <span>
                          {installmentCount} ·{" "}
                          {installmentFrequency === "quarterly"
                            ? isRTL ? "ربع سنوي" : "quarterly"
                            : isRTL ? "شهري" : "monthly"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/20">
                        {isRTL
                          ? "تُصدر كامل الرموز الآن ومقفلة؛ تُحرَّر حصة الدفعة المقدمة، ويُحرَّر الباقي مع سداد الأقساط."
                          : "Your full tokens are minted now but locked; the down-payment's share is released, the rest unlocks as you pay."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <InvestmentSummaryPanel
                investment={investment}
                pronovaDiscount={pronovaDiscount}
                finalAmount={finalAmount}
                onEdit={() => navigate(-1)}
              />
            </div>

            {/* Payment Methods - Right/Bottom */}
            <div className="lg:col-span-2 order-1 lg:order-2 space-y-6">
              <PaymentMethodSelector
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                totalAmount={investment.totalPayable}
                pronovaDiscount={pronovaDiscount}
                availableBalance={availableBalance}
                balanceChargeAmount={investment.investmentAmount}
              />

              {/* Terms & Risk Disclosure */}
              <div className="p-6 bg-card rounded-2xl border border-border space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {t("checkout.requiredDeclarations")}
                </h3>

                <div className="space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <Checkbox
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {t("checkout.termsAgree")}
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <Checkbox
                      checked={riskAccepted}
                      onCheckedChange={(checked) => setRiskAccepted(checked as boolean)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {t("checkout.riskAgree")}
                    </span>
                  </label>
                </div>

                {/* Compliance Note */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("checkout.complianceNote")}
                  </p>
                </div>
              </div>

              {/* KYC-before-invest notice (Phase 4 #1). Shown when the logged-in
                  user isn't approved; pressing invest routes them to the KYC flow. */}
              {user && kycApproved === false && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
                  <Shield className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-foreground">
                      {isRTL ? "التحقق مطلوب" : "Verification required"}
                    </p>
                    <p className="text-muted-foreground">
                      {isRTL
                        ? "يلزم إكمال التحقق (KYC) قبل الاستثمار. سيتم توجيهك لإكماله."
                        : "Identity verification (KYC) is required before investing. We'll take you there."}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={routeToKyc}>
                    {isRTL ? "إكمال التحقق" : "Complete KYC"}
                  </Button>
                </div>
              )}

              {/* Action Buttons.
                  Phase 5: real-PSP methods drive a webhook/IPN-gated flow in place
                  of the generic confirm button — CARD via Stripe Elements (Wave 1),
                  CRYPTO via NOW Payments (Wave 2). All OTHER methods keep their
                  existing simulated flow. */}
              {(selectedMethod === "card" || selectedMethod === "crypto") &&
              user &&
              kycApproved !== false ? (
                <div className="space-y-4">
                  {selectedMethod === "card" ? (
                    <StripeCardCheckout
                      propertyId={propertyId}
                      tokenAmount={units}
                      finalAmount={finalAmount}
                      ready={termsAccepted && riskAccepted && !!property}
                      installment={installmentTerms}
                      onRouteToKyc={routeToKyc}
                      onProcessing={() => setPaymentStatus("processing")}
                      onResult={handlePspResult}
                    />
                  ) : (
                    <NowCryptoCheckout
                      propertyId={propertyId}
                      tokenAmount={units}
                      ready={termsAccepted && riskAccepted && !!property}
                      installment={installmentTerms}
                      onRouteToKyc={routeToKyc}
                      onProcessing={() => setPaymentStatus("processing")}
                      onResult={handlePspResult}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="xl"
                    className="w-full"
                    onClick={() => navigate(-1)}
                    disabled={paymentStatus === "processing"}
                  >
                    {t("checkout.cancelPayment")}
                  </Button>
                </div>
              ) : isInstallment ? (
                /* Installments are settlement-gated → require a real PSP (card or crypto).
                   We never route an installment down the simulated generic-confirm path. */
                <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                  <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      {isRTL ? "اختر البطاقة أو العملة الرقمية" : "Choose card or crypto"}
                    </p>
                    <p className="text-muted-foreground">
                      {isRTL
                        ? "تتم خطط الأقساط عبر دفعة مقدمة آمنة بالبطاقة أو العملة الرقمية."
                        : "Installment plans are paid via a secure down-payment by card or crypto."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="hero"
                    size="xl"
                    className="flex-1"
                    disabled={!canProceed || paymentStatus === "processing"}
                    onClick={() =>
                      user && kycApproved === false
                        ? routeToKyc()
                        : setShowConfirmation(true)
                    }
                  >
                    {paymentStatus === "processing" ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        {t("checkout.processing")}
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        {t("checkout.confirmPay")} ${finalAmount.toLocaleString()}
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="xl"
                    onClick={() => navigate(-1)}
                    disabled={paymentStatus === "processing"}
                  >
                    {t("checkout.cancelPayment")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        <PaymentConfirmationModal
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          selectedMethod={selectedMethod}
          investment={investment}
          finalAmount={finalAmount}
          pronovaDiscount={pronovaDiscount}
          onConfirm={handleConfirmPayment}
        />

        {/* Result Modal */}
        <PaymentResultModal
          open={showResult}
          onOpenChange={setShowResult}
          status={paymentStatus}
          investment={investment}
          finalAmount={finalAmount}
          selectedMethod={selectedMethod}
          onRetry={handleRetry}
          onGoToPortfolio={handleGoToPortfolio}
          tokensMinted={tokensMinted}
        />
      </div>
    </MainLayout>
  );
}
