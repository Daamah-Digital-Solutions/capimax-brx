import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  CreditCard, Plus, ShoppingBag, Plane, Coffee, Fuel, Globe,
  ShieldCheck, Zap, Eye, EyeOff, Snowflake, ArrowDownToLine,
  ArrowUpFromLine, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVisaCards, type VisaCard } from "@/hooks/useVisaCards";
import { CreateCardDialog } from "@/components/wallet/CreateCardDialog";
import { BackendPendingNotice } from "@/components/wallet/BackendPendingNotice";
import { Users, Baby, User as UserIcon } from "lucide-react";

interface VisaCardsSectionProps {
  walletBalance?: number; // legacy, ignored when wallet has real balance
  roleLabel?: { en: string; ar: string };
}

export function VisaCardsSection({ roleLabel }: VisaCardsSectionProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const {
    loading, cards, transactions, balance,
    createCard, setCardStatus, payWithCard, topUp,
  } = useVisaCards(roleLabel?.en);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpenFor, setPayOpenFor] = useState<VisaCard | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMerchant, setPayMerchant] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat(isAr ? "ar-SA" : "en-US", {
      style: "currency", currency: balance?.currency || "USD", maximumFractionDigits: 0,
    }).format(n);

  // Card creation now handled by CreateCardDialog
  const handleToggleFreeze = async (c: VisaCard) => {
    setBusy(c.id);
    await setCardStatus(c.id, c.status === "frozen" ? "active" : "frozen");
    setBusy(null);
  };
  const handlePay = async () => {
    if (!payOpenFor) return;
    const amt = parseFloat(payAmount);
    if (!amt || !payMerchant.trim()) return;
    setBusy(payOpenFor.id);
    const res = await payWithCard(payOpenFor.id, amt, payMerchant.trim());
    setBusy(null);
    if (res) { setPayOpenFor(null); setPayAmount(""); setPayMerchant(""); }
  };
  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (!amt) return;
    setBusy("topup");
    const ok = await topUp(amt);
    setBusy(null);
    if (ok) { setTopUpOpen(false); setTopUpAmount(""); }
  };

  const benefits = [
    { icon: Zap, title: t("Spend directly from your wallet", "اصرف مباشرة من محفظتك"),
      desc: t("Pay anywhere Visa is accepted using your wallet balance — no bank withdrawal needed.", "ادفع في أي مكان يقبل فيزا من رصيد محفظتك دون السحب البنكي.") },
    { icon: Globe, title: t("Use it worldwide", "استخدمها حول العالم"),
      desc: t("Accepted in 200+ countries online and in-store.", "مقبولة في أكثر من 200 دولة عبر الإنترنت والمتاجر.") },
    { icon: ShoppingBag, title: t("Shop, dine & travel", "تسوق، تناول الطعام، سافر"),
      desc: t("Buy products, book flights, fuel up, pay for coffee — directly from wallet.", "اشترِ، احجز رحلات، تزود بالوقود، ادفع للقهوة — مباشرة من المحفظة.") },
    { icon: ShieldCheck, title: t("Secure & controllable", "آمنة وقابلة للتحكم"),
      desc: t("Freeze instantly, set spending limits, real-time transactions.", "جمّد فوراً، حدد سقف الإنفاق، معاملات لحظية.") },
  ];
  const useCases = [
    { icon: ShoppingBag, label: t("Shopping", "تسوق") },
    { icon: Coffee, label: t("Cafés & Dining", "المقاهي والمطاعم") },
    { icon: Fuel, label: t("Fuel", "وقود") },
    { icon: Plane, label: t("Travel", "السفر") },
  ];

  return (
    <>
      <BackendPendingNotice />
      <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("Visa Cards", "بطاقات فيزا")}</CardTitle>
              <CardDescription>
                {t("Spend your wallet balance anywhere — no bank withdrawal needed",
                   "اصرف رصيد محفظتك في أي مكان — دون الحاجة للسحب إلى البنك")}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {roleLabel && <Badge variant="outline">{isAr ? roleLabel.ar : roleLabel.en}</Badge>}
            <div className="px-3 py-1.5 rounded-md bg-muted text-sm">
              <span className="text-muted-foreground mr-1">{t("Wallet:", "المحفظة:")}</span>
              <span className="font-semibold">{fmt(balance?.available_balance ?? 0)}</span>
            </div>
            <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  {t("Top up", "إيداع")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Top up wallet", "إيداع في المحفظة")}</DialogTitle>
                  <DialogDescription>
                    {t("Add funds to spend with your Visa cards.", "أضف أموالًا لاستخدامها مع بطاقات فيزا.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>{t("Amount (USD)", "المبلغ (دولار)")}</Label>
                  <Input type="number" min="1" value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)} placeholder="500" />
                </div>
                <DialogFooter>
                  <Button onClick={handleTopUp} disabled={busy === "topup"}>
                    {busy === "topup" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("Confirm", "تأكيد")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Issue card buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button variant="outline" className="h-auto py-4 flex-col items-start gap-2"
            onClick={() => setCreateOpen(true)}>
            <div className="flex items-center gap-2 w-full">
              <UserIcon className="h-4 w-4" />
              <span className="font-semibold">{t("Personal Card", "بطاقة شخصية")}</span>
            </div>
            <span className="text-xs text-muted-foreground text-start">
              {t("Issue a card linked to your wallet.", "أصدر بطاقة مرتبطة بمحفظتك.")}
            </span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start gap-2"
            onClick={() => setCreateOpen(true)}>
            <div className="flex items-center gap-2 w-full">
              <Users className="h-4 w-4" />
              <span className="font-semibold">{t("Family Investment Card", "بطاقة استثمار عائلي")}</span>
            </div>
            <span className="text-xs text-muted-foreground text-start">
              {t("Linked to a family member's allocation.", "مرتبطة بحصة فرد من العائلة.")}
            </span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col items-start gap-2"
            onClick={() => setCreateOpen(true)}>
            <div className="flex items-center gap-2 w-full">
              <Baby className="h-4 w-4" />
              <span className="font-semibold">{t("Dependent Card", "بطاقة معال")}</span>
            </div>
            <span className="text-xs text-muted-foreground text-start">
              {t("Controlled card for a child or dependent.", "بطاقة بضوابط لطفل أو معال.")}
            </span>
          </Button>
        </div>

        {/* Cards list */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 mx-auto animate-spin" />
          </div>
        ) : cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((c) => {
              const isVirtual = c.card_type === "virtual";
              const isFrozen = c.status === "frozen";
              const isRevealed = revealed[c.id];
              const remaining = Math.max(0, c.spending_limit - c.spent_this_month);
              const isFamily = c.card_category === "family";
              const isDependent = c.card_category === "dependent";
              const gradient = isDependent
                ? "bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700"
                : isFamily
                ? "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700"
                : isVirtual
                ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700"
                : "bg-gradient-to-br from-slate-800 via-slate-900 to-black";
              const CategoryIcon = isDependent ? Baby : isFamily ? Users : UserIcon;
              return (
                <div key={c.id}
                  className={`relative overflow-hidden rounded-xl p-5 text-white shadow-lg transition-all ${gradient} ${isFrozen ? "opacity-60" : ""}`}>
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px] backdrop-blur gap-1">
                      <CategoryIcon className="h-2.5 w-2.5" />
                      {isDependent ? t("DEPENDENT", "معال")
                        : isFamily ? t("FAMILY", "عائلة")
                        : isVirtual ? t("VIRTUAL", "افتراضية") : t("PHYSICAL", "فعلية")}
                    </Badge>
                  </div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <span className="text-xs uppercase tracking-widest opacity-80 block">
                        {t("Capimax Visa", "كابيماكس فيزا")}
                      </span>
                      {(c.nickname || c.cardholder_name || c.relationship) && (
                        <div className="mt-1">
                          {c.nickname && (
                            <p className="text-sm font-semibold leading-tight">{c.nickname}</p>
                          )}
                          {c.cardholder_name && (
                            <p className="text-[11px] opacity-80">{c.cardholder_name}</p>
                          )}
                          {c.relationship && (
                            <p className="text-[10px] opacity-60 italic">{c.relationship}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-lg tracking-wider mb-4">
                    {isRevealed ? c.card_number_masked.replace(/•/g, "0") : c.card_number_masked}
                  </p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase opacity-70">{t("Wallet Balance", "رصيد المحفظة")}</p>
                      <p className="font-semibold text-base">{fmt(balance?.available_balance ?? 0)}</p>
                      <p className="text-[10px] opacity-70 mt-1">
                        {t("Limit left", "المتبقي من الحد")}: {fmt(remaining)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="italic font-bold text-2xl">VISA</span>
                      <p className="text-[10px] opacity-70 mt-1">
                        {String(c.expiry_month).padStart(2, "0")}/{String(c.expiry_year).slice(-2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="secondary"
                      className="h-7 text-xs bg-white/15 hover:bg-white/25 text-white border-0"
                      onClick={() => setRevealed((p) => ({ ...p, [c.id]: !p[c.id] }))}>
                      {isRevealed ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      {isRevealed ? t("Hide", "إخفاء") : t("Reveal", "إظهار")}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy === c.id}
                      className="h-7 text-xs bg-white/15 hover:bg-white/25 text-white border-0"
                      onClick={() => handleToggleFreeze(c)}>
                      <Snowflake className="h-3 w-3 mr-1" />
                      {isFrozen ? t("Unfreeze", "إعادة تفعيل") : t("Freeze", "تجميد")}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={isFrozen || c.status !== "active"}
                      className="h-7 text-xs bg-white/15 hover:bg-white/25 text-white border-0"
                      onClick={() => setPayOpenFor(c)}>
                      <ArrowUpFromLine className="h-3 w-3 mr-1" />
                      {t("Pay", "ادفع")}
                    </Button>
                  </div>
                  {c.status === "pending" && (
                    <Badge className="absolute bottom-3 right-3 bg-amber-500/30 text-amber-100 border-amber-300/40 text-[10px]">
                      {t("Shipping", "قيد الشحن")}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("No cards yet. Create a virtual card instantly or order a physical one.",
                 "لا توجد بطاقات بعد. أنشئ بطاقة افتراضية فورًا أو اطلب بطاقة فعلية.")}
            </p>
          </div>
        )}

        {/* Recent card transactions */}
        {transactions.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
              {t("Card Transactions", "معاملات البطاقة")}
            </h4>
            <div className="space-y-2">
              {transactions.slice(0, 6).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {tx.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : tx.status === "declined" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{tx.merchant || t("Card payment", "دفع ببطاقة")}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString(isAr ? "ar-SA" : "en-US")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${tx.tx_type === "topup" ? "text-green-500" : ""}`}>
                      {tx.tx_type === "topup" ? "+" : "-"}{fmt(Number(tx.amount))}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Benefits */}
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
            {t("Card Benefits", "مزايا البطاقة")}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="p-2 bg-primary/10 rounded-lg h-fit">
                  <b.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Use cases */}
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide text-muted-foreground">
            {t("Use it in everyday life", "استخدمها في الحياة اليومية")}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {useCases.map((u, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30">
                <u.icon className="h-5 w-5 text-primary" />
                <span className="text-xs text-center">{u.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Pay dialog */}
      <Dialog open={!!payOpenFor} onOpenChange={(o) => !o && setPayOpenFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Pay with card", "ادفع بالبطاقة")} •••• {payOpenFor?.card_last_four}
            </DialogTitle>
            <DialogDescription>
              {t("Funds are debited directly from your wallet balance.",
                 "يتم خصم المبلغ مباشرة من رصيد محفظتك.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("Merchant", "التاجر")}</Label>
              <Input value={payMerchant} onChange={(e) => setPayMerchant(e.target.value)}
                placeholder={t("e.g., Amazon, Uber, Starbucks", "مثال: أمازون، أوبر، ستاربكس")} />
            </div>
            <div>
              <Label>{t("Amount", "المبلغ")} (USD)</Label>
              <Input type="number" min="1" value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)} placeholder="50" />
            </div>
            <div className="text-xs text-muted-foreground">
              {t("Available", "المتاح")}: {fmt(balance?.available_balance ?? 0)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpenFor(null)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={handlePay} disabled={busy === payOpenFor?.id || !payAmount || !payMerchant}>
              {busy === payOpenFor?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Confirm payment", "تأكيد الدفع")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roleLabel={roleLabel?.en}
      />
    </Card>
    </>
  );
}
