import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { partnerApi, type PublicPartner } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Home, 
  Scale, 
  Shield, 
  Coins, 
  Briefcase, 
  Calculator,
  Search,
  ExternalLink,
  CheckCircle,
  MapPin,
  Globe
} from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  description: string;
  descriptionAr: string;
  logo: string;
  country: string;
  countryAr: string;
  website: string;
  verified: boolean;
}

const PLACEHOLDER_LOGO = '/placeholder.svg';

/**
 * Phase 11 Wave A: the public partners directory is now served by the backend
 * (GET /api/partners/directory/, AllowAny) — only partners whose directory listing an
 * admin has approved appear here. We map the API rows into the existing `Partner` shape
 * so the rendered cards/search/filters are byte-for-byte the same as the prior mock.
 */
function mapPublicPartner(p: PublicPartner): Partner {
  return {
    id: p.id,
    name: p.name ?? '',
    nameAr: p.nameAr ?? '',
    category: p.category ?? '',
    description: p.description ?? '',
    descriptionAr: p.descriptionAr ?? '',
    logo: p.logo_url || PLACEHOLDER_LOGO,
    country: p.country ?? '',
    countryAr: p.countryAr ?? '',
    website: p.website ?? '',
    verified: p.verified,
  };
}

const categories = [
  { id: 'all', label: 'All Partners', labelAr: 'جميع الشركاء', icon: Building2 },
  { id: 'developers', label: 'Developers', labelAr: 'المطورين', icon: Home },
  { id: 'hotels', label: 'Hotels', labelAr: 'الفنادق', icon: Building2 },
  { id: 'property-management', label: 'Property Management', labelAr: 'إدارة العقارات', icon: Building2 },
  { id: 'insurance', label: 'Insurance', labelAr: 'التأمين', icon: Shield },
  { id: 'valuation', label: 'Valuation', labelAr: 'التقييم', icon: Scale },
  { id: 'digital-finance', label: 'Digital Finance', labelAr: 'التمويل الرقمي', icon: Coins }
];

const countries = [
  { id: 'all', label: 'All Countries', labelAr: 'جميع الدول', flag: '🌍' },
  { id: 'UAE', label: 'UAE', labelAr: 'الإمارات', flag: '🇦🇪' },
  { id: 'UK', label: 'UK', labelAr: 'المملكة المتحدة', flag: '🇬🇧' },
  { id: 'USA', label: 'USA', labelAr: 'أمريكا', flag: '🇺🇸' }
];

export default function Partners() {
  const { t, language, isRTL } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCountry, setActiveCountry] = useState('all');
  const [partners, setPartners] = useState<Partner[]>([]);

  // Poll-on-mount (no realtime, platform-wide). Public endpoint → directory-approved only.
  useEffect(() => {
    let active = true;
    partnerApi
      .directory()
      .then((rows) => {
        if (active) setPartners(rows.map(mapPublicPartner));
      })
      .catch(() => {
        if (active) setPartners([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         partner.nameAr.includes(searchTerm) ||
                         partner.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || partner.category === activeCategory;
    const matchesCountry = activeCountry === 'all' || partner.country === activeCountry;
    return matchesSearch && matchesCategory && matchesCountry;
  });

  const getCategoryLabel = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return language === 'ar' ? category?.labelAr : category?.label;
  };

  return (
    <MainLayout>
      <div className={`container mx-auto px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {language === 'ar' ? 'شركاؤنا' : 'Our Partners'}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'ar' 
              ? 'نعمل مع شركاء موثوقين ومعتمدين لضمان أعلى معايير الجودة والأمان في منصتنا'
              : 'We work with trusted and verified partners to ensure the highest standards of quality and security on our platform'}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === 'ar' ? 'البحث عن شريك...' : 'Search partners...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Country Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {countries.map((country) => (
            <Button
              key={country.id}
              variant={activeCountry === country.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCountry(country.id)}
              className="flex items-center gap-2"
            >
              <span>{country.flag}</span>
              <span>{language === 'ar' ? country.labelAr : country.label}</span>
            </Button>
          ))}
        </div>

        {/* Categories Tabs */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-8">
          <TabsList className="flex flex-wrap justify-center gap-2 h-auto bg-transparent">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {language === 'ar' ? category.labelAr : category.label}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Partners Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPartners.map((partner) => (
            <Card key={partner.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      <img 
                        src={partner.logo} 
                        alt={partner.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {language === 'ar' ? partner.nameAr : partner.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {getCategoryLabel(partner.category)}
                        </Badge>
                        {partner.verified && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {language === 'ar' ? partner.descriptionAr : partner.description}
                </p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{language === 'ar' ? partner.countryAr : partner.country}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open(partner.website, '_blank')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'زيارة الموقع' : 'Visit Website'}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPartners.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {language === 'ar' ? 'لم يتم العثور على شركاء' : 'No partners found'}
            </p>
          </div>
        )}

        {/* Become a Partner CTA */}
        <Card className="mt-12 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <h2 className="text-2xl font-bold mb-4">
              {language === 'ar' ? 'انضم كشريك' : 'Become a Partner'}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              {language === 'ar'
                ? 'هل أنت شركة مهتمة بالشراكة معنا؟ تواصل معنا لمناقشة فرص التعاون.'
                : 'Are you a company interested in partnering with us? Contact us to discuss collaboration opportunities.'}
            </p>
            <Button size="lg">
              {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
