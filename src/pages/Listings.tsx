import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Eye,
  Share2,
  MessageSquare,
  ChevronRight,
  MapPin,
  Calendar,
  Percent,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";

interface Listing {
  id: string;
  name: string;
  nameEn: string;
  location: string;
  type: string;
  status: "active" | "pending" | "sold-out";
  minInvestment: number;
  targetRaise: number;
  raised: number;
  investors: number;
  yield: number;
  commission: number;
  leads: number;
  conversions: number;
}

const listings: Listing[] = [
  {
    id: "1",
    name: "برج المارينا السكني",
    nameEn: "Marina Tower Residence",
    location: "دبي، الإمارات",
    type: "سكني",
    status: "active",
    minInvestment: 100,
    targetRaise: 5000000,
    raised: 3750000,
    investors: 245,
    yield: 8.5,
    commission: 2.5,
    leads: 45,
    conversions: 12,
  },
  {
    id: "2",
    name: "مجمع الواحة التجاري",
    nameEn: "Oasis Commercial Complex",
    location: "أبوظبي، الإمارات",
    type: "تجاري",
    status: "active",
    minInvestment: 100,
    targetRaise: 8000000,
    raised: 4200000,
    investors: 156,
    yield: 9.2,
    commission: 3.0,
    leads: 32,
    conversions: 8,
  },
  {
    id: "3",
    name: "فندق النخيل الفاخر",
    nameEn: "Palm Luxury Hotel",
    location: "دبي، الإمارات",
    type: "فندقي",
    status: "sold-out",
    minInvestment: 100,
    targetRaise: 12000000,
    raised: 12000000,
    investors: 320,
    yield: 10.5,
    commission: 3.5,
    leads: 78,
    conversions: 25,
  },
  {
    id: "4",
    name: "مشروع نخيل ريزيدنس",
    nameEn: "Palm Residences Project",
    location: "دبي، الإمارات",
    type: "قيد الإنشاء",
    status: "pending",
    minInvestment: 100,
    targetRaise: 15000000,
    raised: 0,
    investors: 0,
    yield: 12.0,
    commission: 4.0,
    leads: 15,
    conversions: 0,
  },
];

export default function Listings() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.name.includes(searchTerm) ||
      listing.nameEn.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && listing.status === "active") ||
      (activeTab === "pending" && listing.status === "pending") ||
      (activeTab === "sold-out" && listing.status === "sold-out");
    return matchesSearch && matchesTab;
  });

  const totalLeads = listings.reduce((sum, l) => sum + l.leads, 0);
  const totalConversions = listings.reduce((sum, l) => sum + l.conversions, 0);
  const totalCommission = listings
    .filter((l) => l.status === "sold-out" || l.raised > 0)
    .reduce((sum, l) => sum + (l.raised * l.commission) / 100, 0);

  const getStatusBadge = (status: Listing["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="success">نشط</Badge>;
      case "pending":
        return <Badge variant="warning">قيد الانتظار</Badge>;
      case "sold-out":
        return <Badge variant="outline">مكتمل</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              القوائم / Listings
            </h1>
            <p className="text-muted-foreground mt-1">إدارة العقارات المتاحة للترويج</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{listings.length}</p>
                <p className="text-xs text-muted-foreground">إجمالي القوائم</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">العملاء المحتملين</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalConversions}</p>
                <p className="text-xs text-muted-foreground">تحويلات ناجحة</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-gold text-primary-foreground">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${(totalCommission / 1000).toFixed(0)}K</p>
                <p className="text-xs opacity-80">إجمالي العمولات</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في القوائم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all">
              الكل
              <Badge variant="outline" className="ml-2">
                {listings.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="active">
              نشط
              <Badge variant="outline" className="ml-2">
                {listings.filter((l) => l.status === "active").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
            <TabsTrigger value="sold-out">مكتمل</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="space-y-4">
              {filteredListings.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-12 text-center">
                    <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-foreground font-medium">لا توجد قوائم</p>
                    <p className="text-sm text-muted-foreground">No listings found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredListings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="bg-card/50 backdrop-blur border-border/50 hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                        {/* Property Image Placeholder */}
                        <div className="w-full lg:w-40 h-28 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                          <Building2 className="w-10 h-10 text-primary/50" />
                        </div>

                        {/* Property Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-foreground truncate">{listing.name}</h3>
                            {getStatusBadge(listing.status)}
                            <Badge variant="outline">{listing.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{listing.nameEn}</p>

                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="w-4 h-4" />
                              {listing.location}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="w-4 h-4" />
                              الحد الأدنى: ${listing.minInvestment.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-500">
                              <Percent className="w-4 h-4" />
                              {listing.yield}% عائد
                            </span>
                          </div>

                          {/* Progress Bar */}
                          {listing.status !== "pending" && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">التمويل</span>
                                <span className="font-medium text-foreground">
                                  ${(listing.raised / 1000000).toFixed(1)}M / $
                                  {(listing.targetRaise / 1000000).toFixed(0)}M
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-gold rounded-full transition-all"
                                  style={{
                                    width: `${(listing.raised / listing.targetRaise) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Stats & Actions */}
                        <div className="flex flex-col gap-3 lg:w-48">
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 bg-muted/30 rounded-lg">
                              <p className="text-lg font-bold text-foreground">{listing.leads}</p>
                              <p className="text-xs text-muted-foreground">عملاء</p>
                            </div>
                            <div className="p-2 bg-muted/30 rounded-lg">
                              <p className="text-lg font-bold text-emerald-500">
                                {listing.conversions}
                              </p>
                              <p className="text-xs text-muted-foreground">تحويلات</p>
                            </div>
                          </div>

                          <div className="p-2 bg-primary/10 rounded-lg text-center">
                            <p className="text-xs text-muted-foreground">عمولتك</p>
                            <p className="text-lg font-bold text-primary">{listing.commission}%</p>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1">
                              <Share2 className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1">
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
