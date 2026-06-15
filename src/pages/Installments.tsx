import { useState } from "react";
import { 
  Calendar,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Building2,
  CreditCard,
  Download,
  Filter,
  Eye,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const installmentStats = {
  totalCommitment: 36000,
  totalPaid: 18000,
  remainingAmount: 18000,
  nextPaymentAmount: 1500,
  nextPaymentDate: "2025-01-15",
  activeProjects: 2,
  completedProjects: 1,
};

const installmentPlans = [
  {
    id: "1",
    property: "مساكن النخلة الفاخرة",
    propertyEn: "Palm Luxury Residences",
    propertyId: "2",
    location: "دبي، الإمارات",
    locationEn: "Dubai, UAE",
    totalAmount: 24000,
    downPayment: 6000,
    installmentAmount: 1500,
    totalInstallments: 12,
    paidInstallments: 6,
    remainingInstallments: 6,
    frequencyAr: "شهري",
    frequencyEn: "Monthly",
    nextDueDate: "2025-01-15",
    status: "active",
    progress: 65,
    completionDate: "2025-Q4",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400",
    payments: [
      { id: 1, amount: 6000, type: "down_payment", date: "2024-01-15", status: "paid" },
      { id: 2, amount: 1500, type: "installment", date: "2024-02-15", status: "paid" },
      { id: 3, amount: 1500, type: "installment", date: "2024-03-15", status: "paid" },
      { id: 4, amount: 1500, type: "installment", date: "2024-04-15", status: "paid" },
      { id: 5, amount: 1500, type: "installment", date: "2024-05-15", status: "paid" },
      { id: 6, amount: 1500, type: "installment", date: "2024-06-15", status: "paid" },
      { id: 7, amount: 1500, type: "installment", date: "2024-07-15", status: "paid" },
      { id: 8, amount: 1500, type: "installment", date: "2025-01-15", status: "pending" },
      { id: 9, amount: 1500, type: "installment", date: "2025-02-15", status: "upcoming" },
    ],
  },
  {
    id: "2",
    property: "مشروع الواحة السكني",
    propertyEn: "Oasis Residential Project",
    propertyId: "5",
    location: "جدة، السعودية",
    locationEn: "Jeddah, KSA",
    totalAmount: 12000,
    downPayment: 3000,
    installmentAmount: 1000,
    totalInstallments: 9,
    paidInstallments: 3,
    remainingInstallments: 6,
    frequencyAr: "شهري",
    frequencyEn: "Monthly",
    nextDueDate: "2025-01-20",
    status: "active",
    progress: 35,
    completionDate: "2026-Q2",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400",
    payments: [
      { id: 1, amount: 3000, type: "down_payment", date: "2024-09-20", status: "paid" },
      { id: 2, amount: 1000, type: "installment", date: "2024-10-20", status: "paid" },
      { id: 3, amount: 1000, type: "installment", date: "2024-11-20", status: "paid" },
      { id: 4, amount: 1000, type: "installment", date: "2024-12-20", status: "paid" },
      { id: 5, amount: 1000, type: "installment", date: "2025-01-20", status: "pending" },
      { id: 6, amount: 1000, type: "installment", date: "2025-02-20", status: "upcoming" },
    ],
  },
];

export default function Installments() {
  const { t, language } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<typeof installmentPlans[0] | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [filter, setFilter] = useState("all");

  const handlePayNow = (plan: typeof installmentPlans[0]) => {
    setSelectedPlan(plan);
    setShowPaymentDialog(true);
  };

  const confirmPayment = () => {
    setPaymentConfirmed(true);
    setTimeout(() => {
      setShowPaymentDialog(false);
      setPaymentConfirmed(false);
      setSelectedPlan(null);
    }, 2000);
  };

  const filteredPlans = installmentPlans.filter(p => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const upcomingPayments = installmentPlans
    .filter(p => p.status === "active")
    .map(p => ({
      ...p,
      nextPayment: p.payments.find(pay => pay.status === "pending"),
    }))
    .filter(p => p.nextPayment);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {t("installments.title")}
                </h1>
                <p className="text-muted-foreground">{t("installments.subtitle")}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  {t("installments.exportSchedule")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.totalCommitment")}</div>
              <div className="text-2xl font-bold text-foreground">${installmentStats.totalCommitment.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.paidAmount")}</div>
              <div className="text-2xl font-bold text-success">${installmentStats.totalPaid.toLocaleString()}</div>
              <Progress value={50} className="h-1.5 mt-2" />
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.remaining")}</div>
              <div className="text-2xl font-bold text-foreground">${installmentStats.remainingAmount.toLocaleString()}</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <Calendar className="w-6 h-6 text-primary-foreground" />
                </div>
                <Badge variant="warning">{t("installments.upcoming")}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.nextInstallment")}</div>
              <div className="text-2xl font-bold text-gradient-gold">${installmentStats.nextPaymentAmount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{installmentStats.nextPaymentDate}</div>
            </div>
          </div>

          {/* Upcoming Payments Alert */}
          {upcomingPayments.length > 0 && (
            <div className="mb-8 p-4 bg-warning/10 rounded-2xl border border-warning/20 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-warning" />
                  <div>
                    <h3 className="font-semibold text-foreground">{t("installments.duePayments")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {upcomingPayments.length} {t("installments.duePaymentsDesc")}
                    </p>
                  </div>
                </div>
                <Button variant="hero" onClick={() => handlePayNow(upcomingPayments[0])} className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  {t("installments.payNow")}
                </Button>
              </div>
            </div>
          )}

          {/* Installment Plans */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-foreground">{t("installments.plans")}</h2>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t("common.filter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("installments.all")}</SelectItem>
                  <SelectItem value="active">{t("installments.active")}</SelectItem>
                  <SelectItem value="completed">{t("installments.completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredPlans.map((plan, index) => {
              const pendingPayment = plan.payments.find(p => p.status === "pending");

              return (
                <div 
                  key={plan.id}
                  className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${(index + 3) * 0.05}s` }}
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Property Image */}
                    <div className="lg:w-64 h-48 lg:h-auto relative">
                      <img 
                        src={plan.image} 
                        alt={language === "ar" ? plan.property : plan.propertyEn}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      <div className="absolute bottom-4 right-4 left-4">
                        <Badge variant="construction" className="mb-2">{t("installments.underConstruction")}</Badge>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-gold rounded-full"
                              style={{ width: `${plan.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-foreground font-medium">{plan.progress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Plan Details */}
                    <div className="flex-1 p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                        <div>
                          <h3 className="font-display text-xl font-semibold text-foreground mb-1">
                            {language === "ar" ? plan.property : plan.propertyEn}
                          </h3>
                          <p className="text-sm text-muted-foreground">{language === "ar" ? plan.location : plan.locationEn}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t("installments.expectedDelivery")}: {plan.completionDate}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/property/${plan.propertyId}`}>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Eye className="w-4 h-4" />
                              {t("installments.propertyDetails")}
                            </Button>
                          </Link>
                        </div>
                      </div>

                      {/* Payment Progress */}
                      <div className="grid sm:grid-cols-4 gap-4 mb-6">
                        <div className="p-3 bg-muted rounded-xl">
                          <div className="text-xs text-muted-foreground mb-1">{t("installments.totalAmount")}</div>
                          <div className="font-bold text-foreground">${plan.totalAmount.toLocaleString()}</div>
                        </div>
                        <div className="p-3 bg-success/10 rounded-xl">
                          <div className="text-xs text-muted-foreground mb-1">{t("installments.paidLabel")}</div>
                          <div className="font-bold text-success">
                            ${(plan.downPayment + (plan.paidInstallments * plan.installmentAmount)).toLocaleString()}
                          </div>
                        </div>
                        <div className="p-3 bg-warning/10 rounded-xl">
                          <div className="text-xs text-muted-foreground mb-1">{t("installments.remainingLabel")}</div>
                          <div className="font-bold text-warning">
                            ${(plan.remainingInstallments * plan.installmentAmount).toLocaleString()}
                          </div>
                        </div>
                        <div className="p-3 bg-muted rounded-xl">
                          <div className="text-xs text-muted-foreground mb-1">{t("installments.installmentValue")}</div>
                          <div className="font-bold text-foreground">${plan.installmentAmount.toLocaleString()}/{language === "ar" ? plan.frequencyAr : plan.frequencyEn}</div>
                        </div>
                      </div>

                      {/* Installment Progress Bar */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">{t("installments.paymentProgress")}</span>
                          <span className="font-medium text-foreground">
                            {plan.paidInstallments} {t("installments.ofInstallments")} {plan.totalInstallments} {t("installments.installment")}
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                          {plan.payments.map((payment, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-full flex-1 border-l border-background first:border-l-0",
                                payment.status === "paid" ? "bg-success" :
                                payment.status === "pending" ? "bg-warning animate-pulse" :
                                "bg-muted-foreground/20"
                              )}
                              title={`${payment.type === "down_payment" ? t("installments.downPayment") : `${t("installments.installment")} ${i}`}: $${payment.amount}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Next Payment */}
                      {pendingPayment && (
                        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                              <Calendar className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{t("installments.nextInstallmentLabel")}</div>
                              <div className="text-sm text-muted-foreground">{pendingPayment.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xl font-bold text-foreground">${pendingPayment.amount.toLocaleString()}</div>
                            </div>
                            <Button variant="hero" onClick={() => handlePayNow(plan)} className="gap-2">
                              <CreditCard className="w-4 h-4" />
                              {t("installments.payNow")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{t("installments.payNow")}</DialogTitle>
              <DialogDescription>
                {language === "ar" ? selectedPlan?.property : selectedPlan?.propertyEn}
              </DialogDescription>
            </DialogHeader>

            {!paymentConfirmed ? (
              <div className="space-y-6">
                <div className="p-4 bg-muted rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">{t("installments.installmentValue")}</span>
                    <span className="font-bold">${selectedPlan?.installmentAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("installments.nextInstallmentLabel")}</span>
                    <span>{selectedPlan?.nextDueDate}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="flex-1">
                    {t("common.cancel")}
                  </Button>
                  <Button variant="hero" onClick={confirmPayment} className="flex-1 gap-2">
                    <CreditCard className="w-4 h-4" />
                    {t("installments.payNow")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{t("common.success")}</h3>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
