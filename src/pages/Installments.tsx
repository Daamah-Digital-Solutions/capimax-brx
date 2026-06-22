import {
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  Building2,
  CreditCard,
  Download,
  Filter,
  Eye,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useInstallmentPlans } from "@/hooks/useInstallmentPlans";
import type { InstallmentPlanRow } from "@/integrations/api/client";
import { InstallmentPayDialog } from "@/components/installments/InstallmentPayDialog";

// Installments — REAL per-investor plans + cent-exact schedules from
// GET /api/installments/plans/. Wave C: "Pay Now" charges the next due installment through
// the gated Stripe/NOW path; on confirmation the server progressively releases locked→
// released tokens. Enabled only on ACTIVE plans (the down-payment cleared via Checkout).

export default function Installments() {
  const { t, language } = useLanguage();
  const { data, loading, refresh } = useInstallmentPlans();
  const [filter, setFilter] = useState("all");
  const [payPlan, setPayPlan] = useState<InstallmentPlanRow | null>(null);

  const stats = data?.stats;
  const plans = data?.plans ?? [];

  const filteredPlans = plans.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  const freqLabel = (f: InstallmentPlanRow["frequency"]) =>
    f === "quarterly"
      ? language === "ar"
        ? "ربع سنوي"
        : "Quarterly"
      : language === "ar"
        ? "شهري"
        : "Monthly";

  // Paid value per plan from REAL row statuses (0 in Wave A — nothing is charged yet).
  const paidValue = (plan: InstallmentPlanRow) =>
    plan.payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

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
                {/* Export schedule = a later wave (no document service for plans yet). */}
                <Button variant="outline" className="gap-2" disabled title={language === "ar" ? "قريباً" : "Coming soon"}>
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
              <div className="text-2xl font-bold text-foreground">${(stats?.totalCommitment ?? 0).toLocaleString()}</div>
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.paidAmount")}</div>
              <div className="text-2xl font-bold text-success">${(stats?.totalPaid ?? 0).toLocaleString()}</div>
              <Progress
                value={stats && stats.totalCommitment > 0 ? (stats.totalPaid / stats.totalCommitment) * 100 : 0}
                className="h-1.5 mt-2"
              />
            </div>

            <div className="p-6 bg-card rounded-2xl border border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.remaining")}</div>
              <div className="text-2xl font-bold text-foreground">${(stats?.remainingAmount ?? 0).toLocaleString()}</div>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl border border-primary/30 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <Calendar className="w-6 h-6 text-primary-foreground" />
                </div>
                <Badge variant="warning">{t("installments.upcoming")}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-1">{t("installments.nextInstallment")}</div>
              <div className="text-2xl font-bold text-gradient-gold">${(stats?.nextPaymentAmount ?? 0).toLocaleString()}</div>
              {stats?.nextPaymentDate && (
                <div className="text-xs text-muted-foreground mt-1">{stats.nextPaymentDate}</div>
              )}
            </div>
          </div>

          {/* Loading / empty states */}
          {loading && plans.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
              {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded-2xl">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium">
                {language === "ar" ? "لا توجد خطط أقساط بعد." : "No installment plans yet."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "ar"
                  ? "ابدأ خطة أقساط من صفحة عقار قيد الإنشاء."
                  : "Start an installment plan from an under-construction property."}
              </p>
              <Link to="/marketplace?category=construction">
                <Button variant="outline" className="mt-4">{t("installments.plans")}</Button>
              </Link>
            </div>
          ) : (
            <>
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
                  const paid = paidValue(plan);
                  const remaining = plan.totalAmount - paid;
                  return (
                    <div
                      key={plan.id}
                      className="bg-card rounded-2xl border border-border overflow-hidden animate-fade-in"
                      style={{ animationDelay: `${(index + 3) * 0.05}s` }}
                    >
                      <div className="flex flex-col lg:flex-row">
                        {/* Property visual (no image in the plan payload — gradient placeholder) */}
                        <div className="lg:w-64 h-48 lg:h-auto relative bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-primary/40" />
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
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs capitalize">{plan.status}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {plan.durationMonths} {language === "ar" ? "شهر" : "months"} · {freqLabel(plan.frequency)}
                                </span>
                              </div>
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

                          {/* DEFAULTED (Wave D): honest forfeiture state — kept paid tokens,
                              forfeited unpaid tokens, voided remaining schedule. */}
                          {plan.defaultedAt ? (
                            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                              <div className="text-sm">
                                <span className="font-semibold text-foreground">
                                  {language === "ar" ? "تعثّرت الخطة" : "Plan defaulted"}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {language === "ar"
                                    ? `تحتفظ بـ ${plan.releasedTokens ?? 0} رمز مدفوع؛ تمت مصادرة ${plan.forfeitedTokens} رمز غير مدفوع. الأقساط المتبقية ملغاة.`
                                    : `you keep ${plan.releasedTokens ?? 0} paid token(s); ${plan.forfeitedTokens} unpaid token(s) forfeited. Remaining installments voided.`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* Token release split (full-mint-then-lock). Shown once the
                               down-payment has minted the position. Only the paid share is unlocked. */
                            plan.tokenAmount != null && (
                              <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-primary/5 border border-primary/20">
                                <Lock className="w-4 h-4 text-primary shrink-0" />
                                <div className="text-sm">
                                  <span className="font-semibold text-foreground">
                                    {plan.releasedTokens} {language === "ar" ? "من" : "of"} {plan.tokenAmount}
                                  </span>{" "}
                                  <span className="text-muted-foreground">
                                    {language === "ar"
                                      ? "رمز محرَّر — يُحرَّر الباقي مع سداد الأقساط."
                                      : "tokens released — the rest unlock as you pay."}
                                  </span>
                                </div>
                              </div>
                            )
                          )}

                          {/* Payment Progress */}
                          <div className="grid sm:grid-cols-4 gap-4 mb-6">
                            <div className="p-3 bg-muted rounded-xl">
                              <div className="text-xs text-muted-foreground mb-1">{t("installments.totalAmount")}</div>
                              <div className="font-bold text-foreground">${plan.totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="p-3 bg-success/10 rounded-xl">
                              <div className="text-xs text-muted-foreground mb-1">{t("installments.paidLabel")}</div>
                              <div className="font-bold text-success">${paid.toLocaleString()}</div>
                            </div>
                            <div className="p-3 bg-warning/10 rounded-xl">
                              <div className="text-xs text-muted-foreground mb-1">{t("installments.remainingLabel")}</div>
                              <div className="font-bold text-warning">${remaining.toLocaleString()}</div>
                            </div>
                            <div className="p-3 bg-muted rounded-xl">
                              <div className="text-xs text-muted-foreground mb-1">{t("installments.installmentValue")}</div>
                              <div className="font-bold text-foreground">${plan.installmentAmount.toLocaleString()}/{freqLabel(plan.frequency)}</div>
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
                                    payment.status === "missed" ? "bg-destructive" :
                                    "bg-muted-foreground/20"
                                  )}
                                  title={`${payment.type === "down_payment" ? t("installments.downPayment") : `${t("installments.installment")} ${i}`}: $${payment.amount}`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Next Payment — Pay Now disabled this wave */}
                          {plan.nextDueDate && (
                            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                                  <Calendar className="w-6 h-6 text-primary-foreground" />
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground">{t("installments.nextInstallmentLabel")}</div>
                                  <div className="text-sm text-muted-foreground">{plan.nextDueDate}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-xl font-bold text-foreground">${plan.installmentAmount.toLocaleString()}</div>
                                </div>
                                <Button
                                  variant="hero"
                                  className="gap-2"
                                  disabled={plan.status !== "active"}
                                  title={
                                    plan.status !== "active"
                                      ? language === "ar"
                                        ? "يُتاح بعد تأكيد الدفعة المقدمة"
                                        : "Available once the down-payment confirms"
                                      : undefined
                                  }
                                  onClick={() => setPayPlan(plan)}
                                >
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
            </>
          )}
        </div>
      </div>

      {payPlan && (
        <InstallmentPayDialog
          plan={payPlan}
          open={!!payPlan}
          onOpenChange={(o) => !o && setPayPlan(null)}
          onPaid={refresh}
        />
      )}
    </MainLayout>
  );
}
