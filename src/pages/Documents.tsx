import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  BarChart3,
  Building2,
  Calendar,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Receipt,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useExport } from "@/hooks/useExport";
import { useUserWallet } from "@/hooks/useUserWallet";
import { useOwnershipTokens } from "@/hooks/useOwnershipTokens";
import {
  certificatesApi,
  installmentsApi,
  propertiesApi,
  reportsApi,
  transfersApi,
} from "@/integrations/api/client";

// Document center: every document that belongs to the signed-in investor, gathered from the
// real sources — ownership certificates, payment receipts, statements (generated on demand),
// installment schedules, the beneficiary certificate, and the documents of each property held.

type Cat = "certificates" | "statements" | "receipts" | "schedules" | "property";
type Doc = {
  key: string;
  cat: Cat;
  ar: string;
  en: string;
  subAr?: string;
  subEn?: string;
  date?: string | null;
  status?: { ar: string; en: string; variant: "success" | "warning" | "outline" };
  download?: () => Promise<void>;
  href?: string;
};

const CATS: { id: "all" | Cat; ar: string; en: string; icon: LucideIcon }[] = [
  { id: "all", ar: "كل المستندات", en: "All documents", icon: FolderOpen },
  { id: "certificates", ar: "الشهادات", en: "Certificates", icon: Award },
  { id: "statements", ar: "الكشوف والتقارير", en: "Statements & reports", icon: BarChart3 },
  { id: "schedules", ar: "جداول الأقساط", en: "Installment schedules", icon: Calendar },
  { id: "receipts", ar: "الإيصالات", en: "Receipts", icon: Receipt },
  { id: "property", ar: "مستندات العقارات", en: "Property documents", icon: Building2 },
];

const STATEMENTS: Doc[] = [
  { key: "st-wallet", cat: "statements", ar: "كشف حساب المحفظة", en: "Wallet account statement",
    subAr: "الرصيد الافتتاحي والختامي وكل الحركات", subEn: "Opening and closing balance, every movement",
    download: () => reportsApi.export("wallet", "pdf") },
  { key: "st-portfolio", cat: "statements", ar: "كشف المحفظة الاستثمارية", en: "Portfolio statement",
    subAr: "الحصص والقيمة والعقود على البلوك تشين", subEn: "Units, value and on-chain contracts",
    download: () => reportsApi.export("portfolio", "pdf") },
  { key: "st-analytics", cat: "statements", ar: "تقرير أداء الاستثمار", en: "Investment performance report",
    subAr: "العائد والتوزيع والدخل الشهري", subEn: "Return, allocation and monthly income",
    download: () => reportsApi.export("analytics", "pdf") },
  { key: "st-dist", cat: "statements", ar: "كشف التوزيعات", en: "Distributions statement",
    subAr: "دخل الإيجار المضاف إلى محفظتك", subEn: "Rental income credited to your wallet",
    download: () => reportsApi.export("distributions", "pdf") },
  { key: "st-inst", cat: "statements", ar: "كشف خطط الأقساط", en: "Installment plans statement",
    subAr: "المدفوع والمتبقي لكل خطة", subEn: "Paid and remaining for each plan",
    download: () => reportsApi.export("installments", "pdf") },
  { key: "st-tax", cat: "statements", ar: "ملخص الدخل السنوي", en: "Annual income summary",
    subAr: "معلوماتي — ليس مستندًا ضريبيًا", subEn: "Informational — not a tax document",
    download: () => reportsApi.tax() },
];

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Documents() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const { wallet } = useUserWallet();
  const { tokens } = useOwnershipTokens(wallet?.id ?? null);
  const { exporting, run } = useExport();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<"all" | Cat>("all");
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);

  const slugs = useMemo(
    () => tokens.filter((t) => Number(t.token_amount) > 0).map((t) => t.property_id).sort().join(","),
    [tokens],
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const [certs, receipts, plans, benef, props] = await Promise.all([
        certificatesApi.list().catch(() => []),
        reportsApi.receipts().catch(() => []),
        installmentsApi.plans().catch(() => null),
        transfersApi.beneficiaries().catch(() => null),
        Promise.all(slugs ? slugs.split(",").map((s) => propertiesApi.detail(s).catch(() => null)) : []),
      ]);
      const out: Doc[] = [];
      const arNames = Object.fromEntries(tokens.map((t) => [t.property_id, t.property_name_ar]));
      for (const c of certs as any[]) {
        const final = c.status === "final";
        out.push({
          key: `cert-${c.id}`, cat: "certificates",
          ar: `شهادة ملكية — ${arNames[c.listing_id] || c.property_name || ""}`, en: `Ownership certificate — ${c.property_name || ""}`,
          subAr: `${c.certificate_id} · ${c.units_purchased ?? ""} وحدة`, subEn: `${c.certificate_id} · ${c.units_purchased ?? ""} units`,
          date: c.issue_date,
          status: c.status === "revoked"
            ? { ar: "ملغاة", en: "Revoked", variant: "outline" }
            : final ? { ar: "نهائية", en: "Final", variant: "success" } : { ar: "مبدئية", en: "Provisional", variant: "warning" },
          download: async () => saveBlob(await certificatesApi.downloadPdf(c.id), `${c.certificate_id}.pdf`),
        });
      }
      if (benef?.certificate_number) {
        out.push({
          key: "beneficiary", cat: "certificates",
          ar: "شهادة المستفيدين", en: "Beneficiary designation certificate",
          subAr: benef.certificate_number, subEn: benef.certificate_number,
          date: benef.certificate_updated_at,
          download: () => transfersApi.certificatePdf(),
        });
      }
      out.push(...STATEMENTS);
      for (const p of plans?.plans ?? []) {
        out.push({
          key: `plan-${p.id}`, cat: "schedules",
          ar: `جدول أقساط — ${p.property || p.propertyEn}`, en: `Installment schedule — ${p.propertyEn || p.property}`,
          subAr: `${p.paidInstallments}/${p.totalInstallments} قسط مدفوع`, subEn: `${p.paidInstallments}/${p.totalInstallments} installments paid`,
          status: p.status === "completed"
            ? { ar: "مكتملة", en: "Completed", variant: "success" }
            : p.status === "active" ? { ar: "نشطة", en: "Active", variant: "warning" } : undefined,
          download: () => reportsApi.installmentPlan(p.id),
        });
      }
      for (const r of receipts as any[]) {
        out.push({
          key: `rc-${r.kind}-${r.id}`, cat: "receipts",
          ar: `إيصال — ${r.title_ar || r.title}`, en: `Receipt — ${r.title}`,
          subAr: `${r.number} · $${Number(r.amount).toLocaleString()}`, subEn: `${r.number} · $${Number(r.amount).toLocaleString()}`,
          date: r.date,
          download: () => reportsApi.receipt(r.kind, r.id),
        });
      }
      for (const p of props as any[]) {
        if (!p) continue;
        const pname = (isAr && p.name_ar) || p.name || p.title || "";
        for (const d of p.documents ?? []) {
          if (!d.url) continue;
          out.push({
            key: `pd-${p.slug || p.id}-${d.url}`, cat: "property",
            ar: d.name || d.nameEn, en: d.nameEn || d.name,
            subAr: pname, subEn: pname, date: d.date,
            href: `${d.url}${d.url.includes("?") ? "&" : "?"}download=1`,
          });
        }
      }
      if (active) {
        setDocs(out);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, slugs]);

  const q = search.trim().toLowerCase();
  const shown = docs.filter(
    (d) =>
      (cat === "all" || d.cat === cat) &&
      (!q || `${d.ar} ${d.en} ${d.subAr ?? ""} ${d.subEn ?? ""}`.toLowerCase().includes(q)),
  );
  const count = (c: "all" | Cat) => (c === "all" ? docs.length : docs.filter((d) => d.cat === c).length);
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "";

  const stats = [
    { label: isAr ? "كل المستندات" : "All documents", value: count("all"), icon: FolderOpen, tone: "bg-primary/10 text-primary" },
    { label: isAr ? "الشهادات" : "Certificates", value: count("certificates"), icon: Award, tone: "bg-emerald-500/10 text-emerald-500" },
    { label: isAr ? "الإيصالات" : "Receipts", value: count("receipts"), icon: Receipt, tone: "bg-amber-500/10 text-amber-500" },
    { label: isAr ? "مستندات العقارات" : "Property documents", value: count("property"), icon: Building2, tone: "bg-sky-500/10 text-sky-500" },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {isAr ? "مركز المستندات" : "Document center"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAr
                ? "كل مستنداتك في مكان واحد: الشهادات والكشوف والإيصالات وجداول الأقساط ومستندات عقاراتك."
                : "All your documents in one place: certificates, statements, receipts, schedules and your properties' documents."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isAr ? "ابحث في المستندات..." : "Search documents..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-10 w-64"
              />
            </div>
            <Link to="/verification-center">
              <Button variant="outline" className="gap-2">
                <ShieldCheck className="w-4 h-4" />
                {isAr ? "مركز التحقق" : "Verification center"}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.tone}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? "—" : s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{isAr ? "التصنيفات" : "Categories"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {CATS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    cat === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <c.icon className="w-4 h-4" />
                    {isAr ? c.ar : c.en}
                  </span>
                  <Badge variant="outline" className="text-xs">{loading ? "—" : count(c.id)}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {!user ? (
                <div className="p-10 text-center">
                  <p className="text-muted-foreground mb-4">
                    {isAr ? "سجّل الدخول لرؤية مستنداتك." : "Sign in to see your documents."}
                  </p>
                  <Link to="/auth?next=/documents"><Button>{isAr ? "تسجيل الدخول" : "Sign in"}</Button></Link>
                </div>
              ) : loading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : shown.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  {isAr ? "لا توجد مستندات في هذا التصنيف." : "No documents in this category."}
                </div>
              ) : (
                shown.map((d) => (
                  <div key={d.key} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{isAr ? d.ar : d.en}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {[isAr ? d.subAr : d.subEn, fmtDate(d.date)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.status && <Badge variant={d.status.variant}>{isAr ? d.status.ar : d.status.en}</Badge>}
                      {d.href ? (
                        <a href={d.href} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download className="w-4 h-4" />
                            {isAr ? "تنزيل" : "Download"}
                          </Button>
                        </a>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={exporting !== null}
                          onClick={() => d.download && run(d.key, d.download)}
                        >
                          {exporting === d.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
