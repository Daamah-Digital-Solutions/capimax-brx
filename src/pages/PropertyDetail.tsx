import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  MapPin, 
  TrendingUp, 
  Clock, 
  Users, 
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Building2,
  Home,
  Warehouse,
  Shield,
  FileText,
  BarChart3,
  Blocks,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Percent,
  Coins,
  PieChart,
  Download,
  Eye,
  Lock,
  Globe,
  Info,
  Wallet,
  Link2,
  ShieldCheck,
  AlertCircle,
  HardHat
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { InstallmentCalculator } from "@/components/property/InstallmentCalculator";
import { PropertyModelSection } from "@/components/property/PropertyModelSection";
import { PropertyDataRoom } from "@/components/property/PropertyDataRoom";
import {
  useInstallmentPreview,
  DEFAULT_INSTALLMENT_TERMS,
  installmentCheckoutQuery,
  termInstallmentCount,
  type InstallmentTerms,
} from "@/hooks/useInstallmentPreview";
import { InsuranceValuationSection } from "@/components/property/InsuranceValuationSection";
import { NovaFinancePledgeNotice } from "@/components/legal/NovaFinancePledgeNotice";
// Phase 2: the model-rich catalogue property comes from the Django API now
// (was the static properties.ts `propertyById`). Keep the `Property` type.
import type { Property } from "@/data/properties";
import { propertiesApi } from "@/integrations/api/client";

// Property data with installment options for under-construction
const propertyDatabase = {
  "1": {
    id: "1",
    name: "Marina Bay Tower",
    nameAr: "برج مارينا باي",
    location: "Dubai Marina, Dubai, UAE",
    locationAr: "دبي مارينا، دبي، الإمارات",
    images: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
      "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800",
    ],
    assetType: "commercial",
    status: "ready",
    expectedYield: 9.5,
    minInvestment: 100,
    funded: 78,
    duration: "5 years",
    durationAr: "5 سنوات",
    exitEligible: true,
    totalValue: 5000000,
    investors: 234,
    riskLevel: "medium",
    description: "A luxury Class A office tower located in the heart of Dubai Marina, featuring panoramic sea and city views. It comprises 35 floors of modern office spaces with a current occupancy rate of 95%.",
    descriptionAr: "برج مكتبي فاخر من الفئة A يقع في قلب دبي مارينا، يتميز بإطلالات بانورامية على البحر والمدينة. يضم 35 طابقاً من المساحات المكتبية الحديثة مع معدل إشغال حالي يبلغ 95%.",
    isUnderConstruction: false,
    installmentOptions: null,
    spvDetails: {
      name: "Marina Bay Tower SPV Ltd",
      jurisdiction: "DIFC, Dubai",
      registrationNumber: "SPV-2024-001234",
      established: "2024-01-15",
    },
    tokenDetails: {
      contractAddress: "0x7a23f4c8b9d2e1a0c3b4d5e6f7a8b9c0d1e2f3a4",
      network: "Ethereum",
      networkIcon: "⟠",
      standard: "ERC-1155",
      totalSupply: 5000,
      tokenizedUnits: 5000,
      tokenPrice: 100,
      verified: true,
      deployedDate: "2024-01-15",
      explorerUrl: "https://etherscan.io/address/0x7a23f4c8b9d2e1a0c3b4d5e6f7a8b9c0d1e2f3a4",
    },
    financials: {
      purchasePrice: 4500000,
      currentValuation: 5000000,
      grossRentalIncome: 475000,
      operatingExpenses: 95000,
      netOperatingIncome: 380000,
      capRate: 8.44,
      occupancyRate: 95,
    },
    fees: {
      platformFee: 1.5,
      managementFee: 0.5,
      exitFee: 0.5,
    },
    documents: [
      { name: "تقرير التقييم", nameEn: "Valuation Report", date: "2024-12-01", type: "valuation" },
      { name: "عقد الملكية", nameEn: "Title Deed", date: "2024-01-15", type: "legal" },
      { name: "شهادة التأمين", nameEn: "Insurance Certificate", date: "2024-11-01", type: "insurance" },
      { name: "البيانات المالية", nameEn: "Financial Statements", date: "2024-12-15", type: "financial" },
    ],
  },
  "2": {
    id: "2",
    name: "Palm Luxury Residences",
    nameAr: "مساكن النخلة الفاخرة",
    location: "Palm Jumeirah, Dubai, UAE",
    locationAr: "نخلة جميرا، دبي، الإمارات",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
    ],
    assetType: "residential",
    status: "construction",
    expectedYield: 0,
    expectedGrowth: 25,
    minInvestment: 100,
    funded: 45,
    duration: "3 years",
    durationAr: "3 سنوات",
    exitEligible: false,
    totalValue: 8000000,
    investors: 156,
    riskLevel: "medium",
    description: "A luxury residential development on Palm Jumeirah featuring 120 premium apartments with direct beach access. Expected completion in Q4 2026 with projected 25% capital appreciation upon completion.",
    descriptionAr: "مشروع سكني فاخر على نخلة جميرا يضم 120 شقة فاخرة مع وصول مباشر للشاطئ. التسليم المتوقع في الربع الرابع 2026 مع توقعات نمو رأس المال بنسبة 25% عند الاكتمال.",
    isUnderConstruction: true,
    constructionProgress: 65,
    expectedCompletion: "Q4 2026",
    installmentOptions: {
      downPaymentPercent: 25,
      durations: [
        { months: 12, label: "12 Months", labelAr: "12 شهر" },
        { months: 18, label: "18 Months", labelAr: "18 شهر" },
        { months: 24, label: "24 Months", labelAr: "24 شهر" },
      ],
    },
    spvDetails: {
      name: "Palm Residences SPV Ltd",
      jurisdiction: "DIFC, Dubai",
      registrationNumber: "SPV-2024-002345",
      established: "2024-03-01",
    },
    tokenDetails: {
      contractAddress: "0x8b34f5c9c0d3e2b1a4c5d6e7f8a9b0c1d2e3f4a5",
      network: "Ethereum",
      networkIcon: "⟠",
      standard: "ERC-1155",
      totalSupply: 4000,
      tokenizedUnits: 4000,
      tokenPrice: 100,
      verified: true,
      deployedDate: "2024-03-01",
      explorerUrl: "https://etherscan.io/address/0x8b34f5c9c0d3e2b1a4c5d6e7f8a9b0c1d2e3f4a5",
    },
    financials: {
      purchasePrice: 7200000,
      currentValuation: 8000000,
      grossRentalIncome: 0,
      operatingExpenses: 0,
      netOperatingIncome: 0,
      capRate: 0,
      occupancyRate: 0,
    },
    fees: {
      platformFee: 1.5,
      managementFee: 0.5,
      exitFee: 0.5,
    },
    documents: [
      { name: "تقرير التقييم", nameEn: "Valuation Report", date: "2024-12-01", type: "valuation" },
      { name: "عقد الملكية", nameEn: "Title Deed", date: "2024-03-01", type: "legal" },
      { name: "شهادة التأمين", nameEn: "Insurance Certificate", date: "2024-11-01", type: "insurance" },
      { name: "تقرير تقدم البناء", nameEn: "Construction Progress Report", date: "2024-12-15", type: "construction" },
    ],
  },
};

const propertyData = propertyDatabase["1"];

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language, isRTL } = useLanguage();
  const [selectedImage, setSelectedImage] = useState(0);
  const [copied, setCopied] = useState(false);
  // Units chosen in the catalogue-branch investment sidebar; drives the live total
  // and is forwarded to Checkout (which reads ?units=). Real state, not a dead stepper.
  const [units, setUnits] = useState(1);

  // Catalogue property from the API (replaces synchronous properties.ts lookup).
  // Fetched for every id; for ids "1"/"2" the inline `propertyDatabase` legacy
  // view still wins, and this just augments it with <PropertyModelSection /> when
  // the slug also exists in the catalogue (id "1" does, "2" does not — unchanged).
  const [catalogueProperty, setCatalogueProperty] = useState<Property | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setCatalogueLoading(true);
    propertiesApi
      .detail(id || "")
      .then((p) => {
        if (active) {
          setCatalogueProperty(p as Property);
          setCatalogueLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setCatalogueProperty(null);
          setCatalogueLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Shared installment terms + the live engine preview — the SINGLE source of truth every
  // installment block on the page renders from, so they all show ONE identical plan. Enabled
  // only for installment-model catalogue properties; the preview is null otherwise (each block
  // falls back to a clearly-labelled example). Declared before any early return (hook rules).
  const [installmentTerms, setInstallmentTerms] =
    useState<InstallmentTerms>(DEFAULT_INSTALLMENT_TERMS);
  const { preview: installmentPreview } = useInstallmentPreview(
    // Catalogue properties are keyed by slug, exposed as `id` on the API object (no `slug`
    // field); the backend preview looks up Property by slug, so pass the id.
    catalogueProperty?.id,
    installmentTerms,
    catalogueProperty?.model === "installment",
  );

  // Get property data based on ID from URL
  const legacyProperty = propertyDatabase[id || ""];
  const currentProperty = legacyProperty || propertyDatabase["1"];

  // While a non-legacy (catalogue-only) property is loading, hold the render so we
  // don't flash the fallback property.
  if (!legacyProperty && catalogueLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          {t("common.loading")}
        </div>
      </MainLayout>
    );
  }

  // Clean template route — when the ID is only in the catalogue (no legacy data),
  // render a professional, model-aware page with payment methods BELOW details.
  if (!legacyProperty && catalogueProperty) {
    const cp = catalogueProperty;
    const cpName = language === "ar" ? cp.nameAr : cp.name;
    const cpLoc = language === "ar" ? cp.locationAr : cp.location;
    const cpDesc = language === "ar" ? cp.descriptionAr : cp.description;
    // Installment (under-construction) properties are bought via a DOWN-PAYMENT plan, not an
    // outright "Own Now". Surface the down-payment + installment count in the sidebar and route
    // its CTA to the installment checkout (the SHARED terms the calculator on this page drives).
    const cpIsInstallment = cp.model === "installment";
    const cpDownPayment = installmentPreview
      ? installmentPreview.downPayment
      : Math.round(
          Number(cp.tokenPrice) * installmentTerms.units * (installmentTerms.downPct / 100),
        );
    const cpInstallmentCount = installmentPreview
      ? installmentPreview.numberOfInstallments
      : termInstallmentCount(installmentTerms);
    return (
      <MainLayout>
        <div className="min-h-screen bg-background">
          <div className="border-b border-border bg-card/50">
            <div className="container py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link to="/" className="hover:text-foreground">{t("propertyDetail.home")}</Link>
                <span>/</span>
                <Link to="/marketplace" className="hover:text-foreground">{t("propertyDetail.market")}</Link>
                <span>/</span>
                <span className="text-foreground">{cpName}</span>
              </div>
            </div>
          </div>

          <div className="container py-8">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
            {/* Hero */}
            <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden">
              <img src={cp.image} alt={cpName} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">{cpName}</h1>
                <div className="flex items-center gap-4 text-muted-foreground text-sm flex-wrap">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{cpLoc}</span>
                  <Badge variant="outline" className="capitalize">{cp.assetType}</Badge>
                  <Badge variant={cp.status === "ready" ? "ready" : "construction"}>
                    {cp.status === "ready" ? t("propertyDetail.readyForYield") : t("property.underConstruction")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground">{cp.expectedYield ? t("property.yield") : t("property.growth")}</p>
                <p className="text-2xl font-bold text-primary">{cp.expectedYield ?? cp.expectedGrowth}%</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground">{t("propertyDetail.unitPrice")}</p>
                <p className="text-2xl font-bold">${cp.tokenPrice}</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground">{t("propertyDetail.funding")}</p>
                <p className="text-2xl font-bold">{cp.funded}%</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground">{t("property.investors")}</p>
                <p className="text-2xl font-bold">{cp.investors}</p>
              </div>
            </div>

            {/* Description */}
            <div className="p-6 bg-card rounded-2xl border border-border">
              <h3 className="font-display text-xl font-semibold mb-3">{t("propertyDetail.description")}</h3>
              <p className="text-muted-foreground leading-relaxed">{cpDesc}</p>
            </div>

            {/* Model-specific template */}
            <PropertyModelSection property={cp} />

            {/* Installment purchase entry — real per-investor plan builder → Checkout charges
                the down-payment + buyer-borne fee, mints-then-locks the full position. Only
                for the installment model (the CTA carries type=installment + the terms). */}
            {cpIsInstallment && (
              <div id="installment-plan">
                <InstallmentCalculator
                  propertyId={id || cp.id}
                  totalPropertyPrice={Number(cp.totalValue ?? 0)}
                  downPaymentPercent={20}
                  installmentDurations={[
                    { months: 12, label: "12 Months", labelAr: "12 شهر" },
                    { months: 24, label: "24 Months", labelAr: "24 شهر" },
                    { months: 36, label: "36 Months", labelAr: "36 شهر" },
                  ]}
                  unitPrice={Number(cp.tokenPrice)}
                  expectedGrowth={Number(cp.expectedGrowth ?? 0)}
                  constructionProgress={Number(cp.constructionProgress ?? 0)}
                  expectedCompletion={
                    cp.installment?.activationDate ??
                    (language === "ar" ? cp.durationAr ?? "" : cp.duration ?? "")
                  }
                  terms={installmentTerms}
                  onTermsChange={setInstallmentTerms}
                  preview={installmentPreview}
                />
              </div>
            )}

            {/* Institutional Data Room — full digital investment center. The installment terms
                + engine preview flow through to the Construction tab's calculators/schedule so
                every block on the page reflects the same per-investor plan. */}
            <PropertyDataRoom
              property={cp}
              installmentTerms={installmentTerms}
              onInstallmentTermsChange={setInstallmentTerms}
              installmentPreview={installmentPreview}
            />

            {/* Insurance & Independent Valuation */}
            <InsuranceValuationSection currentValuation={cp.totalValue ?? 5000000} />

            {/* Exit & disclosures */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />{language === "ar" ? "خيارات التخارج" : "Exit Options"}</h4>
                <p className="text-sm text-muted-foreground">
                  {cp.exitAvailability === "both" && (language === "ar" ? "سوق LP والسوق الثانوي" : "LP & Secondary Market")}
                  {cp.exitAvailability === "lp" && (language === "ar" ? "سوق LP فقط" : "LP Market only")}
                  {cp.exitAvailability === "secondary" && (language === "ar" ? "السوق الثانوي فقط" : "Secondary Market only")}
                  {cp.exitAvailability === "none" && (language === "ar" ? "لا يوجد تخارج حتى الاستحقاق" : "No exit until maturity")}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />{language === "ar" ? "إفصاحات قانونية" : "Legal Disclosures"}</h4>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "هيكل SPV وفق Reg D / Reg S. اقرأ الشروط الكاملة قبل الاستثمار." : "SPV structure under Reg D / Reg S. Read full terms before investing."}</p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />{language === "ar" ? "إشعار المخاطر" : "Risk Notice"}</h4>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "الاستثمار العقاري ينطوي على مخاطر بما في ذلك خسارة رأس المال. الأداء السابق لا يضمن الأداء المستقبلي." : "Real-estate investing carries risks including loss of capital. Past performance does not guarantee future returns."}</p>
              </div>
            </div>

            {/* Nova Finance pledge disclosure */}
            <NovaFinancePledgeNotice />

            {/* ──────────────── PAYMENT METHODS BELOW ──────────────── */}
            <div className="border-t border-border pt-8">
              <h2 className="font-display text-2xl font-bold mb-1">{language === "ar" ? "إتمام الاستثمار" : "Complete your investment"}</h2>
              <p className="text-sm text-muted-foreground mb-6">{language === "ar" ? "اختر طريقة الدفع وأكمل العملية بأمان." : "Choose your payment method and complete securely."}</p>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                  <Wallet className="w-6 h-6 text-primary mb-2" />
                  <h4 className="font-semibold">{language === "ar" ? "محفظة المنصة" : "Platform Wallet"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{language === "ar" ? "تنفيذ فوري برصيدك" : "Instant from your balance"}</p>
                </div>
                <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                  <DollarSign className="w-6 h-6 text-primary mb-2" />
                  <h4 className="font-semibold">{language === "ar" ? "تحويل بنكي" : "Bank Transfer"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">SWIFT / IBAN / SEPA</p>
                </div>
                <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
                  <Coins className="w-6 h-6 text-primary mb-2" />
                  <h4 className="font-semibold">{language === "ar" ? "عملة مشفرة" : "Crypto"}</h4>
                  <p className="text-xs text-muted-foreground mt-1">USDC / USDT (ERC-20)</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="hero"
                  size="lg"
                  className="flex-1"
                  onClick={() =>
                    navigate(
                      cpIsInstallment
                        ? `/checkout?${installmentCheckoutQuery(id || cp.id, installmentTerms)}`
                        : `/checkout?property=${id}&units=${units}`,
                    )
                  }
                >
                  {cpIsInstallment
                    ? language === "ar"
                      ? "التملّك بالتقسيط"
                      : "Own via installments"
                    : t("property.investNow")}
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/marketplace">{language === "ar" ? "العودة إلى السوق" : "Back to Marketplace"}</Link>
                </Button>
              </div>
            </div>
              </div>

              {/* ─────────── Investment sidebar — real catalogue data + real Checkout flow ─────────── */}
              <aside className="lg:col-span-1">
                <div className="bg-card rounded-2xl border border-border p-6 sticky top-36 animate-fade-in">
                  {/* Unit price */}
                  <div className="text-center mb-6">
                    <div className="text-sm text-muted-foreground mb-1">{t("propertyDetail.unitPrice")}</div>
                    <div className="text-3xl font-bold text-gradient-gold">${Number(cp.tokenPrice).toLocaleString()}</div>
                  </div>

                  {/* Funding progress bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t("propertyDetail.funding")}</span>
                      <span className="font-semibold text-primary">{cp.funded}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-gold rounded-full" style={{ width: `${cp.funded}%` }} />
                    </div>
                    {cp.totalValue ? (
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                        <span>${Math.round((cp.totalValue * cp.funded) / 100).toLocaleString()} {t("propertyDetail.raised")}</span>
                        <span>${cp.totalValue.toLocaleString()} {t("propertyDetail.target")}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Yield + investors */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-lg font-bold text-primary">{cp.expectedYield ?? cp.expectedGrowth}%</div>
                      <div className="text-xs text-muted-foreground">{cp.expectedYield ? t("propertyDetail.annualYield") : t("property.growth")}</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-lg font-bold text-foreground">{cp.investors}</div>
                      <div className="text-xs text-muted-foreground">{t("property.investors")}</div>
                    </div>
                  </div>

                  {cpIsInstallment ? (
                    <>
                      {/* Installment (under-construction) purchase — the DOWN-PAYMENT is what's
                          charged now, NOT the full price. Routes to the installment checkout using
                          the SHARED terms the plan builder below drives — never the ready-property
                          "Own Now" full-buy. */}
                      <div className="mb-4 p-4 rounded-xl border border-primary/20 bg-gradient-gold/10">
                        <div className="flex items-center gap-2 mb-2">
                          <HardHat className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            {language === "ar" ? "خطة تقسيط" : "Installment plan"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {language === "ar" ? "المستحق الآن (دفعة مقدمة)" : "Due now (down payment)"}
                        </div>
                        <div className="text-3xl font-bold text-gradient-gold">
                          ${cpDownPayment.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {language === "ar"
                            ? `ثم ${cpInstallmentCount} قسط · تُضاف رسوم المنصة عند الدفع`
                            : `then ${cpInstallmentCount} installments · platform fee added at checkout`}
                        </p>
                      </div>

                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full mb-3 gap-2"
                        onClick={() =>
                          navigate(`/checkout?${installmentCheckoutQuery(id || cp.id, installmentTerms)}`)
                        }
                      >
                        <DollarSign className="w-5 h-5" />
                        {language === "ar" ? "التملّك بالتقسيط" : "Own via installments"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full mb-4"
                        onClick={() =>
                          document
                            .getElementById("installment-plan")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                      >
                        {language === "ar" ? "خصّص خطتك" : "Customize your plan"}
                      </Button>
                      <Button variant="outline" className="w-full">
                        {t("propertyDetail.addToFavorites")}
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Number of units — working stepper with live total */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-foreground mb-2">{t("propertyDetail.numberOfUnits")}</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="decrease units"
                            onClick={() => setUnits((u) => Math.max(1, u - 1))}
                            className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-muted/80 text-xl font-medium"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={units}
                            onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="flex-1 h-10 bg-muted rounded-lg text-center font-semibold outline-none focus:ring-2 focus:ring-primary"
                          />
                          <button
                            type="button"
                            aria-label="increase units"
                            onClick={() => setUnits((u) => u + 1)}
                            className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-muted/80 text-xl font-medium"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-center mt-2 text-sm text-muted-foreground">
                          {t("propertyDetail.total")}: <span className="font-semibold text-foreground">${(units * Number(cp.tokenPrice)).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* CTA — Own Now → real Checkout with the chosen quantity */}
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full mb-4"
                        onClick={() => navigate(`/checkout?property=${id}&units=${units}`)}
                      >
                        {t("property.investNow")}
                      </Button>
                      <Button variant="outline" className="w-full">
                        {t("propertyDetail.addToFavorites")}
                      </Button>
                    </>
                  )}

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>{t("propertyDetail.secure")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-4 h-4 text-primary" />
                      <span>{t("propertyDetail.encrypted")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Blocks className="w-4 h-4 text-primary" />
                      <span>{t("propertyDetail.tokenVerified")}</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }


  const copyAddress = () => {
    navigator.clipboard.writeText(currentProperty.tokenDetails.contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const propertyName = language === "ar" ? currentProperty.nameAr : currentProperty.name;
  const propertyLocation = language === "ar" ? currentProperty.locationAr : currentProperty.location;
  const propertyDescription = language === "ar" ? currentProperty.descriptionAr : currentProperty.description;
  const duration = language === "ar" ? currentProperty.durationAr : currentProperty.duration;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const isUnderConstruction = currentProperty.isUnderConstruction;

  // "Verify on Blockchain" must only appear when the Django catalogue carries a real,
  // verified token contract. The legacy inline `tokenDetails` is mock, so we source the
  // explorer link from the API's tokenMetadata and hide the button otherwise.
  // NOTE: the authoritative on-chain field is the model's `deployed_contract_address`,
  // which the detail serializer does not expose yet — prefer it once it's serialized.
  const tokenMeta = (catalogueProperty as unknown as {
    tokenMetadata?: { contractAddress?: string; explorerUrl?: string; verified?: boolean };
  } | null)?.tokenMetadata;
  const onChainExplorerUrl =
    tokenMeta?.verified && tokenMeta?.contractAddress ? tokenMeta.explorerUrl : undefined;

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground">{t("propertyDetail.home")}</Link>
              <span>/</span>
              <Link to="/marketplace" className="hover:text-foreground">{t("propertyDetail.market")}</Link>
              <span>/</span>
              <span className="text-foreground">{propertyName}</span>
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Gallery */}
              <div className="space-y-4 animate-fade-in">
                <div className="relative h-96 rounded-2xl overflow-hidden">
                  <img
                    src={currentProperty.images[selectedImage]}
                    alt={propertyName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 end-4 flex gap-2">
                    {isUnderConstruction ? (
                      <>
                        <Badge variant="construction" className="gap-1">
                          <HardHat className="w-3 h-3" />
                          {t("property.underConstruction")}
                        </Badge>
                        <Badge variant="gold">{currentProperty.constructionProgress}% {t("installmentCalc.constructionProgress")}</Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="ready">{t("propertyDetail.readyForYield")}</Badge>
                        {currentProperty.exitEligible && (
                          <Badge variant="exit-eligible">{t("propertyDetail.exitAvailable")}</Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  {currentProperty.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={cn(
                        "w-24 h-16 rounded-lg overflow-hidden border-2 transition-colors",
                        selectedImage === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Location */}
              <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <h1 className="font-display text-3xl font-bold text-foreground mb-2">
                  {propertyName}
                </h1>
                <p className="text-lg text-muted-foreground mb-4">
                  {language === "ar" ? currentProperty.name : currentProperty.nameAr}
                </p>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    <span>{propertyLocation}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    <span>{t("property.commercial")}</span>
                  </div>
                </div>
              </div>

              {/* Model-specific section (templates: ready/portfolio/installment/phasing/future/option/shared) */}
              {catalogueProperty && (
                <div className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
                  <PropertyModelSection property={catalogueProperty} />
                </div>
              )}

              {/* Tabs */}
              <Tabs defaultValue="overview" className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
                  <TabsTrigger value="overview" className="rounded-lg">{t("propertyDetail.overview")}</TabsTrigger>
                  <TabsTrigger value="financials" className="rounded-lg">{t("propertyDetail.financials")}</TabsTrigger>
                  <TabsTrigger value="spv" className="rounded-lg">{t("propertyDetail.spv")}</TabsTrigger>
                  <TabsTrigger value="documents" className="rounded-lg">{t("propertyDetail.dataRoom")}</TabsTrigger>
                  <TabsTrigger value="reports" className="rounded-lg">{t("propertyDetail.reports")}</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6 space-y-6">
                  <div className="p-6 bg-card rounded-2xl border border-border">
                    <h3 className="font-display text-xl font-semibold text-foreground mb-4">
                      {t("propertyDetail.description")}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {propertyDescription}
                    </p>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            {isUnderConstruction ? t("property.growth") : t("propertyDetail.expectedYield")}
                          </h4>
                          <p className="text-2xl font-bold text-gradient-gold">
                            {isUnderConstruction ? `+${currentProperty.expectedGrowth || 0}%` : `${currentProperty.expectedYield}%`}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isUnderConstruction 
                          ? t("installmentCalc.expectedGrowth") 
                          : t("propertyDetail.expectedYieldNote")}
                      </p>
                    </div>

                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">
                            {isUnderConstruction ? t("installmentCalc.expectedCompletion") : t("propertyDetail.investmentDuration")}
                          </h4>
                          <p className="text-2xl font-bold text-foreground">
                            {isUnderConstruction ? currentProperty.expectedCompletion : duration}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isUnderConstruction 
                          ? `${t("installmentCalc.constructionProgress")}: ${currentProperty.constructionProgress}%`
                          : t("propertyDetail.investmentDurationNote")}
                      </p>
                    </div>
                  </div>

                  {/* Risk Disclosure */}
                  <div className="p-5 bg-warning/10 border border-warning/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground mb-2">{t("propertyDetail.riskDisclosure")}</h4>
                        <p className="text-sm text-muted-foreground">
                          {t("propertyDetail.riskDisclosureText")}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Financials Tab */}
                <TabsContent value="financials" className="mt-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 bg-card rounded-2xl border border-border">
                      <h3 className="font-semibold text-foreground mb-4">{t("propertyDetail.keyFinancials")}</h3>
                      <div className="space-y-4">
                        {[
                          { label: t("propertyDetail.purchasePrice"), value: `$${currentProperty.financials.purchasePrice.toLocaleString()}` },
                          { label: t("propertyDetail.currentValuation"), value: `$${currentProperty.financials.currentValuation.toLocaleString()}` },
                          { label: t("propertyDetail.grossRental"), value: `$${currentProperty.financials.grossRentalIncome.toLocaleString()}` },
                          { label: t("propertyDetail.operatingExpenses"), value: `$${currentProperty.financials.operatingExpenses.toLocaleString()}` },
                          { label: t("propertyDetail.netOperatingIncome"), value: `$${currentProperty.financials.netOperatingIncome.toLocaleString()}`, highlight: true },
                        ].map((item, index) => (
                          <div key={index} className={cn(
                            "flex items-center justify-between py-2",
                            index !== 0 && "border-t border-border"
                          )}>
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className={cn("font-semibold", item.highlight && "text-primary")}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-6 bg-card rounded-2xl border border-border">
                        <h3 className="font-semibold text-foreground mb-4">{t("propertyDetail.performanceIndicators")}</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-muted rounded-xl">
                            <div className="text-2xl font-bold text-primary">{currentProperty.financials.capRate}%</div>
                            <div className="text-sm text-muted-foreground">{t("propertyDetail.capRate")}</div>
                          </div>
                          <div className="text-center p-4 bg-muted rounded-xl">
                            <div className="text-2xl font-bold text-foreground">{currentProperty.financials.occupancyRate}%</div>
                            <div className="text-sm text-muted-foreground">{t("propertyDetail.occupancyRate")}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-card rounded-2xl border border-border">
                        <h3 className="font-semibold text-foreground mb-4">{t("propertyDetail.fees")}</h3>
                        <div className="space-y-3">
                          {[
                            { label: t("propertyDetail.platformFee"), value: `${currentProperty.fees.platformFee}%` },
                            { label: t("propertyDetail.managementFee"), value: `${currentProperty.fees.managementFee}%` },
                            { label: t("propertyDetail.exitFee"), value: `${currentProperty.fees.exitFee}%` },
                          ].map((fee, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{fee.label}</span>
                              <span className="font-medium">{fee.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Insurance & Independent Valuation */}
                  <InsuranceValuationSection
                    currentValuation={currentProperty.financials.currentValuation}
                  />

                  {/* Nova Finance pledge disclosure */}
                  <NovaFinancePledgeNotice />
                </TabsContent>

                {/* SPV Tab */}
                <TabsContent value="spv" className="mt-6 space-y-6">
                  {/* Investor Information - Ownership & Tokenization */}
                  <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border border-primary/20">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Info className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-semibold text-foreground">{t("propertyDetail.investorInfo")}</h3>
                        <p className="text-sm text-muted-foreground">Investor Information – Ownership & Tokenization</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                      {/* Investment Structure */}
                      <div className="p-4 bg-card rounded-xl">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          {t("propertyDetail.investmentStructure")}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("propertyDetail.investmentStructureText")}
                        </p>
                      </div>

                      {/* Tokenization */}
                      <div className="p-4 bg-card rounded-xl">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Blocks className="w-4 h-4 text-primary" />
                          {t("propertyDetail.tokenization")}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("propertyDetail.tokenizationText")}
                        </p>
                      </div>

                      {/* Smart Contract */}
                      <div className="p-4 bg-card rounded-xl">
                        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          {t("propertyDetail.smartContract")}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("propertyDetail.smartContractText")}
                        </p>
                      </div>
                    </div>

                    {/* Important Note */}
                    <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-foreground mb-1">{t("propertyDetail.investorNote")}</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• {t("propertyDetail.investorNoteItem1")}</li>
                            <li>• {t("propertyDetail.investorNoteItem2")}</li>
                            <li>• {t("propertyDetail.investorNoteItem3")}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SPV Info */}
                  <div className="p-6 bg-card rounded-2xl border border-border">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Shield className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-semibold text-foreground">{t("propertyDetail.spvDetails")}</h3>
                        <p className="text-sm text-muted-foreground">Special Purpose Vehicle Details</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {[
                          { label: t("propertyDetail.companyName"), labelEn: "Company Name", value: currentProperty.spvDetails.name },
                          { label: t("propertyDetail.jurisdiction"), labelEn: "Jurisdiction", value: currentProperty.spvDetails.jurisdiction },
                          { label: t("propertyDetail.registrationNo"), labelEn: "Registration No.", value: currentProperty.spvDetails.registrationNumber },
                          { label: t("propertyDetail.established"), labelEn: "Established", value: currentProperty.spvDetails.established },
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                            <div>
                              <span className="text-foreground font-medium">{item.label}</span>
                              <span className="text-xs text-muted-foreground block">{item.labelEn}</span>
                            </div>
                            <span className="font-medium text-sm">{item.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="text-center p-6 bg-success/5 rounded-xl border border-success/20">
                          <Badge variant="verified" className="mb-3 text-sm px-4 py-2">
                            <CheckCircle2 className="w-4 h-4 me-1" />
                            {t("propertyDetail.spvEstablished")}
                          </Badge>
                          <div className="text-sm text-muted-foreground mt-2">
                            {t("propertyDetail.ownershipProtected")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Smart Contract & Token Details - Enhanced */}
                  <div className="p-6 bg-card rounded-2xl border-2 border-primary/30">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                          <Blocks className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="font-display text-xl font-semibold text-foreground">{t("propertyDetail.smartContractDetails")}</h3>
                          <p className="text-sm text-muted-foreground">Smart Contract & Token Details</p>
                        </div>
                      </div>
                      {currentProperty.tokenDetails.verified ? (
                        <Badge variant="verified" className="gap-1 px-3 py-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {t("propertyDetail.verified")} - Verified
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1 px-3 py-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          {t("propertyDetail.unverified")} - Unverified
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-5">
                      {/* Contract Address */}
                      <div className="p-4 bg-muted rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <Link2 className="w-4 h-4" />
                            {t("propertyDetail.contractAddress")} / Smart Contract Address
                          </span>
                          <Button variant="ghost" size="sm" onClick={copyAddress} className="gap-1.5 text-xs">
                            {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                            {copied ? t("propertyDetail.copied") : t("propertyDetail.copy")}
                          </Button>
                        </div>
                        <code className="text-sm font-mono text-foreground break-all block bg-background/50 p-3 rounded-lg border border-border">
                          {currentProperty.tokenDetails.contractAddress}
                        </code>
                      </div>

                      {/* Token Details Grid */}
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="p-4 bg-muted rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{t("propertyDetail.network")} / Network</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{currentProperty.tokenDetails.networkIcon}</span>
                            <span className="font-semibold text-foreground">{currentProperty.tokenDetails.network}</span>
                          </div>
                        </div>

                        <div className="p-4 bg-muted rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{t("propertyDetail.standard")} / Standard</span>
                          </div>
                          <Badge variant="info" className="text-sm px-3 py-1">
                            {currentProperty.tokenDetails.standard}
                          </Badge>
                        </div>

                        <div className="p-4 bg-muted rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Coins className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{t("propertyDetail.totalSupply")} / Total Supply</span>
                          </div>
                          <div className="font-semibold text-foreground">{currentProperty.tokenDetails.totalSupply.toLocaleString()} {t("propertyDetail.tokens")}</div>
                        </div>

                        <div className="p-4 bg-muted rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{t("propertyDetail.deployed")} / Deployed</span>
                          </div>
                          <div className="font-semibold text-foreground">{currentProperty.tokenDetails.deployedDate}</div>
                        </div>
                      </div>

                      {/* Token Value Info */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gradient-gold/10 rounded-xl border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-primary" />
                            <span className="text-sm text-muted-foreground">{t("propertyDetail.tokenPrice")}</span>
                          </div>
                          <div className="text-2xl font-bold text-gradient-gold">${currentProperty.tokenDetails.tokenPrice.toLocaleString()}</div>
                        </div>

                        <div className="p-4 bg-gradient-gold/10 rounded-xl border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-primary" />
                            <span className="text-sm text-muted-foreground">{t("propertyDetail.tokenizedUnits")}</span>
                          </div>
                          <div className="text-2xl font-bold text-gradient-gold">{currentProperty.tokenDetails.tokenizedUnits.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Action Buttons — the on-chain verify link only renders when the
                          Django catalogue carries a real, verified token contract.
                          (The legacy "Add to Wallet" toast-only action was removed.) */}
                      {onChainExplorerUrl && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button
                            variant="hero"
                            className="gap-2"
                            onClick={() => window.open(onChainExplorerUrl, "_blank")}
                          >
                            <ExternalLink className="w-4 h-4" />
                            {t("propertyDetail.verifyOnBlockchain")}
                            <span className="text-xs opacity-80">Verify on Blockchain</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transparency & Risk Disclosure */}
                  <div className="p-6 bg-muted/50 rounded-2xl border border-border">
                    <div className="flex items-center gap-3 mb-4">
                      <ShieldCheck className="w-6 h-6 text-primary" />
                      <h3 className="font-semibold text-foreground">{t("propertyDetail.transparency")}</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <span>{t("propertyDetail.transparencyItem1")}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <span>{t("propertyDetail.transparencyItem2")}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                        <span>{t("propertyDetail.transparencyItem3")}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
                        <span>{t("propertyDetail.transparencyItem4")}</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-6">
                  <div className="p-6 bg-card rounded-2xl border border-border">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display text-xl font-semibold text-foreground">{t("propertyDetail.dataRoom")}</h3>
                      <Badge variant="gold">
                        <Lock className="w-3 h-3 me-1" />
                        {t("propertyDetail.readOnly")}
                      </Badge>
                    </div>

                    {/* Insurance Notices */}
                    <div className="grid md:grid-cols-2 gap-3 mb-6">
                      <div className="flex items-start gap-3 p-4 rounded-xl border border-success/30 bg-success/5">
                        <ShieldCheck className="w-5 h-5 text-success mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-foreground text-sm">
                            {language === "ar" ? "العقار مؤمن بالكامل" : "Property Fully Insured"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {language === "ar" ? "تغطية شاملة ضد الأضرار والمخاطر" : "Comprehensive coverage against damages & risks"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
                        <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-foreground text-sm">
                            {language === "ar" ? "أموال المستثمرين مؤمنة" : "Investor Funds Insured"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {language === "ar" ? "حماية رأس المال عبر هيكل SPV ووثائق ضمان" : "Capital protected via SPV structure & escrow"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {currentProperty.documents.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-foreground flex items-center gap-2">
                                {language === "ar" ? doc.name : doc.nameEn}
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-success" />
                                  {language === "ar" ? "موثّق" : "Verified"}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">{language === "ar" ? doc.nameEn : doc.name} • {doc.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-1">
                              <ShieldCheck className="w-4 h-4 text-success" />
                              {language === "ar" ? "التحقق من الوثيقة" : "Verify Documents"}
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Reports Tab */}
                <TabsContent value="reports" className="mt-6">
                  <div className="p-6 bg-card rounded-2xl border border-border">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display text-xl font-semibold text-foreground">{t("propertyDetail.reportsAndAnalytics")}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-2 h-2 bg-success rounded-full" />
                        {t("propertyDetail.lastUpdate")}: 15 {language === "ar" ? "ديسمبر" : "December"} 2024
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { icon: BarChart3, title: t("propertyDetail.financialReport"), titleEn: "Financial Report", date: "Q4 2024" },
                        { icon: PieChart, title: t("propertyDetail.investmentReport"), titleEn: "Investment Report", date: language === "ar" ? "ديسمبر 2024" : "December 2024" },
                        { icon: TrendingUp, title: t("propertyDetail.valuationReport"), titleEn: "Valuation Report", date: language === "ar" ? "ديسمبر 2024" : "December 2024" },
                        { icon: DollarSign, title: t("propertyDetail.distributionReport"), titleEn: "Distribution Report", date: "Q4 2024" },
                      ].map((report, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <report.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{report.title}</div>
                              <div className="text-sm text-muted-foreground">{report.titleEn} • {report.date}</div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Investment Sidebar */}
            <div className="space-y-6">
              {/* Show InstallmentCalculator for under-construction properties */}
              {isUnderConstruction && currentProperty.installmentOptions ? (
                <InstallmentCalculator
                  propertyId={currentProperty.id}
                  totalPropertyPrice={currentProperty.totalValue}
                  downPaymentPercent={currentProperty.installmentOptions.downPaymentPercent}
                  installmentDurations={currentProperty.installmentOptions.durations}
                  unitPrice={currentProperty.tokenDetails.tokenPrice}
                  expectedGrowth={currentProperty.expectedGrowth || 0}
                  constructionProgress={currentProperty.constructionProgress || 0}
                  expectedCompletion={currentProperty.expectedCompletion || ""}
                />
              ) : (
                /* Investment Card for Ready Properties */
                <div className="bg-card rounded-2xl border border-border p-6 sticky top-36 animate-fade-in">
                  <div className="text-center mb-6">
                    <div className="text-sm text-muted-foreground mb-1">{t("propertyDetail.unitPrice")}</div>
                    <div className="text-3xl font-bold text-gradient-gold">${currentProperty.minInvestment.toLocaleString()}</div>
                  </div>

                  {/* Progress */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{t("propertyDetail.funding")}</span>
                      <span className="font-semibold text-primary">{currentProperty.funded}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-gold rounded-full"
                        style={{ width: `${currentProperty.funded}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>${(currentProperty.totalValue * currentProperty.funded / 100).toLocaleString()} {t("propertyDetail.raised")}</span>
                      <span>${currentProperty.totalValue.toLocaleString()} {t("propertyDetail.target")}</span>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-lg font-bold text-primary">{currentProperty.expectedYield}%</div>
                      <div className="text-xs text-muted-foreground">{t("propertyDetail.annualYield")}</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-lg font-bold text-foreground">{currentProperty.investors}</div>
                      <div className="text-xs text-muted-foreground">{t("property.investors")}</div>
                    </div>
                  </div>

                  {/* Unit price (informational). The real quantity selector lives on the
                      Checkout page — this replaces a dead, misleading stepper that did
                      nothing and showed a hardcoded total. */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">{t("propertyDetail.unitPrice")}</label>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm text-muted-foreground">{t("propertyDetail.unitPrice")}</span>
                      <span className="font-semibold text-foreground">
                        ${currentProperty.tokenDetails.tokenPrice.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-center mt-2 text-xs text-muted-foreground">
                      {language === "ar"
                        ? "تحدِّد عدد الوحدات في صفحة الدفع."
                        : "Choose the number of units at checkout."}
                    </p>
                  </div>

                  {/* CTA */}
                  <Button 
                    variant="hero" 
                    size="lg" 
                    className="w-full mb-4"
                    onClick={() => navigate(`/checkout?property=${id}`)}
                  >
                    {t("property.investNow")}
                  </Button>
                  <Button variant="outline" className="w-full">
                    {t("propertyDetail.addToFavorites")}
                  </Button>

                  {/* Trust Badges */}
                  <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>{t("propertyDetail.secure")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-4 h-4 text-primary" />
                      <span>{t("propertyDetail.encrypted")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Blocks className="w-4 h-4 text-primary" />
                      <span>{t("propertyDetail.tokenVerified")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
