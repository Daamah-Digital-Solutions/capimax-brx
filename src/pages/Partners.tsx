import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  ConciergeBell,
  CreditCard,
  ExternalLink,
  Globe,
  Landmark,
  Scale,
  ShieldCheck,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { partnerApi, type PublicPartner } from '@/integrations/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PARTNER_SECTIONS, displayUrl, type PartnerSectionKey } from '@/lib/partners';

/**
 * The Partners page: the client's partner register (src/lib/partners.ts), one section per kind of
 * partner — the same page as Capimax PropShare, in Arabic and English. Each partner is a card
 * with its logo, what it does for the platform, where it operates and a link to its own site.
 * Service partners an admin approved for the public directory (GET /api/partners/directory/)
 * follow in their own section when there are any.
 */

const ICONS: Record<PartnerSectionKey, LucideIcon> = {
  payments: CreditCard,
  identity: ShieldCheck,
  banking: Landmark,
  advisory: Scale,
  insurance: Umbrella,
  developers: Building2,
  operations: ConciergeBell,
  tokenization: BadgeCheck,
};

interface CardData {
  key: string;
  name: string;
  role?: string;
  description: string;
  market: string;
  url?: string;
  logo?: string;
}

function PartnerCard({ partner, isAr }: { partner: CardData; isAr: boolean }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-border bg-card transition-shadow hover:shadow-lg">
      {/* the logos are drawn for a white ground: the tile stays white in the dark theme too */}
      <div className="flex h-32 items-center justify-center border-b border-border bg-white p-6">
        {partner.logo ? (
          <img
            src={partner.logo}
            alt={`${partner.name} logo`}
            loading="lazy"
            className="max-h-20 max-w-[220px] object-contain"
          />
        ) : (
          <span className="text-xl font-semibold text-slate-700">{partner.name}</span>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold leading-snug text-foreground" dir="ltr" style={{ textAlign: 'start' }}>
          {partner.name}
        </h3>
        {partner.role && <p className="mt-0.5 text-sm font-medium text-primary">{partner.role}</p>}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{partner.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
          {partner.market && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
              {partner.market}
            </span>
          )}
          {partner.url && (
            <a
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              dir="ltr"
            >
              <span className="sr-only">{partner.name} {isAr ? 'الموقع الإلكتروني' : 'website'}: </span>
              {displayUrl(partner.url)}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Partners() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const pick = (t: { en: string; ar: string }) => (isAr ? t.ar : t.en);

  // Service partners an admin approved for the public directory (none → section hidden).
  const [directory, setDirectory] = useState<PublicPartner[]>([]);
  useEffect(() => {
    let active = true;
    partnerApi
      .directory()
      .then((rows) => active && setDirectory(rows))
      .catch(() => active && setDirectory([]));
    return () => {
      active = false;
    };
  }, []);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/5 py-16 border-b border-border">
          <div className="container mx-auto px-4 text-center">
            <Badge className="bg-primary text-primary-foreground mb-4">{isAr ? 'شركاؤنا' : 'Our Partners'}</Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              {isAr ? (
                <>شركاء <span className="text-primary">موثوقون</span></>
              ) : (
                <>Trusted <span className="text-primary">Partners</span></>
              )}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {isAr
                ? 'نعمل مع شركاء موثوقين ومعتمدين لضمان أعلى معايير الجودة والأمان في منصتنا'
                : 'We work with trusted and verified partners to ensure the highest standards of quality and security on our platform'}
            </p>
          </div>
        </section>

        {/* The register, section by section */}
        <div className="py-16">
          <div className="container mx-auto px-4 space-y-14">
            {PARTNER_SECTIONS.map((section) => {
              const Icon = ICONS[section.key];
              const headingId = `partners-${section.key}`;
              return (
                <section key={section.key} aria-labelledby={headingId}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h2 id={headingId} className="text-2xl font-bold text-foreground">
                      {pick(section.title)}
                    </h2>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {section.partners.map((p) => (
                      <li key={p.key}>
                        <PartnerCard
                          isAr={isAr}
                          partner={{
                            key: p.key,
                            name: p.name,
                            role: p.role && pick(p.role),
                            description: pick(p.description),
                            market: pick(p.market),
                            url: p.url,
                            logo: p.logo,
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {directory.length > 0 && (
              <section aria-labelledby="partners-directory">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BadgeCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h2 id="partners-directory" className="text-2xl font-bold text-foreground">
                    {isAr ? 'شركاء خدمات معتمدون' : 'Approved Service Partners'}
                  </h2>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {directory.map((p) => (
                    <li key={p.id}>
                      <PartnerCard
                        isAr={isAr}
                        partner={{
                          key: p.id,
                          name: (isAr && p.nameAr) || p.name || '',
                          description: (isAr && p.descriptionAr) || p.description || '',
                          market: (isAr && p.countryAr) || p.country || '',
                          url: p.website || undefined,
                          logo: p.logo_url || undefined,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* Become a Partner CTA */}
        <section className="py-16 bg-gradient-to-r from-primary/10 to-accent/10 border-t border-border">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">{isAr ? 'انضم كشريك' : 'Become a Partner'}</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              {isAr
                ? 'هل أنت شركة مهتمة بالشراكة معنا؟ تواصل معنا لمناقشة فرص التعاون.'
                : 'Are you a company interested in partnering with us? Contact us to discuss collaboration opportunities.'}
            </p>
            <Button size="lg" asChild>
              <Link to="/support">{isAr ? 'تواصل معنا' : 'Contact Us'}</Link>
            </Button>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
