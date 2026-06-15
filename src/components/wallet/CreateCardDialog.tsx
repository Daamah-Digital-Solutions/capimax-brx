import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CreditCard, User, Users, Baby, Loader2, Sparkles, ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFamilyAccounts } from "@/hooks/useFamilyAccounts";
import { useVisaCards, type CardCategory } from "@/hooks/useVisaCards";
import { toast } from "sonner";

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roleLabel?: string;
  /** Pre-select a category (e.g. opening directly into "family" flow). */
  initialCategory?: CardCategory;
}

type Step = "category" | "details";

export function CreateCardDialog({ open, onOpenChange, roleLabel, initialCategory }: CreateCardDialogProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const { familyAccounts, isLoading: famLoading } = useFamilyAccounts();
  const { createCard } = useVisaCards(roleLabel);

  const [step, setStep] = useState<Step>(initialCategory ? "details" : "category");
  const [category, setCategory] = useState<CardCategory>(initialCategory ?? "personal");
  const [cardType, setCardType] = useState<"virtual" | "physical">("virtual");
  const [nickname, setNickname] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [spendingLimit, setSpendingLimit] = useState<string>("");
  const [familyAccountId, setFamilyAccountId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(initialCategory ? "details" : "category");
    setCategory(initialCategory ?? "personal");
    setCardType("virtual");
    setNickname("");
    setCardholderName("");
    setSpendingLimit("");
    setFamilyAccountId("");
    setBusy(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const eligibleMembers = useMemo(() => {
    if (category === "dependent") {
      // Dependents = child / son / daughter / minor type relationships
      const keywords = ["child", "son", "daughter", "dependent", "minor", "ابن", "ابنة", "طفل", "معال"];
      return familyAccounts.filter((m) =>
        keywords.some((k) => m.relationship.toLowerCase().includes(k.toLowerCase())),
      );
    }
    return familyAccounts;
  }, [familyAccounts, category]);

  const selectedMember = familyAccounts.find((m) => m.id === familyAccountId);

  const categoryOptions: Array<{
    value: CardCategory;
    icon: typeof User;
    title: string;
    desc: string;
    accent: string;
  }> = [
    {
      value: "personal", icon: User,
      title: t("Personal Card", "بطاقة شخصية"),
      desc: t("For your own spending from your wallet.", "للإنفاق الشخصي من محفظتك."),
      accent: "from-indigo-500 to-blue-600",
    },
    {
      value: "family", icon: Users,
      title: t("Family Investment Card", "بطاقة استثمار عائلي"),
      desc: t("Linked to a family member & their portfolio allocation.", "مرتبطة بأحد أفراد العائلة وحصته الاستثمارية."),
      accent: "from-emerald-500 to-teal-600",
    },
    {
      value: "dependent", icon: Baby,
      title: t("Dependent Card", "بطاقة معال"),
      desc: t("Issue a controlled card for a child or dependent.", "أصدر بطاقة بضوابط لطفل أو معال."),
      accent: "from-amber-500 to-orange-600",
    },
  ];

  const handleNext = (cat: CardCategory) => {
    setCategory(cat);
    setStep("details");
  };

  const handleSubmit = async () => {
    if ((category === "family" || category === "dependent") && !familyAccountId) {
      toast.error(t("Select a family member", "اختر فردًا من العائلة"));
      return;
    }
    setBusy(true);
    const limit = parseFloat(spendingLimit);
    const res = await createCard({
      cardType,
      category,
      nickname: nickname.trim() || undefined,
      familyAccountId: familyAccountId || undefined,
      relationship: selectedMember?.relationship,
      cardholderName: (cardholderName || selectedMember?.member_name || "").trim() || undefined,
      spendingLimit: !isNaN(limit) && limit > 0 ? limit : undefined,
    });
    setBusy(false);
    if (res) handleClose(false);
  };

  const needsMember = category === "family" || category === "dependent";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {step === "category"
              ? t("Issue a New Card", "إصدار بطاقة جديدة")
              : t("Card Details", "تفاصيل البطاقة")}
          </DialogTitle>
          <DialogDescription>
            {step === "category"
              ? t("Choose the type of card to add to your family wealth dashboard.",
                  "اختر نوع البطاقة لإضافتها إلى لوحة الثروة العائلية.")
              : t("Configure the card before issuing.", "اضبط البطاقة قبل الإصدار.")}
          </DialogDescription>
        </DialogHeader>

        {step === "category" ? (
          <div className="grid gap-3 py-2">
            {categoryOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleNext(opt.value)}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-start transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br ${opt.accent} flex items-center justify-center shadow-md`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{opt.title}</h4>
                        {opt.value === "family" && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Sparkles className="h-2.5 w-2.5 mr-1" />
                            {t("Wealth Office", "مكتب ثروات")}
                          </Badge>
                        )}
                        {opt.value === "dependent" && (
                          <Badge variant="outline" className="text-[10px]">
                            <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                            {t("Controlled", "مُتحكم بها")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                {categoryOptions.find((c) => c.value === category)?.title}
              </span>
              {!initialCategory && (
                <Button size="sm" variant="ghost" onClick={() => setStep("category")}>
                  {t("Change", "تغيير")}
                </Button>
              )}
            </div>

            {needsMember && (
              <div className="space-y-2">
                <Label>
                  {category === "dependent"
                    ? t("Select dependent", "اختر المعال")
                    : t("Select family member", "اختر فردًا من العائلة")}
                </Label>
                {famLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("Loading members…", "جارٍ تحميل الأفراد…")}
                  </div>
                ) : eligibleMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {category === "dependent"
                      ? t("No dependents linked yet. Add one in Family Investment first.",
                          "لا يوجد معالون مرتبطون. أضفهم أولًا من قسم استثمار العائلة.")
                      : t("No family members yet. Add one in Family Investment first.",
                          "لا يوجد أفراد عائلة بعد. أضفهم أولًا من قسم استثمار العائلة.")}
                  </div>
                ) : (
                  <Select value={familyAccountId} onValueChange={setFamilyAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Choose a person", "اختر شخصًا")} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-2">
                            <span>{m.member_name}</span>
                            <span className="text-xs text-muted-foreground">· {m.relationship}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedMember && (
                  <div className="text-xs text-muted-foreground">
                    {t("Allocation", "الحصة")}: {selectedMember.allocated_returns_percent}% ·{" "}
                    {t("Transferred", "المُحوّل")}: ${Number(selectedMember.total_transferred ?? 0).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("Card type", "نوع البطاقة")}</Label>
              <RadioGroup
                value={cardType}
                onValueChange={(v) => setCardType(v as "virtual" | "physical")}
                className="grid grid-cols-2 gap-2"
              >
                <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${cardType === "virtual" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="virtual" />
                  <div>
                    <p className="text-sm font-medium">{t("Virtual", "افتراضية")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("Instant", "فورية")}</p>
                  </div>
                </label>
                <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${cardType === "physical" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="physical" />
                  <div>
                    <p className="text-sm font-medium">{t("Physical", "فعلية")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("5-7 days", "5-7 أيام")}</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("Nickname / Label", "اسم مستعار")}</Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t("e.g., Tuition, Travel", "مثال: رسوم دراسية، سفر")}
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Cardholder name", "اسم حامل البطاقة")}</Label>
                <Input
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder={selectedMember?.member_name || t("As printed", "كما هو مطبوع")}
                  maxLength={60}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                {t("Monthly spending limit (USD)", "سقف الإنفاق الشهري (دولار)")}
              </Label>
              <Input
                type="number"
                min="0"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
                placeholder={category === "dependent" ? "500" : "5000"}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("Leave blank for default ($5,000).", "اتركه فارغًا للسقف الافتراضي ($5,000).")}
              </p>
            </div>
          </div>
        )}

        {step === "details" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Issue Card", "إصدار البطاقة")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
