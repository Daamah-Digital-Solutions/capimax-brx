import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
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

const partners: Partner[] = [
  // Developers
  {
    id: '1',
    name: 'Elite Gate Properties',
    nameAr: 'إيليت جيت للعقارات',
    category: 'developers',
    description: 'Premier real estate developer delivering exceptional residential and commercial projects.',
    descriptionAr: 'مطور عقاري متميز يقدم مشاريع سكنية وتجارية استثنائية.',
    logo: '/placeholder.svg',
    country: 'UAE',
    countryAr: 'الإمارات',
    website: 'https://www.elitegateproperties.com',
    verified: true
  },
  {
    id: '2',
    name: 'TDH Development',
    nameAr: 'تي دي إتش للتطوير',
    category: 'developers',
    description: 'Innovative development company specializing in luxury real estate projects.',
    descriptionAr: 'شركة تطوير مبتكرة متخصصة في المشاريع العقارية الفاخرة.',
    logo: '/placeholder.svg',
    country: 'UK',
    countryAr: 'المملكة المتحدة',
    website: 'https://www.tdhdevelopment.com',
    verified: true
  },
  {
    id: '3',
    name: 'Capimax Development',
    nameAr: 'كابيماكس للتطوير',
    category: 'developers',
    description: 'Strategic real estate development company with diverse portfolio across key markets.',
    descriptionAr: 'شركة تطوير عقاري استراتيجية مع محفظة متنوعة في الأسواق الرئيسية.',
    logo: '/placeholder.svg',
    country: 'UAE',
    countryAr: 'الإمارات',
    website: 'https://www.capimaxgroup.com',
    verified: true
  },
  // Hotels
  {
    id: '4',
    name: 'Priminn Hotels',
    nameAr: 'بريم إن للفنادق',
    category: 'hotels',
    description: 'Leading hospitality developer creating world-class hotel and resort destinations.',
    descriptionAr: 'مطور ضيافة رائد يبتكر وجهات فندقية ومنتجعات عالمية المستوى.',
    logo: '/placeholder.svg',
    country: 'USA',
    countryAr: 'أمريكا',
    website: 'https://www.priminnhotel.com',
    verified: true
  },
  // Property Management
  {
    id: '5',
    name: 'Nova Property Management',
    nameAr: 'نوفا لإدارة العقارات',
    category: 'property-management',
    description: 'Professional property management services ensuring optimal asset performance.',
    descriptionAr: 'خدمات إدارة عقارات احترافية تضمن الأداء الأمثل للأصول.',
    logo: '/placeholder.svg',
    country: 'UK',
    countryAr: 'المملكة المتحدة',
    website: 'https://www.novapropertymanagement.com',
    verified: true
  },
  // Insurance
  {
    id: '6',
    name: 'Assurax Insurance',
    nameAr: 'أشوراكس للتأمين',
    category: 'insurance',
    description: 'Comprehensive insurance solutions for real estate and investment protection.',
    descriptionAr: 'حلول تأمين شاملة لحماية العقارات والاستثمارات.',
    logo: '/placeholder.svg',
    country: 'UK',
    countryAr: 'المملكة المتحدة',
    website: 'https://www.assuraxinsurance.com',
    verified: true
  },
  {
    id: '7',
    name: 'HCC International Insurance',
    nameAr: 'إتش سي سي للتأمين الدولي',
    category: 'insurance',
    description: 'International insurance provider specializing in property and asset coverage.',
    descriptionAr: 'مزود تأمين دولي متخصص في تغطية العقارات والأصول.',
    logo: '/placeholder.svg',
    country: 'USA',
    countryAr: 'أمريكا',
    website: 'https://www.hccinternationalinsurance.com',
    verified: true
  },
  // Valuation
  {
    id: '8',
    name: 'CIM Financial Group',
    nameAr: 'سي آي إم للمجموعة المالية',
    category: 'valuation',
    description: 'Professional valuation and financial advisory services for real estate assets.',
    descriptionAr: 'خدمات تقييم واستشارات مالية احترافية للأصول العقارية.',
    logo: '/placeholder.svg',
    country: 'USA',
    countryAr: 'أمريكا',
    website: 'https://www.cimfinancialgroup.com',
    verified: true
  },
  {
    id: '9',
    name: 'Capimax Financial Management',
    nameAr: 'كابيماكس للإدارة المالية',
    category: 'valuation',
    description: 'Expert financial management and valuation services for investment properties.',
    descriptionAr: 'خدمات إدارة مالية وتقييم متخصصة للعقارات الاستثمارية.',
    logo: '/placeholder.svg',
    country: 'UAE',
    countryAr: 'الإمارات',
    website: 'https://www.capimaxgroup.com',
    verified: true
  },
  // Digital Finance
  {
    id: '10',
    name: 'Nova Digital Finance',
    nameAr: 'نوفا للتمويل الرقمي',
    category: 'digital-finance',
    description: 'Interest-free digital financing solutions for tokenized real estate investments.',
    descriptionAr: 'حلول تمويل رقمية بدون فوائد للاستثمارات العقارية المرمزة.',
    logo: '/placeholder.svg',
    country: 'UAE',
    countryAr: 'الإمارات',
    website: 'https://www.novadf.com',
    verified: true
  }
];

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
