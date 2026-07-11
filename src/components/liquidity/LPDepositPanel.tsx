import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  Bitcoin,
  Building2,
  Smartphone,
  Coins,
  FileText,
  ChevronRight,
  ArrowLeft,
  Wallet,
} from "lucide-react";
import { DepositPayStep } from "@/components/wallet/DepositPayStep";
import { lpApi } from "@/integrations/api/client";
import type { LiquidityProvider } from "@/hooks/useLiquidityProvider";

// LP top-up panel. Same method list + honesty as the investor wallet deposit (only card +
// crypto have a real gated Stripe/NOW rail; the rest are kept but "Coming soon"). The key
// difference: target="lp" so the confirmed webhook credits the LP's OPERATING balance
// (LiquidityProvider.current_balance), not the internal wallet — and DepositPayStep polls
// the LP profile so the flow only completes once that credit actually lands.
const METHODS = [
  { id: "card", nameEn: "Credit/Debit Card", nameAr: "بطاقة ائتمان/خصم", icon: CreditCard, available: true },
  { id: "crypto", nameEn: "Cryptocurrency", nameAr: "عملات رقمية", icon: Bitcoin, available: true },
  { id: "bank", nameEn: "Bank Transfer", nameAr: "تحويل بنكي", icon: Building2, available: false },
  { id: "apple", nameEn: "Apple Pay", nameAr: "Apple Pay", icon: Smartphone, available: false },
  { id: "google", nameEn: "Google Pay", nameAr: "Google Pay", icon: Smartphone, available: false },
  { id: "pronova", nameEn: "Pronova Token", nameAr: "توكن Pronova", icon: Coins, available: false },
  { id: "sukuk", nameEn: "Nova Sukuk", nameAr: "Nova Sukuk", icon: FileText, available: false },
];

const PRESETS = [1000, 5000, 25000, 100000];

/** Poll source for the LP deposit — the LP profile's operating balance. */
const readLpBalance = async (): Promise<number> => {
  const p = await lpApi.profile();
  return Number(p?.current_balance) || 0;
};

interface LPDepositPanelProps {
  lpProfile: LiquidityProvider | null;
  isRTL: boolean;
  /** Called once a deposit is confirmed credited so the dashboard refetches the balance. */
  onDeposited: () => void;
}

export function LPDepositPanel({ lpProfile, isRTL, onDeposited }: LPDepositPanelProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const tr = (en: string, ar: string) => (isRTL ? ar : en);

  const reset = () => {
    setStep(1);
    setMethod(null);
    setAmount("");
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Balance summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold shrink-0">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {tr("Deposit Funds", "إيداع الأموال")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tr(
                  "Add funds to your Liquidity Provider balance so you can buy on the market.",
                  "أضف أموالاً إلى رصيد مزود السيولة لتتمكن من الشراء من السوق.",
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">
              {tr("Current balance", "الرصيد الحالي")}:
            </span>
            <span className="text-xl font-bold text-foreground" dir="ltr">
              ${Number(lpProfile?.current_balance ?? 0).toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Deposit flow */}
      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-3">
              <Label>{tr("Select a payment method", "اختر طريقة الدفع")}</Label>
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (!m.available) return;
                    setMethod(m.id);
                    setStep(2);
                  }}
                  disabled={!m.available}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    m.available
                      ? "border-border hover:border-primary/50 hover:bg-muted/50"
                      : "border-border/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <m.icon className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="font-medium text-foreground">{tr(m.nameEn, m.nameAr)}</span>
                  </div>
                  {m.available ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Badge variant="secondary">{tr("Coming soon", "قريباً")}</Badge>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="lp-deposit-amount">
                  {tr("Deposit amount (USD)", "مبلغ الإيداع (دولار)")}
                </Label>
                <Input
                  id="lp-deposit-amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-2xl font-bold h-14"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(String(p))}
                    className="flex-1 min-w-[72px]"
                  >
                    ${p.toLocaleString()}
                  </Button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {tr("Back", "رجوع")}
                </Button>
                <Button
                  variant="hero"
                  onClick={() => setStep(3)}
                  className="flex-1"
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  {tr("Continue", "متابعة")}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-xl flex justify-between">
                <span className="text-muted-foreground">{tr("Deposit amount", "مبلغ الإيداع")}</span>
                <span className="font-semibold" dir="ltr">
                  ${parseFloat(amount || "0").toLocaleString()}
                </span>
              </div>

              {/* REAL gated deposit that funds the LP balance. On the confirmed webhook/IPN
                  LiquidityProvider.current_balance is credited (+ an LP ledger row); we poll
                  the LP profile until it rises. With no provider keys this shows an honest
                  "not configured" panel — never a silent success. */}
              <DepositPayStep
                method={method === "crypto" ? "crypto" : "card"}
                amount={parseFloat(amount || "0")}
                target="lp"
                pollBalance={readLpBalance}
                onPaid={() => {
                  reset();
                  onDeposited();
                }}
              />

              <Button variant="outline" onClick={() => setStep(2)} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-1" />
                {tr("Back", "رجوع")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
