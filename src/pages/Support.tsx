import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  BookOpen,
  FileQuestion,
  CreditCard,
  Building2,
  Shield,
  Users,
  ChevronRight,
  Bot,
  Headphones,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supportApi, type SupportTicketRow } from "@/integrations/api/client";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useAuth } from "@/contexts/AuthContext";

// FAQ category labels — static help-center taxonomy. The per-category question COUNT was a
// fabricated number (12/8/6/10) with no FAQ store behind it; per "never fake a number" we show
// an honest "—" placeholder instead of a made-up count (the card + label stay — DELETE NOTHING).
const faqCategories = [
  { id: "investment", icon: Building2, title: "الاستثمار", titleEn: "Investment" },
  { id: "payments", icon: CreditCard, title: "المدفوعات", titleEn: "Payments" },
  { id: "security", icon: Shield, title: "الأمان", titleEn: "Security" },
  { id: "account", icon: Users, title: "الحساب", titleEn: "Account" },
];

const popularQuestions = [
  { question: "كيف أبدأ الاستثمار؟", questionEn: "How do I start investing?" },
  { question: "ما هي رسوم المنصة؟", questionEn: "What are the platform fees?" },
  { question: "كيف أسحب أرباحي؟", questionEn: "How do I withdraw my profits?" },
  { question: "ما هو الحد الأدنى للاستثمار؟", questionEn: "What is the minimum investment?" },
  { question: "كيف يعمل السوق الثانوي؟", questionEn: "How does the secondary market work?" },
];

export default function Support() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("help");
  const [searchTerm, setSearchTerm] = useState("");

  // REAL tickets + unresolved count (replaces the hardcoded mock array).
  const { tickets, unresolvedCount, loading, refresh } = useSupportTickets();

  // New-Ticket form — now controlled + wired to a real POST (was uncontrolled + no-op Submit).
  const [form, setForm] = useState({ subject: "", category: "", priority: "low", details: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitTicket = async () => {
    if (!user) {
      toast.error(language === "ar" ? "يجب تسجيل الدخول" : "Please sign in first");
      return;
    }
    if (!form.subject.trim() || !form.category || !form.details.trim()) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill the required fields");
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.create({
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        details: form.details.trim(),
      });
      toast.success(language === "ar" ? "تم إرسال التذكرة" : "Ticket submitted");
      setForm({ subject: "", category: "", priority: "low", details: "" });
      await refresh();
      setActiveTab("tickets");
    } catch (e: any) {
      toast.error(e?.message || (language === "ar" ? "تعذّر إرسال التذكرة" : "Could not submit the ticket"));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: SupportTicketRow["status"]) => {
    switch (status) {
      case "open":
        return <Badge variant="info">{t("support.statusOpen")}</Badge>;
      case "pending":
        return <Badge variant="warning">{t("support.statusPending")}</Badge>;
      case "resolved":
        return <Badge variant="success">{t("support.statusResolved")}</Badge>;
    }
  };

  const getPriorityBadge = (priority: SupportTicketRow["priority"]) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">{t("support.priorityHigh")}</Badge>;
      case "medium":
        return <Badge variant="warning">{t("support.priorityMedium")}</Badge>;
      case "low":
        return <Badge variant="outline">{t("support.priorityLow")}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Headphones className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {t("support.title")}
              </h1>
              <p className="text-muted-foreground mt-1">{t("support.subtitle")}</p>
            </div>
          </div>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {/* AI Assistant — needs an external AI service (deferred, like payment providers).
              KEPT but honestly disabled "Coming soon" — not faked, not removed. */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 opacity-60">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("support.aiAssistant")}</h3>
                <Badge variant="secondary" className="mt-1">{t("support.comingSoon")}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Live Chat — needs an external live-chat service (deferred). KEPT, disabled. */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 opacity-60">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("support.liveChat")}</h3>
                <Badge variant="secondary" className="mt-1">{t("support.comingSoon")}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Phone className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("support.callUs")}</h3>
                <p className="text-sm text-muted-foreground" dir="ltr">+1 205 350 8771</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="help" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {t("support.helpCenter")}
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <FileQuestion className="w-4 h-4" />
              {t("support.tickets")}
              <Badge variant="outline" className="ml-1">
                {unresolvedCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="new" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              {t("support.newTicket")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="help" className="mt-6 space-y-6">
            {/* Search */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="p-6">
                <div className="relative max-w-xl mx-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder={t("support.searchHelp")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Categories */}
              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">{t("support.categories")}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {faqCategories.map((cat) => (
                    <Card
                      key={cat.id}
                      className="bg-card/50 backdrop-blur border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <cat.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{cat.title}</h4>
                          <p className="text-sm text-muted-foreground">{cat.titleEn}</p>
                        </div>
                        <div className="text-right">
                          {/* No FAQ store yet → honest "—" instead of a fabricated count. */}
                          <Badge variant="outline">— {t("support.questions")}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Popular Questions */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t("support.popular")}</h3>
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="p-0 divide-y divide-border/50">
                    {popularQuestions.map((q, i) => (
                      <button
                        key={i}
                        className="w-full flex items-center gap-3 p-4 text-right hover:bg-muted/30 transition-colors"
                      >
                        <HelpCircle className="w-5 h-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {language === "ar" ? q.question : q.questionEn}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tickets" className="mt-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t("support.tickets")}</CardTitle>
                  <Button size="sm" onClick={() => setActiveTab("new")}>
                    {t("support.newTicket")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading && tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-muted-foreground/50 mb-3 animate-spin" />
                    <p className="text-muted-foreground">
                      {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                    </p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileQuestion className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">{t("support.noTickets")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            ticket.status === "resolved"
                              ? "bg-emerald-500/10"
                              : ticket.status === "pending"
                                ? "bg-amber-500/10"
                                : "bg-blue-500/10"
                          }`}
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
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ticket.reference}
                            </span>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <h4 className="font-medium text-foreground truncate">
                            {ticket.subject}
                          </h4>
                        </div>

                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {t("support.lastUpdate")}: {new Date(ticket.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
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
                    placeholder={language === "ar" ? "أدخل موضوع التذكرة..." : "Enter ticket subject..."}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.category")}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{language === "ar" ? "اختر التصنيف..." : "Select category..."}</option>
                    <option value="investment">{t("support.investmentCat")}</option>
                    <option value="payments">{t("support.paymentsCat")}</option>
                    <option value="account">{t("support.accountCat")}</option>
                    <option value="technical">{language === "ar" ? "دعم فني" : "Technical"}</option>
                    <option value="other">{language === "ar" ? "أخرى" : "Other"}</option>
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
                    placeholder={language === "ar" ? "اشرح مشكلتك بالتفصيل..." : "Describe your issue in detail..."}
                    rows={5}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.attachments")}</label>
                  {/* Display-only dropzone — the form has no real <input type=file>; attachment
                      upload is a deferred enhancement (kept, honestly labelled "Coming soon"). */}
                  <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center opacity-60">
                    <p className="text-muted-foreground text-sm">{t("support.dragFiles")}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {t("support.fileTypes")} · {t("support.comingSoon")}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setActiveTab("tickets")} disabled={submitting}>
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button
                    className="bg-gradient-gold hover:opacity-90"
                    onClick={handleSubmitTicket}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {submitting ? (language === "ar" ? "جارٍ الإرسال..." : "Submitting...") : t("support.submitTicket")}
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
