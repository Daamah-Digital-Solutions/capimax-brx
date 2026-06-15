import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  Search, 
  Filter, 
  FileText, 
  Building2, 
  MapPin, 
  Calendar,
  Download,
  Eye,
  ChevronRight,
  FileSpreadsheet,
  TrendingUp,
  HardHat,
  Coins,
  BarChart3,
  Clock,
  Shield,
  ExternalLink,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";

// Mock project data
const projects = [
  {
    id: "proj-001",
    name: "برج الواحة السكني",
    nameEn: "Al Waha Residential Tower",
    location: "الرياض، المملكة العربية السعودية",
    country: "السعودية",
    city: "الرياض",
    type: "سكني",
    status: "جاهز",
    statusEn: "Ready",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80",
    totalValue: 45000000,
    reportsCount: 12,
    lastUpdate: "2024-01-10"
  },
  {
    id: "proj-002",
    name: "مجمع النخيل التجاري",
    nameEn: "Al Nakheel Commercial Complex",
    location: "دبي، الإمارات",
    country: "الإمارات",
    city: "دبي",
    type: "تجاري",
    status: "قيد الإنشاء",
    statusEn: "Under Construction",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80",
    totalValue: 78000000,
    reportsCount: 18,
    lastUpdate: "2024-01-12",
    progress: 65
  },
  {
    id: "proj-003",
    name: "فندق الخليج الفاخر",
    nameEn: "Al Khaleej Luxury Hotel",
    location: "المنامة، البحرين",
    country: "البحرين",
    city: "المنامة",
    type: "فندقي",
    status: "جاهز",
    statusEn: "Ready",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&q=80",
    totalValue: 92000000,
    reportsCount: 15,
    lastUpdate: "2024-01-08"
  },
  {
    id: "proj-004",
    name: "مركز الابتكار التقني",
    nameEn: "Innovation Tech Center",
    location: "الرياض، المملكة العربية السعودية",
    country: "السعودية",
    city: "الرياض",
    type: "مكتبي",
    status: "قيد الإنشاء",
    statusEn: "Under Construction",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80",
    totalValue: 120000000,
    reportsCount: 22,
    lastUpdate: "2024-01-14",
    progress: 42
  }
];

// Mock reports for a selected project
const projectReports = {
  financial: [
    { id: "fr-001", title: "تقرير الأداء المالي - الربع الرابع 2023", titleEn: "Financial Performance Report - Q4 2023", period: "Q4 2023", issuer: "شركة التدقيق الخليجية", date: "2024-01-10", type: "PDF", size: "2.4 MB" },
    { id: "fr-002", title: "تقرير التدفقات النقدية السنوي", titleEn: "Annual Cash Flow Report", period: "2023", issuer: "شركة التدقيق الخليجية", date: "2024-01-05", type: "PDF", size: "1.8 MB" },
    { id: "fr-003", title: "ملخص الإيرادات والمصروفات", titleEn: "Revenue & Expenses Summary", period: "Q4 2023", issuer: "إدارة الأصول", date: "2024-01-08", type: "PDF", size: "1.2 MB" }
  ],
  construction: [
    { id: "cr-001", title: "تقرير تقدم الإنشاءات - يناير 2024", titleEn: "Construction Progress Report - Jan 2024", period: "يناير 2024", issuer: "شركة الهندسة المتحدة", date: "2024-01-12", type: "PDF", size: "5.6 MB" },
    { id: "cr-002", title: "تحديث المراحل الإنشائية", titleEn: "Milestones Update", period: "Q4 2023", issuer: "مدير المشروع", date: "2024-01-01", type: "PDF", size: "3.2 MB" }
  ],
  distributions: [
    { id: "dr-001", title: "جدول التوزيعات السنوي", titleEn: "Annual Distribution Schedule", period: "2024", issuer: "إدارة المستثمرين", date: "2024-01-02", type: "PDF", size: "0.8 MB" },
    { id: "dr-002", title: "تقرير العوائد التاريخية", titleEn: "Historical Returns Report", period: "2021-2023", issuer: "إدارة الأصول", date: "2024-01-05", type: "PDF", size: "1.5 MB" }
  ],
  valuation: [
    { id: "vr-001", title: "تقرير التقييم الحالي", titleEn: "Current Valuation Report", period: "يناير 2024", issuer: "شركة التقييم الدولية", date: "2024-01-14", type: "PDF", size: "4.2 MB" },
    { id: "vr-002", title: "تاريخ التقييمات السابقة", titleEn: "Historical Valuations", period: "2020-2023", issuer: "شركة التقييم الدولية", date: "2024-01-10", type: "PDF", size: "2.8 MB" }
  ]
};

const reportCategories = [
  { id: "financial", label: "التقارير المالية", labelEn: "Financial Reports", icon: FileSpreadsheet, count: 3 },
  { id: "construction", label: "تقارير الإنشاء", labelEn: "Construction Reports", icon: HardHat, count: 2 },
  { id: "distributions", label: "تقارير التوزيعات", labelEn: "Distribution Reports", icon: Coins, count: 2 },
  { id: "valuation", label: "تقارير التقييم", labelEn: "Valuation Reports", icon: TrendingUp, count: 2 }
];

export default function PublicReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get("project");
  const { t, isRTL, language } = useLanguage();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeCategory, setActiveCategory] = useState("financial");

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Localized report categories
  const localizedReportCategories = [
    { id: "financial", label: t("publicReports.financialReports"), icon: FileSpreadsheet, count: 3 },
    { id: "construction", label: t("publicReports.constructionReports"), icon: HardHat, count: 2 },
    { id: "distributions", label: t("publicReports.distributionReports"), icon: Coins, count: 2 },
    { id: "valuation", label: t("publicReports.valuationReports"), icon: TrendingUp, count: 2 }
  ];

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.includes(searchQuery) || 
                         project.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCountry = countryFilter === "all" || project.country === countryFilter;
    const matchesCity = cityFilter === "all" || project.city === cityFilter;
    const matchesType = typeFilter === "all" || project.type === typeFilter;
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    
    return matchesSearch && matchesCountry && matchesCity && matchesType && matchesStatus;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setCountryFilter("all");
    setCityFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-gold flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">C</span>
                </div>
                <span className="text-xl font-bold text-foreground">Capimax BRX</span>
              </Link>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold">{t("publicReports.pageTitle")}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/analytics">
                <Button variant="outline" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {t("publicReports.analyticsBtn")}
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="gold-outline">{t("publicReports.exploreBtn")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Transparency Notice */}
        <Card className="bg-muted/50 border-primary/20 mb-8">
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t("publicReports.transparencyTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("publicReports.transparencyDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!selectedProject ? (
          <>
            {/* Search & Filters */}
            <Card className="mb-8">
              <CardContent className="py-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} />
                    <Input
                      placeholder={t("publicReports.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${isRTL ? 'pr-10' : 'pl-10'} h-12 text-base`}
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-3">
                    <Select value={countryFilter} onValueChange={setCountryFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t("publicReports.country")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("publicReports.allCountries")}</SelectItem>
                        <SelectItem value="السعودية">{language === 'ar' ? 'السعودية' : 'Saudi Arabia'}</SelectItem>
                        <SelectItem value="الإمارات">{language === 'ar' ? 'الإمارات' : 'UAE'}</SelectItem>
                        <SelectItem value="البحرين">{language === 'ar' ? 'البحرين' : 'Bahrain'}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder={t("publicReports.city")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("publicReports.allCities")}</SelectItem>
                        <SelectItem value="الرياض">{language === 'ar' ? 'الرياض' : 'Riyadh'}</SelectItem>
                        <SelectItem value="دبي">{language === 'ar' ? 'دبي' : 'Dubai'}</SelectItem>
                        <SelectItem value="المنامة">{language === 'ar' ? 'المنامة' : 'Manama'}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder={t("publicReports.assetType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("publicReports.allTypes")}</SelectItem>
                        <SelectItem value="سكني">{t("publicReports.residential")}</SelectItem>
                        <SelectItem value="تجاري">{t("publicReports.commercial")}</SelectItem>
                        <SelectItem value="فندقي">{t("publicReports.hotel")}</SelectItem>
                        <SelectItem value="مكتبي">{t("publicReports.office")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t("publicReports.status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("publicReports.allStatuses")}</SelectItem>
                        <SelectItem value="جاهز">{t("publicReports.ready")}</SelectItem>
                        <SelectItem value="قيد الإنشاء">{t("publicReports.underConstruction")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={clearFilters} className="gap-2">
                      <X className="w-4 h-4" />
                      {t("publicReports.clear")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Projects Grid */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t("publicReports.availableProjects")}
              </h2>
              <p className="text-muted-foreground">
                {t("publicReports.selectProject")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <Card 
                  key={project.id} 
                  className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
                  onClick={() => setSearchParams({ project: project.id })}
                >
                  <div className="relative h-48">
                    <img 
                      src={project.image} 
                      alt={language === 'ar' ? project.name : project.nameEn}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                    <Badge 
                      className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} ${
                        project.status === "جاهز" 
                          ? "bg-success text-success-foreground" 
                          : "bg-warning text-warning-foreground"
                      }`}
                    >
                      {project.status === "جاهز" ? t("publicReports.ready") : t("publicReports.underConstruction")}
                    </Badge>
                    {project.progress && (
                      <div className={`absolute bottom-3 ${isRTL ? 'right-3 left-3' : 'left-3 right-3'}`}>
                        <div className="flex items-center justify-between text-xs text-foreground mb-1">
                          <span>{t("publicReports.constructionProgress")}</span>
                          <span>{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-1.5" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {language === 'ar' ? project.name : project.nameEn}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {project.location}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span>{project.reportsCount} {t("publicReports.reportsCount")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t("publicReports.lastUpdate")}: {project.lastUpdate}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <Card className="py-16 text-center">
                <CardContent>
                  <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("publicReports.noResults")}</h3>
                  <p className="text-muted-foreground mb-4">{t("publicReports.noProjectsFound")}</p>
                  <Button variant="outline" onClick={clearFilters}>{t("publicReports.clearFilters")}</Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* Project Reports View */
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <button 
                onClick={() => setSearchParams({})}
                className="hover:text-primary transition-colors"
              >
                {t("publicReports.back")}
              </button>
              <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              <span className="text-foreground">{language === 'ar' ? selectedProject.name : selectedProject.nameEn}</span>
            </div>

            {/* Project Overview */}
            <Card className="mb-8">
              <CardContent className="py-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <img 
                    src={selectedProject.image}
                    alt={language === 'ar' ? selectedProject.name : selectedProject.nameEn}
                    className="w-full lg:w-64 h-48 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground mb-1">
                          {language === 'ar' ? selectedProject.name : selectedProject.nameEn}
                        </h2>
                        <p className="text-muted-foreground">{language === 'ar' ? selectedProject.nameEn : selectedProject.name}</p>
                      </div>
                      <Badge 
                        className={
                          selectedProject.status === "جاهز" 
                            ? "bg-success text-success-foreground" 
                            : "bg-warning text-warning-foreground"
                        }
                      >
                        {selectedProject.status === "جاهز" ? t("publicReports.ready") : t("publicReports.underConstruction")}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'الموقع' : 'Location'}</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          {selectedProject.location}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t("publicReports.assetType")}</p>
                        <p className="text-sm font-medium">{selectedProject.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t("publicReports.totalValue")}</p>
                        <p className="text-sm font-medium text-primary">
                          ${(selectedProject.totalValue / 1000000).toFixed(1)}M
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t("publicReports.reportsCount")}</p>
                        <p className="text-sm font-medium">{selectedProject.reportsCount}</p>
                      </div>
                    </div>

                    {selectedProject.progress && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">{t("publicReports.constructionProgress")}</span>
                          <span className="font-medium text-primary">{selectedProject.progress}%</span>
                        </div>
                        <Progress value={selectedProject.progress} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Categories */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              {localizedReportCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <Card 
                    key={category.id}
                    className={`cursor-pointer transition-all ${
                      activeCategory === category.id 
                        ? "border-primary bg-primary/5" 
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          activeCategory === category.id 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">{category.label}</h4>
                          <p className="text-xs text-muted-foreground">{category.count} {t("publicReports.reportsCount")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Reports List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const category = localizedReportCategories.find(c => c.id === activeCategory);
                    const Icon = category?.icon || FileText;
                    return (
                      <>
                        <Icon className="w-5 h-5 text-primary" />
                        {category?.label}
                      </>
                    );
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectReports[activeCategory as keyof typeof projectReports]?.map((report) => (
                    <div 
                      key={report.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-destructive/10">
                          <FileText className="w-6 h-6 text-destructive" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground mb-1">{language === 'ar' ? report.title : report.titleEn}</h4>
                          <p className="text-sm text-muted-foreground mb-2">{language === 'ar' ? report.titleEn : report.title}</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {t("publicReports.reportPeriod")}: {report.period}
                            </span>
                            <span>{t("publicReports.reportIssuer")}: {report.issuer}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {report.date}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {report.type} • {report.size}
                        </Badge>
                        <Button variant="ghost" size="icon" title={t("publicReports.viewReport")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t("publicReports.downloadReport")}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Read-Only Notice */}
                <div className="mt-6 p-4 rounded-lg bg-info/10 border border-info/20">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-info mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {language === 'ar' ? 'وضع القراءة فقط' : 'Read-Only Mode'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' 
                          ? 'التقارير المعروضة مخصصة للعرض فقط ولا يمكن تعديلها. البيانات المقدمة تعكس آخر المعلومات المتاحة وقد تخضع للتحديث.'
                          : 'Reports displayed are view-only and cannot be modified. Data provided reflects the latest available information and may be subject to updates.'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation to Analytics */}
            <Card className={`mt-8 bg-gradient-to-${isRTL ? 'l' : 'r'} from-primary/10 to-transparent border-primary/20`}>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/20">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {language === 'ar' ? 'عرض التحليلات المرئية' : 'View Visual Analytics'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {language === 'ar' ? 'اطلع على الرسوم البيانية ومؤشرات الأداء لهذا المشروع' : 'View charts and performance indicators for this project'}
                      </p>
                    </div>
                  </div>
                  <Link to={`/analytics?project=${selectedProject.id}`}>
                    <Button className="gap-2">
                      {t("publicReports.analyticsBtn")}
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 Capimax BRX. {language === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-primary transition-colors">{t("nav.about")}</Link>
              <Link to="/compliance" className="hover:text-primary transition-colors">{t("nav.compliance")}</Link>
              <Link to="/support" className="hover:text-primary transition-colors">{t("nav.support")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
