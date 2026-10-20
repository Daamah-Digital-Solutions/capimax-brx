import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CheckCircle2, Clock, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { rolesApi, type RoleApplicationInfo } from "@/integrations/api/client";
import { ROLE_LABELS, useRoles } from "@/hooks/useRoles";

type L = { en: string; ar: string };

const FIELD: Record<string, L> = {
  name: { en: "Name or company name", ar: "الاسم أو اسم الشركة" },
  license_number: { en: "Brokerage licence number", ar: "رقم رخصة الوساطة" },
  phone: { en: "Mobile", ar: "الموبايل" },
  country: { en: "Country of registration", ar: "بلد التسجيل" },
  entity_type: { en: "Entity type", ar: "نوع الكيان" },
  commitment: { en: "Commitment size", ar: "حجم الالتزام" },
  investor_status: { en: "Investor status", ar: "الوضع الاستثماري" },
  source_of_funds: { en: "Source of funds", ar: "مصدر الأموال" },
  company_name: { en: "Company name", ar: "اسم الشركة" },
  registration_number: { en: "Commercial registration number", ar: "رقم السجل التجاري" },
};
const LP_FIELD: Record<string, L> = {
  name: { en: "Name or entity name", ar: "الاسم أو اسم الكيان" },
  country: { en: "Country", ar: "الدولة" },
};
const CHOICE: Record<string, L> = {
  individual: { en: "Individual", ar: "فرد" },
  institution: { en: "Institution", ar: "مؤسسة" },
  "10k_50k": { en: "$10k – $50k", ar: "10 آلاف – 50 ألف $" },
  "50k_250k": { en: "$50k – $250k", ar: "50 ألف – 250 ألف $" },
  "250k_1m": { en: "$250k – $1M", ar: "250 ألف – مليون $" },
  "1m_plus": { en: "$1M+", ar: "أكثر من مليون $" },
  retail: { en: "Retail", ar: "مستثمر فرد" },
  accredited: { en: "Accredited", ar: "مستثمر معتمد" },
  qualified: { en: "Qualified", ar: "مستثمر مؤهَّل" },
  institutional: { en: "Institutional", ar: "مؤسسي" },
};
const DOC: Record<string, L> = {
  id_document: { en: "ID (passport or national ID)", ar: "الهوية (جواز سفر أو بطاقة)" },
  license: { en: "Brokerage licence", ar: "رخصة الوساطة" },
  proof_of_funds: { en: "Proof of funds or bank statement", ar: "إثبات أموال أو كشف حساب بنكي" },
  entity_registration: { en: "Entity registration (institutions)", ar: "تسجيل الكيان (للمؤسسات)" },
  company_registration: { en: "Commercial registration", ar: "السجل التجاري" },
};
const TITLE: Record<string, L> = {
  broker: { en: "Become a Broker", ar: "انضم كوسيط" },
  lp: { en: "Become a Liquidity Provider", ar: "انضم كمزوّد سيولة" },
  developer: { en: "Become a Developer", ar: "انضم كمطوّر عقاري" },
  partner: { en: "Become a Strategic Partner", ar: "انضم كشريك استراتيجي" },
};

export default function RoleApply() {
  const { role: slug = "" } = useParams();
  const { user, loading } = useAuth();
  const { isRTL } = useLanguage();
  const { refresh } = useRoles();
  const [info, setInfo] = useState<RoleApplicationInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const t = (l: L) => (isRTL ? l.ar : l.en);

  const load = useCallback(() => {
    rolesApi
      .application(slug)
      .then((i) => {
        setInfo(i);
        setData(i.application?.data ?? {});
        setEditing(!i.application || i.status === "rejected" || i.status === "available");
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!loading && !user) return <Navigate to={`/auth?next=/roles/apply/${slug}`} replace />;
  if (slug === "owner") return <Navigate to="/settings" replace />;

  const role = info?.role;
  const roleName = role ? t(ROLE_LABELS[role]) : "";
  const form = info?.form;
  const existingDocs = new Set((info?.application?.documents ?? []).map((d) => d.kind));
  const label = (f: string) => t((role === "lp" && LP_FIELD[f]) || FIELD[f] || { en: f, ar: f });
  const missingDoc = form?.docs.some((d) => !files[d] && !existingDocs.has(d));
  const valid = !!form && form.fields.every((f) => (data[f] ?? "").trim()) && !missingDoc;

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await rolesApi.submitApplication(slug, Object.fromEntries(form.fields.map((f) => [f, (data[f] ?? "").trim()])), files);
      toast.success(isRTL ? "تم إرسال الطلب — في انتظار مراجعة الإدارة" : "Application submitted — pending admin review");
      setFiles({});
      refresh();
      load();
    } catch (e: any) {
      toast.error(e?.message || (isRTL ? "تعذّر إرسال الطلب" : "Could not submit the application"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl" dir={isRTL ? "rtl" : "ltr"}>
        {notFound ? (
          <Card><CardContent className="p-8 text-center">{isRTL ? "دور غير معروف." : "Unknown role."}</CardContent></Card>
        ) : !info ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
        ) : info.status === "active" ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-xl font-bold">
                {isRTL ? `دور ${roleName} معاك بالفعل` : `You already hold the ${roleName} role`}
              </h2>
              <p className="text-muted-foreground">
                {isRTL ? "بدّل له من مبدّل الأدوار في القائمة الجانبية." : "Use the role switcher in the sidebar."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {t(TITLE[info.role] ?? { en: roleName, ar: roleName })}
              </CardTitle>
              <CardDescription>
                {isRTL
                  ? "املا البيانات وارفع المستندات. فريقنا هيراجع الطلب ويفعّل الدور."
                  : "Fill in your details and upload the documents. Our team reviews the application and activates the role."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {info.status === "pending" && !editing && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{isRTL ? "الطلب قيد المراجعة" : "Application pending review"}</div>
                      <div className="text-sm text-muted-foreground">
                        {isRTL
                          ? "هيوصلك إشعار وإيميل أول ما الإدارة تقرر."
                          : "You'll get a notification and an email as soon as it's decided."}
                      </div>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {form?.fields.map((f) => (
                      <div key={f}>
                        <dt className="text-muted-foreground text-xs">{label(f)}</dt>
                        <dd className="font-medium">{CHOICE[data[f]] ? t(CHOICE[data[f]]) : data[f]}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="space-y-1">
                    {info.application?.documents.map((d) => (
                      <div key={d.kind} className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {t(DOC[d.kind] ?? { en: d.kind, ar: d.kind })}: <span className="text-muted-foreground">{d.name}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    {isRTL ? "عدّل وقدّم تاني" : "Edit & resubmit"}
                  </Button>
                </div>
              )}

              {editing && form && (
                <div className="space-y-4">
                  {info.status === "rejected" && (
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">{isRTL ? "الطلب ما اتقبلش" : "Your application wasn't approved"}</div>
                        {info.application?.review_note && (
                          <div className="text-sm text-muted-foreground">{info.application.review_note}</div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {isRTL ? "عدّل البيانات وقدّم تاني." : "Update it and submit again."}
                        </div>
                      </div>
                    </div>
                  )}
                  {form.fields.map((f) => (
                    <div key={f} className="space-y-1.5">
                      <Label>{label(f)}</Label>
                      {form.choices[f] ? (
                        <Select value={data[f] ?? ""} onValueChange={(v) => setData((d) => ({ ...d, [f]: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder={isRTL ? "اختر" : "Choose"} />
                          </SelectTrigger>
                          <SelectContent>
                            {form.choices[f].map((c) => (
                              <SelectItem key={c} value={c}>
                                {CHOICE[c] ? t(CHOICE[c]) : c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={data[f] ?? ""}
                          type={f === "phone" ? "tel" : "text"}
                          dir={f === "phone" ? "ltr" : undefined}
                          onChange={(e) => setData((d) => ({ ...d, [f]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                  <div className="space-y-3">
                    <div className="text-sm font-medium">{isRTL ? "المستندات" : "Documents"}</div>
                    {[...form.docs, ...form.optional_docs].map((d) => {
                      const current = info.application?.documents.find((x) => x.kind === d);
                      const optional = form.optional_docs.includes(d);
                      return (
                        <div key={d} className="space-y-1">
                          <Label className="text-sm">
                            {t(DOC[d] ?? { en: d, ar: d })}
                            {optional && <span className="text-muted-foreground ms-1">({isRTL ? "اختياري" : "optional"})</span>}
                          </Label>
                          <Input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              setFiles((fs) => {
                                const next = { ...fs };
                                if (f) next[d] = f;
                                else delete next[d];
                                return next;
                              });
                            }}
                          />
                          {current && !files[d] && (
                            <div className="text-xs text-muted-foreground">
                              {isRTL ? `الملف الحالي: ${current.name} — ارفع ملف جديد لو عايز تستبدله` : `Current file: ${current.name} — upload a new one to replace it`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={submit} disabled={busy || !valid}>
                      {busy && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                      {isRTL ? "إرسال الطلب" : "Submit"}
                    </Button>
                    {info.status === "pending" && (
                      <Button variant="ghost" onClick={() => { setEditing(false); setData(info.application?.data ?? {}); setFiles({}); }}>
                        {isRTL ? "إلغاء" : "Cancel"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                <Link to="/settings" className="hover:underline">{isRTL ? "← صلاحيات الأدوار" : "← Role Access"}</Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
