import { useState } from "react";
import {
  Building2,
  Bitcoin,
  CreditCard,
  ArrowRight,
  Check,
  Shield,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useInvestorBankAccounts } from "@/hooks/useInvestorBankAccounts";
import { useInvestorCryptoWallets } from "@/hooks/useInvestorCryptoWallets";
import { useSavedCards } from "@/hooks/useSavedCards";
import { useWithdrawalRequests } from "@/hooks/useWithdrawalRequests";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
}

type WithdrawalMethod = "bank" | "crypto" | "card";
type WithdrawalStep = "method" | "amount" | "confirm" | "otp" | "success";

export function WithdrawalDialog({ open, onOpenChange, availableBalance }: WithdrawalDialogProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { accounts: bankAccounts } = useInvestorBankAccounts();
  const { wallets: cryptoWallets } = useInvestorCryptoWallets();
  const { cards } = useSavedCards();
  const { createRequest, sendOtp, verifyOtp } = useWithdrawalRequests();

  const [step, setStep] = useState<WithdrawalStep>("method");
  const [method, setMethod] = useState<WithdrawalMethod | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  const isAr = language === "ar";

  const reset = () => {
    setStep("method");
    setMethod(null);
    setSelectedMethodId(null);
    setAmount("");
    setOtp("");
    setCreatedRequestId(null);
    setReferenceNumber(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const getSelectedMethodDetails = () => {
    if (method === "bank" && selectedMethodId) {
      return bankAccounts.find(a => a.id === selectedMethodId);
    }
    if (method === "crypto" && selectedMethodId) {
      return cryptoWallets.find(w => w.id === selectedMethodId);
    }
    if (method === "card" && selectedMethodId) {
      return cards.find(c => c.id === selectedMethodId);
    }
    return null;
  };

  const handleSubmitRequest = async () => {
    if (!method || !amount || parseFloat(amount) <= 0) return;

    setIsSubmitting(true);
    try {
      const request = await createRequest({
        amount: parseFloat(amount),
        withdrawal_method: method,
        bank_account_id: method === "bank" ? selectedMethodId || undefined : undefined,
        crypto_wallet_id: method === "crypto" ? selectedMethodId || undefined : undefined,
        card_id: method === "card" ? selectedMethodId || undefined : undefined,
      });

      if (request) {
        setCreatedRequestId(request.id);
        setReferenceNumber(request.reference_number);
        await sendOtp(request.id);
        setStep("otp");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!createdRequestId || otp.length !== 6) return;

    setIsSubmitting(true);
    try {
      const success = await verifyOtp(createdRequestId, otp);
      if (success) {
        setStep("success");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const methods = [
    {
      id: "bank" as WithdrawalMethod,
      nameEn: "Bank Transfer",
      nameAr: "تحويل بنكي",
      descEn: "Withdraw to your bank account (1-3 business days)",
      descAr: "سحب إلى حسابك البنكي (1-3 أيام عمل)",
      icon: Building2,
      available: bankAccounts.length > 0,
      count: bankAccounts.length,
    },
    {
      id: "crypto" as WithdrawalMethod,
      nameEn: "Crypto Wallet",
      nameAr: "محفظة رقمية",
      descEn: "Withdraw to your crypto wallet (within 24 hours)",
      descAr: "سحب إلى محفظتك الرقمية (خلال 24 ساعة)",
      icon: Bitcoin,
      available: cryptoWallets.length > 0,
      count: cryptoWallets.length,
    },
    {
      id: "card" as WithdrawalMethod,
      nameEn: "Card Refund",
      nameAr: "استرداد للبطاقة",
      descEn: "Refund to your saved card (3-5 business days)",
      descAr: "استرداد إلى بطاقتك (3-5 أيام عمل)",
      icon: CreditCard,
      available: cards.length > 0,
      count: cards.length,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === "success" 
              ? (isAr ? "تم تقديم الطلب" : "Request Submitted")
              : (isAr ? "طلب سحب" : "Withdrawal Request")
            }
          </DialogTitle>
          <DialogDescription>
            {step === "method" && (isAr ? "اختر طريقة السحب" : "Select withdrawal method")}
            {step === "amount" && (isAr ? "أدخل مبلغ السحب" : "Enter withdrawal amount")}
            {step === "confirm" && (isAr ? "تأكيد تفاصيل السحب" : "Confirm withdrawal details")}
            {step === "otp" && (isAr ? "أدخل رمز التحقق" : "Enter verification code")}
            {step === "success" && (isAr ? "تم تقديم طلب السحب بنجاح" : "Your withdrawal request has been submitted")}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Method */}
        {step === "method" && (
          <div className="space-y-3">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMethod(m.id);
                  // Auto-select default if only one
                  if (m.id === "bank" && bankAccounts.length === 1) {
                    setSelectedMethodId(bankAccounts[0].id);
                  } else if (m.id === "crypto" && cryptoWallets.length === 1) {
                    setSelectedMethodId(cryptoWallets[0].id);
                  } else if (m.id === "card" && cards.length === 1) {
                    setSelectedMethodId(cards[0].id);
                  }
                  setStep("amount");
                }}
                disabled={!m.available}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                  m.available
                    ? "border-border hover:border-primary/50 hover:bg-muted/50"
                    : "border-border/50 opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <m.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">
                      {isAr ? m.nameAr : m.nameEn}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isAr ? m.descAr : m.descEn}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.count > 0 && (
                    <Badge variant="outline">{m.count}</Badge>
                  )}
                  {!m.available && (
                    <Badge variant="secondary">
                      {isAr ? "غير متاح" : "Not set up"}
                    </Badge>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}

            {bankAccounts.length === 0 && cryptoWallets.length === 0 && cards.length === 0 && (
              <div className="p-4 bg-warning/10 rounded-xl border border-warning/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">
                      {isAr ? "لا توجد طرق سحب" : "No Withdrawal Methods"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isAr 
                        ? "يرجى إضافة حساب بنكي أو محفظة رقمية أو بطاقة أولاً"
                        : "Please add a bank account, crypto wallet, or card first"
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Enter Amount & Select Account */}
        {step === "amount" && method && (
          <div className="space-y-6">
            {/* Select specific account/wallet/card */}
            {method === "bank" && bankAccounts.length > 1 && (
              <div className="space-y-2">
                <Label>{isAr ? "اختر الحساب البنكي" : "Select Bank Account"}</Label>
                <div className="space-y-2">
                  {bankAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedMethodId(account.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                        selectedMethodId === account.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="text-sm text-left">
                        <div className="font-medium">{account.bank_name}</div>
                        <div className="text-muted-foreground">{account.account_number_masked}</div>
                      </div>
                      {selectedMethodId === account.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "crypto" && cryptoWallets.length > 1 && (
              <div className="space-y-2">
                <Label>{isAr ? "اختر المحفظة" : "Select Wallet"}</Label>
                <div className="space-y-2">
                  {cryptoWallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => setSelectedMethodId(wallet.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                        selectedMethodId === wallet.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="text-sm text-left">
                        <div className="font-medium">{wallet.wallet_label || wallet.network}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                        </div>
                      </div>
                      {selectedMethodId === wallet.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "card" && cards.length > 1 && (
              <div className="space-y-2">
                <Label>{isAr ? "اختر البطاقة" : "Select Card"}</Label>
                <div className="space-y-2">
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedMethodId(card.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                        selectedMethodId === card.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="text-sm text-left">
                        <div className="font-medium capitalize">{card.card_brand} •••• {card.card_last_four}</div>
                        <div className="text-muted-foreground">{card.cardholder_name}</div>
                      </div>
                      {selectedMethodId === card.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{isAr ? "مبلغ السحب" : "Withdrawal Amount"}</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-bold h-14"
              />
            </div>

            <div className="flex gap-2">
              {[1000, 2500, 5000].map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(Math.min(preset, availableBalance).toString())}
                  className="flex-1"
                >
                  ${preset.toLocaleString()}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount(availableBalance.toString())}
                className="flex-1"
              >
                {isAr ? "الكل" : "Max"}
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-xl">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">{isAr ? "الرصيد المتاح" : "Available Balance"}</span>
                <span className="font-semibold">${availableBalance.toLocaleString()}</span>
              </div>
              {parseFloat(amount) > availableBalance && (
                <div className="text-destructive text-sm">
                  {isAr ? "المبلغ أكبر من الرصيد المتاح" : "Amount exceeds available balance"}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("method")} className="flex-1">
                {isAr ? "رجوع" : "Back"}
              </Button>
              <Button
                variant="hero"
                onClick={() => setStep("confirm")}
                className="flex-1"
                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance}
              >
                {isAr ? "التالي" : "Next"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && method && (
          <div className="space-y-6">
            <div className="p-4 bg-muted rounded-xl space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? "طريقة السحب" : "Withdrawal Method"}</span>
                <span className="font-medium capitalize">
                  {method === "bank" && (isAr ? "تحويل بنكي" : "Bank Transfer")}
                  {method === "crypto" && (isAr ? "محفظة رقمية" : "Crypto Wallet")}
                  {method === "card" && (isAr ? "استرداد للبطاقة" : "Card Refund")}
                </span>
              </div>
              {selectedMethodId && getSelectedMethodDetails() && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isAr ? "الوجهة" : "Destination"}</span>
                  <span className="font-medium">
                    {method === "bank" && (getSelectedMethodDetails() as typeof bankAccounts[0])?.bank_name}
                    {method === "crypto" && ((getSelectedMethodDetails() as typeof cryptoWallets[0])?.wallet_label || (getSelectedMethodDetails() as typeof cryptoWallets[0])?.network)}
                    {method === "card" && `•••• ${(getSelectedMethodDetails() as typeof cards[0])?.card_last_four}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{isAr ? "المبلغ" : "Amount"}</span>
                <span className="font-semibold text-lg">${parseFloat(amount).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-warning/10 rounded-xl border border-warning/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-warning mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-foreground">
                    {isAr ? "التحقق الأمني" : "Security Verification"}
                  </div>
                  <div className="text-muted-foreground">
                    {isAr 
                      ? "سيتم إرسال رمز تحقق إلى بريدك الإلكتروني لتأكيد هذا السحب"
                      : "A verification code will be sent to your email to confirm this withdrawal"
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("amount")} className="flex-1">
                {isAr ? "رجوع" : "Back"}
              </Button>
              <Button
                variant="hero"
                onClick={handleSubmitRequest}
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isAr ? "جاري الإرسال..." : "Submitting..."}
                  </>
                ) : (
                  isAr ? "تأكيد وإرسال الرمز" : "Confirm & Send Code"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: OTP Verification */}
        {step === "otp" && (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground">
                {isAr 
                  ? "أدخل الرمز المكون من 6 أرقام المرسل إلى بريدك الإلكتروني"
                  : "Enter the 6-digit code sent to your email"
                }
              </p>
            </div>

            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                <X className="w-4 h-4 mr-1" />
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="hero"
                onClick={handleVerifyOtp}
                className="flex-1"
                disabled={otp.length !== 6 || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isAr ? "جاري التحقق..." : "Verifying..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    {isAr ? "تأكيد" : "Verify"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === "success" && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {isAr ? "تم تقديم طلب السحب" : "Withdrawal Request Submitted"}
              </h3>
              <p className="text-muted-foreground">
                {isAr 
                  ? "سيتم معالجة طلبك خلال 1-3 أيام عمل"
                  : "Your request will be processed within 1-3 business days"
                }
              </p>
            </div>
            {referenceNumber && (
              <div className="p-4 bg-muted rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">
                  {isAr ? "رقم المرجع" : "Reference Number"}
                </div>
                <div className="font-mono font-semibold">{referenceNumber}</div>
              </div>
            )}
            <Button variant="hero" onClick={handleClose} className="w-full">
              {isAr ? "تم" : "Done"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
