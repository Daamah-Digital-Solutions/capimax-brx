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
} from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  subjectAr: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "medium" | "high";
  date: string;
  lastUpdate: string;
}

const tickets: Ticket[] = [
  {
    id: "TKT-001",
    subject: "Distribution Payment Delay",
    subjectAr: "تأخير دفع التوزيعات",
    status: "pending",
    priority: "high",
    date: "2024-01-15",
    lastUpdate: "منذ 2 ساعة",
  },
  {
    id: "TKT-002",
    subject: "KYC Document Verification",
    subjectAr: "التحقق من مستندات KYC",
    status: "open",
    priority: "medium",
    date: "2024-01-14",
    lastUpdate: "منذ يوم",
  },
  {
    id: "TKT-003",
    subject: "Secondary Market Order Issue",
    subjectAr: "مشكلة في أمر السوق الثانوي",
    status: "resolved",
    priority: "low",
    date: "2024-01-10",
    lastUpdate: "منذ 5 أيام",
  },
];

const faqCategories = [
  {
    id: "investment",
    icon: Building2,
    title: "الاستثمار",
    titleEn: "Investment",
    questions: 12,
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "المدفوعات",
    titleEn: "Payments",
    questions: 8,
  },
  {
    id: "security",
    icon: Shield,
    title: "الأمان",
    titleEn: "Security",
    questions: 6,
  },
  {
    id: "account",
    icon: Users,
    title: "الحساب",
    titleEn: "Account",
    questions: 10,
  },
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
  const [activeTab, setActiveTab] = useState("help");
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusBadge = (status: Ticket["status"]) => {
    switch (status) {
      case "open":
        return <Badge variant="info">{t("support.statusOpen")}</Badge>;
      case "pending":
        return <Badge variant="warning">{t("support.statusPending")}</Badge>;
      case "resolved":
        return <Badge variant="success">{t("support.statusResolved")}</Badge>;
    }
  };

  const getPriorityBadge = (priority: Ticket["priority"]) => {
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
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("support.aiAssistant")}</h3>
                <p className="text-sm text-muted-foreground">AI Assistant</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("support.liveChat")}</h3>
                <p className="text-sm text-muted-foreground">Live Chat</p>
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
                {tickets.filter((t) => t.status !== "resolved").length}
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
                          <Badge variant="outline">{cat.questions} {t("support.questions")}</Badge>
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
                {tickets.length === 0 ? (
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
                              {ticket.id}
                            </span>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                          </div>
                          <h4 className="font-medium text-foreground truncate">
                            {language === "ar" ? ticket.subjectAr : ticket.subject}
                          </h4>
                        </div>

                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">{ticket.date}</p>
                          <p className="text-xs text-muted-foreground/70">
                            {t("support.lastUpdate")}: {ticket.lastUpdate}
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
                  <Input placeholder={language === "ar" ? "أدخل موضوع التذكرة..." : "Enter ticket subject..."} />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.category")}</label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
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
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="low">{t("support.priorityLow")}</option>
                    <option value="medium">{t("support.priorityMedium")}</option>
                    <option value="high">{t("support.priorityHigh")}</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.details")}</label>
                  <Textarea placeholder={language === "ar" ? "اشرح مشكلتك بالتفصيل..." : "Describe your issue in detail..."} rows={5} />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t("support.attachments")}</label>
                  <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <p className="text-muted-foreground text-sm">{t("support.dragFiles")}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {t("support.fileTypes")}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setActiveTab("tickets")}>
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button className="bg-gradient-gold hover:opacity-90">
                    <Send className="w-4 h-4 mr-2" />
                    {t("support.submitTicket")}
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
