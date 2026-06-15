import { Landmark, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export function Footer() {
  const { t, language } = useLanguage();

  const footerLinks = {
    platform: {
      titleKey: "footer.platform",
      links: [
        { labelKey: "footer.howItWorks", href: "/how-it-works" },
        { labelKey: "footer.marketplace", href: "/marketplace" },
        { labelKey: "footer.fundedProperties", href: "/funded-properties" },
        { labelKey: "footer.secondaryMarket", href: "/secondary-market" },
        { labelKey: "footer.fees", href: "/fees" },
      ],
    },
    transparency: {
      titleKey: "footer.transparency",
      links: [
        { labelKey: "footer.publicReports", href: "/public-reports" },
        { labelKey: "footer.publicAnalytics", href: "/public-analytics" },
        { labelKey: "footer.compliance", href: "/compliance" },
        { labelKey: "footer.whitePaper", href: "/white-paper" },
        { labelKey: "footer.partners", href: "/partners" },
      ],
    },
    investors: {
      titleKey: "footer.forInvestors",
      links: [
        { labelKey: "footer.startInvesting", href: "/auth" },
        { labelKey: "footer.portfolio", href: "/portfolio" },
        { label: language === "ar" ? "مزود السيولة" : "Liquidity Provider", href: "/liquidity-provider" },
        { labelKey: "footer.supportLink", href: "/support" },
      ],
    },
    owners: {
      titleKey: "footer.forOwners",
      links: [
        { labelKey: "footer.listProperty", href: "/submit-property" },
        { labelKey: "footer.forDevelopers", href: "/how-it-works" },
        { labelKey: "footer.contactUs", href: "/support" },
      ],
    },
    legal: {
      titleKey: "footer.legal",
      links: [
        { labelKey: "footer.privacyPolicy", href: "/privacy-policy" },
        { labelKey: "footer.termsOfService", href: "/terms-conditions" },
        { labelKey: "footer.disclaimer", href: "/disclaimer" },
        { labelKey: "footer.disclosure", href: "/disclosure" },
        { labelKey: "footer.platformRules", href: "/platform-rules" },
      ],
    },
  };

  return (
    <footer className="bg-card border-t border-border">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-8 lg:mb-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                <Landmark className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Capimax BRX</h3>
                <p className="text-xs text-muted-foreground">Real Estate Tokenization</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {t("footer.description")}
            </p>

            {/* Institutional Contact Block */}
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold mb-1.5">
                  {language === "ar" ? "المقر الرئيسي" : "Global Headquarters"}
                </p>
                <address className="not-italic text-foreground/90 leading-relaxed">
                  8 The Green, Ste R<br />
                  Dover, Kent, DE 19901<br />
                  United States
                </address>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold mb-1">
                    {language === "ar" ? "الولايات المتحدة" : "United States"}
                  </p>
                  <a href="tel:+12053508771" dir="ltr" className="block text-foreground/90 hover:text-primary transition-colors text-[13px]">
                    +1 205 350 8771
                  </a>
                  <a href="tel:+12053508864" dir="ltr" className="block text-foreground/90 hover:text-primary transition-colors text-[13px]">
                    +1 205 350 8864
                  </a>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold mb-1">
                    {language === "ar" ? "المملكة المتحدة" : "United Kingdom"}
                  </p>
                  <a href="tel:+447577370309" dir="ltr" className="block text-foreground/90 hover:text-primary transition-colors text-[13px]">
                    +44 7577 370309
                  </a>
                </div>
              </div>

              <a href="mailto:info@capimaxrt.com" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors pt-2 border-t border-border/60">
                <Mail className="w-4 h-4" />
                info@capimaxrt.com
              </a>
            </div>
          </div>

          {/* Links Columns */}
          {Object.values(footerLinks).map((section, index) => (
            <div key={index}>
              <h4 className="font-semibold text-foreground mb-4">
                {t(section.titleKey)}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {'label' in link ? link.label : t(link.labelKey)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-start">
            {t("footer.copyright")}
          </p>
          
          {/* Social Links */}
          <div className="flex items-center gap-2">
            {[Facebook, Twitter, Linkedin, Instagram].map((Icon, index) => (
              <Button key={index} variant="ghost" size="icon" className="w-9 h-9">
                <Icon className="w-4 h-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
