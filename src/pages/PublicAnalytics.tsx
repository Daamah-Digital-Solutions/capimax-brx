import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  Search, 
  BarChart3, 
  MapPin, 
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  DollarSign,
  Users,
  Percent,
  HardHat,
  FileText,
  Clock,
  Shield,
  X,
  ArrowUpRight,
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
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

// Mock project data
const projects = [
  {
    id: "proj-001",
    nameAr: "برج الواحة السكني",
    nameEn: "Al Waha Residential Tower",
    locationAr: "الرياض، المملكة العربية السعودية",
    locationEn: "Riyadh, Saudi Arabia",
    type: "residential",
    status: "ready",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80",
    totalValue: 45000000,
    currentValuation: 52000000,
    totalInvested: 38000000,
    totalDistributions: 4200000,
    yield: 8.5,
    lastUpdate: "2024-01-10"
  },
  {
    id: "proj-002",
    nameAr: "مجمع النخيل التجاري",
    nameEn: "Al Nakheel Commercial Complex",
    locationAr: "دبي، الإمارات",
    locationEn: "Dubai, UAE",
    type: "commercial",
    status: "construction",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80",
    totalValue: 78000000,
    currentValuation: 85000000,
    totalInvested: 65000000,
    totalDistributions: 0,
    yield: 0,
    progress: 65,
    lastUpdate: "2024-01-12"
  },
  {
    id: "proj-003",
    nameAr: "فندق الخليج الفاخر",
    nameEn: "Al Khaleej Luxury Hotel",
    locationAr: "المنامة، البحرين",
    locationEn: "Manama, Bahrain",
    type: "hotel",
    status: "ready",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&q=80",
    totalValue: 92000000,
    currentValuation: 105000000,
    totalInvested: 88000000,
    totalDistributions: 9500000,
    yield: 10.2,
    lastUpdate: "2024-01-08"
  },
  {
    id: "proj-004",
    nameAr: "مركز الابتكار التقني",
    nameEn: "Innovation Tech Center",
    locationAr: "الرياض، المملكة العربية السعودية",
    locationEn: "Riyadh, Saudi Arabia",
    type: "office",
    status: "construction",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80",
    totalValue: 120000000,
    currentValuation: 135000000,
    totalInvested: 95000000,
    totalDistributions: 0,
    yield: 0,
    progress: 42,
    lastUpdate: "2024-01-14"
  }
];

export default function PublicAnalytics() {
  const { t, isRTL, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get("project");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("1y");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const filteredProjects = projects.filter(project => {
    const name = language === "ar" ? project.nameAr : project.nameEn;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getProjectName = (project: typeof projects[0]) => {
    return language === "ar" ? project.nameAr : project.nameEn;
  };

  const getProjectLocation = (project: typeof projects[0]) => {
    return language === "ar" ? project.locationAr : project.locationEn;
  };

  const getStatusText = (status: string) => {
    return status === "ready" ? t("analytics.ready") : t("analytics.underConstruction");
  };

  // Mock chart data with translations
  const financialPerformanceData = [
    { month: isRTL ? "يناير" : "Jan", revenue: 420000, expenses: 180000, net: 240000 },
    { month: isRTL ? "فبراير" : "Feb", revenue: 450000, expenses: 175000, net: 275000 },
    { month: isRTL ? "مارس" : "Mar", revenue: 480000, expenses: 190000, net: 290000 },
    { month: isRTL ? "أبريل" : "Apr", revenue: 510000, expenses: 185000, net: 325000 },
    { month: isRTL ? "مايو" : "May", revenue: 490000, expenses: 195000, net: 295000 },
    { month: isRTL ? "يونيو" : "Jun", revenue: 520000, expenses: 200000, net: 320000 },
    { month: isRTL ? "يوليو" : "Jul", revenue: 550000, expenses: 210000, net: 340000 },
    { month: isRTL ? "أغسطس" : "Aug", revenue: 530000, expenses: 205000, net: 325000 },
    { month: isRTL ? "سبتمبر" : "Sep", revenue: 560000, expenses: 215000, net: 345000 },
    { month: isRTL ? "أكتوبر" : "Oct", revenue: 580000, expenses: 220000, net: 360000 },
    { month: isRTL ? "نوفمبر" : "Nov", revenue: 600000, expenses: 225000, net: 375000 },
    { month: isRTL ? "ديسمبر" : "Dec", revenue: 620000, expenses: 230000, net: 390000 }
  ];

  const constructionProgressData = [
    { milestone: t("analytics.foundations"), planned: 100, actual: 100 },
    { milestone: t("analytics.structure"), planned: 100, actual: 100 },
    { milestone: t("analytics.facades"), planned: 80, actual: 75 },
    { milestone: t("analytics.finishing"), planned: 60, actual: 45 },
    { milestone: t("analytics.systems"), planned: 40, actual: 30 },
    { milestone: t("analytics.delivery"), planned: 0, actual: 0 }
  ];

  const distributionTrendsData = [
    { quarter: "Q1 2023", amount: 850000, yield: 7.8 },
    { quarter: "Q2 2023", amount: 920000, yield: 8.2 },
    { quarter: "Q3 2023", amount: 980000, yield: 8.5 },
    { quarter: "Q4 2023", amount: 1050000, yield: 8.8 },
    { quarter: "Q1 2024", amount: 1100000, yield: 9.0 }
  ];

  const valuationHistoryData = [
    { date: "2021", valuation: 45000000 },
    { date: "2022", valuation: 48000000 },
    { date: "2023-Q1", valuation: 49500000 },
    { date: "2023-Q2", valuation: 50000000 },
    { date: "2023-Q3", valuation: 51000000 },
    { date: "2023-Q4", valuation: 52000000 },
    { date: "2024-Q1", valuation: 52500000 }
  ];

  const expenseBreakdownData = [
    { name: t("analytics.maintenance"), value: 35, color: "hsl(43, 74%, 49%)" },
    { name: t("analytics.management"), value: 25, color: "hsl(199, 89%, 48%)" },
    { name: t("analytics.insurance"), value: 15, color: "hsl(142, 76%, 36%)" },
    { name: t("analytics.taxes"), value: 15, color: "hsl(38, 92%, 50%)" },
    { name: t("analytics.other"), value: 10, color: "hsl(222, 30%, 40%)" }
  ];

  return (
    <div className={`min-h-screen bg-background ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
              <Link to="/" className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className="w-10 h-10 rounded-lg bg-gradient-gold flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">C</span>
                </div>
                <span className="text-xl font-bold text-foreground">Capimax BRX</span>
              </Link>
              <Separator orientation="vertical" className="h-8" />
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <BarChart3 className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold">{t("analytics.title")}</h1>
              </div>
            </div>
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <Link to="/reports">
                <Button variant="outline" className={`gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <FileText className="w-4 h-4" />
                  {t("analytics.reports")}
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="gold-outline">{t("analytics.exploreOpportunities")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Transparency Notice */}
        <Card className="bg-muted/50 border-primary/20 mb-8">
          <CardContent className="py-4">
            <div className={`flex items-start gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t("analytics.transparencyNotice")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("analytics.transparencyDesc")}
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
                <div className={`flex flex-col lg:flex-row gap-4 ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                    <Input
                      placeholder={t("analytics.searchProject")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`h-12 text-base ${isRTL ? "pr-10" : "pl-10"}`}
                    />
                  </div>

                  {/* Filters */}
                  <div className={`flex flex-wrap gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder={t("analytics.period")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3m">{t("analytics.3months")}</SelectItem>
                        <SelectItem value="6m">{t("analytics.6months")}</SelectItem>
                        <SelectItem value="1y">{t("analytics.1year")}</SelectItem>
                        <SelectItem value="all">{t("analytics.allTime")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t("analytics.status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("analytics.allStatuses")}</SelectItem>
                        <SelectItem value="ready">{t("analytics.ready")}</SelectItem>
                        <SelectItem value="construction">{t("analytics.underConstruction")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder={t("analytics.category")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("analytics.allCategories")}</SelectItem>
                        <SelectItem value="financial">{t("analytics.financial")}</SelectItem>
                        <SelectItem value="construction">{t("analytics.construction")}</SelectItem>
                        <SelectItem value="distributions">{t("analytics.distributions")}</SelectItem>
                        <SelectItem value="valuation">{t("analytics.valuation")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={clearFilters} className={`gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <X className="w-4 h-4" />
                      {t("analytics.clear")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Projects Grid */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t("analytics.availableProjects")}
              </h2>
              <p className="text-muted-foreground">
                {t("analytics.selectProject")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <Card 
                  key={project.id} 
                  className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
                  onClick={() => setSearchParams({ project: project.id })}
                >
                  <div className="relative h-40">
                    <img 
                      src={project.image} 
                      alt={getProjectName(project)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                    <Badge 
                      className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} ${
                        project.status === "ready" 
                          ? "bg-success text-success-foreground" 
                          : "bg-warning text-warning-foreground"
                      }`}
                    >
                      {getStatusText(project.status)}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {getProjectName(project)}
                    </h3>
                    <p className={`text-sm text-muted-foreground mb-4 flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <MapPin className="w-3.5 h-3.5" />
                      {getProjectLocation(project)}
                    </p>
                    
                    {/* KPI Preview */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t("analytics.currentValuation")}</p>
                        <p className="text-sm font-semibold text-primary">
                          {formatCurrency(project.currentValuation)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t("analytics.yield")}</p>
                        <p className="text-sm font-semibold text-success">
                          {project.yield > 0 ? `${project.yield}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProjects.length === 0 && (
              <Card className="py-16 text-center">
                <CardContent>
                  <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t("analytics.noResults")}</h3>
                  <p className="text-muted-foreground mb-4">{t("analytics.noProjectsFound")}</p>
                  <Button variant="outline" onClick={clearFilters}>{t("analytics.clearFilters")}</Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* Project Analytics Dashboard */
          <div>
            {/* Breadcrumb */}
            <div className={`flex items-center gap-2 text-sm text-muted-foreground mb-6 ${isRTL ? "flex-row-reverse" : ""}`}>
              <button 
                onClick={() => setSearchParams({})}
                className="hover:text-primary transition-colors"
              >
                {t("analytics.title")}
              </button>
              <ChevronIcon className="w-4 h-4" />
              <span className="text-foreground">{getProjectName(selectedProject)}</span>
            </div>

            {/* Project Header */}
            <div className={`flex flex-col lg:flex-row gap-6 mb-8 ${isRTL ? "lg:flex-row-reverse" : ""}`}>
              <Card className="flex-1">
                <CardContent className="py-6">
                  <div className={`flex items-start gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <img 
                      src={selectedProject.image}
                      alt={getProjectName(selectedProject)}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <div className={`flex items-start justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                        <div>
                          <h2 className="text-xl font-bold text-foreground mb-1">
                            {getProjectName(selectedProject)}
                          </h2>
                          <p className={`text-sm text-muted-foreground mb-2 flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <MapPin className="w-3.5 h-3.5" />
                            {getProjectLocation(selectedProject)}
                          </p>
                        </div>
                        <Badge 
                          className={
                            selectedProject.status === "ready" 
                              ? "bg-success text-success-foreground" 
                              : "bg-warning text-warning-foreground"
                          }
                        >
                          {getStatusText(selectedProject.status)}
                        </Badge>
                      </div>
                      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isRTL ? "flex-row-reverse" : ""}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t("analytics.lastUpdate")}: {selectedProject.lastUpdate}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time Range Filter */}
              <Card className="lg:w-64">
                <CardContent className="py-6">
                  <p className="text-sm text-muted-foreground mb-3">{t("analytics.timePeriod")}</p>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3m">{t("analytics.3months")}</SelectItem>
                      <SelectItem value="6m">{t("analytics.6months")}</SelectItem>
                      <SelectItem value="1y">{t("analytics.1year")}</SelectItem>
                      <SelectItem value="all">{t("analytics.allTime")}</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="py-4">
                  <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div className={`flex items-center gap-1 text-success text-sm ${isRTL ? "flex-row-reverse" : ""}`}>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>+15.6%</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(selectedProject.currentValuation)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("analytics.currentValuation")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="p-2 rounded-lg bg-info/10">
                      <Users className="w-5 h-5 text-info" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(selectedProject.totalInvested)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("analytics.totalInvestment")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="p-2 rounded-lg bg-success/10">
                      <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(selectedProject.totalDistributions)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("analytics.totalDistributions")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-4">
                  <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <div className="p-2 rounded-lg bg-warning/10">
                      <Percent className="w-5 h-5 text-warning" />
                    </div>
                    {selectedProject.yield > 0 && (
                      <div className={`flex items-center gap-1 text-success text-sm ${isRTL ? "flex-row-reverse" : ""}`}>
                        <ArrowUpRight className="w-4 h-4" />
                        <span>+0.3%</span>
                      </div>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {selectedProject.yield > 0 ? `${selectedProject.yield}%` : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.status === "ready" ? t("analytics.annualYield") : t("analytics.expectedYield")}
                  </p>
                </CardContent>
              </Card>

              {selectedProject.progress && (
                <Card className="md:col-span-2 lg:col-span-4">
                  <CardContent className="py-4">
                    <div className={`flex items-center justify-between mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <HardHat className="w-5 h-5 text-warning" />
                        <span className="font-medium">{t("analytics.constructionProgress")}</span>
                      </div>
                      <span className="text-xl font-bold text-primary">{selectedProject.progress}%</span>
                    </div>
                    <Progress value={selectedProject.progress} className="h-3" />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Charts */}
            <Tabs defaultValue="financial" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                <TabsTrigger value="financial">{t("analytics.financialPerformance")}</TabsTrigger>
                {selectedProject.progress && (
                  <TabsTrigger value="construction">{t("analytics.constructionProgress")}</TabsTrigger>
                )}
                <TabsTrigger value="distributions">{t("analytics.distributions")}</TabsTrigger>
                <TabsTrigger value="valuation">{t("analytics.valuation")}</TabsTrigger>
              </TabsList>

              {/* Financial Performance */}
              <TabsContent value="financial" className="space-y-6">
                <div className="grid lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <TrendingUp className="w-5 h-5 text-primary" />
                          {t("analytics.revenueVsExpenses")}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {t("analytics.lastUpdate")}: 2024-01-10
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={financialPerformanceData}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                          <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                          <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `$${v/1000}K`} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(222, 47%, 10%)", 
                              border: "1px solid hsl(222, 30%, 18%)",
                              borderRadius: "8px"
                            }}
                            formatter={(value: number) => [`$${(value/1000).toFixed(0)}K`, ""]}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="revenue" name={t("analytics.revenue")} stroke="hsl(142, 76%, 36%)" fillOpacity={1} fill="url(#colorRevenue)" />
                          <Area type="monotone" dataKey="expenses" name={t("analytics.expenses")} stroke="hsl(0, 72%, 51%)" fillOpacity={1} fill="url(#colorExpenses)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 text-base ${isRTL ? "flex-row-reverse" : ""}`}>
                        <DollarSign className="w-5 h-5 text-primary" />
                        {t("analytics.expenseBreakdown")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={expenseBreakdownData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {expenseBreakdownData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(222, 47%, 10%)", 
                              border: "1px solid hsl(222, 30%, 18%)",
                              borderRadius: "8px"
                            }}
                            formatter={(value: number) => [`${value}%`, ""]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {expenseBreakdownData.map((item) => (
                          <div key={item.name} className={`flex items-center gap-2 text-sm ${isRTL ? "flex-row-reverse" : ""}`}>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="font-medium">{item.value}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Net Income Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <BarChart3 className="w-5 h-5 text-primary" />
                      {t("analytics.monthlyNetIncome")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsBarChart data={financialPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                        <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                        <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `$${v/1000}K`} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(222, 47%, 10%)", 
                            border: "1px solid hsl(222, 30%, 18%)",
                            borderRadius: "8px"
                          }}
                          formatter={(value: number) => [`$${(value/1000).toFixed(0)}K`, t("analytics.netIncome")]}
                        />
                        <Bar dataKey="net" fill="hsl(43, 74%, 49%)" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Construction Progress */}
              {selectedProject.progress && (
                <TabsContent value="construction" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                          <HardHat className="w-5 h-5 text-warning" />
                          {t("analytics.constructionMilestones")}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {t("analytics.lastUpdate")}: 2024-01-12
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsBarChart data={constructionProgressData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                          <XAxis type="number" domain={[0, 100]} stroke="hsl(215, 20%, 55%)" fontSize={12} />
                          <YAxis type="category" dataKey="milestone" stroke="hsl(215, 20%, 55%)" fontSize={12} width={100} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(222, 47%, 10%)", 
                              border: "1px solid hsl(222, 30%, 18%)",
                              borderRadius: "8px"
                            }}
                            formatter={(value: number) => [`${value}%`, ""]}
                          />
                          <Legend />
                          <Bar dataKey="planned" name={t("analytics.planned")} fill="hsl(222, 30%, 40%)" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="actual" name={t("analytics.actual")} fill="hsl(43, 74%, 49%)" radius={[0, 4, 4, 0]} />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Milestones Timeline */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("analytics.milestonesTimeline")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {constructionProgressData.map((milestone) => (
                          <div key={milestone.milestone} className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <div className={`w-4 h-4 rounded-full ${
                              milestone.actual >= 100 
                                ? "bg-success" 
                                : milestone.actual > 0 
                                  ? "bg-warning" 
                                  : "bg-muted"
                            }`} />
                            <div className="flex-1">
                              <div className={`flex items-center justify-between mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                                <span className="font-medium">{milestone.milestone}</span>
                                <span className="text-sm text-muted-foreground">{milestone.actual}%</span>
                              </div>
                              <Progress value={milestone.actual} className="h-2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Distributions */}
              <TabsContent value="distributions" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <DollarSign className="w-5 h-5 text-success" />
                        {t("analytics.distributionTrends")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {t("analytics.lastUpdate")}: 2024-01-05
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={distributionTrendsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                        <XAxis dataKey="quarter" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                        <YAxis yAxisId="left" stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `$${v/1000}K`} />
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(222, 47%, 10%)", 
                            border: "1px solid hsl(222, 30%, 18%)",
                            borderRadius: "8px"
                          }}
                        />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="amount" name={t("analytics.distributions")} stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ fill: "hsl(142, 76%, 36%)" }} />
                        <Line yAxisId="right" type="monotone" dataKey="yield" name={t("analytics.yield")} stroke="hsl(43, 74%, 49%)" strokeWidth={2} dot={{ fill: "hsl(43, 74%, 49%)" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Valuation */}
              <TabsContent value="valuation" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <TrendingUp className="w-5 h-5 text-primary" />
                        {t("analytics.valuationHistory")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {t("analytics.lastUpdate")}: 2024-01-01
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={valuationHistoryData}>
                        <defs>
                          <linearGradient id="colorValuation" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(43, 74%, 49%)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(43, 74%, 49%)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                        <XAxis dataKey="date" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                        <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `$${v/1000000}M`} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(222, 47%, 10%)", 
                            border: "1px solid hsl(222, 30%, 18%)",
                            borderRadius: "8px"
                          }}
                          formatter={(value: number) => [`$${(value/1000000).toFixed(1)}M`, t("analytics.valuation")]}
                        />
                        <Area type="monotone" dataKey="valuation" stroke="hsl(43, 74%, 49%)" strokeWidth={2} fillOpacity={1} fill="url(#colorValuation)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}