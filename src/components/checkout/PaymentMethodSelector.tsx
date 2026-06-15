import { useState } from "react";
import { 
  CreditCard, 
  Smartphone, 
  Wallet, 
  Coins, 
  FileText,
  ChevronDown,
  ChevronUp,
  Percent,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentMethod } from "@/pages/Checkout";
import { cn } from "@/lib/utils";
import { CardPaymentForm } from "./methods/CardPaymentForm";
import { ApplePayButton } from "./methods/ApplePayButton";
import { GooglePayButton } from "./methods/GooglePayButton";
import { CryptoPayment } from "./methods/CryptoPayment";
import { PronovaPayment } from "./methods/PronovaPayment";
import { SukukPayment } from "./methods/SukukPayment";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelectMethod: (method: PaymentMethod) => void;
  totalAmount: number;
  pronovaDiscount: number;
}

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  totalAmount,
  pronovaDiscount,
}: PaymentMethodSelectorProps) {
  const { t, language, isRTL } = useLanguage();
  const [expandedMethod, setExpandedMethod] = useState<PaymentMethod | null>(null);

  const paymentMethods = [
    {
      id: "card" as PaymentMethod,
      name: t("payment.creditDebitCard"),
      icon: CreditCard,
      description: "Visa, Mastercard, Amex",
    },
    {
      id: "apple_pay" as PaymentMethod,
      name: "Apple Pay",
      icon: Smartphone,
      description: t("payment.fastPaymentApple"),
    },
    {
      id: "google_pay" as PaymentMethod,
      name: "Google Pay",
      icon: Wallet,
      description: t("payment.fastPaymentGoogle"),
    },
    {
      id: "crypto" as PaymentMethod,
      name: t("payment.crypto"),
      icon: Coins,
      description: "BTC, ETH, USDT, USDC",
    },
    {
      id: "pronova" as PaymentMethod,
      name: t("payment.pronova"),
      icon: Coins,
      description: language === "ar" ? "خصم 5% على جميع المدفوعات" : "5% discount on all payments",
      badge: language === "ar" ? "5% خصم" : "5% Off",
      highlight: true,
    },
    {
      id: "sukuk" as PaymentMethod,
      name: t("payment.sukuk"),
      icon: FileText,
      description: language === "ar" ? "أداة تمويل متوافقة مع الشريعة" : "Sharia-compliant financing",
      badge: t("payment.financing"),
    },
  ];

  const handleSelectMethod = (methodId: PaymentMethod) => {
    onSelectMethod(methodId);
    setExpandedMethod(methodId);
  };

  const renderMethodContent = (methodId: PaymentMethod) => {
    switch (methodId) {
      case "card":
        return <CardPaymentForm />;
      case "apple_pay":
        return <ApplePayButton />;
      case "google_pay":
        return <GooglePayButton />;
      case "crypto":
        return <CryptoPayment totalAmount={totalAmount} />;
      case "pronova":
        return <PronovaPayment totalAmount={totalAmount} discount={pronovaDiscount} />;
      case "sukuk":
        return <SukukPayment />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="font-display text-xl font-semibold text-foreground mb-4">
        {t("payment.selectMethod")}
      </h2>

      <div className="space-y-3">
        {paymentMethods.map((method) => {
          const isSelected = selectedMethod === method.id;
          const isExpanded = expandedMethod === method.id;
          const Icon = method.icon;

          return (
            <div
              key={method.id}
              className={cn(
                "rounded-2xl border transition-all duration-300",
                isSelected
                  ? "border-primary bg-card shadow-gold"
                  : "border-border bg-card hover:border-primary/50",
                method.highlight && !isSelected && "border-success/50 bg-success/5"
              )}
            >
              {/* Method Header */}
              <button
                className={cn(
                  "w-full p-4 flex items-center gap-4",
                  isRTL ? "text-right" : "text-left"
                )}
                onClick={() => handleSelectMethod(method.id)}
              >
                {/* Selection Indicator */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>

                {/* Icon */}
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-primary/20"
                      : method.highlight
                      ? "bg-success/20"
                      : "bg-muted"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-6 h-6",
                      isSelected
                        ? "text-primary"
                        : method.highlight
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{method.name}</h3>
                    {method.badge && (
                      <Badge
                        variant={method.highlight ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          method.highlight && "bg-success text-success-foreground"
                        )}
                      >
                        {method.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>

                {/* Expand Arrow */}
                {isSelected && (
                  <div className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                )}
              </button>

              {/* Expanded Content */}
              {isSelected && isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border mt-2">
                  <div className="pt-4">{renderMethodContent(method.id)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
