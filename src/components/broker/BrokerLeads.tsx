import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  FileSignature,
  Loader2,
  Mail,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { brokerLeadsApi, type BrokerLeadRow } from "@/integrations/api/client";
import { countryOptions } from "@/lib/countries";

const STATUS: Record<string, { ar: string; en: string; variant: "success" | "warning" | "destructive" | "outline" | "info" }> = {
  invited: { ar: "تمت الدعوة", en: "Invited", variant: "info" },
  joined: { ar: "انضم", en: "Joined", variant: "success" },
  cancelled: { ar: "ملغاة", en: "Cancelled", variant: "outline" },
  awaiting_authorization: { ar: "بانتظار تفويض المالك", en: "Awaiting owner authorization", variant: "warning" },
  under_review: { ar: "قيد المراجعة", en: "Under review", variant: "info" },
  contacted: { ar: "تم التواصل مع المالك", en: "Owner contacted", variant: "info" },
  listed: { ar: "تم الإدراج", en: "Listed", variant: "success" },
  declined: { ar: "لم يُدرج", en: "Not listed", variant: "destructive" },
  withdrawn: { ar: "مسحوبة", en: "Withdrawn", variant: "outline" },
};
const AUTH: Record<string, { ar: string; en: string }> = {
  none: { ar: "لم يُستكمل بعد", en: "Not done yet" },
  requested: { ar: "أُرسل للمالك — بانتظار تأكيده", en: "Sent to the owner — waiting for them" },
  uploaded: { ar: "رُفع التفويض الموقّع", en: "Signed authorization uploaded" },
  confirmed: { ar: "أكّده المالك", en: "Confirmed by the owner" },
};
const OPEN = ["awaiting_authorization", "under_review"];

/** "Refer a client" / "Refer a property" + the broker's own referrals and their status. */
export function BrokerLeads({ clientOpen, setClientOpen, propertyOpen, setPropertyOpen }: {
  clientOpen: boolean;
  setClientOpen: (o: boolean) => void;
  propertyOpen: boolean;
  setPropertyOpen: (o: boolean) => void;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [rows, setRows] = useState<BrokerLeadRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const authInput = useRef<HTMLInputElement>(null);
  const [authFor, setAuthFor] = useState<string | null>(null);

  const load = useCallback(() => {
    brokerLeadsApi.list().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      load();
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "حدث خطأ" : "Something went wrong"));
    } finally {
      setBusy(null);
    }
  };

  // --- client form ------------------------------------------------------------ //
  const [client, setClient] = useState({ name: "", email: "", phone: "", notes: "" });
  const submitClient = () =>
    act("client", () => brokerLeadsApi.inviteClient(client), isAr ? "تم إرسال الدعوة إلى بريده" : "Invitation emailed").then(() => {
      setClient({ name: "", email: "", phone: "", notes: "" });
      setClientOpen(false);
    });

  // --- property form ---------------------------------------------------------- //
  const empty = {
    title: "", location: "", country: "", property_type: "", estimated_value: "", expected_completion: "",
    owner_role: "owner", owner_name: "", owner_email: "", owner_phone: "", notes: "",
  };
  const [prop, setProp] = useState(empty);
  const [files, setFiles] = useState<File[]>([]);
  const [authFile, setAuthFile] = useState<File | null>(null);
  const submitProperty = () => {
    const form = new FormData();
    Object.entries(prop).forEach(([k, v]) => form.append(k, v));
    files.forEach((f) => form.append("files", f));
    if (authFile) form.append("authorization", authFile);
    return act("property", () => brokerLeadsApi.referProperty(form),
      isAr ? "تم تسجيل العقار" : "Property referral saved").then(() => {
      setProp(empty);
      setFiles([]);
      setAuthFile(null);
      setPropertyOpen(false);
    });
  };
  const p = (k: keyof typeof empty) => ({
    value: prop[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setProp({ ...prop, [k]: e.target.value }),
  });
  const isDev = prop.owner_role === "developer";

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">{isAr ? "إحالاتي المباشرة" : "My direct referrals"}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setClientOpen(true)}>
                <UserPlus className="w-4 h-4" />{isAr ? "إحالة عميل" : "Refer a client"}
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setPropertyOpen(true)}>
                <Building2 className="w-4 h-4" />{isAr ? "إحالة عقار" : "Refer a property"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          {rows === null ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {isAr
                ? "لم تُحِل أحدًا بعد. ادعُ عميلًا ببريده، أو سجّل عقارًا مع بيانات مالكه وتفويضه."
                : "No referrals yet. Invite a client by email, or register a property with its owner's details and authorization."}
            </p>
          ) : (
            rows.map((r) => {
              const st = STATUS[r.status] ?? { ar: r.status, en: r.status, variant: "outline" as const };
              const authOpen = r.kind === "property" && OPEN.includes(r.status) && r.authorization !== "confirmed";
              return (
                <div key={r.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                        {r.kind === "client" ? <UserPlus className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.kind === "client"
                            ? `${isAr ? "عميل" : "Client"} · ${r.email}`
                            : `${isAr ? "عقار" : "Property"} · ${r.details.location || ""} · ${isAr ? "المالك" : "Owner"}: ${r.details.owner_name || ""}`}
                          {" · "}{fmt(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={st.variant}>{isAr ? st.ar : st.en}</Badge>
                  </div>
                  {r.kind === "property" && (
                    <div className="ps-12 space-y-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileSignature className="w-3.5 h-3.5" />
                        {isAr ? "تفويض المالك:" : "Owner authorization:"} {isAr ? AUTH[r.authorization].ar : AUTH[r.authorization].en}
                      </p>
                      {r.status === "declined" && r.admin_note && (
                        <p className="text-xs text-destructive">{isAr ? "السبب:" : "Reason:"} {r.admin_note}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {authOpen && (
                          <>
                            <Button size="sm" variant="secondary" className="gap-1.5 h-8" disabled={busy !== null}
                              onClick={() => { setAuthFor(r.id); authInput.current?.click(); }}>
                              <Upload className="w-3.5 h-3.5" />{isAr ? "رفع التفويض الموقّع" : "Upload signed authorization"}
                            </Button>
                            {r.email && (
                              <Button size="sm" variant="secondary" className="gap-1.5 h-8" disabled={busy !== null}
                                onClick={() => act(`req-${r.id}`, () => brokerLeadsApi.requestAuthorization(r.id),
                                  isAr ? "أُرسل رابط التأكيد إلى المالك" : "Confirmation link emailed to the owner")}>
                                <Mail className="w-3.5 h-3.5" />
                                {r.authorization === "requested" ? (isAr ? "إعادة إرسال الرابط للمالك" : "Resend link to the owner") : (isAr ? "إرسال رابط تأكيد للمالك" : "Email the owner a confirmation link")}
                              </Button>
                            )}
                          </>
                        )}
                        {r.documents.map((d) => (
                          <Button key={d.id} size="sm" variant="ghost" className="gap-1.5 h-8 text-muted-foreground"
                            onClick={() => brokerLeadsApi.downloadDocument(r.id, d.id, d.name)}>
                            <Download className="w-3.5 h-3.5" />
                            {d.kind === "authorization" ? (isAr ? "التفويض" : "Authorization") : d.name}
                          </Button>
                        ))}
                        {OPEN.includes(r.status) && (
                          <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-destructive" disabled={busy !== null}
                            onClick={() => act(`cancel-${r.id}`, () => brokerLeadsApi.cancel(r.id), isAr ? "تم سحب الإحالة" : "Referral withdrawn")}>
                            <X className="w-3.5 h-3.5" />{isAr ? "سحب" : "Withdraw"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {r.kind === "client" && r.status === "invited" && (
                    <div className="ps-12">
                      <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-destructive" disabled={busy !== null}
                        onClick={() => act(`cancel-${r.id}`, () => brokerLeadsApi.cancel(r.id), isAr ? "أُلغيت الدعوة" : "Invitation cancelled")}>
                        <X className="w-3.5 h-3.5" />{isAr ? "إلغاء الدعوة" : "Cancel invitation"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <input
        ref={authInput}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && authFor) {
            void act(`auth-${authFor}`, () => brokerLeadsApi.uploadAuthorization(authFor, f),
              isAr ? "تم رفع التفويض — العقار قيد المراجعة" : "Authorization uploaded — the property is under review");
          }
          e.target.value = "";
        }}
      />

      {/* Refer a client */}
      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "إحالة عميل" : "Refer a client"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "نرسل له بريدًا فيه رابط الإحالة الخاص بك. عندما يسجّل منه يُنسب إليك ويظهر هنا «انضم»."
                : "We email them your referral link. When they sign up through it they are linked to you and show here as “Joined”."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{isAr ? "الاسم الكامل" : "Full name"} *</Label>
              <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{isAr ? "البريد الإلكتروني" : "Email"} *</Label>
              <Input type="email" dir="ltr" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{isAr ? "الهاتف" : "Phone"}</Label>
              <Input type="tel" dir="ltr" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{isAr ? "ملاحظات (لك فقط)" : "Notes (only you see them)"}</Label>
              <Textarea rows={2} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={submitClient} disabled={busy !== null || !client.name.trim() || !client.email.trim()}>
              {busy === "client" && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {isAr ? "إرسال الدعوة" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refer a property */}
      <Dialog open={propertyOpen} onOpenChange={setPropertyOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isAr ? "إحالة عقار" : "Refer a property"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "سجّل العقار وبيانات مالكه الآن، ثم استكمل تفويض المالك: ارفع تفويضًا موقّعًا، أو أرسل له رابطًا يؤكد منه بنفسه. لا يُدرج العقار قبل اكتمال التفويض."
                : "Register the property and its owner now, then complete the owner's authorization: upload a signed authorization, or email them a link to confirm it themselves. The property isn't listed until the authorization is complete."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2"><Label>{isAr ? "اسم العقار أو المشروع" : "Property or project name"} *</Label><Input {...p("title")} /></div>
              <div className="space-y-1.5"><Label>{isAr ? "الموقع (المدينة / المنطقة)" : "Location (city / area)"} *</Label><Input {...p("location")} /></div>
              <div className="space-y-1.5"><Label>{isAr ? "الدولة" : "Country"}</Label>
                <select {...p("country")} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{isAr ? "اختر الدولة" : "Select a country"}</option>
                  {countryOptions(language).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label>{isAr ? "نوع العقار" : "Property type"}</Label>
                <Input {...p("property_type")} placeholder={isAr ? "سكني، تجاري، فندقي…" : "Residential, commercial, hospitality…"} /></div>
              <div className="space-y-1.5"><Label>{isAr ? "القيمة التقديرية (دولار)" : "Estimated value (USD)"}</Label><Input dir="ltr" {...p("estimated_value")} /></div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex gap-2">
                {(["owner", "developer"] as const).map((r) => (
                  <Button key={r} type="button" size="sm" variant={prop.owner_role === r ? "default" : "outline"}
                    onClick={() => setProp({ ...prop, owner_role: r })}>
                    {r === "owner" ? (isAr ? "مالك" : "Owner") : (isAr ? "مطوّر" : "Developer")}
                  </Button>
                ))}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>{isDev ? (isAr ? "اسم المطوّر" : "Developer name") : (isAr ? "اسم المالك" : "Owner name")} *</Label><Input {...p("owner_name")} /></div>
                <div className="space-y-1.5"><Label>{isAr ? "البريد الإلكتروني" : "Email"}</Label><Input type="email" dir="ltr" {...p("owner_email")} /></div>
                <div className="space-y-1.5"><Label>{isAr ? "الهاتف" : "Phone"}</Label><Input type="tel" dir="ltr" {...p("owner_phone")} /></div>
              </div>
              {isDev && (
                <div className="space-y-1.5 sm:w-1/2"><Label>{isAr ? "موعد التسليم المتوقع" : "Expected completion"}</Label><Input type="date" {...p("expected_completion")} /></div>
              )}
              <p className="text-xs text-muted-foreground">
                {isAr ? "البريد مطلوب إن أردت أن نرسل للمالك رابط التأكيد." : "The email is needed if you want us to send the owner the confirmation link."}
              </p>
            </div>

            <div className="space-y-1.5"><Label>{isAr ? "ملاحظات لفريقنا" : "Notes for our team"}</Label><Textarea rows={2} {...p("notes")} /></div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isAr ? "مستندات العقار (حتى 8)" : "Property documents (up to 8)"}</Label>
                <Input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))} />
                <p className="text-xs text-muted-foreground">{isAr ? "سند الملكية، الكتيّب، التقييم…" : "Title deed, brochure, valuation…"}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? "تفويض المالك الموقّع (إن كان جاهزًا)" : "Owner's signed authorization (if ready)"}</Label>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setAuthFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isAr ? "يمكنك استكماله لاحقًا من القائمة" : "You can complete it later from the list"}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitProperty}
              disabled={busy !== null || !prop.title.trim() || !prop.location.trim() || !prop.owner_name.trim()}>
              {busy === "property" && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              {isAr ? "تسجيل العقار" : "Register the property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
