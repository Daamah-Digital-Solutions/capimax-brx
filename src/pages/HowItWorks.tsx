import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Search,
  CreditCard,
  LineChart,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Building2,
  Coins,
  TrendingUp,
  Users,
  FileCheck,
  Wallet,
  BarChart3,
  ArrowLeftRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HowItWorks() {
  const { t, isRTL } = useLanguage();
  
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const investorSteps = [
    {
      step: 1,
      icon: UserPlus,
      title: t("howItWorks.step1InvTitle"),
      description: t("howItWorks.step1InvDesc"),
    },
    {
      step: 2,
      icon: Search,
      title: t("howItWorks.step2InvTitle"),
      description: t("howItWorks.step2InvDesc"),
    },
    {
      step: 3,
      icon: CreditCard,
      title: t("howItWorks.step3InvTitle"),
      description: t("howItWorks.step3InvDesc"),
    },
    {
      step: 4,
      icon: LineChart,
      title: t("howItWorks.step4InvTitle"),
      description: t("howItWorks.step4InvDesc"),
    },
  ];

  const ownerSteps = [
    {
      step: 1,
      icon: FileCheck,
      title: t("howItWorks.step1OwnTitle"),
      description: t("howItWorks.step1OwnDesc"),
    },
    {
      step: 2,
      icon: Shield,
      title: t("howItWorks.step2OwnTitle"),
      description: t("howItWorks.step2OwnDesc"),
    },
    {
      step: 3,
      icon: Coins,
      title: t("howItWorks.step3OwnTitle"),
      description: t("howItWorks.step3OwnDesc"),
    },
    {
      step: 4,
      icon: TrendingUp,
      title: t("howItWorks.step4OwnTitle"),
      description: t("howItWorks.step4OwnDesc"),
    },
  ];

  const benefits = [
    {
      icon: Building2,
      title: t("howItWorks.benefit1Title"),
      description: t("howItWorks.benefit1Desc"),
    },
    {
      icon: Shield,
      title: t("howItWorks.benefit2Title"),
      description: t("howItWorks.benefit2Desc"),
    },
    {
      icon: ArrowLeftRight,
      title: t("howItWorks.benefit3Title"),
      description: t("howItWorks.benefit3Desc"),
    },
    {
      icon: BarChart3,
      title: t("howItWorks.benefit4Title"),
      description: t("howItWorks.benefit4Desc"),
    },
    {
      icon: Wallet,
      title: t("howItWorks.benefit5Title"),
      description: t("howItWorks.benefit5Desc"),
    },
    {
      icon: Users,
      title: t("howItWorks.benefit6Title"),
      description: t("howItWorks.benefit6Desc"),
    },
  ];

  return (
    <MainLayout>
      <div className={`p-6 space-y-12 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="gold" className="mb-4">
            {t("howItWorks.badge")}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {t("howItWorks.title")}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        {/* What is Tokenization Section */}
        <section className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8">
              <div className={`flex items-center gap-3 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("howItWorks.whatIsTokenization")}</h2>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed text-justify">
                {t("howItWorks.tokenizationDefinition")}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Benefits for Investors and Owners */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("howItWorks.benefitsForAll")}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Investor Benefits */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-6">
                <div className={`flex items-center gap-3 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="w-10 h-10 rounded-lg bg-gradient-gold flex items-center justify-center shadow-gold">
                    <Users className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{t("howItWorks.investorBenefits")}</h3>
                </div>
                <ul className="space-y-3">
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.invBenefit1")}</span>
                  </li>
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.invBenefit2")}</span>
                  </li>
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.invBenefit3")}</span>
                  </li>
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.invBenefit4")}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Owner Benefits */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-6">
                <div className={`flex items-center gap-3 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{t("howItWorks.ownerBenefits")}</h3>
                </div>
                <ul className="space-y-3">
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.ownBenefit1")}</span>
                  </li>
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.ownBenefit2")}</span>
                  </li>
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.ownBenefit3")}</span>
                  </li>
                  <li className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("howItWorks.ownBenefit4")}</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Investor Journey */}
        <section>
          <div className={`flex items-center gap-3 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{t("howItWorks.investorJourney")}</h2>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {investorSteps.map((step, index) => (
              <div key={step.step} className="relative">
                <Card className="bg-card/50 backdrop-blur border-border/50 h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className={`flex items-center gap-3 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
                        <step.icon className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {step.step}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
                {index < investorSteps.length - 1 && (
                  <ArrowIcon className={`hidden md:block absolute top-1/2 w-6 h-6 text-muted-foreground/30 -translate-y-1/2 z-10 ${isRTL ? "-left-4" : "-right-4"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-6">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-gold hover:opacity-90 shadow-gold">
                {t("howItWorks.startInvesting")}
                <ArrowIcon className={`w-4 h-4 ${isRTL ? "mr-2" : "ml-2"}`} />
              </Button>
            </Link>
          </div>
        </section>

        {/* Owner Journey */}
        <section>
          <div className={`flex items-center gap-3 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{t("howItWorks.ownerJourney")}</h2>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            {ownerSteps.map((step, index) => (
              <div key={step.step} className="relative">
                <Card className="bg-card/50 backdrop-blur border-border/50 h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className={`flex items-center gap-3 mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                        <step.icon className="w-6 h-6 text-foreground" />
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {step.step}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
                {index < ownerSteps.length - 1 && (
                  <ArrowIcon className={`hidden md:block absolute top-1/2 w-6 h-6 text-muted-foreground/30 -translate-y-1/2 z-10 ${isRTL ? "-left-4" : "-right-4"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-6">
            <Link to="/submit-property">
              <Button size="lg" variant="outline">
                {t("howItWorks.submitProperty")}
                <ArrowIcon className={`w-4 h-4 ${isRTL ? "mr-2" : "ml-2"}`} />
              </Button>
            </Link>
          </div>
        </section>

        {/* Benefits */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("howItWorks.benefitsTitle")}</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((benefit, index) => (
              <Card
                key={index}
                className="bg-card/50 backdrop-blur border-border/50 hover:bg-muted/30 transition-colors"
              >
                <CardContent className={`p-6 flex items-start gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SPV & Tokenization Explanation */}
        <section className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8">
              <div className={`flex items-center gap-3 mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("howItWorks.tokenizationTitle")}</h2>
                </div>
              </div>

              <div className="space-y-4 text-muted-foreground">
                <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-foreground">{t("howItWorks.spvStructure")}</strong>{" "}
                    {t("howItWorks.spvStructureDesc")}
                  </p>
                </div>
                <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-foreground">{t("howItWorks.tokenizationPoint")}</strong>{" "}
                    {t("howItWorks.tokenizationPointDesc")}
                  </p>
                </div>
                <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-foreground">{t("howItWorks.smartContracts")}</strong>{" "}
                    {t("howItWorks.smartContractsDesc")}
                  </p>
                </div>
                <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-foreground">{t("howItWorks.yourRights")}</strong>{" "}
                    {t("howItWorks.yourRightsDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">{t("howItWorks.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-6">
            {t("howItWorks.ctaSubtitle")}
          </p>
          <div className={`flex justify-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Link to="/marketplace">
              <Button size="lg" className="bg-gradient-gold hover:opacity-90 shadow-gold">
                {t("howItWorks.browseOpportunities")}
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">
                {t("howItWorks.createAccount")}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}