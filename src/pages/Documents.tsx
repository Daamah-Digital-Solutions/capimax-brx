import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  FolderOpen,
  FileCheck,
  FileClock,
  FileWarning,
  Calendar,
  Building2,
  Shield,
  Receipt,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  nameAr: string;
  type: string;
  category: string;
  property?: string;
  propertyEn?: string;
  date: string;
  size: string;
  status: "signed" | "pending" | "expired";
}

const documents: Document[] = [
  {
    id: "1",
    name: "Investment Agreement - Marina Tower",
    nameAr: "اتفاقية الاستثمار - برج المارينا",
    type: "PDF",
    category: "agreements",
    property: "برج المارينا",
    propertyEn: "Marina Tower",
    date: "2024-01-15",
    size: "2.4 MB",
    status: "signed",
  },
  {
    id: "2",
    name: "SPV Ownership Certificate",
    nameAr: "شهادة ملكية SPV",
    type: "PDF",
    category: "certificates",
    property: "برج المارينا",
    propertyEn: "Marina Tower",
    date: "2024-01-15",
    size: "1.2 MB",
    status: "signed",
  },
  {
    id: "3",
    name: "Risk Disclosure Statement",
    nameAr: "بيان الإفصاح عن المخاطر",
    type: "PDF",
    category: "disclosures",
    date: "2024-01-10",
    size: "850 KB",
    status: "signed",
  },
  {
    id: "4",
    name: "Q4 2023 Financial Report",
    nameAr: "التقرير المالي للربع الرابع 2023",
    type: "PDF",
    category: "reports",
    property: "برج المارينا",
    propertyEn: "Marina Tower",
    date: "2024-01-05",
    size: "3.1 MB",
    status: "signed",
  },
  {
    id: "5",
    name: "Tax Statement 2023",
    nameAr: "البيان الضريبي 2023",
    type: "PDF",
    category: "tax",
    date: "2024-01-20",
    size: "1.8 MB",
    status: "pending",
  },
  {
    id: "6",
    name: "Distribution Statement - December",
    nameAr: "بيان التوزيعات - ديسمبر",
    type: "PDF",
    category: "distributions",
    property: "مجمع الواحة السكني",
    propertyEn: "Oasis Residential Complex",
    date: "2024-01-01",
    size: "450 KB",
    status: "signed",
  },
];

const getCategoryTranslationKey = (id: string) => {
  const map: Record<string, string> = {
    all: "documents.allDocuments",
    agreements: "documents.agreements",
    certificates: "documents.certificates",
    reports: "documents.reports",
    distributions: "documents.distributions",
    tax: "documents.tax",
    disclosures: "documents.disclosures",
  };
  return map[id] || id;
};

const categories = [
  { id: "all", icon: FolderOpen },
  { id: "agreements", icon: FileCheck },
  { id: "certificates", icon: Shield },
  { id: "reports", icon: FileSpreadsheet },
  { id: "distributions", icon: Receipt },
  { id: "tax", icon: FileText },
  { id: "disclosures", icon: FileWarning },
];

export default function Documents() {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.nameAr.includes(searchTerm);
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "signed":
        return <Badge variant="success">{t("documents.statusSigned")}</Badge>;
      case "pending":
        return <Badge variant="warning">{t("documents.statusPending")}</Badge>;
      case "expired":
        return <Badge variant="destructive">{t("documents.statusExpired")}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t("documents.title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("documents.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("documents.search")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{documents.length}</p>
                <p className="text-xs text-muted-foreground">{t("documents.totalDocuments")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {documents.filter((d) => d.status === "signed").length}
                </p>
                <p className="text-xs text-muted-foreground">{t("documents.signed")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FileClock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {documents.filter((d) => d.status === "pending").length}
                </p>
                <p className="text-xs text-muted-foreground">{t("documents.pending")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <FileWarning className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {documents.filter((d) => d.status === "expired").length}
                </p>
                <p className="text-xs text-muted-foreground">{t("documents.expired")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categories & Documents */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Categories Sidebar */}
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t("documents.categories")}</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      selectedCategory === cat.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <cat.icon className="w-4 h-4" />
                    <span className="flex-1 text-right">{t(getCategoryTranslationKey(cat.id))}</span>
                    <span className="text-xs opacity-60">
                      {cat.id === "all"
                        ? documents.length
                        : documents.filter((d) => d.category === cat.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card className="lg:col-span-3 bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {t(getCategoryTranslationKey(selectedCategory))}
                </CardTitle>
                <Badge variant="outline">{filteredDocs.length} {t("documents.document")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">{t("documents.noDocuments")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">
                          {language === "ar" ? doc.nameAr : doc.name}
                        </h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {language === "ar" ? doc.name : doc.nameAr}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {doc.property && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {language === "ar" ? doc.property : doc.propertyEn}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {doc.date}
                          </span>
                          <span>{doc.size}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc.status)}
                        <Button variant="ghost" size="icon" title={t("documents.view")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t("documents.download")}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
