import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Calendar,
  Clock,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Building2,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface InstallmentPlan {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyNameEn: string;
  propertyImage: string;
  totalAmount: number;
  downPayment: number;
  paidAmount: number;
  remainingAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDueDate: string;
  nextDueAmount: number;
  status: "active" | "completed" | "overdue";
  constructionProgress: number;
}

interface PortfolioInstallmentsProps {
  installments: InstallmentPlan[];
  onPayNow: (plan: InstallmentPlan) => void;
}

export function PortfolioInstallments({ installments, onPayNow }: PortfolioInstallmentsProps) {
  const { t, language } = useLanguage();

  if (installments.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("portfolio.noInstallments")}
        </h3>
        <p className="text-muted-foreground mb-6">
          {t("portfolio.noInstallmentsDesc")}
        </p>
        <Link to="/marketplace">
          <Button variant="hero">{t("portfolio.exploreOpportunities")}</Button>
        </Link>
      </div>
    );
  }

  // Find upcoming payments
  const upcomingPayment = installments
    .filter(i => i.status === "active")
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Upcoming Payment Alert */}
      {upcomingPayment && (
        <div className="p-4 bg-warning/10 rounded-2xl border border-warning/20 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-warning/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t("portfolio.upcomingPayment")}</h3>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? upcomingPayment.propertyName : upcomingPayment.propertyNameEn} • {upcomingPayment.nextDueDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xl font-bold text-foreground">${upcomingPayment.nextDueAmount.toLocaleString()}</div>
              </div>
              <Button variant="hero" onClick={() => onPayNow(upcomingPayment)} className="gap-2">
                <CreditCard className="w-4 h-4" />
                {t("installments.payNow")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Installment Plans */}
      <div className="space-y-4">
        {installments.map((plan, index) => (
          <div 
            key={plan.id}
            className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex flex-col lg:flex-row">
              {/* Property Image */}
              <div className="lg:w-48 h-32 lg:h-auto relative">
                <img 
                  src={plan.propertyImage} 
                  alt={language === "ar" ? plan.propertyName : plan.propertyNameEn}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <Badge variant="construction" className="text-xs mb-1">{t("portfolio.underConstruction")}</Badge>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-gold rounded-full"
                        style={{ width: `${plan.constructionProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-foreground font-medium">{plan.constructionProgress}%</span>
                  </div>
                </div>
              </div>

              {/* Plan Details */}
              <div className="flex-1 p-4 lg:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {language === "ar" ? plan.propertyName : plan.propertyNameEn}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? plan.propertyNameEn : plan.propertyName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.status === "active" && (
                      <Badge variant="success" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {t("portfolio.active")}
                      </Badge>
                    )}
                    {plan.status === "completed" && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("installments.completed")}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-2 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">{t("installments.totalAmount")}</div>
                    <div className="font-semibold text-foreground">${plan.totalAmount.toLocaleString()}</div>
                  </div>
                  <div className="p-2 bg-success/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">{t("installments.paidLabel")}</div>
                    <div className="font-semibold text-success">${plan.paidAmount.toLocaleString()}</div>
                  </div>
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">{t("installments.remainingLabel")}</div>
                    <div className="font-semibold text-warning">${plan.remainingAmount.toLocaleString()}</div>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">{t("installments.installmentValue")}</div>
                    <div className="font-semibold text-foreground">${plan.installmentAmount.toLocaleString()}</div>
                  </div>
                </div>

                {/* Payment Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{t("installments.paymentProgress")}</span>
                    <span className="font-medium text-foreground">
                      {plan.paidInstallments} / {plan.totalInstallments} {t("installments.installment")}
                    </span>
                  </div>
                  <Progress 
                    value={(plan.paidInstallments / plan.totalInstallments) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Actions */}
                {plan.status === "active" && (
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-gold rounded-lg flex items-center justify-center shadow-gold">
                        <Calendar className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground text-sm">{t("installments.nextInstallmentLabel")}</div>
                        <div className="text-xs text-muted-foreground">{plan.nextDueDate}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-foreground">${plan.nextDueAmount.toLocaleString()}</div>
                      </div>
                      <Button variant="hero" size="sm" onClick={() => onPayNow(plan)} className="gap-1">
                        <CreditCard className="w-4 h-4" />
                        {t("installments.payNow")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All Link */}
      <div className="text-center">
        <Link to="/installments">
          <Button variant="outline" className="gap-2">
            {t("dashboard.viewAll")}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
