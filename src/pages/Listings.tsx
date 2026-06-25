import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBrokerCommissions } from "@/hooks/useBrokerCommissions";
import { useBrokerProfile } from "@/hooks/useBrokerProfile";
import {
  propertiesApi,
  brokerApi,
  type BrokerPropertyStatRow,
} from "@/integrations/api/client";
import {
  Building2,
  Users,
  DollarSign,
  Search,
  Filter,
  Eye,
  Share2,
  MessageSquare,
  MapPin,
  Percent,
  Target,
  Loader2,
} from "lucide-react";

// A broker-promotable property row = the public catalogue item + this broker's own stats.
interface CatalogueProperty {
  id: string;            // slug
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  assetType: string;
  minInvestment: number | string;
  expectedYield: number | string | null;
  funded: number;        // 0..100 (property funding %)
  totalValue: number | string;
  brokerCommissionRate: number | string | null;  // per-property; null → fall back
  openForPromotion: boolean;
}

const EMPTY_STAT: BrokerPropertyStatRow = {
  property_id: "",
  conversions: 0,
  investors: 0,
  raised: 0,
  commission: "0.00",
  leads: null,
};

export default function Listings() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [properties, setProperties] = useState<CatalogueProperty[]>([]);
  const [byProperty, setByProperty] = useState<Record<string, BrokerPropertyStatRow>>({});
  const [brokerRate, setBrokerRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // KPIs come from the REAL commission ledger; the share link from the broker profile.
  const { data: commissionData } = useBrokerCommissions();
  const { brokerProfile } = useBrokerProfile();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cat, stats] = await Promise.all([
          propertiesApi.list(),
          brokerApi.propertyStats().catch(() => ({ broker_rate: "0", by_property: {} })),
        ]);
        if (!active) return;
        // Only properties opened for broker promotion (default true).
        const promotable = (cat as CatalogueProperty[]).filter(
          (p) => p.openForPromotion !== false,
        );
        setProperties(promotable);
        setByProperty(stats.by_property || {});
        setBrokerRate(Number(stats.broker_rate) || 0);
      } catch {
        if (active) setProperties([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Effective per-property rate = the property's own rate, else this broker's fallback rate.
  const effectiveRate = (p: CatalogueProperty): number => {
    const r = p.brokerCommissionRate;
    return r === null || r === undefined || r === "" ? brokerRate : Number(r);
  };
  const statFor = (slug: string) => byProperty[slug] || EMPTY_STAT;

  const filtered = properties.filter((p) => {
    const matchesSearch =
      p.name.includes(searchTerm) || (p.nameAr || "").includes(searchTerm) ||
      (p.location || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "open" && p.funded < 100) ||
      (activeTab === "funded" && p.funded >= 100);
    return matchesSearch && matchesTab;
  });

  // KPIs — real aggregate from the ledger (conversions + commission). Leads = Phase 2 → "—".
  const totalConversions = commissionData?.stats?.converted_referrals ?? 0;
  const totalCommission = Number(commissionData?.stats?.total_commission ?? 0);

  const referralLink = brokerProfile?.referral_code
    ? `${window.location.origin}/ref/${brokerProfile.referral_code}`
    : "";

  const shareListing = async (p: CatalogueProperty) => {
    if (!referralLink) {
      toast.error(isAr ? "أكمل توثيق الوسيط أولاً" : "Complete broker verification first");
      return;
    }
    // The broker-attributed referral link (a referred investor is linked to this broker).
    const shareData = {
      title: "Capimax BRX",
      text: isAr ? p.nameAr || p.name : p.name,
      url: referralLink,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(referralLink);
        toast.success(isAr ? "تم نسخ رابط الإحالة" : "Referral link copied");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const fundedBadge = (funded: number) =>
    funded >= 100 ? (
      <Badge variant="outline">{isAr ? "مكتمل" : "Funded"}</Badge>
    ) : (
      <Badge variant="success">{isAr ? "متاح للترويج" : "Open"}</Badge>
    );

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {isAr ? "القوائم" : "Listings"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAr ? "العقارات المتاحة للترويج وعمولتك على كل منها" : "Properties open for promotion + your commission on each"}
            </p>
          </div>
        </div>

        {/* Stats — listings count + leads (Phase 2 "—") + real conversions + real commission. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{properties.length}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "إجمالي القوائم" : "Listings"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                {/* Per-broker lead tracking is Phase 2 — honest "—", never a fabricated number. */}
                <p className="text-2xl font-bold text-foreground">—</p>
                <p className="text-xs text-muted-foreground">{isAr ? "العملاء المحتملين" : "Leads"}</p>
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
                <p className="text-xs text-muted-foreground">{isAr ? "تحويلات ناجحة" : "Conversions"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-gold text-primary-foreground">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalCommission.toLocaleString()}</p>
                <p className="text-xs opacity-80">{isAr ? "إجمالي العمولات" : "Total Commission"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isAr ? "بحث في القوائم..." : "Search listings..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon" disabled>
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all">
              {isAr ? "الكل" : "All"}
              <Badge variant="outline" className="ml-2">{properties.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="open">{isAr ? "متاح" : "Open"}</TabsTrigger>
            <TabsTrigger value="funded">{isAr ? "مكتمل" : "Funded"}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isAr ? "جارٍ التحميل..." : "Loading..."}
                </div>
              ) : filtered.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-12 text-center">
                    <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-foreground font-medium">
                      {isAr ? "لا توجد قوائم متاحة للترويج" : "No properties open for promotion"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filtered.map((p) => {
                  const stat = statFor(p.id);
                  const target = Number(p.totalValue) || 0;
                  const raised = (Number(p.funded) / 100) * target;
                  return (
                    <Card
                      key={p.id}
                      className="bg-card/50 backdrop-blur border-border/50 hover:shadow-lg transition-shadow"
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                          {/* Image placeholder */}
                          <div className="w-full lg:w-40 h-28 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                            <Building2 className="w-10 h-10 text-primary/50" />
                          </div>

                          {/* Property info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-foreground truncate">
                                {isAr ? p.nameAr || p.name : p.name}
                              </h3>
                              {fundedBadge(p.funded)}
                              <Badge variant="outline" className="capitalize">{p.assetType}</Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                {isAr ? p.locationAr || p.location : p.location}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <DollarSign className="w-4 h-4" />
                                {isAr ? "الحد الأدنى" : "Min"}: ${Number(p.minInvestment).toLocaleString()}
                              </span>
                              {p.expectedYield != null && (
                                <span className="flex items-center gap-1 text-emerald-500">
                                  <Percent className="w-4 h-4" />
                                  {Number(p.expectedYield)}% {isAr ? "عائد" : "yield"}
                                </span>
                              )}
                            </div>

                            {/* Funding progress (the property's overall funding — public). */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">{isAr ? "التمويل" : "Funding"}</span>
                                <span className="font-medium text-foreground">
                                  ${(raised / 1_000_000).toFixed(1)}M / ${(target / 1_000_000).toFixed(0)}M ({p.funded}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-gold rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Number(p.funded))}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* This broker's stats + actions */}
                          <div className="flex flex-col gap-3 lg:w-48">
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="p-2 bg-muted/30 rounded-lg">
                                {/* Per-property leads are Phase 2 → honest "—", never faked. */}
                                <p className="text-lg font-bold text-foreground">—</p>
                                <p className="text-xs text-muted-foreground">{isAr ? "عملاء" : "Leads"}</p>
                              </div>
                              <div className="p-2 bg-muted/30 rounded-lg">
                                <p className="text-lg font-bold text-emerald-500">{stat.conversions}</p>
                                <p className="text-xs text-muted-foreground">{isAr ? "تحويلاتك" : "Conversions"}</p>
                              </div>
                            </div>

                            <div className="p-2 bg-primary/10 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground">{isAr ? "عمولتك" : "Your commission"}</p>
                              <p className="text-lg font-bold text-primary">{effectiveRate(p)}%</p>
                            </div>

                            <div className="flex gap-2">
                              <Button asChild variant="outline" size="sm" className="flex-1" title={isAr ? "عرض" : "View"}>
                                <Link to={`/property/${p.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="outline" size="sm" className="flex-1"
                                title={isAr ? "مشاركة رابط الإحالة" : "Share referral link"}
                                onClick={() => shareListing(p)}
                              >
                                <Share2 className="w-4 h-4" />
                              </Button>
                              {/* No broker↔platform chat backend yet → honest disabled "Coming soon". */}
                              <Button
                                variant="outline" size="sm" className="flex-1" disabled
                                title={isAr ? "استفسار (قريباً)" : "Inquire (Coming soon)"}
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
