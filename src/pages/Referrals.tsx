import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Users,
  UserPlus,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Copy,
  Share2,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
} from "lucide-react";

interface Referral {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "pending" | "registered" | "invested" | "rejected";
  date: string;
  property?: string;
  investmentAmount?: number;
  commission?: number;
}

const referrals: Referral[] = [
  {
    id: "1",
    name: "أحمد محمد",
    email: "ahmed@example.com",
    phone: "+971 50 XXX XXXX",
    status: "invested",
    date: "2024-01-15",
    property: "برج المارينا",
    investmentAmount: 25000,
    commission: 625,
  },
  {
    id: "2",
    name: "سارة علي",
    email: "sara@example.com",
    phone: "+971 55 XXX XXXX",
    status: "registered",
    date: "2024-01-18",
  },
  {
    id: "3",
    name: "محمد خالد",
    email: "mohammed@example.com",
    phone: "+971 52 XXX XXXX",
    status: "pending",
    date: "2024-01-20",
  },
  {
    id: "4",
    name: "فاطمة أحمد",
    email: "fatima@example.com",
    phone: "+971 56 XXX XXXX",
    status: "invested",
    date: "2024-01-10",
    property: "مجمع الواحة",
    investmentAmount: 50000,
    commission: 1500,
  },
  {
    id: "5",
    name: "عمر حسن",
    email: "omar@example.com",
    phone: "+971 58 XXX XXXX",
    status: "rejected",
    date: "2024-01-12",
  },
];

export default function Referrals() {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const referralLink = "https://capimax.com/ref/BROKER123";

  const totalReferrals = referrals.length;
  const registeredCount = referrals.filter((r) => r.status === "registered" || r.status === "invested").length;
  const investedCount = referrals.filter((r) => r.status === "invested").length;
  const totalCommission = referrals.reduce((sum, r) => sum + (r.commission || 0), 0);

  const getStatusBadge = (status: Referral["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t("referrals.statusPending")}
          </Badge>
        );
      case "registered":
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {t("referrals.statusRegistered")}
          </Badge>
        );
      case "invested":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {t("referrals.statusInvested")}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {t("referrals.statusRejected")}
          </Badge>
        );
    }
  };

  const filteredReferrals = referrals.filter(
    (ref) =>
      ref.name.includes(searchTerm) ||
      ref.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t("referrals.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("referrals.subtitle")}</p>
          </div>
          <Button className="bg-gradient-gold hover:opacity-90 shadow-gold">
            <UserPlus className="w-4 h-4 mr-2" />
            {t("referrals.addReferral")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalReferrals}</p>
                <p className="text-xs text-muted-foreground">{t("referrals.totalReferrals")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{registeredCount}</p>
                <p className="text-xs text-muted-foreground">{t("referrals.registered")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{investedCount}</p>
                <p className="text-xs text-muted-foreground">{t("referrals.invested")}</p>
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
                <p className="text-xs opacity-80">{t("referrals.commissionsEarned")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-3">{t("referrals.yourLink")}</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3 bg-muted/50 rounded-lg font-mono text-sm text-muted-foreground truncate">
                {referralLink}
              </div>
              <Button variant="outline" size="icon" title={t("referrals.copy")}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" title={t("referrals.share")}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("referrals.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Referrals List */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("referrals.referralList")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredReferrals.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium">{t("referrals.noReferrals")}</p>
                <p className="text-sm text-muted-foreground">{t("referrals.shareLink")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredReferrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
                        <span className="text-lg font-bold text-primary-foreground">
                          {referral.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{referral.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {referral.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {referral.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {referral.investmentAmount && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{t("referrals.investment")}</p>
                          <p className="font-semibold text-foreground">
                            ${referral.investmentAmount.toLocaleString()}
                          </p>
                        </div>
                      )}

                      {referral.commission && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{t("referrals.commission")}</p>
                          <p className="font-semibold text-emerald-500">
                            ${referral.commission.toLocaleString()}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Calendar className="w-3 h-3" />
                            {referral.date}
                          </div>
                          {getStatusBadge(referral.status)}
                        </div>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
