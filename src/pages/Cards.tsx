import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Sparkles, ShieldCheck, Globe, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { VisaCardsSection } from "@/components/wallet/VisaCardsSection";
import { CreateVirtualCardButton } from "@/components/wallet/CreateVirtualCardButton";
import cardSample from "@/assets/capimax-card-sample.png";

export default function Cards() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const features = [
    { icon: Zap, en: "Instant virtual card", ar: "بطاقة افتراضية فورية" },
    { icon: Globe, en: "Global Visa acceptance", ar: "قبول فيزا عالمي" },
    { icon: ShieldCheck, en: "Freeze & limits", ar: "تجميد وحدود" },
    { icon: Sparkles, en: "Pay from wallet", ar: "ادفع من المحفظة" },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/50">
          <div className="container py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center shadow-gold">
                  <CreditCard className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    {t("Capimax BRX Cards", "بطاقات كابيماكس BRX")}
                  </h1>
                  <p className="text-muted-foreground">
                    {t(
                      "Order, manage, and pay with your virtual & physical Visa cards",
                      "اطلب، أدر، وادفع ببطاقاتك فيزا الافتراضية والفعلية"
                    )}
                  </p>
                </div>
              </div>
              <CreateVirtualCardButton roleLabel="Cardholder" />
            </div>
          </div>
        </div>

        <div className="container py-8 space-y-8">
          {/* Sample card showcase */}
          <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/20">
            <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t("Sample Card", "بطاقة نموذجية")}
                </Badge>
                <h2 className="font-display text-3xl font-bold">
                  {t("The Capimax BRX Visa", "فيزا كابيماكس BRX")}
                </h2>
                <p className="text-muted-foreground">
                  {t(
                    "A premium institutional-grade card linked directly to your investment wallet. Spend yields globally — without bank withdrawals.",
                    "بطاقة مؤسسية فاخرة مرتبطة مباشرة بمحفظة استثماراتك. اصرف عوائدك حول العالم دون السحب البنكي."
                  )}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <f.icon className="w-4 h-4 text-primary" />
                      </div>
                      <span>{isAr ? f.ar : f.en}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center md:justify-end">
                <img
                  src={cardSample}
                  alt={t("Capimax BRX Visa Card sample", "بطاقة فيزا كابيماكس BRX نموذجية")}
                  loading="lazy"
                  width={1536}
                  height={1024}
                  className="w-full max-w-md drop-shadow-2xl rounded-2xl transform hover:-rotate-1 hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Visa cards + transactions */}
          <VisaCardsSection roleLabel={{ en: "Cardholder", ar: "حامل البطاقة" }} />

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t("How it works", "كيف يعمل")}
              </CardTitle>
              <CardDescription>
                {t(
                  "Three steps to start spending from your wallet anywhere Visa is accepted.",
                  "ثلاث خطوات لبدء الإنفاق من محفظتك في أي مكان يقبل فيزا."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              {[
                { step: 1, en: "Create a virtual card instantly or order a physical one (5-7 days).",
                  ar: "أنشئ بطاقة افتراضية فورًا أو اطلب فعلية (5-7 أيام)." },
                { step: 2, en: "Top up your wallet from rentals, distributions, or deposits.",
                  ar: "اشحن محفظتك من الإيجارات أو التوزيعات أو الإيداعات." },
                { step: 3, en: "Pay merchants worldwide — debited live from your wallet ledger.",
                  ar: "ادفع للتجار حول العالم — يُخصم لحظيًا من محفظتك." },
              ].map((s) => (
                <div key={s.step} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-2">
                    {s.step}
                  </div>
                  <p className="text-sm">{isAr ? s.ar : s.en}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
