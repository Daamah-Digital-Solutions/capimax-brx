import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MailCheck,
  RotateCcw,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GiftDialog } from "@/components/transfers/GiftDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { transfersApi, type TransferRow } from "@/integrations/api/client";
import { cn } from "@/lib/utils";

// Transfers — send property units or wallet balance to anyone by email, follow every
// transfer and cancel it before it is delivered. Separate from Family Investment (its own
// family-member transfers and inheritance stay on that page).

const STATUS: Record<TransferRow["status"], { ar: string; en: string; cls: string }> = {
  scheduled: { ar: "مجدول", en: "Scheduled", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  waiting: { ar: "بانتظار المستلم", en: "Waiting for the recipient", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  delivered: { ar: "تم التسليم", en: "Delivered", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { ar: "أُلغي — أُعيد إليك", en: "Cancelled — returned", cls: "bg-muted text-muted-foreground" },
  expired: { ar: "انتهت المهلة — أُعيد إليك", en: "Expired — returned", cls: "bg-muted text-muted-foreground" },
  failed: { ar: "تعذّر التسليم — أُعيد إليك", en: "Failed — returned", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

const OCCASION: Record<string, { ar: string; en: string }> = {
  birthday: { ar: "عيد ميلاد", en: "Birthday" },
  graduation: { ar: "تخرج", en: "Graduation" },
  wedding: { ar: "زواج", en: "Wedding" },
  new_baby: { ar: "مولود جديد", en: "New baby" },
  holiday: { ar: "عيد", en: "Holiday" },
  other: { ar: "أخرى", en: "Other" },
};

type Filter = "all" | "sent" | "received" | "waiting";

export default function Transfers() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const [rows, setRows] = useState<TransferRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user) return;
    transfersApi
      .list()
      .then((r) => setRows(r.filter((t) => t.kind === "gift")))
      .catch(() => setRows([]));
  }, [user]);
  useEffect(load, [load]);

  const cancel = async (t: TransferRow) => {
    setBusy(t.id);
    try {
      await transfersApi.cancel(t.id);
      toast.success(isAr ? "أُلغي التحويل وأُعيد إليك" : "Transfer cancelled — returned to you");
      load();
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "تعذّر إلغاء التحويل" : "Could not cancel the transfer"));
    } finally {
      setBusy(null);
    }
  };

  const all = rows ?? [];
  const pending = (t: TransferRow) => t.status === "scheduled" || t.status === "waiting";
  const counts = {
    sent: all.filter((t) => t.direction === "sent").length,
    received: all.filter((t) => t.direction === "received").length,
    waiting: all.filter(pending).length,
    delivered: all.filter((t) => t.status === "delivered").length,
  };
  const shown = useMemo(
    () =>
      all.filter((t) =>
        filter === "all" ? true : filter === "waiting" ? pending(t) : t.direction === filter,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, filter],
  );

  const day = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "";
  const what = (t: TransferRow) =>
    t.asset === "units"
      ? `${t.units.toLocaleString()} ${isAr ? "وحدة" : t.units === 1 ? "unit" : "units"} · ${(isAr && t.property_name_ar) || t.property_name}`
      : `$${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isAr ? "من المحفظة" : "wallet balance"}`;

  const steps: { icon: LucideIcon; ar: string; en: string }[] = [
    { icon: Lock, ar: "يُحجز ما تحوّله من رصيدك فورًا، فلا يُباع أو يُحوّل مرتين.", en: "What you send is held at once, so it can't be sold or sent twice." },
    { icon: ShieldCheck, ar: "إن كان بريد المستلم مؤكدًا وهويته موثّقة، يصله التحويل مباشرة أو في التاريخ الذي تختاره.", en: "If the recipient's email is confirmed and identity verified, it reaches them right away or on the date you choose." },
    { icon: MailCheck, ar: "وإن لم يكن، يصله بريد دعوة، ويصله التحويل تلقائيًا فور تسجيله وتوثيقه بنفس البريد.", en: "If not, they get an invitation and receive it automatically once they sign up and verify with that email." },
    { icon: RotateCcw, ar: "إن لم يستلمه خلال 30 يومًا يعود إليك تلقائيًا، ويمكنك إلغاؤه من هنا قبل التسليم.", en: "If it isn't received within 30 days it comes back to you; you can cancel it here before delivery." },
  ];

  const tabs: { id: Filter; ar: string; en: string; n: number }[] = [
    { id: "all", ar: "الكل", en: "All", n: all.length },
    { id: "sent", ar: "المرسلة", en: "Sent", n: counts.sent },
    { id: "received", ar: "المستلمة", en: "Received", n: counts.received },
    { id: "waiting", ar: "بانتظار المستلم", en: "Waiting", n: counts.waiting },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ArrowLeftRight className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{isAr ? "التحويلات" : "Transfers"}</h1>
              <p className="text-muted-foreground mt-1">
                {isAr
                  ? "حوّل وحدات عقار أو رصيدًا من محفظتك لأي شخص ببريده الإلكتروني، وتابع كل تحويل وألغِه قبل تسليمه."
                  : "Send property units or wallet balance to anyone by email, follow every transfer and cancel it before delivery."}
              </p>
            </div>
          </div>
          {user && (
            <Button className="bg-gradient-gold hover:opacity-90 gap-2" onClick={() => setOpen(true)}>
              <ArrowLeftRight className="w-4 h-4" />
              {isAr ? "تحويل جديد" : "New transfer"}
            </Button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <Card key={i} className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-4 flex gap-3">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{isAr ? s.ar : s.en}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!user ? (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">{isAr ? "سجّل الدخول لإرسال التحويلات ومتابعتها." : "Sign in to send and follow transfers."}</p>
              <Link to="/auth?next=/transfers"><Button>{isAr ? "تسجيل الدخول" : "Sign in"}</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { ar: "المرسلة", en: "Sent", n: counts.sent, icon: ArrowUpRight, tone: "bg-primary/10 text-primary" },
                { ar: "المستلمة", en: "Received", n: counts.received, icon: ArrowDownLeft, tone: "bg-emerald-500/10 text-emerald-500" },
                { ar: "بانتظار المستلم", en: "Waiting", n: counts.waiting, icon: Clock, tone: "bg-amber-500/10 text-amber-500" },
                { ar: "تم التسليم", en: "Delivered", n: counts.delivered, icon: CheckCircle2, tone: "bg-sky-500/10 text-sky-500" },
              ].map((s) => (
                <Card key={s.en} className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", s.tone)}>
                      <s.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{rows === null ? "—" : s.n}</p>
                      <p className="text-xs text-muted-foreground">{isAr ? s.ar : s.en}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm transition-colors",
                    filter === t.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border hover:border-primary/30",
                  )}
                >
                  {isAr ? t.ar : t.en} <span className="text-muted-foreground">({t.n})</span>
                </button>
              ))}
            </div>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-0 divide-y divide-border/50">
                {rows === null ? (
                  <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : shown.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-muted-foreground">
                      {filter === "all"
                        ? isAr ? "لم ترسل أو تستلم أي تحويل بعد." : "You haven't sent or received a transfer yet."
                        : isAr ? "لا توجد تحويلات هنا." : "No transfers here."}
                    </p>
                    {filter === "all" && (
                      <Button variant="outline" onClick={() => setOpen(true)}>{isAr ? "أرسل أول تحويل" : "Send your first transfer"}</Button>
                    )}
                  </div>
                ) : (
                  shown.map((t) => {
                    const st = STATUS[t.status];
                    const sent = t.direction === "sent";
                    const canCancel = sent && pending(t);
                    return (
                      <div key={t.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={cn("w-10 h-10 shrink-0 rounded-lg flex items-center justify-center",
                              sent ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500")}>
                              {sent ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {sent ? (isAr ? "إلى " : "To ") : (isAr ? "من " : "From ")}
                                <span dir="auto">{t.counterparty}</span>
                              </p>
                              <p className="text-sm text-foreground/80">{what(t)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={st.cls}>{isAr ? st.ar : st.en}</Badge>
                            {canCancel && (
                              <Button size="sm" variant="outline" className="gap-1.5 text-destructive"
                                disabled={busy === t.id} onClick={() => cancel(t)}>
                                {busy === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                {isAr ? "إلغاء" : "Cancel"}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="ps-[52px] text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span dir="ltr">{t.reference}</span>
                          <span>{isAr ? "أُنشئ" : "Created"} {day(t.created_at)}</span>
                          {t.status === "scheduled" && <span>{isAr ? "يُسلَّم في" : "Delivers on"} {day(t.deliver_on)}</span>}
                          {t.status === "waiting" && t.expires_at && (
                            <span>{isAr ? "آخر موعد للاستلام" : "Must be received by"} {day(t.expires_at)}</span>
                          )}
                          {t.status === "delivered" && t.delivered_at && <span>{isAr ? "سُلِّم في" : "Delivered"} {day(t.delivered_at)}</span>}
                          {sent && <span dir="ltr">{t.recipient_email}</span>}
                          {t.occasion && OCCASION[t.occasion] && <span>{isAr ? OCCASION[t.occasion].ar : OCCASION[t.occasion].en}</span>}
                        </div>
                        {t.status === "waiting" && sent && (
                          <p className="ps-[52px] text-xs text-amber-600">
                            {isAr
                              ? "أرسلنا للمستلم دعوة؛ يصله التحويل فور تأكيد بريده وتوثيق هويته."
                              : "We invited the recipient; it reaches them as soon as they confirm their email and verify their identity."}
                          </p>
                        )}
                        {t.message && (
                          <p className="ms-[52px] text-sm rounded-lg bg-muted/40 px-3 py-2 text-foreground/90" dir="auto">“{t.message}”</p>
                        )}
                        {/* The stored reason is English; the badge already says it on the Arabic site. */}
                        {!isAr && t.closed_reason && t.status !== "delivered" && (
                          <p className="ps-[52px] text-xs text-muted-foreground" dir="auto">{t.closed_reason}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <GiftDialog open={open} onOpenChange={setOpen} onDone={load} mode="transfer" />
    </MainLayout>
  );
}
