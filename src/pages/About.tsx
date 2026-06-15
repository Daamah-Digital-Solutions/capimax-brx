import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Globe,
  Users,
  Shield,
  Award,
  Target,
  Lightbulb,
  Heart,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Twitter,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function About() {
  const { t, language } = useLanguage();

  const stats = [
    { value: "500M+", labelKey: "about.totalAssetValue" },
    { value: "15+", labelKey: "about.countries" },
    { value: "10,000+", labelKey: "about.investors" },
    { value: "50+", labelKey: "about.listedProperties" },
  ];

  const values = [
    {
      icon: Shield,
      titleKey: "about.transparency",
      descriptionKey: "about.transparencyDesc",
    },
    {
      icon: Target,
      titleKey: "about.reliability",
      descriptionKey: "about.reliabilityDesc",
    },
    {
      icon: Lightbulb,
      titleKey: "about.innovation",
      descriptionKey: "about.innovationDesc",
    },
    {
      icon: Heart,
      titleKey: "about.customerService",
      descriptionKey: "about.customerServiceDesc",
    },
  ];

  const team = [
    {
      nameAr: "إبراهيم جاد",
      nameEn: "Ibrahim Gad",
      roleKey: "about.ceo",
    },
    {
      nameAr: "ويليام كيدج",
      nameEn: "William Kidge",
      roleKey: "about.cfo",
    },
    {
      nameAr: "سميث رونالدو",
      nameEn: "Smith Ronaldo",
      roleKey: "about.cto",
    },
    {
      nameAr: "فاطمة الحسن",
      nameEn: "Fatima Al-Hassan",
      roleKey: "about.complianceDirector",
    },
  ];

  // License disclaimer text is now a single paragraph

  return (
    <MainLayout>
      <div className="p-6 space-y-12">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="gold" className="mb-4">
            {t("about.badge")}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Capimax BRX
          </h1>
          <p className="text-lg text-muted-foreground">
            {t("about.heroDescription")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-card/50 backdrop-blur border-border/50 text-center">
              <CardContent className="p-6">
                <p className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</p>
                <p className="text-sm text-foreground">{t(stat.labelKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("about.ourMission")}</h2>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {t("about.missionText")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Globe className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("about.ourVision")}</h2>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {t("about.visionText")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Values */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("about.ourValues")}</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((value, index) => (
              <Card
                key={index}
                className="bg-card/50 backdrop-blur border-border/50 text-center hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{t(value.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(value.descriptionKey)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Team */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("about.leadershipTeam")}</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.map((member, index) => (
              <Card
                key={index}
                className="bg-card/50 backdrop-blur border-border/50 text-center hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-gold flex items-center justify-center mx-auto mb-4 shadow-gold">
                    <span className="text-2xl font-bold text-primary-foreground">
                      {(language === "ar" ? member.nameAr : member.nameEn).charAt(0)}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground">
                    {language === "ar" ? member.nameAr : member.nameEn}
                  </h3>
                  <Badge variant="outline" className="mt-2">
                    {t(member.roleKey)}
                  </Badge>
                  <div className="flex justify-center gap-2 mt-4">
                    <button className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                      <Linkedin className="w-4 h-4" />
                    </button>
                    <button className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                      <Twitter className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Certifications */}
        <section>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t("about.licensesTitle")}</h2>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-foreground leading-relaxed text-justify">
                  {t("about.licenseDisclaimer")}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Contact */}
        <section>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("about.contactUs")}</h2>
              </div>

              <div className="grid sm:grid-cols-3 gap-6 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{t("about.headquarters")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("about.addressLine1")}
                    <br />
                    {t("about.addressLine2")}
                  </p>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{t("about.email")}</h3>
                  <p className="text-sm text-muted-foreground">
                    info@capimax.com
                    <br />
                    support@capimax.com
                  </p>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{t("about.phone")}</h3>
                  <p className="text-sm text-muted-foreground" dir="ltr">
                    USA: +1 205 350 8771
                    <br />
                    USA: +1 205 350 8864
                    <br />
                    UK: +44 7577 370309
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
