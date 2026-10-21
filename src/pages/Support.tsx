import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Clock,
  FileQuestion,
  Headphones,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supportApi, type SupportTicketRow, type SupportTicketThread } from "@/integrations/api/client";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useAuth } from "@/contexts/AuthContext";
import { faqSections } from "@/data/faq";
import { openAssistant } from "@/lib/assistant";
import {
  SUPPORT_ADDRESS,
  SUPPORT_EMAIL,
  SUPPORT_PHONES,
  SUPPORT_WHATSAPP,
  telHref,
  whatsappHref,
} from "@/lib/contact";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { ar: string; en: string; variant: "info" | "warning" | "success" }> = {
  open: { ar: "مفتوحة — لدى فريق الدعم", en: "Open — with our team", variant: "info" },
  pending: { ar: "بانتظار ردك", en: "Waiting for your reply", variant: "warning" },
  resolved: { ar: "تم الحل", en: "Resolved", variant: "success" },
};

export default function Support() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(params.get("ticket") ? "tickets" : params.get("tab") || "help");
  const [searchTerm, setSearchTerm] = useState("");
  const [section, setSection] = useState<string>("all");

  const { tickets, unresolvedCount, loading, refresh } = useSupportTickets();

  const [form, setForm] = useState({ subject: "", category: "", priority: "low", details: "" });
  const [submitting, setSubmitting] = useState(false);

  // --- one ticket's conversation --------------------------------------------- //
  const [thread, setThread] = useState<SupportTicketThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const openTicket = async (id: string) => {
    setThreadLoading(true);
    try {
      setThread(await supportApi.detail(id));
      setParams({ tab: "tickets", ticket: id }, { replace: true });
    } catch {
      toast.error(isAr ? "تعذّر فتح التذكرة" : "Could not open the ticket");
    } finally {
      setThreadLoading(false);
    }
  };
  useEffect(() => {
    const id = params.get("ticket");
    if (id && user) void openTicket(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sendReply = async () => {
    if (!thread || !reply.trim()) return;
    setReplying(true);
    try {
      setThread(await supportApi.reply(thread.id, reply.trim()));
      setReply("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "تعذّر إرسال الرد" : "Could not send the reply"));
    } finally {
      setReplying(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!user) {
      toast.error(isAr ? "يجب تسجيل الدخول" : "Please sign in first");
      return;
    }
    if (!form.subject.trim() || !form.category || !form.details.trim()) {
      toast.error(isAr ? "يرجى ملء الحقول المطلوبة" : "Please fill the required fields");
      return;
    }
    setSubmitting(true);
    try {
      const created = await supportApi.create({
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        details: form.details.trim(),
      });
      toast.success(isAr ? `تم فتح التذكرة ${created.reference}` : `Ticket ${created.reference} opened`);
      setForm({ subject: "", category: "", priority: "low", details: "" });
      await refresh();
      setActiveTab("tickets");
      void openTicket(created.id);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "تعذّر إرسال التذكرة" : "Could not submit the ticket"));
    } finally {
      setSubmitting(false);
    }
  };

  // --- help center (the FAQ content) ---------------------------------------- //
  const q = searchTerm.trim().toLowerCase();
  const results = useMemo(
    () =>
      faqSections
        .filter((s) => section === "all" || s.id === section)
        .flatMap((s) => s.items.map((it, i) => ({ ...it, key: `${s.id}-${i}` })))
        .filter(
          (it) =>
            !q ||
            [it.question, it.questionAr, it.answer, it.answerAr].some((x) => x.toLowerCase().includes(q)),
        ),
    [q, section],
  );
  const popular = faqSections.map((s) => ({ ...s.items[0], key: `${s.id}-0`, section: s.id }));

  const statusBadge = (status: SupportTicketRow["status"]) => {
    const s = STATUS[status];
    return s ? <Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge> : <Badge variant="outline">{status}</Badge>;
  };
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  const Back = isAr ? ArrowRight : ArrowLeft;
  const waText = isAr ? "مرحبًا، أحتاج مساعدة بخصوص حسابي على Capimax BRX." : "Hello, I need help with my Capimax BRX account.";

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{t("support.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {isAr
                ? "ثلاث طرق للحصول على المساعدة: اسأل المساعد الذكي، أو تواصل مع خدمة العملاء، أو افتح تذكرة دعم وتابعها."
                : "Three ways to get help: ask the AI assistant, contact customer service, or open a support ticket and follow it."}
            </p>
          </div>
        </div>

        {/* The three ways to get help */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{isAr ? "المساعد الذكي" : "AI assistant"}</h3>
                  <p className="text-xs text-muted-foreground">{isAr ? "متاح على مدار الساعة" : "Available 24/7"}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "اسأل عن الاستثمار والعقارات والمحفظة والأقساط وطريقة استخدام المنصة واحصل على إجابة فورية."
                  : "Ask about investing, properties, your wallet, installments or how to use the platform and get an instant answer."}
              </p>
              <Button className="w-full gap-2" onClick={openAssistant}>
                <MessageCircle className="w-4 h-4" />
                {isAr ? "ابدأ المحادثة" : "Start a chat"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-foreground">{isAr ? "خدمة العملاء" : "Customer service"}</h3>
              </div>
              <div className="space-y-2 text-sm">
                <button type="button" onClick={openAssistant} className="flex items-center gap-2 text-foreground hover:text-primary">
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  {isAr ? "راسلنا عبر المحادثة" : "Chat with us"}
                </button>
                {SUPPORT_WHATSAPP && (
                  <a href={whatsappHref(waText)} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-foreground hover:text-primary">
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                    {isAr ? "واتساب" : "WhatsApp"} <span dir="ltr" className="text-muted-foreground">+{SUPPORT_WHATSAPP}</span>
                  </a>
                )}
                {SUPPORT_PHONES.map((p) => (
                  <a key={p} href={telHref(p)} className="flex items-center gap-2 text-foreground hover:text-primary">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span dir="ltr">{p}</span>
                  </a>
                ))}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span dir="ltr">{SUPPORT_EMAIL}</span>
                </a>
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span dir="ltr">{SUPPORT_ADDRESS}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <FileQuestion className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-semibold text-foreground">{isAr ? "تذاكر الدعم" : "Support tickets"}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "افتح تذكرة بمشكلتك، وتابع حالتها، واقرأ ردود الفريق ورد عليها من هنا. يصلك إشعار وبريد عند كل رد."
                  : "Open a ticket about your issue, follow its status, read the team's replies and answer here. You get a notification and an email on every reply."}
              </p>
              <div className="flex gap-2">
                <Button className="flex-1 bg-gradient-gold hover:opacity-90" onClick={() => setActiveTab("new")}>
                  {t("support.newTicket")}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setActiveTab("tickets")}>
                  {isAr ? "تذاكري" : "My tickets"}
                  {unresolvedCount > 0 && <Badge className="ms-2">{unresolvedCount}</Badge>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
            <TabsTrigger value="help" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {t("support.helpCenter")}
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <FileQuestion className="w-4 h-4" />
              {t("support.tickets")}
              <Badge variant="outline" className="ms-1">{unresolvedCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              {t("support.newTicket")}
            </TabsTrigger>
          </TabsList>

          {/* Help center — searchable FAQ by category */}
          <TabsContent value="help" className="mt-6 space-y-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-6">
                <div className="relative max-w-xl mx-auto">
                  <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder={t("support.searchHelp")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="ps-12 h-12 text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[{ id: "all", titleAr: "كل الأسئلة", titleEn: "All questions", count: faqSections.reduce((n, s) => n + s.items.length, 0) },
                    ...faqSections.map((s) => ({ id: s.id, titleAr: s.titleAr, titleEn: s.titleEn, count: s.items.length }))].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSection(c.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-sm transition-colors",
                        section === c.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border hover:border-primary/30",
                      )}
                    >
                      {isAr ? c.titleAr : c.titleEn} <span className="text-muted-foreground">({c.count})</span>
                    </button>
                  ))}
                </div>
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-2">
                    {results.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground space-y-3">
                        <p>{isAr ? "لا توجد نتائج. جرّب المساعد الذكي أو افتح تذكرة." : "No results. Try the AI assistant or open a ticket."}</p>
                        <Button variant="outline" size="sm" onClick={openAssistant}>{isAr ? "اسأل المساعد" : "Ask the assistant"}</Button>
                      </div>
                    ) : (
                      <Accordion type="single" collapsible>
                        {results.map((it) => (
                          <AccordionItem key={it.key} value={it.key}>
                            <AccordionTrigger className="text-start px-3">{isAr ? it.questionAr : it.question}</AccordionTrigger>
                            <AccordionContent className="px-3 whitespace-pre-line text-muted-foreground">
                              {isAr ? it.answerAr : it.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
                <Link to="/faq" className="text-sm text-primary hover:underline">
                  {isAr ? "صفحة الأسئلة الشائعة كاملة" : "The full FAQ page"}
                </Link>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">{t("support.popular")}</h3>
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-0 divide-y divide-border/50">
                    {popular.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => {
                          setSection(p.section);
                          setSearchTerm(isAr ? p.questionAr : p.question);
                        }}
                        className="w-full flex items-center gap-3 p-4 text-start hover:bg-muted/30 transition-colors"
                      >
                        <BookOpen className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground">{isAr ? p.questionAr : p.question}</span>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tickets — list, or one ticket's conversation */}
          <TabsContent value="tickets" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              {thread || threadLoading ? (
                <CardContent className="p-6 space-y-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 -ms-2"
                    onClick={() => {
                      setThread(null);
                      setParams({ tab: "tickets" }, { replace: true });
                    }}
                  >
                    <Back className="w-4 h-4" />
                    {isAr ? "كل التذاكر" : "All tickets"}
                  </Button>
                  {threadLoading || !thread ? (
                    <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{thread.reference}</span>
                        {statusBadge(thread.status)}
                      </div>
                      <h2 className="text-xl font-semibold text-foreground">{thread.subject}</h2>
                      <div className="space-y-3">
                        {[{ id: "first", from_support: false, body: thread.details, created_at: thread.created_at }, ...thread.messages].map((m) => (
                          <div key={m.id} className={cn("flex", m.from_support ? "justify-start" : "justify-end")}>
                            <div
                              className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3",
                                m.from_support ? "bg-muted" : "bg-primary/10 border border-primary/20",
                              )}
                            >
                              <p className="text-xs text-muted-foreground mb-1">
                                {m.from_support ? (isAr ? "فريق الدعم" : "Support team") : (isAr ? "أنت" : "You")} · {fmt(m.created_at)}
                              </p>
                              <p className="text-foreground whitespace-pre-wrap" dir="auto">{m.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 pt-2">
                        <Textarea
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          rows={3}
                          placeholder={thread.status === "resolved"
                            ? (isAr ? "اكتب ردًا لإعادة فتح التذكرة..." : "Write a reply to reopen the ticket...")
                            : (isAr ? "اكتب ردك..." : "Write your reply...")}
                        />
                        <div className="flex justify-end">
                          <Button onClick={sendReply} disabled={replying || !reply.trim()} className="gap-2">
                            {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isAr ? "إرسال الرد" : "Send reply"}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              ) : (
                <>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{t("support.tickets")}</CardTitle>
                      <Button size="sm" onClick={() => setActiveTab("new")}>{t("support.newTicket")}</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!user ? (
                      <div className="py-12 text-center space-y-3">
                        <p className="text-muted-foreground">{isAr ? "سجّل الدخول لرؤية تذاكرك." : "Sign in to see your tickets."}</p>
                        <Link to="/auth?next=/support?tab=tickets"><Button>{isAr ? "تسجيل الدخول" : "Sign in"}</Button></Link>
                      </div>
                    ) : loading && tickets.length === 0 ? (
                      <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-muted-foreground/50 animate-spin" /></div>
                    ) : tickets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileQuestion className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">{t("support.noTickets")}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {tickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            onClick={() => openTicket(ticket.id)}
                            className="w-full text-start flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                          >
                            <div
                              className={cn(
                                "w-10 h-10 shrink-0 rounded-lg flex items-center justify-center",
                                ticket.status === "resolved" ? "bg-emerald-500/10" : ticket.status === "pending" ? "bg-amber-500/10" : "bg-blue-500/10",
                              )}
                            >
                              {ticket.status === "resolved" ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              ) : ticket.status === "pending" ? (
                                <Clock className="w-5 h-5 text-amber-500" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-muted-foreground">{ticket.reference}</span>
                                {statusBadge(ticket.status)}
                              </div>
                              <h4 className="font-medium text-foreground truncate">{ticket.subject}</h4>
                            </div>
                            <div className="text-end text-sm shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {t("support.lastUpdate")}: {new Date(ticket.updated_at).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="new" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50 max-w-2xl">
              <CardHeader>
                <CardTitle>{t("support.newTicket")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.subject")}</label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder={isAr ? "أدخل موضوع التذكرة..." : "Enter ticket subject..."}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.category")}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{isAr ? "اختر التصنيف..." : "Select category..."}</option>
                    <option value="investment">{t("support.investmentCat")}</option>
                    <option value="payments">{t("support.paymentsCat")}</option>
                    <option value="account">{t("support.accountCat")}</option>
                    <option value="technical">{isAr ? "دعم فني" : "Technical"}</option>
                    <option value="other">{isAr ? "أخرى" : "Other"}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.priority")}</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="low">{t("support.priorityLow")}</option>
                    <option value="medium">{t("support.priorityMedium")}</option>
                    <option value="high">{t("support.priorityHigh")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.details")}</label>
                  <Textarea
                    value={form.details}
                    onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                    placeholder={isAr ? "اشرح مشكلتك بالتفصيل..." : "Describe your issue in detail..."}
                    rows={5}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setActiveTab("tickets")} disabled={submitting}>
                    {isAr ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button className="bg-gradient-gold hover:opacity-90 gap-2" onClick={handleSubmitTicket} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submitting ? (isAr ? "جارٍ الإرسال..." : "Submitting...") : t("support.submitTicket")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
