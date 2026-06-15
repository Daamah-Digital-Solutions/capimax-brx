import { useState } from "react";
import { 
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Award,
  Link2,
  Copy,
  Eye,
  Download,
  BarChart3,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  User
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisaCardsSection } from "@/components/wallet/VisaCardsSection";
import { CreateVirtualCardButton } from "@/components/wallet/CreateVirtualCardButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const brokerStats = {
  totalListings: 12,
  activeListings: 8,
  totalReferrals: 45,
  convertedReferrals: 28,
  totalCommission: 35000,
  pendingCommission: 8500,
  thisMonthCommission: 5200,
  conversionRate: 62,
};

const listings = [
  {
    id: "1",
    name: "برج مارينا باي التجاري",
    location: "دبي، الإمارات",
    status: "active",
    referrals: 8,
    converted: 5,
    commission: 2500,
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400",
  },
  {
    id: "2",
    name: "مساكن النخلة الفاخرة",
    location: "دبي، الإمارات",
    status: "active",
    referrals: 12,
    converted: 8,
    commission: 4000,
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400",
  },
  {
    id: "3",
    name: "المجمع الصناعي الحديث",
    location: "الرياض، السعودية",
    status: "sold_out",
    referrals: 6,
    converted: 4,
    commission: 2000,
    image: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400",
  },
];

const referrals = [
  { id: 1, name: "أحمد محمد", email: "ahmed@email.com", property: "برج مارينا باي", status: "converted", amount: 5000, commission: 250, date: "2024-12-15" },
  { id: 2, name: "سارة علي", email: "sara@email.com", property: "مساكن النخلة", status: "converted", amount: 10000, commission: 500, date: "2024-12-12" },
  { id: 3, name: "خالد عبدالله", email: "khalid@email.com", property: "برج مارينا باي", status: "pending", amount: null, commission: null, date: "2024-12-10" },
  { id: 4, name: "فاطمة حسن", email: "fatima@email.com", property: "مساكن النخلة", status: "converted", amount: 15000, commission: 750, date: "2024-12-08" },
  { id: 5, name: "عمر سعيد", email: "omar@email.com", property: "المجمع الصناعي", status: "lost", amount: null, commission: null, date: "2024-12-05" },
];

const commissions = [
  { id: 1, referral: "أحمد محمد", property: "برج مارينا باي", amount: 250, status: "paid", date: "2024-12-20" },
  { id: 2, referral: "سارة علي", property: "مساكن النخلة", amount: 500, status: "paid", date: "2024-12-18" },
  { id: 3, referral: "فاطمة حسن", property: "مساكن النخلة", amount: 750, status: "pending", date: "2025-01-05" },
  { id: 4, referral: "محمد أحمد", property: "المجمع الصناعي", amount: 400, status: "paid", date: "2024-12-10" },
];

export default function BrokerDashboard() {
  const [copiedLink, setCopiedLink] = useState(false);
  const [filter, setFilter] = useState("all");
  const referralLink = "https://capimax.io/ref/BROKER123";

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  لوحة تحكم الوسيط / Broker Dashboard
                </h1>
                <p className="text-muted-foreground">إدارة الإحالات والعمولات</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <CreateVirtualCardButton roleLabel="Broker" />
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <code className="text-sm text-foreground">{referralLink}</code>
                  <Button variant="ghost" size="icon" onClick={copyReferralLink}>
                    {copiedLink ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="success">{brokerStats.conversionRate}% تحويل</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">إجمالي الإحالات</div>
              <div className="text-2xl font-bold text-foreground">{brokerStats.totalReferrals}</div>
              <div className="text-xs text-success flex items-center gap-1 mt-1">
                <ArrowUpRight className="w-3 h-3" />
                {brokerStats.convertedReferrals} تم تحويلهم
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <DollarSign className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">إجمالي العمولات</div>
              <div className="text-2xl font-bold text-gradient-gold">${brokerStats.totalCommission.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                ${brokerStats.pendingCommission.toLocaleString()} معلق
              </div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">هذا الشهر</div>
              <div className="text-2xl font-bold text-success">${brokerStats.thisMonthCommission.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">العقارات النشطة</div>
              <div className="text-2xl font-bold text-foreground">{brokerStats.activeListings}</div>
              <div className="text-xs text-muted-foreground mt-1">
                من أصل {brokerStats.totalListings}
              </div>
            </div>
          </div>

          <Tabs defaultValue="referrals" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="referrals">الإحالات</TabsTrigger>
              <TabsTrigger value="commissions">العمولات</TabsTrigger>
              <TabsTrigger value="listings">العقارات</TabsTrigger>
              <TabsTrigger value="performance">الأداء</TabsTrigger>
              <TabsTrigger value="wallet">المحفظة والبطاقات</TabsTrigger>
            </TabsList>

            {/* Referrals Tab */}
            <TabsContent value="referrals">
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-foreground">سجل الإحالات</h2>
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger className="w-40">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="تصفية" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="converted">تم التحويل</SelectItem>
                        <SelectItem value="pending">قيد الانتظار</SelectItem>
                        <SelectItem value="lost">فقد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">المستثمر</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">العقار</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">المبلغ</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">العمولة</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">التاريخ</th>
                        <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {referrals.map((referral) => (
                        <tr key={referral.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{referral.name}</div>
                                <div className="text-xs text-muted-foreground">{referral.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">{referral.property}</td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {referral.amount ? `$${referral.amount.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-success">
                            {referral.commission ? `$${referral.commission}` : "-"}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{referral.date}</td>
                          <td className="px-6 py-4">
                            {referral.status === "converted" && (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                تم التحويل
                              </Badge>
                            )}
                            {referral.status === "pending" && (
                              <Badge variant="warning" className="gap-1">
                                <Clock className="w-3 h-3" />
                                قيد الانتظار
                              </Badge>
                            )}
                            {referral.status === "lost" && (
                              <Badge variant="outline" className="text-muted-foreground">
                                لم يكتمل
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Commissions Tab */}
            <TabsContent value="commissions">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-lg font-semibold text-foreground">سجل العمولات</h2>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="w-4 h-4" />
                          تصدير
                        </Button>
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {commissions.map((commission) => (
                        <div key={commission.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              commission.status === "paid" ? "bg-success/10" : "bg-warning/10"
                            )}>
                              <Award className={cn(
                                "w-5 h-5",
                                commission.status === "paid" ? "text-success" : "text-warning"
                              )} />
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{commission.referral}</div>
                              <div className="text-sm text-muted-foreground">{commission.property}</div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-success">${commission.amount}</div>
                            <Badge variant={commission.status === "paid" ? "success" : "warning"} className="text-xs">
                              {commission.status === "paid" ? "تم الدفع" : "معلق"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Commission Summary */}
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4">ملخص العمولات</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">إجمالي مستحق</span>
                        <span className="font-bold text-foreground">${brokerStats.totalCommission.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">تم الدفع</span>
                        <span className="font-bold text-success">
                          ${(brokerStats.totalCommission - brokerStats.pendingCommission).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">معلق</span>
                        <span className="font-bold text-warning">${brokerStats.pendingCommission.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Referral Link */}
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Link2 className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">رابط الإحالة</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      شارك هذا الرابط للحصول على عمولة 5% على كل استثمار
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-background rounded text-sm text-foreground truncate">
                        {referralLink}
                      </code>
                      <Button variant="hero" size="icon" onClick={copyReferralLink}>
                        {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Listings Tab */}
            <TabsContent value="listings">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map((listing, index) => (
                  <div 
                    key={listing.id}
                    className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="h-40 relative">
                      <img 
                        src={listing.image} 
                        alt={listing.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        {listing.status === "active" && <Badge variant="success">نشط</Badge>}
                        {listing.status === "sold_out" && <Badge variant="outline">تم البيع</Badge>}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-1">{listing.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{listing.location}</p>
                      
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted rounded-lg">
                          <div className="text-lg font-bold text-foreground">{listing.referrals}</div>
                          <div className="text-xs text-muted-foreground">إحالة</div>
                        </div>
                        <div className="p-2 bg-success/10 rounded-lg">
                          <div className="text-lg font-bold text-success">{listing.converted}</div>
                          <div className="text-xs text-muted-foreground">تحويل</div>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <div className="text-lg font-bold text-primary">${listing.commission}</div>
                          <div className="text-xs text-muted-foreground">عمولة</div>
                        </div>
                      </div>

                      <Button variant="outline" className="w-full mt-4 gap-2" asChild>
                        <Link to={`/property/${listing.id}`}>
                          <Eye className="w-4 h-4" />
                          عرض العقار
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-6">تحليل الأداء</h2>
                
                {/* Performance Chart Placeholder */}
                <div className="h-64 bg-muted/50 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">رسم بياني للأداء</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-xl text-center">
                    <div className="text-2xl font-bold text-foreground">{brokerStats.conversionRate}%</div>
                    <div className="text-sm text-muted-foreground">معدل التحويل</div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl text-center">
                    <div className="text-2xl font-bold text-foreground">
                      ${Math.round(brokerStats.totalCommission / brokerStats.convertedReferrals)}
                    </div>
                    <div className="text-sm text-muted-foreground">متوسط العمولة</div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl text-center">
                    <div className="text-2xl font-bold text-foreground">{brokerStats.activeListings}</div>
                    <div className="text-sm text-muted-foreground">عقار نشط</div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl text-center">
                    <div className="text-2xl font-bold text-foreground">{brokerStats.convertedReferrals}</div>
                    <div className="text-sm text-muted-foreground">مستثمر محوّل</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="wallet">
              <VisaCardsSection
                walletBalance={brokerStats.totalCommission}
                roleLabel={{ en: "Broker", ar: "وسيط" }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
